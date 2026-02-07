import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import { openDb, migrate, resolveDbPath } from './db/sqlite.js';
import {
  hydrateMovie,
  hydratePerson,
  searchLocal,
  upsertMovieFromTmdb,
  upsertRatingsFromOmdb,
  replaceSongsFromYoutube,
  replaceSongsForMovie,
  clearSongsForMovie,
  updatePersonWiki
} from './db/repository.js';
import {
  defaultIndianLanguageCodes,
  tmdbDiscoverMovies,
  tmdbGetMovieFull,
  tmdbGetPersonFull,
  tmdbSearchMovie,
  tmdbSearchPerson
} from './providers/tmdb.js';
import { youtubeSearchCached } from './providers/youtube.js';
import {
  wikipediaSearch,
  wikipediaSearchTitle,
  wikipediaLeadByTitle,
  wikipediaSoundtrackTracksByTitle,
  wikipediaSummaryByTitle
} from './providers/wikipedia.js';
import { itunesFindSoundtrackForMovie } from './providers/itunes.js';
import { motnGetDeepLinksForTmdbMovie } from './providers/motn.js';
import { hashId, INDIAN_LANGUAGES_LOWER, makeId, normalizeForSearch, nowIso, soundex, statusFrom, toIsoDate } from './repo.js';
import { omdbByTitle } from './providers/omdb.js';
import {
  clearSessionCookie,
  createPasswordHash,
  createPasswordReset,
  createSession,
  deleteSession,
  getSessionId,
  getUserBySession,
  normalizeEmail,
  requireUser,
  setSessionCookie,
  scryptHash,
  timingSafeEqual,
  verifyCaptcha,
  consumePasswordReset
} from './auth.js';

const PORT = Number(process.env.PORT || 8787);
const app = express();
app.use(express.json({ limit: '1mb' }));
// Minimal cookie parser (avoid extra deps).
app.use((req, _res, next) => {
  const header = String(req.headers.cookie || '');
  const out = {};
  for (const part of header.split(';')) {
    const p = part.trim();
    if (!p) continue;
    const eq = p.indexOf('=');
    if (eq <= 0) continue;
    const k = p.slice(0, eq).trim();
    const v = p.slice(eq + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  req.cookies = out;
  next();
});

function loadEnvFileIfPresent(filename) {
  try {
    const full = path.join(process.cwd(), filename);
    if (!fs.existsSync(full)) return;
    const content = fs.readFileSync(full, 'utf-8');
    for (const rawLine of content.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

// If you're using a plain `env` file locally, support it in addition to `.env`.
loadEnvFileIfPresent('env');
loadEnvFileIfPresent('.env');

const db = openDb();
migrate(db);

function metaGet(key) {
  try {
    const row = db.prepare('SELECT value, updated_at FROM app_meta WHERE key = ?').get(String(key));
    return row ? { value: String(row.value || ''), updatedAt: String(row.updated_at || '') } : null;
  } catch {
    return null;
  }
}

function metaGetNumber(key) {
  const row = metaGet(key);
  const n = row ? Number(row.value) : 0;
  return Number.isFinite(n) ? n : 0;
}

function metaSet(key, value) {
  try {
    db.prepare('INSERT OR REPLACE INTO app_meta(key, value, updated_at) VALUES (?, ?, ?)').run(
      String(key),
      String(value),
      nowIso()
    );
  } catch {
    // ignore
  }
}

function isoDay() {
  return new Date().toISOString().slice(0, 10);
}

function motnCircuitIsOpen() {
  const until = metaGetNumber('motn_quota_until');
  return until && Date.now() < until ? until : 0;
}

function motnBumpDailyCount() {
  const k = `motn_daily_count:${isoDay()}`;
  const v = metaGetNumber(k) || 0;
  metaSet(k, String(v + 1));
  return v + 1;
}

function motnDailyCount() {
  return metaGetNumber(`motn_daily_count:${isoDay()}`) || 0;
}

async function enrichOttDeepLinksForMovie(movieId, tmdbId, { country = 'in', force = false, debug = false } = {}) {
  const key = String(process.env.MOTN_API_KEY || '').trim();
  if (!key) return { ok: false, skipped: true, reason: 'missing_key' };

  const circuitUntil = motnCircuitIsOpen();
  if (circuitUntil) return { ok: false, skipped: true, reason: 'circuit_open', until: new Date(circuitUntil).toISOString() };

  const dailyBudget = Math.max(0, Math.min(5000, Number(process.env.MOTN_DAILY_BUDGET || 0) || 80));
  if (dailyBudget > 0 && motnDailyCount() >= dailyBudget) {
    return { ok: false, skipped: true, reason: 'daily_budget' };
  }

  const ttlHours = Math.max(6, Math.min(24 * 30, Number(process.env.MOTN_DEEPLINK_TTL_HOURS || 0) || 24 * 14)); // default 14 days
  const attemptMinutes = Math.max(10, Math.min(24 * 60, Number(process.env.MOTN_ATTEMPT_MINUTES || 0) || 180)); // default 3h
  const ttlMs = ttlHours * 60 * 60 * 1000;
  const attemptMs = attemptMinutes * 60 * 1000;

  const haveDeepLink =
    db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM ott_offers
        WHERE movie_id = ?
          AND offer_type = 'Streaming'
          AND COALESCE(deep_link, '') != ''
      `
      )
      .get(movieId)?.c || 0;
  const lastVerified = db
    .prepare(
      `
      SELECT MAX(deep_link_verified_at) as t
      FROM ott_offers
      WHERE movie_id = ?
        AND offer_type = 'Streaming'
        AND COALESCE(deep_link, '') != ''
    `
    )
    .get(movieId)?.t;
  const lastVerifiedMs = lastVerified ? Date.parse(String(lastVerified)) : 0;
  const freshEnough = lastVerifiedMs && Date.now() - lastVerifiedMs < ttlMs;
  if (!force && haveDeepLink && freshEnough) return { ok: true, skipped: true, reason: 'fresh' };

  const attemptKey = `motn_last_attempt_at:${movieId}`;
  const lastAttemptAt = metaGetNumber(attemptKey) || 0;
  if (!force && lastAttemptAt && Date.now() - lastAttemptAt < attemptMs) return { ok: false, skipped: true, reason: 'attempt_ttl' };
  metaSet(attemptKey, String(Date.now()));

  try {
    motnBumpDailyCount();
    const rows = await motnGetDeepLinksForTmdbMovie(tmdbId, { country });
    const ts = nowIso();
    let updated = 0;
    for (const r of rows || []) {
      const provider = String(r.provider || '').trim();
      const deepLink = String(r.deepLink || '').trim();
      if (!provider || !deepLink) continue;
      const res = db
        .prepare(
          `
          UPDATE ott_offers
          SET deep_link = ?,
              deep_link_source = ?,
              deep_link_verified_at = ?
          WHERE movie_id = ?
            AND offer_type = 'Streaming'
            AND lower(provider) = lower(?)
        `
        )
        .run(deepLink, 'motn', ts, movieId, provider);
      if (res?.changes) updated += res.changes;
    }
    if (debug) console.log('[motn] deeplinks updated', { movieId, tmdbId, updated, got: rows?.length || 0 });
    return { ok: true, updated, got: rows?.length || 0 };
  } catch (e) {
    const status = Number(e?.status || 0) || 0;
    if (status === 429 || status === 403) {
      const pauseMinutes = Math.max(10, Math.min(24 * 60, Number(process.env.MOTN_PAUSE_MINUTES || 0) || 360)); // 6h
      metaSet('motn_quota_until', String(Date.now() + pauseMinutes * 60 * 1000));
    }
    if (debug) console.log('[motn] deeplinks failed', { movieId, tmdbId, status, message: String(e?.message || e) });
    return { ok: false, error: String(e?.message || e || 'motn_failed'), status };
  }
}

// --- Static frontend (production) ---
// In production (e.g. Render), serve the built Vite app from `dist/` so you only
// run a single Node process. In dev, use `npm run dev` (Vite) + `npm run server:dev`.
const DIST_DIR = path.join(process.cwd(), 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
function hasDistBuild() {
  try {
    return fs.existsSync(DIST_INDEX);
  } catch {
    return false;
  }
}

const SITE_URL = String(process.env.SITE_URL || 'https://indiamovieguide.com').replace(/\/+$/, '');

function canonicalUrlFor(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'https';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  // Prefer configured site URL to avoid indexing the Render default hostname.
  const base = SITE_URL || (host ? `${proto}://${host}` : 'https://indiamovieguide.com');
  const pathPart = String(req.path || '/');
  return `${String(base).replace(/\/+$/, '')}${pathPart === '/' ? '/' : pathPart}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clampText(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)).trimEnd() + '…';
}

function absUrl(url, base) {
  const u = String(url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  const b = String(base || '').replace(/\/+$/, '');
  return `${b}${u.startsWith('/') ? '' : '/'}${u}`;
}

function setTitle(html, title) {
  const t = escapeHtml(title);
  const re = /<title>[^<]*<\/title>/i;
  if (re.test(html)) return html.replace(re, `<title>${t}</title>`);
  return html.replace('</head>', `  <title>${t}</title>\n</head>`);
}

function setMetaName(html, name, content) {
  const c = escapeAttr(content);
  const re = new RegExp(`<meta[^>]+name=["']${name}["'][^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${c}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n</head>`);
}

function setMetaProp(html, prop, content) {
  const c = escapeAttr(content);
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*>`, 'i');
  const tag = `<meta property="${prop}" content="${c}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n</head>`);
}

function setLinkRel(html, rel, href) {
  const h = escapeAttr(href);
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, 'i');
  const tag = `<link rel="${rel}" href="${h}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace('</head>', `  ${tag}\n</head>`);
}

function injectJsonLd(html, json) {
  const marker = '<!--__SEO_JSONLD__-->';
  if (!html.includes(marker)) return html;
  if (!json) return html.replace(marker, '');
  return html.replace(marker, `<script type="application/ld+json">${json}</script>`);
}

function injectPrerender(html, prerenderHtml) {
  const marker = '<!--__SEO_PRERENDER__-->';
  if (!html.includes(marker)) return html;
  return html.replace(marker, prerenderHtml || '');
}

function seoForPath(req, canonical, siteUrl) {
  const defaultTitle = 'IndiaMovieGuide — Indian Movies, Cast, Songs, Trailers';
  const defaultDesc =
    'IndiaMovieGuide — a modern guide to Indian cinema. Discover new and upcoming movies across languages, explore cast profiles, watch trailers, find where to stream, and play songs.';
  const ogDefault = absUrl('/brand/og-image.svg', siteUrl);

  const path = String(req.path || '/');
  const noIndex =
    path.startsWith('/admin') ||
    path.startsWith('/account') ||
    path.startsWith('/login') ||
    path.startsWith('/submit');

  // Movie page
  const movieMatch = path.match(/^\/movie\/([^/]+)$/);
  if (movieMatch) {
    const raw = decodeURIComponent(movieMatch[1]);
    const tmdbId = /^\d+$/.test(raw) ? Number(raw) : null;
    const movieId = tmdbId ? makeId('tmdb-movie', tmdbId) : raw.includes(':') ? raw : raw;
    const m = hydrateMovie(db, movieId);
    if (m) {
      const year = m.releaseDate ? String(m.releaseDate).slice(0, 4) : '';
      const title = `${m.title}${year ? ` (${year})` : ''} — IndiaMovieGuide`;
      const desc = clampText(m.synopsis || `Explore ${m.title} on IndiaMovieGuide.`, 180);
      const img = absUrl(m.backdrop || m.poster || ogDefault, siteUrl);
      const castNames = (m.cast || []).slice(0, 6).map((c) => c?.name).filter(Boolean);
      const castText = castNames.length ? `<p><strong>Cast:</strong> ${escapeHtml(castNames.join(', '))}</p>` : '';
      const pre =
        `<div style="padding:16px 20px;">` +
        `<h1 style="margin:0 0 8px;font-size:24px;">${escapeHtml(m.title)}</h1>` +
        `<p style="margin:0 0 10px;color:#cbd5e1;">${escapeHtml(desc)}</p>` +
        castText +
        `</div>`;

      const json = JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Movie',
          name: m.title,
          url: canonical,
          description: clampText(m.synopsis || '', 420),
          inLanguage: m.language || undefined,
          datePublished: m.releaseDate || undefined,
          image: [m.backdrop || '', m.poster || ''].filter(Boolean),
          actor: (m.cast || [])
            .slice(0, 8)
            .map((c) => ({
              '@type': 'Person',
              name: c.name,
              url: c?.tmdbId ? `${siteUrl}/person/${encodeURIComponent(String(c.tmdbId))}` : undefined
            }))
            .filter((x) => x.name),
          director: m.director
            ? [
                {
                  '@type': 'Person',
                  name: m.director
                }
              ]
            : undefined
        },
        null,
        0
      );

      return {
        title,
        description: desc,
        ogType: 'video.movie',
        ogImage: img,
        robots: noIndex ? 'noindex,nofollow' : 'index,follow',
        jsonLd: json,
        prerender: pre
      };
    }
  }

  // Person page
  const personMatch = path.match(/^\/person\/([^/]+)$/);
  if (personMatch) {
    const raw = decodeURIComponent(personMatch[1]);
    const tmdbId = /^\d+$/.test(raw) ? Number(raw) : null;
    const personId = tmdbId ? makeId('tmdb-person', tmdbId) : raw.includes(':') ? raw : raw;
    const p = hydratePerson(db, personId);
    if (p) {
      const title = `${p.name} — Profile · IndiaMovieGuide`;
      const desc = clampText(p.biography || `Explore ${p.name}'s bio and filmography on IndiaMovieGuide.`, 180);
      const img = absUrl(p.profileImage || ogDefault, siteUrl);
      const pre =
        `<div style="padding:16px 20px;">` +
        `<h1 style="margin:0 0 8px;font-size:24px;">${escapeHtml(p.name)}</h1>` +
        `<p style="margin:0 0 10px;color:#cbd5e1;">${escapeHtml(desc)}</p>` +
        `</div>`;
      const json = JSON.stringify(
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: p.name,
          url: canonical,
          description: clampText(p.biography || '', 420),
          image: p.profileImage || undefined,
          sameAs: [p.wikiUrl || '', tmdbId ? `https://www.themoviedb.org/person/${tmdbId}` : ''].filter(Boolean)
        },
        null,
        0
      );
      return {
        title,
        description: desc,
        ogType: 'profile',
        ogImage: img,
        robots: noIndex ? 'noindex,nofollow' : 'index,follow',
        jsonLd: json,
        prerender: pre
      };
    }
  }

  // Static pages
  if (path === '/about') {
    return {
      title: 'About · IndiaMovieGuide',
      description: 'Learn about IndiaMovieGuide — a modern, fast guide to Indian cinema across languages.',
      ogType: 'website',
      ogImage: ogDefault,
      robots: 'index,follow',
      jsonLd: '',
      prerender: `<div style="padding:16px 20px;"><h1 style="margin:0 0 8px;font-size:24px;">About</h1></div>`
    };
  }
  if (path === '/contact') {
    return {
      title: 'Contact · IndiaMovieGuide',
      description: 'Contact IndiaMovieGuide — feedback, corrections, and partnership enquiries.',
      ogType: 'website',
      ogImage: ogDefault,
      robots: 'index,follow',
      jsonLd: '',
      prerender: `<div style="padding:16px 20px;"><h1 style="margin:0 0 8px;font-size:24px;">Contact</h1></div>`
    };
  }
  if (path === '/privacy') {
    return {
      title: 'Privacy Policy · IndiaMovieGuide',
      description: 'Read the IndiaMovieGuide privacy policy.',
      ogType: 'website',
      ogImage: ogDefault,
      robots: 'index,follow',
      jsonLd: '',
      prerender: `<div style="padding:16px 20px;"><h1 style="margin:0 0 8px;font-size:24px;">Privacy Policy</h1></div>`
    };
  }

  return {
    title: defaultTitle,
    description: defaultDesc,
    ogType: 'website',
    ogImage: ogDefault,
    robots: noIndex ? 'noindex,nofollow' : 'index,follow',
    jsonLd: '',
    prerender: ''
  };
}

const LANG_TO_TMDB = {
  Hindi: 'hi',
  Kannada: 'kn',
  Telugu: 'te',
  Tamil: 'ta',
  Malayalam: 'ml',
  Marathi: 'mr',
  Bengali: 'bn'
};

const SUPPORTED_LANGUAGES = Object.keys(LANG_TO_TMDB);

function isLikelyIndianMovie(full) {
  if (!full) return false;
  if (Array.isArray(full.productionCountries) && full.productionCountries.includes('IN')) return true;
  return INDIAN_LANGUAGES_LOWER.includes(String(full.language || '').toLowerCase());
}

async function seedLanguageIfSparse(langName, opts = {}) {
  const code = LANG_TO_TMDB[langName];
  if (!code) return;

  const haveTotal =
    db
      .prepare('SELECT COUNT(*) as c FROM movies WHERE lower(language) = lower(?)')
      .get(langName)?.c || 0;
  // Don't only look at total rows: you can have a large catalog of older titles but still
  // have 0 upcoming movies for that language.
  const today = new Date().toISOString().slice(0, 10);
  const haveUpcoming =
    db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM movies
        WHERE lower(language) = lower(?)
          AND COALESCE(is_indian, 1) = 1
          AND release_date > ?
      `
      )
      .get(langName, today)?.c || 0;

  const desiredUpcoming = Math.max(2, Number(process.env.LANG_SEED_DESIRED_UPCOMING || 0) || 6);
  const desiredTotal = Math.max(24, Number(process.env.LANG_SEED_DESIRED_TOTAL || 0) || 48);
  const force = opts?.force === true;
  const overrides = opts?.overrides && typeof opts.overrides === 'object' ? opts.overrides : {};
  const desiredUpcomingOverride =
    overrides.desiredUpcoming != null && Number.isFinite(Number(overrides.desiredUpcoming))
      ? Number(overrides.desiredUpcoming)
      : null;
  const desiredTotalOverride =
    overrides.desiredTotal != null && Number.isFinite(Number(overrides.desiredTotal)) ? Number(overrides.desiredTotal) : null;
  const effectiveDesiredUpcoming = desiredUpcomingOverride != null ? Math.max(2, desiredUpcomingOverride) : desiredUpcoming;
  const effectiveDesiredTotal = desiredTotalOverride != null ? Math.max(24, desiredTotalOverride) : desiredTotal;

  // If we already have a decent number of titles and at least some upcoming, skip.
  // Otherwise, refresh this language in the background.
  if (!force && haveTotal >= effectiveDesiredTotal && haveUpcoming >= effectiveDesiredUpcoming) return;

  const langKey = `last_lang_seed_at:${String(langName || '').toLowerCase()}`;
  // If we're still missing a decent catalog/upcoming shelf, retry more often.
  const langTtlMs =
    haveTotal < effectiveDesiredTotal || haveUpcoming < effectiveDesiredUpcoming ? 30 * 60 * 1000 : 12 * 60 * 60 * 1000;
  const lastLangSeedAt = metaGetNumber(langKey);
  if (!force && lastLangSeedAt && Date.now() - lastLangSeedAt < langTtlMs) return;
  // Allow backfilling older catalogs via env without code changes.
  // Keep a hard cap to avoid unbounded backfills by mistake (TMDB/API usage + time).
  // Note: "days" is only used to define a discover window; actual API usage is bounded by pages/maxIds/budget.
  const MAX_LOOKBACK_DAYS = 40000; // ~109 years
  const MAX_FORWARD_DAYS = 3650; // 10 years

  const lookbackDaysEnv = Math.max(60, Math.min(MAX_LOOKBACK_DAYS, Number(process.env.LANG_SEED_LOOKBACK_DAYS || 0) || 365));
  const forwardDaysEnv = Math.max(60, Math.min(MAX_FORWARD_DAYS, Number(process.env.LANG_SEED_FORWARD_DAYS || 0) || 365));
  const lookbackDays =
    overrides.lookbackDays != null && Number.isFinite(Number(overrides.lookbackDays))
      ? Math.max(60, Math.min(MAX_LOOKBACK_DAYS, Number(overrides.lookbackDays)))
      : lookbackDaysEnv;
  const forwardDays =
    overrides.forwardDays != null && Number.isFinite(Number(overrides.forwardDays))
      ? Math.max(60, Math.min(MAX_FORWARD_DAYS, Number(overrides.forwardDays)))
      : forwardDaysEnv;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const past = new Date(Date.now() - lookbackDays * DAY_MS).toISOString().slice(0, 10);
  const future = new Date(Date.now() + forwardDays * DAY_MS).toISOString().slice(0, 10);

  const pagesEnv = Math.max(1, Math.min(20, Number(process.env.LANG_SEED_PAGES || 0) || 3));
  const maxIdsEnv = Math.max(16, Math.min(600, Number(process.env.LANG_SEED_MAX_IDS || 0) || 72));
  const pages =
    overrides.pages != null && Number.isFinite(Number(overrides.pages))
      ? Math.max(1, Math.min(20, Number(overrides.pages)))
      : pagesEnv;
  const maxIds =
    overrides.maxIds != null && Number.isFinite(Number(overrides.maxIds))
      ? Math.max(16, Math.min(600, Number(overrides.maxIds)))
      : maxIdsEnv;

  const strategyEnvRaw = String(process.env.LANG_SEED_STRATEGY || '').trim().toLowerCase();
  const strategyEnv = strategyEnvRaw === 'mixed' ? 'mixed' : 'popular';
  const strategyRaw = String(overrides.strategy || '').trim().toLowerCase();
  const strategy = strategyRaw === 'mixed' ? 'mixed' : strategyRaw === 'popular' ? 'popular' : strategyEnv;

  const recentSorts = strategy === 'mixed'
    ? ['popularity.desc', 'vote_count.desc', 'revenue.desc', 'primary_release_date.desc']
    : ['popularity.desc'];
  const upcomingSorts = strategy === 'mixed'
    ? ['popularity.desc', 'primary_release_date.asc']
    : ['popularity.desc'];

  // Safety budget: cap discover calls per window/language so a misconfig doesn't explode runtime.
  const DISCOVER_BUDGET = Math.max(10, Math.min(120, Number(process.env.LANG_SEED_DISCOVER_BUDGET || 0) || 40));
  const pagesRecent = Math.max(1, Math.min(pages, Math.max(1, Math.floor(DISCOVER_BUDGET / recentSorts.length))));
  const pagesUpcoming = Math.max(1, Math.min(pages, Math.max(1, Math.floor(DISCOVER_BUDGET / upcomingSorts.length))));

  // If lookback is large, rotate across time windows so repeated backfills keep discovering new titles
  // without increasing API usage per run.
  const WINDOW_DAYS = Math.max(
    365,
    Math.min(MAX_LOOKBACK_DAYS, Number(process.env.LANG_SEED_WINDOW_DAYS || 0) || 3650)
  ); // default 10y windows
  let recentStart = past;
  let recentEnd = today;
  let windowInfo = null;
  let cursorKey = null;
  let cursor = null;
  if (lookbackDays > WINDOW_DAYS * 1.2) {
    cursorKey = `lang_seed_cursor:${String(langName || '').toLowerCase()}`;
    cursor = metaGetNumber(cursorKey) || 0;
    const numWindows = Math.max(1, Math.ceil(lookbackDays / WINDOW_DAYS));
    const idx = cursor % numWindows;
    const endMs = Date.now() - idx * WINDOW_DAYS * DAY_MS;
    const startMs = endMs - WINDOW_DAYS * DAY_MS;
    const minMs = Date.now() - lookbackDays * DAY_MS;
    const clampedStart = Math.max(minMs, startMs);
    const clampedEnd = Math.min(Date.now(), endMs);
    recentStart = new Date(clampedStart).toISOString().slice(0, 10);
    recentEnd = new Date(clampedEnd).toISOString().slice(0, 10);
    windowInfo = { idx, numWindows, windowDays: WINDOW_DAYS, start: recentStart, end: recentEnd };
  }

  const recentTasks = [];
  const upcomingTasks = [];
  for (const sortBy of recentSorts) {
    for (let p = 1; p <= pagesRecent; p++) {
      recentTasks.push(
        tmdbDiscoverMovies({
          dateGte: recentStart,
          dateLte: recentEnd,
          sortBy,
          page: p,
          region: 'IN',
          languages: [code],
          voteCountGte: 0
        }).catch(() => [])
      );
    }
  }
  for (const sortBy of upcomingSorts) {
    for (let p = 1; p <= pagesUpcoming; p++) {
      upcomingTasks.push(
        tmdbDiscoverMovies({
          dateGte: today,
          dateLte: future,
          sortBy,
          page: p,
          region: 'IN',
          languages: [code],
          voteCountGte: 0
        }).catch(() => [])
      );
    }
  }

  const [recentPages, upcomingPages] = await Promise.all([Promise.all(recentTasks), Promise.all(upcomingTasks)]);
  const recentHits = recentPages.flat();
  const upcomingHits = upcomingPages.flat();

  const ids = Array.from(new Set([...recentHits, ...upcomingHits].map((h) => h.tmdbId))).slice(0, maxIds);
  let wrote = 0;
  const cancelRef = opts?.cancelRef;
  for (const tmdbId of ids) {
    if (cancelRef?.cancelled) break;
    try {
      const full = await tmdbGetMovieFull(tmdbId);
      upsertMovieFromTmdb(db, full);
      wrote++;
    } catch {
      // ignore
    }
  }

  if (wrote > 0) metaSet(langKey, String(Date.now()));
  if (cursorKey) metaSet(cursorKey, String((cursor || 0) + 1));
  return { lang: langName, attempted: ids.length, wrote, window: windowInfo, strategy };
}

async function seedAllLanguages({ force = false, overrides = undefined, cancelRef = undefined } = {}) {
  const key = 'last_all_languages_seed_at';
  const ttlMs = 12 * 60 * 60 * 1000;
  const last = metaGetNumber(key);
  if (!force && last && Date.now() - last < ttlMs) return { skipped: true, reason: 'ttl', last };

  const results = [];
  for (const lang of SUPPORTED_LANGUAGES) {
    if (cancelRef?.cancelled) break;
    try {
      const r = await seedLanguageIfSparse(lang, { force, overrides, cancelRef });
      results.push(r || { lang, attempted: 0, wrote: 0 });
    } catch {
      results.push({ lang, attempted: 0, wrote: 0, error: true });
    }
  }

  // Only update the global seed timestamp if we actually completed the run.
  if (!cancelRef?.cancelled) metaSet(key, String(Date.now()));
  return { skipped: false, results };
}

async function enrichMovieIfNeeded(movieId, opts = {}) {
  const debugSongs = process.env.DEBUG_SONGS === '1' || opts?.debug === true;
  const slog = (...args) => {
    if (!debugSongs) return;
    // Keep logs compact; never log API keys.
    console.log('[songs]', ...args);
  };

  try {
    const row = db
      .prepare(
        'SELECT tmdb_id, trailer_url, title, language, release_date, status, synopsis, poster, backdrop, updated_at FROM movies WHERE id = ?'
      )
      .get(movieId);
    const tmdbId = row?.tmdb_id;
    if (!tmdbId) return;

    const offerCount = db.prepare('SELECT COUNT(*) as c FROM ott_offers WHERE movie_id = ?').get(movieId)?.c || 0;
    const ratingCount = db.prepare('SELECT COUNT(*) as c FROM ratings WHERE movie_id = ?').get(movieId)?.c || 0;
    const reviewCount = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE movie_id = ?').get(movieId)?.c || 0;
    const songCount = db.prepare('SELECT COUNT(*) as c FROM songs WHERE movie_id = ?').get(movieId)?.c || 0;
    const playableSongCount =
      db
        .prepare("SELECT COUNT(*) as c FROM songs WHERE movie_id = ? AND COALESCE(youtube_url, '') != ''")
        .get(movieId)?.c || 0;
    const adminSongCount =
      db.prepare("SELECT COUNT(*) as c FROM songs WHERE movie_id = ? AND source = 'admin'").get(movieId)?.c || 0;
    const missingTrailer = !row?.trailer_url;
    const castCount = db
      .prepare('SELECT COUNT(*) as c FROM movie_cast WHERE movie_id = ?')
      .get(movieId)?.c || 0;
    const castImageCount = db
      .prepare(
        `
        SELECT COUNT(*) as c
        FROM movie_cast mc
        JOIN persons p ON p.id = mc.person_id
        WHERE mc.movie_id = ?
          AND COALESCE(p.profile_image, '') != ''
      `
      )
      .get(movieId)?.c || 0;
    const missingCastImages = castCount > 0 && castImageCount === 0;
    const missingCast = castCount === 0;
    const synopsis = String(row?.synopsis || '').trim();
    const missingSynopsis = synopsis.length < 12;
    const missingArtwork = !String(row?.poster || '').trim() && !String(row?.backdrop || '').trim();
    // Song refresh rules:
    // - Always respect admin-curated songs (don't auto-overwrite).
    // - If we have 0 songs OR have songs but none are playable (no YouTube links), we can attempt a refresh.
    const missingSongs = songCount === 0;
    const missingPlayableSongs = playableSongCount === 0;
	    const forceSongs = opts?.forceSongs === true;
	    const forceFull = opts?.forceFull === true;
	    // Only auto-refresh songs on explicit movie page loads (to limit provider usage).
	    const autoSongs = opts?.autoSongs === true;
	    const autoDeeplinks = opts?.autoDeeplinks === true;
	    const forceDeeplinks = opts?.forceDeeplinks === true;
	    const needsSongsRefresh = autoSongs && (missingSongs || missingPlayableSongs) && adminSongCount === 0;

    const storedStatus = String(row?.status || '').trim();
    const inferredStatus = statusFrom(row?.release_date, offerCount > 0);
    const status = storedStatus || inferredStatus;
    const isUpcoming = status === 'Upcoming' || status === 'Announced';
    const lastUpdatedMs = (() => {
      const t = Date.parse(String(row?.updated_at || ''));
      return Number.isFinite(t) ? t : 0;
    })();

    const UPCOMING_TTL_HOURS = Math.max(
      1,
      Math.min(168, Number(process.env.UPCOMING_DETAILS_REFRESH_HOURS || 0) || 24)
    ); // default 24h, max 7 days
    const DEFAULT_TTL_HOURS = Math.max(
      6,
      Math.min(24 * 90, Number(process.env.DETAILS_REFRESH_HOURS || 0) || 24 * 30)
    ); // default 30 days
    const ttlMs = (isUpcoming ? UPCOMING_TTL_HOURS : DEFAULT_TTL_HOURS) * 60 * 60 * 1000;

    const SONGS_AUTO_TTL_HOURS = Math.max(
      1,
      Math.min(24 * 14, Number(process.env.SONGS_AUTO_REFRESH_HOURS || 0) || 24)
    ); // default 24h, max 14 days
    const songsTtlMs = SONGS_AUTO_TTL_HOURS * 60 * 60 * 1000;
    const SONGS_AUTO_ATTEMPT_MINUTES = Math.max(
      2,
      Math.min(60, Number(process.env.SONGS_AUTO_ATTEMPT_MINUTES || 0) || 10)
    ); // default 10 min, max 60 min
    const songsAttemptMs = SONGS_AUTO_ATTEMPT_MINUTES * 60 * 1000;
    const songsAttemptKey = `last_song_auto_attempt_at:${movieId}`;
    const songsSuccessKey = `last_song_auto_success_at:${movieId}`;
    const lastSongAttemptAt = metaGetNumber(songsAttemptKey);
    const lastSongSuccessAt = metaGetNumber(songsSuccessKey);
    const canAttemptSongs = !lastSongAttemptAt || Date.now() - lastSongAttemptAt > songsAttemptMs;
    const canAutoRefreshSongs = !lastSongSuccessAt || Date.now() - lastSongSuccessAt > songsTtlMs;

    if (debugSongs && (forceSongs || needsSongsRefresh)) {
      slog('enrich start', {
        movieId,
        tmdbId,
        title: row?.title || '',
        songCount,
        playableSongCount,
        adminSongCount,
        forceSongs,
        needsSongsRefresh,
        canAutoRefreshSongs,
        canAttemptSongs
      });
    }

    const needsFullNonSongs =
      missingTrailer ||
      offerCount === 0 ||
      ratingCount === 0 ||
      reviewCount === 0 ||
      missingCastImages ||
      missingCast ||
      (isUpcoming && (missingSynopsis || missingArtwork));

    const needsFull = needsFullNonSongs || needsSongsRefresh || forceSongs;
    if (!needsFull) return;

    // Extracted helper so we can refresh songs without a full TMDB fetch when appropriate.
    const refreshSongsIfNeeded = async (full) => {
      if (!(forceSongs || needsSongsRefresh)) return;
      if (!forceSongs && (!canAutoRefreshSongs || !canAttemptSongs)) return;

      // Mark attempt up front so repeated page visits don't hammer providers.
      if (!forceSongs) metaSet(songsAttemptKey, String(Date.now()));
      const beforeSongCount = songCount;
      const beforePlayableCount = playableSongCount;

      const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : null;
      const ytMode = tokenize(full.title).length <= 1 ? 'strict' : 'bestEffort';
      if (debugSongs) slog('song refresh', { movieTitle: full.title, language: full.language, year, ytMode });
      const ytQuotaUntil = metaGetNumber('youtube_quota_until');
      const ytBlocked = ytQuotaUntil && Date.now() < ytQuotaUntil;

      // Do not overwrite admin-curated songs unless explicitly allowed.
      if (forceSongs && adminSongCount > 0 && opts?.overrideAdminSongs !== true) {
        if (debugSongs) slog('skip refresh: admin songs exist', { adminSongCount });
        return;
      }
      if (forceSongs) {
        // If the user explicitly requests a refresh, clear cached songs first so we don't keep stale/wrong matches.
        clearSongsForMovie(db, movieId);
        // Clear any previously guessed/incorrect wiki attribution for this movie.
        db.prepare("DELETE FROM attributions WHERE entity_type = 'movie' AND entity_id = ? AND provider = 'wikipedia'").run(
          movieId
        );
        // Clear any previous catalog attribution for this movie.
        db.prepare("DELETE FROM attributions WHERE entity_type = 'movie' AND entity_id = ? AND provider IN ('itunes','spotify')").run(
          movieId
        );
      }

      // Prefer Apple iTunes tracklists for definitive song names *only if* we can map
      // enough tracks to playable links. Otherwise, keep a YouTube-first list for UX.
      const itunes = await itunesFindSoundtrackForMovie({ title: full.title, year, language: full.language }).catch(() => null);
      if (itunes?.tracks?.length) {
        if (debugSongs) slog('itunes found', { tracks: itunes.tracks.length, albumUrl: !!itunes.albumUrl });
        const trackTitles = itunes.tracks.map((t) => t.title).filter(Boolean);
        const trackArtists = {};
        for (const t of itunes.tracks) {
          if (t?.title && t?.artist) trackArtists[t.title] = t.artist;
        }
        const trackMap = await youtubeMatchVideosForTracklist({
          movieTitle: full.title,
          language: full.language,
          year,
          tracks: trackTitles,
          trackArtists,
          mode: ytMode
        }).catch(() => new Map());

        const songs = itunes.tracks.slice(0, 20).map((t) => ({
          title: t.title,
          singers: t.artist ? [t.artist] : [],
          youtubeUrl: trackMap.get(t.title) || '',
          sourceUrl: t.url || itunes.albumUrl || '',
          sourceProviderId: t.providerId || ''
        }));

        const linkedCount = songs.filter((s) => !!s.youtubeUrl).length;
        // If we can't get enough playable links, fall back to a YouTube-first list.
        const minLinked = Math.max(3, Math.ceil(songs.length * 0.7));
        if (debugSongs) slog('itunes youtube mapping', { linkedCount, total: songs.length, minLinked });
        if (linkedCount >= minLinked) {
          replaceSongsForMovie(db, movieId, songs, {
            source: 'itunes',
            platform: 'YouTube',
            sourceUrl: itunes.albumUrl || '',
            attributionProvider: 'itunes'
          });

          if (itunes.albumUrl) {
            db.prepare(
              'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
              hashId('attr', `${movieId}:itunes`),
              'movie',
              movieId,
              'itunes',
              String(itunes.albumId || ''),
              itunes.albumUrl,
              nowIso()
            );
          }

          // Tracklist + playable links found; stop here.
          if (debugSongs) slog('itunes committed', { movieId });
          if (!forceSongs) metaSet(songsSuccessKey, String(Date.now()));
          return;
        }

        // If YouTube is currently blocked due to quota, still store the definitive tracklist
        // without links so the UI can show song names (and offer a manual YouTube search per song).
        if (ytBlocked) {
          replaceSongsForMovie(db, movieId, songs, {
            source: 'itunes',
            platform: 'YouTube',
            sourceUrl: itunes.albumUrl || '',
            attributionProvider: 'itunes'
          });

          if (itunes.albumUrl) {
            db.prepare(
              'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(
              hashId('attr', `${movieId}:itunes`),
              'movie',
              movieId,
              'itunes',
              String(itunes.albumId || ''),
              itunes.albumUrl,
              nowIso()
            );
          }

          if (debugSongs) slog('itunes committed (no youtube links; quota blocked)', { movieId });
          // This is a partial success (tracklist only). Still mark success to avoid tight loops.
          if (!forceSongs) metaSet(songsSuccessKey, String(Date.now()));
          return;
        }
      }

      const wikiOverride = opts?.wikiTitleOverride ? String(opts.wikiTitleOverride).trim() : '';
      const wikiFromOverride = wikiOverride
        ? await wikipediaSoundtrackTracksByTitle(wikiOverride, { lang: 'en' }).catch(() => null)
        : null;

      const wiki =
        wikiFromOverride && wikiFromOverride?.tracks?.length
          ? wikiFromOverride
          : await wikipediaTracklistForMovie({
              title: full.title,
              year,
              language: full.language,
              castNames: (full.cast || []).slice(0, 2).map((c) => c?.name).filter(Boolean)
            }).catch(() => null);
      let useWiki = !!(wiki?.tracks?.length);
      if (useWiki) {
        // If the chosen Wikipedia page doesn't match the movie's language/year, don't use it.
        // This prevents ambiguous titles ("Champion") from pulling the wrong film's soundtrack.
        const lead = await wikipediaLeadByTitle(wiki.title, { lang: 'en' }).catch(() => null);
        const l = normalizeText(lead?.extract || '');
        const langToken = normalizeText(full.language);
        const y = year ? String(year) : '';
        const okLang =
          !langToken ||
          l.includes(`${langToken} language`) ||
          l.includes(`${langToken}-language`) ||
          l.includes(` ${langToken} film`);
        const okYear = !y || l.includes(y);
        if (!(okLang && okYear)) {
          if (wikiOverride) return; // explicit override: don't fall back to noisy heuristics
          useWiki = false;
        }
      }

      if (useWiki) {
        if (debugSongs) slog('wikipedia tracklist found', { tracks: wiki.tracks.length, wikiUrl: wiki.url || '' });
        const trackMap = await youtubeMatchVideosForTracklist({
          movieTitle: full.title,
          language: full.language,
          year,
          tracks: wiki.tracks,
          mode: ytMode
        }).catch(() => new Map());

        const songs = wiki.tracks.slice(0, 20).map((t) => ({
          title: t,
          singers: [],
          youtubeUrl: trackMap.get(t) || ''
        }));
        const linkedCount = songs.filter((s) => !!s.youtubeUrl).length;
        // Only store Wikipedia tracklists when we can map enough playable links; otherwise fall back
        // to a YouTube-first playlist for better end-user experience.
        const minLinked = Math.max(3, Math.ceil(songs.length * 0.5));
        if (debugSongs) slog('wikipedia youtube mapping', { linkedCount, total: songs.length, minLinked });
        if (linkedCount >= minLinked) {
          replaceSongsForMovie(db, movieId, songs, { source: 'wikipedia', platform: 'YouTube', wikiUrl: wiki.url || '' });

          if (wiki.url) {
            db.prepare(
              'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).run(hashId('attr', `${movieId}:wikipedia`), 'movie', movieId, 'wikipedia', wiki.title || '', wiki.url, nowIso());
          }
          if (debugSongs) slog('wikipedia committed', { movieId });
          if (!forceSongs) metaSet(songsSuccessKey, String(Date.now()));
        } else {
          if (ytBlocked) {
            // Quota is blocked; still store the soundtrack list without links so users see something useful.
            replaceSongsForMovie(db, movieId, songs, { source: 'wikipedia', platform: 'YouTube', wikiUrl: wiki.url || '' });
            if (wiki.url) {
              db.prepare(
                'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
              ).run(hashId('attr', `${movieId}:wikipedia`), 'movie', movieId, 'wikipedia', wiki.title || '', wiki.url, nowIso());
            }
            if (debugSongs) slog('wikipedia committed (no youtube links; quota blocked)', { movieId });
            // Partial success (tracklist only).
            if (!forceSongs) metaSet(songsSuccessKey, String(Date.now()));
            return;
          }

          const hints = hintTokensFromNames((full.cast || []).slice(0, 8).map((c) => c?.name).filter(Boolean));
          const ytSongs = await youtubeSearchSongsForMovie({
            title: full.title,
            year,
            language: full.language,
            hints
          }).catch(() => []);
          if (debugSongs) slog('fallback to youtubeSearchSongsForMovie', { count: ytSongs.length });
          if (ytSongs.length) replaceSongsFromYoutube(db, movieId, ytSongs);
        }
      } else {
        // If the caller explicitly requested a Wikipedia title, do not fall back to noisy YouTube-only results.
        if (wikiOverride) return;
        const hints = hintTokensFromNames((full.cast || []).slice(0, 8).map((c) => c?.name).filter(Boolean));
        const songs = await youtubeSearchSongsForMovie({
          title: full.title,
          year,
          language: full.language,
          hints
        }).catch(() => []);
        if (debugSongs) slog('youtubeSearchSongsForMovie', { count: songs.length });
        if (songs.length) replaceSongsFromYoutube(db, movieId, songs);
      }

      // If something actually improved, mark success; otherwise let it retry later.
      try {
        const afterSongCount = db.prepare('SELECT COUNT(*) as c FROM songs WHERE movie_id = ?').get(movieId)?.c || 0;
        const afterPlayableCount =
          db
            .prepare("SELECT COUNT(*) as c FROM songs WHERE movie_id = ? AND COALESCE(youtube_url, '') != ''")
            .get(movieId)?.c || 0;
        const improved =
          afterSongCount > beforeSongCount || afterPlayableCount > beforePlayableCount || (beforeSongCount === 0 && afterSongCount > 0);
        if (improved && !forceSongs) metaSet(songsSuccessKey, String(Date.now()));
      } catch {
        // ignore
      }
    };

    // Avoid hammering TMDB for sparse upcoming titles on every page load.
    // If details are missing but we refreshed recently, wait for the TTL unless forced.
	    if (!needsFullNonSongs) {
	      // Songs-only refresh path: do not call TMDB if everything else is already present.
      const castNames = db
        .prepare(
          `
          SELECT p.name as name
          FROM movie_cast mc
          JOIN persons p ON p.id = mc.person_id
          WHERE mc.movie_id = ?
          ORDER BY mc.billing_order ASC
          LIMIT 8
        `
        )
        .all(movieId)
        .map((x) => x?.name)
        .filter(Boolean);
	      const pseudoFull = {
	        title: row?.title || '',
	        language: row?.language || '',
	        releaseDate: row?.release_date || '',
	        cast: castNames.map((n) => ({ name: n }))
	      };
	      await refreshSongsIfNeeded(pseudoFull);
	      if (autoDeeplinks || forceDeeplinks) {
	        await enrichOttDeepLinksForMovie(movieId, tmdbId, {
	          country: String(process.env.MOTN_COUNTRY || 'in'),
	          force: forceDeeplinks,
	          debug: opts?.debug === true
	        });
	      }
	      return;
	    }

	    if (!forceFull && lastUpdatedMs && Date.now() - lastUpdatedMs < ttlMs) {
	      // Still allow song refresh (auto/forced) even inside the details TTL.
      const castNames = db
        .prepare(
          `
          SELECT p.name as name
          FROM movie_cast mc
          JOIN persons p ON p.id = mc.person_id
          WHERE mc.movie_id = ?
          ORDER BY mc.billing_order ASC
          LIMIT 8
        `
        )
        .all(movieId)
        .map((x) => x?.name)
        .filter(Boolean);
	      await refreshSongsIfNeeded({
	        title: row?.title || '',
	        language: row?.language || '',
	        releaseDate: row?.release_date || '',
	        cast: castNames.map((n) => ({ name: n }))
	      });
	      if (autoDeeplinks || forceDeeplinks) {
	        await enrichOttDeepLinksForMovie(movieId, tmdbId, {
	          country: String(process.env.MOTN_COUNTRY || 'in'),
	          force: forceDeeplinks,
	          debug: opts?.debug === true
	        });
	      }
	      return;
	    }

	    const full = await tmdbGetMovieFull(tmdbId);
	    upsertMovieFromTmdb(db, full);

	    if (autoDeeplinks || forceDeeplinks) {
	      await enrichOttDeepLinksForMovie(movieId, tmdbId, {
	        country: String(process.env.MOTN_COUNTRY || 'in'),
	        force: forceDeeplinks,
	        debug: opts?.debug === true
	      });
	    }

    if (!full.trailerUrl) {
      const yt = await youtubeSearchCached(db, `${full.title} official trailer`).catch(() => []);
      const trailerUrl = yt[0]?.youtubeUrl || '';
      if (trailerUrl) {
        db.prepare('UPDATE movies SET trailer_url = ?, updated_at = ? WHERE id = ?').run(
          trailerUrl,
          nowIso(),
          movieId
        );
      }
    }

    await refreshSongsIfNeeded(full);

    // Ratings from OMDb (optional; needs OMDB_API_KEY).
    try {
      const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : undefined;
      const omdb = await omdbByTitle(full.title, year);
      upsertRatingsFromOmdb(db, movieId, omdb);
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

// Fire-and-forget enrichment queue to keep page loads fast.
// Prevents stampeding provider calls when multiple clients hit the same title at once.
const movieEnrichInFlight = new Map(); // movieId -> Promise<void>
function enqueueMovieEnrich(movieId, opts) {
  const id = String(movieId || '').trim();
  if (!id) return;
  if (movieEnrichInFlight.has(id)) return;
  const p = (async () => {
    try {
      await enrichMovieIfNeeded(id, opts);
    } catch {
      // ignore
    } finally {
      movieEnrichInFlight.delete(id);
    }
  })();
  movieEnrichInFlight.set(id, p);
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function ytLangCode(language) {
  switch (String(language || '').toLowerCase()) {
    case 'hindi':
      return 'hi';
    case 'telugu':
      return 'te';
    case 'tamil':
      return 'ta';
    case 'kannada':
      return 'kn';
    case 'malayalam':
      return 'ml';
    case 'marathi':
      return 'mr';
    case 'bengali':
      return 'bn';
    case 'punjabi':
      return 'pa';
    default:
      return '';
  }
}

function hintTokensFromNames(names) {
  const tokens = [];
  for (const n of names || []) {
    for (const t of normalizeText(n).split(/\s+/g)) {
      if (t.length < 4) continue;
      // avoid very common words that add noise
      if (['movie', 'film', 'official', 'music', 'songs', 'song', 'audio', 'video'].includes(t)) continue;
      tokens.push(t);
    }
  }
  return Array.from(new Set(tokens)).slice(0, 10);
}

function scoreYoutubeSongCandidate({ title: movieTitle, year, language, hints }, item) {
  const title = normalizeText(item?.title);
  const desc = normalizeText(item?.description);
  const hay = `${title} ${desc}`.trim();

  // Hard excludes: very often irrelevant.
  const bad = [
    'trailer',
    'teaser',
    'reaction',
    'review',
    'explain',
    'explained',
    'scene',
    'climax',
    'dialogue',
    'interview',
    'full movie',
    'movie recap'
  ];
  if (bad.some((w) => hay.includes(w))) return -1;

  const tokens = normalizeText(movieTitle)
    .split(/\s+/g)
    .filter((t) => t.length >= 3 && !['the', 'and', 'for', 'from', 'with', 'movie', 'film'].includes(t));
  const uniq = Array.from(new Set(tokens));
  const matched = uniq.filter((t) => hay.includes(t)).length;
  const base = uniq.length ? matched / uniq.length : 0;

  let bonus = 0;
  const langToken = normalizeText(language);
  if (langToken && hay.includes(langToken)) bonus += 0.2;
  if (year && hay.includes(String(year))) bonus += 0.12;
  if (hay.includes('jukebox') || hay.includes('full album') || hay.includes('audio jukebox')) bonus += 0.25;
  if (hay.includes('lyric') || hay.includes('lyrical') || hay.includes('audio')) bonus += 0.15;
  if (hay.includes('song') || hay.includes('songs')) bonus += 0.05;

  // Single-word titles are ambiguous ("Champion", "Hero", ...).
  // Require stronger evidence: language/year/cast-hint plus "song-like" keywords.
  if (uniq.length <= 1) {
    const hasSongSignals = hay.includes('song') || hay.includes('songs') || hay.includes('jukebox') || hay.includes('audio');
    const hasLang = !!(langToken && hay.includes(langToken));
    const hasYear = !!(year && hay.includes(String(year)));
    const hs = Array.isArray(hints) ? hints : [];
    const hasHint = hs.some((t) => t && hay.includes(String(t)));
    const hasDisambiguator = hasLang || hasYear || hasHint;
    if (!(hasSongSignals && hasDisambiguator && matched >= 1)) return 0;
  }

  return base + bonus;
}

async function youtubeSearchSongsForMovie({ title, year, language, hints }) {
  const movieTitle = String(title || '').trim();
  if (!movieTitle) return [];
  const y = year ? String(year) : '';
  const lang = String(language || '').trim();
  const langToken = lang ? `${lang} ` : '';
  const hintTokens = Array.isArray(hints) ? hints : [];

  const queries = [
    `${movieTitle} ${langToken}jukebox`.trim(),
    `${movieTitle} ${y} ${langToken}songs`.trim(),
    `${movieTitle} ${langToken}movie songs`.trim(),
    `${movieTitle} ${langToken}lyrical`.trim()
  ].filter(Boolean);
  for (const t of hintTokens.slice(0, 3)) {
    queries.push(`${movieTitle} ${t} song`.trim());
    queries.push(`${movieTitle} ${t} lyrical`.trim());
  }
  // YouTube search.list is quota-expensive; keep the number of queries bounded.
  const queryLimit = Math.max(1, Math.min(8, Number(process.env.YOUTUBE_SONG_QUERY_LIMIT || 0) || 2));
  const all = [];
  const rel = ytLangCode(lang);
  for (const q of queries.slice(0, queryLimit)) {
    const hits = await youtubeSearchCached(db, q, {
      maxResults: 10,
      videoCategoryId: 10,
      relevanceLanguage: rel || undefined,
      regionCode: 'IN'
    }).catch(() => []);
    all.push(...hits);
  }
  const byUrl = new Map();
  for (const h of all) {
    const url = String(h?.youtubeUrl || '');
    if (!url) continue;
    if (!byUrl.has(url)) byUrl.set(url, h);
  }
  const scored = Array.from(byUrl.values())
    .map((h) => ({ h, s: scoreYoutubeSongCandidate({ title: movieTitle, year, language: lang, hints: hintTokens }, h) }))
    .filter((x) => x.s >= (normalizeText(movieTitle).split(/\s+/g).filter(Boolean).length <= 1 ? 0.55 : 0.38))
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map(({ h }) => ({ title: h.title, singers: [h.channel].filter(Boolean), youtubeUrl: h.youtubeUrl }));

  if (scored.length) return scored;

  // Last-resort fallback for UX: produce a short playable list even when strict scoring yields nothing
  // (common with ambiguous 1-word titles).
  const titleTokens = normalizeText(movieTitle).split(/\s+/g).filter(Boolean);
  const ambiguous = titleTokens.length <= 1;
  const rel2 = ytLangCode(lang);
  const fallbackQueries = [
    `${movieTitle} ${langToken}${y} jukebox`.trim(),
    `${movieTitle} ${langToken}${y} songs`.trim(),
    `${movieTitle} ${langToken}movie songs`.trim()
  ].filter(Boolean);

  const raw = [];
  for (const q of fallbackQueries.slice(0, Math.min(2, fallbackQueries.length))) {
    const hits = await youtubeSearchCached(db, q, {
      maxResults: 10,
      videoCategoryId: 10,
      relevanceLanguage: rel2 || undefined,
      regionCode: 'IN'
    }).catch(() => []);
    raw.push(...hits);
  }
  const uniq = new Map();
  for (const h of raw) {
    const url = String(h?.youtubeUrl || '');
    if (!url) continue;
    if (!uniq.has(url)) uniq.set(url, h);
  }

  const filtered = Array.from(uniq.values())
    .map((h) => ({ h, s: scoreYoutubeSongCandidate({ title: movieTitle, year, language: lang, hints: hintTokens }, h) }))
    .filter(({ h, s }) => {
      if (s < 0.2) return false;
      if (!ambiguous) return true;
      // For 1-word titles, require at least some disambiguator when we have one available.
      const hay = `${normalizeText(h?.title)} ${normalizeText(h?.description)}`.trim();
      const lt = normalizeText(lang);
      if (lt && hay.includes(lt)) return true;
      if (y && hay.includes(String(y))) return true;
      // If we don't have language/year, allow it through (best effort).
      return !(lt || y);
    })
    .sort((a, b) => b.s - a.s)
    .slice(0, 8)
    .map(({ h }) => ({ title: h.title, singers: [h.channel].filter(Boolean), youtubeUrl: h.youtubeUrl }));

  return filtered;
}

function tokenize(s) {
  return normalizeText(s)
    .split(/\s+/g)
    .filter((t) => t.length >= 3 && !['the', 'and', 'for', 'from', 'with', 'movie', 'film', 'song', 'songs'].includes(t));
}

function tokenizeTrackTitle(s) {
  // Track titles often contain short words ("Tu", "O", "Aa") that matter. Keep 2+ chars,
  // but exclude common English glue words to reduce noise.
  return normalizeText(s)
    .split(/\s+/g)
    .filter(
      (t) =>
        t.length >= 2 &&
        ![
          'the',
          'and',
          'for',
          'from',
          'with',
          'of',
          'to',
          'in',
          'on',
          'a',
          'an',
          'movie',
          'film',
          'song',
          'songs'
        ].includes(t)
    );
}

function isBadMusicHit(hay) {
  // Exclude common non-song videos that tend to pollute music search results.
  const bad = [
    'trailer',
    'teaser',
    'reaction',
    'review',
    'explained',
    'scene',
    'interview',
    'full movie',
    'recap',
    'karaoke',
    'instrumental',
    'cover',
    'remix',
    '8d',
    'slowed',
    'reverb'
  ];
  return bad.some((w) => hay.includes(w));
}

function scoreYoutubeTrackMatch({ movieTitle, language, year, trackTitle, artist, mode }, item) {
  const hay = `${normalizeText(item?.title)} ${normalizeText(item?.description)}`.trim();
  if (!hay) return -1;
  if (isBadMusicHit(hay)) return -1;

  const trackTokens = tokenizeTrackTitle(trackTitle);
  if (!trackTokens.length) return -1;

  const matchedTrack = trackTokens.filter((t) => hay.includes(t)).length;
  const trackScore = matchedTrack / trackTokens.length;

  const movieTokens = tokenize(movieTitle);
  const matchedMovie = movieTokens.filter((t) => hay.includes(t)).length;
  const movieScore = movieTokens.length ? matchedMovie / movieTokens.length : 0;

  const artistTokens = tokenize(artist || '');
  const matchedArtist = artistTokens.filter((t) => hay.includes(t)).length;
  const artistScore = artistTokens.length ? matchedArtist / artistTokens.length : 0;

  // In strict mode, require the candidate to actually contain most track tokens.
  // In best-effort mode, allow lower overlap, because YouTube titles often omit
  // the movie name or abbreviate the track name.
  const minTrackScore = mode === 'bestEffort' ? (trackTokens.length <= 2 ? 0.5 : 0.4) : trackTokens.length <= 2 ? 0.7 : 0.6;
  if (trackScore < minTrackScore) return -1;

  let bonus = 0;
  const langToken = normalizeText(language);
  if (langToken && hay.includes(langToken)) bonus += 0.2;
  if (year && hay.includes(String(year))) bonus += 0.12;
  if (hay.includes('official')) bonus += 0.08;
  if (hay.includes('lyric') || hay.includes('lyrical')) bonus += 0.08;
  if (hay.includes('audio')) bonus += 0.08;
  if (hay.includes('full song') || hay.includes('video song')) bonus += 0.05;
  if (artistScore >= 0.5) bonus += 0.12;

  return trackScore * 0.65 + Math.max(movieScore, artistScore) * 0.3 + bonus;
}

async function youtubeMatchVideosForTracklist({ movieTitle, language, year, tracks, trackArtists, mode }) {
  const rel = ytLangCode(language);
  const q1 = `${movieTitle} ${language ? `${language} ` : ''}songs`.trim();
  const q2 = `${movieTitle} ${language ? `${language} ` : ''}jukebox`.trim();
  const [a, b] = await Promise.all([
    youtubeSearchCached(db, q1, { maxResults: 25, videoCategoryId: 10, relevanceLanguage: rel || undefined, regionCode: 'IN' }).catch(
      () => []
    ),
    youtubeSearchCached(db, q2, { maxResults: 15, videoCategoryId: 10, relevanceLanguage: rel || undefined, regionCode: 'IN' }).catch(
      () => []
    )
  ]);
  const pool = [];
  const seen = new Set();
  for (const h of [...b, ...a]) {
    const url = String(h?.youtubeUrl || '');
    if (!url || seen.has(url)) continue;
    seen.add(url);
    pool.push(h);
  }

  const out = new Map();
  for (const t of tracks) {
    let best = null;
    let bestScore = -1;
    const artist = (trackArtists && (trackArtists.get ? trackArtists.get(t) : trackArtists[t])) || '';
    for (const h of pool) {
      const s = scoreYoutubeTrackMatch({ movieTitle, language, year, trackTitle: t, artist, mode }, h);
      if (s > bestScore) {
        bestScore = s;
        best = h;
      }
    }
    const gate = mode === 'bestEffort' ? 0.35 : 0.55;
    if (best && bestScore >= gate) out.set(t, best.youtubeUrl);
  }

  // If pool-based matching fails, do a limited number of per-track lookups.
  // This improves link coverage when track titles come from a catalog (iTunes) but
  // YouTube video titles don't include enough movie tokens.
  const perTrackLimit = Math.max(0, Math.min(16, Number(process.env.YOUTUBE_PER_TRACK_LOOKUPS || 0) || 0));
  const missing = tracks.filter((t) => !out.get(t)).slice(0, perTrackLimit);
  for (const t of missing) {
    const artist = (trackArtists && (trackArtists.get ? trackArtists.get(t) : trackArtists[t])) || '';
    const queries = [];
    const ctx = `${movieTitle} ${language ? `${language} ` : ''}${year ? `${year} ` : ''}`.trim();
    if (artist) queries.push(`${ctx} ${t} ${artist}`.trim());
    queries.push(`${ctx} ${t} song`.trim());
    queries.push(`${ctx} ${t} audio`.trim());
    queries.push(`${ctx} ${t} lyrical`.trim());
    // Only try artist-only searches when the movie title is not ambiguous; otherwise it can match unrelated songs.
    const movieTokens = tokenize(movieTitle);
    if (artist && movieTokens.length >= 2) {
      queries.push(`${t} ${artist} audio`.trim());
      queries.push(`${t} ${artist} lyrical`.trim());
    }

    let hits = [];
    for (const q of queries) {
      hits = await youtubeSearchCached(db, q, {
        maxResults: 14,
        // Best-effort mode favors link coverage; don't over-constrain by category.
        ...(mode === 'bestEffort' ? {} : { videoCategoryId: 10 }),
        relevanceLanguage: rel || undefined,
        regionCode: 'IN'
      }).catch(() => []);
      if (hits.length) break;
    }

    let best = null;
    let bestScore = -1;
    for (const h of hits) {
      const s = scoreYoutubeTrackMatch({ movieTitle, language, year, trackTitle: t, artist, mode }, h);
      if (s > bestScore) {
        bestScore = s;
        best = h;
      }
    }
    const gate = mode === 'bestEffort' ? 0.32 : 0.56;
    if (best && bestScore >= gate) out.set(t, best.youtubeUrl);
    // Best-effort fallback: if scoring couldn't confidently choose, still prefer the top hit,
    // but only when the hit includes at least one track token to avoid totally unrelated results.
    if (!out.get(t) && mode === 'bestEffort' && hits[0]?.youtubeUrl) {
      const hay = normalizeText(hits[0]?.title);
      const tt = tokenizeTrackTitle(t);
      const ok = tt.some((tok) => hay.includes(tok));
      if (ok) out.set(t, hits[0].youtubeUrl);
    }
  }

  return out;
}

async function wikipediaTracklistForMovie({ title, year, language, castNames }) {
  const base = String(title || '').trim();
  if (!base) return null;
  const lang = String(language || '').trim();
  const cast = Array.isArray(castNames) ? castNames.map((n) => String(n || '').trim()).filter(Boolean) : [];

  // If TMDB title is all-caps ("CHAMPION"), also try a title-cased variant for Wikipedia page lookup.
  const baseCandidates = Array.from(
    new Set([
      base,
      base.toUpperCase() === base && base.length > 1 ? base[0] + base.slice(1).toLowerCase() : '',
      base.toLowerCase() === base && base.length > 1 ? base[0].toUpperCase() + base.slice(1) : ''
    ].filter(Boolean))
  );

  const queries = [
    ...baseCandidates.flatMap((b) => [
      year ? `${b} (${year} film)` : '',
      year && lang ? `${b} (${year} ${lang} film)` : '',
      year ? `${b} (${year} Indian film)` : '',
      lang ? `${b} ${lang} film` : '',
      cast[0] ? `${b} ${lang ? `${lang} ` : ''}film ${cast[0]}`.trim() : '',
      `${b} film`,
      `${b} (film)`,
      `${b} (Indian film)`,
      b
    ])
  ].filter(Boolean);

  const wikiLangs = ['en'];
  const wl = ytLangCode(lang);
  if (wl && wl !== 'en') wikiLangs.push(wl);

  const seen = new Set();
  const scoreHit = (hit) => {
    const t = normalizeText(hit?.title);
    const s = normalizeText(hit?.snippet);
    const mt = normalizeText(base);
    const lt = normalizeText(lang);
    let score = 0;

    // Must be closely related to the movie title.
    if (mt && t.includes(mt)) score += 2.2;
    if (mt && s.includes(mt)) score += 0.8;

    // Prefer film pages.
    if (t.includes('film')) score += 1.2;
    if (s.includes('film')) score += 0.4;

    if (year && t.includes(String(year))) score += 1.0;
    if (year && s.includes(String(year))) score += 0.3;
    if (lt && (t.includes(lt) || s.includes(lt))) score += 0.8;

    // Avoid "Champion (song)" / unrelated pages.
    if ((t.includes('song') || t.includes('album')) && !t.includes('film') && !s.includes('film')) score -= 2.0;

    // Cast hints help disambiguate short titles.
    for (const cn of cast.slice(0, 2)) {
      const ct = normalizeText(cn);
      if (ct && (t.includes(ct) || s.includes(ct))) score += 0.5;
    }

    return score;
  };

  const looksLikeSameMovie = (lead, canonicalTitle) => {
    const ambiguousTitle = tokenize(baseCandidates[0] || base).length <= 1;
    const t = normalizeText(canonicalTitle || '');
    const mt = normalizeText(baseCandidates[0] || base);
    if (mt && !t.includes(mt) && !mt.includes(t)) return false;

    const l = normalizeText(lead || '');
    // Language is the most important for avoiding cross-film matches (e.g., Telugu vs Hindi).
    if (lang) {
      const lt = normalizeText(lang);
      if (lt && !(l.includes(`${lt} language`) || l.includes(`${lt}-language`) || l.includes(` ${lt} film`))) {
        return false;
      }
    }
    // If a year is available, ensure the lead mentions it (or is very close).
    if (year) {
      const y = String(year);
      if (!l.includes(y)) return false;
    }
    // Cast hint: only enforce for ambiguous titles (e.g., "Champion").
    const castTokens = (cast || [])
      .flatMap((n) => normalizeText(n).split(/\s+/g))
      .filter((x) => x.length >= 4)
      .slice(0, 8);
    if (ambiguousTitle && castTokens.length) {
      const hit = castTokens.some((ct) => l.includes(ct));
      if (!hit) return false;
    }
    return true;
  };

  for (const wikiLang of wikiLangs) {
    // Direct title attempts first (no search), because Wikipedia search can be noisy for ambiguous titles.
    // Example: https://en.wikipedia.org/wiki/Champion_(2025_film)
    if (year) {
      for (const b of baseCandidates) {
        const direct = [
          `${b} (${year} film)`,
          lang ? `${b} (${year} ${lang} film)` : '',
          `${b} (${year} Indian film)`
        ].filter(Boolean);
        for (const t of direct) {
          const key = `${wikiLang}:${t}`.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          const tl = await wikipediaSoundtrackTracksByTitle(t, { lang: wikiLang }).catch(() => null);
          if (tl && Array.isArray(tl.tracks) && tl.tracks.length >= 2) {
            const lead = await wikipediaLeadByTitle(tl.title, { lang: wikiLang }).catch(() => null);
            const ok = looksLikeSameMovie(lead?.extract || '', tl.title);
            if (ok) return tl;
          }
        }
      }
    }

    for (const q of queries) {
      const hits = await wikipediaSearch(q, { lang: wikiLang, limit: 8 }).catch(() => []);
      const ranked = hits
        .map((h) => ({ ...h, _score: scoreHit(h) }))
        .filter((h) => h._score >= 1.8)
        .sort((a, b) => b._score - a._score)
        .slice(0, 4);

      for (const h of ranked) {
        const key = `${wikiLang}:${h.title}`.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        const tl = await wikipediaSoundtrackTracksByTitle(h.title, { lang: wikiLang }).catch(() => null);
        if (tl && Array.isArray(tl.tracks) && tl.tracks.length >= 2) {
          const lead = await wikipediaLeadByTitle(tl.title, { lang: wikiLang }).catch(() => null);
          const ok = looksLikeSameMovie(lead?.extract || '', tl.title);
          if (ok) return tl;
        }
      }
    }
  }

  return null;
}

function ensureSeedTitles() {
  const seeds = process.env.SEED_TITLES
    ? process.env.SEED_TITLES.split(',').map((s) => s.trim()).filter(Boolean)
    : ['Pushpa 2', 'Kalki 2898 AD', 'Jawan', '12th Fail'];
  return seeds;
}

let homeSeedInFlight = null;
// Persisted across restarts via SQLite meta (important for Render restarts).
let lastHomeSeedAt = metaGetNumber('last_home_seed_at');

const HOME_CACHE_TTL_MS = 30 * 1000;
const homeCache = new Map(); // key -> { expiresAt: number, payload: any }
function homeCacheKey(lang) {
  const l = String(lang || '').trim().toLowerCase();
  return l || '*';
}

// In-memory admin tokens (dev-friendly). Tokens are lost on server restart.
const adminTokens = new Map(); // token -> expiresAt (ms)
const ADMIN_TTL_MS = 24 * 60 * 60 * 1000;

// Bulk backfill job (admin-triggered). Keeps state in SQLite meta for visibility after restarts.
let backfillJob = {
  inFlight: null,
  cancelRef: { cancelled: false },
  state: null
};

function backfillStateLoad() {
  try {
    const v = metaGet('backfill_state');
    if (!v?.value) return null;
    return JSON.parse(String(v.value));
  } catch {
    return null;
  }
}

function backfillStateSave(state) {
  try {
    metaSet('backfill_state', JSON.stringify(state || {}));
  } catch {
    // ignore
  }
}

function normalizeBackfillOverrides(raw) {
  const o = raw && typeof raw === 'object' ? raw : {};
  const num = (v) => (v == null ? null : Number(v));
  const clampInt = (v, min, max) => {
    const n = num(v);
    if (!Number.isFinite(n)) return null;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  };
  const MAX_LOOKBACK_DAYS = 40000; // keep in sync with seedLanguageIfSparse
  const MAX_FORWARD_DAYS = 3650;
  const strategyRaw = String(o.strategy || '').trim().toLowerCase();
  const strategy = strategyRaw === 'mixed' ? 'mixed' : strategyRaw === 'popular' ? 'popular' : null;
  return {
    lookbackDays: clampInt(o.lookbackDays, 60, MAX_LOOKBACK_DAYS),
    forwardDays: clampInt(o.forwardDays, 60, MAX_FORWARD_DAYS),
    pages: clampInt(o.pages, 1, 20),
    maxIds: clampInt(o.maxIds, 16, 600),
    desiredTotal: clampInt(o.desiredTotal, 24, 25000),
    desiredUpcoming: clampInt(o.desiredUpcoming, 2, 5000),
    strategy
  };
}

async function startBackfill({ scope, lang, force, overrides } = {}) {
  if (backfillJob.inFlight) return backfillJob.state || backfillStateLoad();

  const safeScope = scope === 'language' ? 'language' : 'all';
  const safeLang = String(lang || '').trim();
  const effectiveForce = force !== false; // default true
  const o = normalizeBackfillOverrides(overrides);

  backfillJob.cancelRef = { cancelled: false };
  const state = {
    status: 'running',
    scope: safeScope,
    lang: safeScope === 'language' ? safeLang : null,
    force: effectiveForce,
    overrides: o,
    startedAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null,
    cancelled: false,
    totals: { attempted: 0, wrote: 0, errors: 0 },
    results: []
  };
  backfillJob.state = state;
  backfillStateSave(state);

  backfillJob.inFlight = (async () => {
    try {
      if (safeScope === 'language') {
        if (!SUPPORTED_LANGUAGES.includes(safeLang)) {
          state.status = 'error';
          state.finishedAt = nowIso();
          state.updatedAt = nowIso();
          state.error = 'unsupported_lang';
          backfillStateSave(state);
          return;
        }
        const r = await seedLanguageIfSparse(safeLang, {
          force: effectiveForce,
          overrides: o,
          cancelRef: backfillJob.cancelRef
        });
        const rr = r || { lang: safeLang, attempted: 0, wrote: 0 };
        state.results.push(rr);
        state.totals.attempted += rr.attempted || 0;
        state.totals.wrote += rr.wrote || 0;
      } else {
        const r = await seedAllLanguages({
          force: effectiveForce,
          overrides: o,
          cancelRef: backfillJob.cancelRef
        });
        const results = Array.isArray(r?.results) ? r.results : [];
        state.results = results;
        for (const x of results) {
          state.totals.attempted += x?.attempted || 0;
          state.totals.wrote += x?.wrote || 0;
          if (x?.error) state.totals.errors += 1;
        }
      }

      if (backfillJob.cancelRef.cancelled) state.cancelled = true;
      state.status = state.cancelled ? 'cancelled' : 'done';
      state.updatedAt = nowIso();
      state.finishedAt = nowIso();
      backfillStateSave(state);
    } catch (e) {
      state.status = 'error';
      state.updatedAt = nowIso();
      state.finishedAt = nowIso();
      state.error = String(e?.message || e || 'backfill_failed');
      backfillStateSave(state);
    } finally {
      backfillJob.inFlight = null;
    }
  })();

  return state;
}

function requireAdmin(req, res) {
  const token = String(req.headers['x-admin-token'] || '').trim();
  if (!token) {
    res.status(401).json({ error: 'missing_admin_token' });
    return null;
  }
  const expiresAt = adminTokens.get(token);
  if (!expiresAt || Date.now() > expiresAt) {
    adminTokens.delete(token);
    res.status(401).json({ error: 'invalid_admin_token' });
    return null;
  }
  return token;
}

function normalizeMovieIdInput(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.startsWith('tmdb-movie:')) return s;
  if (/^\d+$/.test(s)) return makeId('tmdb-movie', Number(s));
  return s;
}

async function seedHomeFromProviders({ force = false } = {}) {
  const ttlMs = 12 * 60 * 60 * 1000;
  // Another instance (or a previous run) may have updated the persisted timestamp.
  const persisted = metaGetNumber('last_home_seed_at');
  if (persisted > lastHomeSeedAt) lastHomeSeedAt = persisted;
  if (!force && Date.now() - lastHomeSeedAt < ttlMs) return;
  if (homeSeedInFlight) return homeSeedInFlight;

  homeSeedInFlight = (async () => {
    const today = new Date().toISOString().slice(0, 10);
    const past45 = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const future180 = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // Two curated shelves: "New" (last 45 days) and "Upcoming" (next 180 days) for region IN.
    const languages = defaultIndianLanguageCodes();
    const pages = Math.max(1, Math.min(5, Number(process.env.HOME_SEED_PAGES || 0) || 2));
    const maxIds = Math.max(40, Math.min(180, Number(process.env.HOME_SEED_MAX_IDS || 0) || 80));
    const concurrency = Math.max(1, Math.min(8, Number(process.env.HOME_SEED_CONCURRENCY || 0) || 4));

    const newTasks = [];
    const upcomingTasks = [];
    for (let p = 1; p <= pages; p++) {
      newTasks.push(
        tmdbDiscoverMovies({
          dateGte: past45,
          dateLte: today,
          sortBy: 'popularity.desc',
          page: p,
          region: 'IN',
          languages,
          voteCountGte: 0
        }).catch(() => [])
      );
      upcomingTasks.push(
        tmdbDiscoverMovies({
          dateGte: today,
          dateLte: future180,
          sortBy: 'popularity.desc',
          page: p,
          region: 'IN',
          languages,
          voteCountGte: 0
        }).catch(() => [])
      );
    }

    const [newPages, upcomingPages] = await Promise.all([Promise.all(newTasks), Promise.all(upcomingTasks)]);
    const newHits = newPages.flat();
    const upcomingHits = upcomingPages.flat();

    const uniqueIds = Array.from(new Set([...newHits, ...upcomingHits].map((h) => h.tmdbId))).slice(0, maxIds);

    // Concurrency-limited upsert (TMDB movie full fetch is the expensive part).
    const q = uniqueIds.slice();
    const workers = Array.from({ length: concurrency }).map(async () => {
      while (q.length) {
        const tmdbId = q.shift();
        if (!tmdbId) return;
        try {
          const full = await tmdbGetMovieFull(tmdbId);
          upsertMovieFromTmdb(db, full);
        } catch {
          // ignore
        }
      }
    });
    await Promise.all(workers);

    lastHomeSeedAt = Date.now();
    metaSet('last_home_seed_at', String(lastHomeSeedAt));

    // While we're refreshing the home shelves, opportunistically seed language shelves too
    // so `/home?lang=...` has enough "New/Upcoming" without requiring a separate warm-up.
    if (process.env.HOME_SEED_ALL_LANGUAGES !== '0') {
      seedAllLanguages({ force: false }).catch(() => {});
    }
  })().finally(() => {
    homeSeedInFlight = null;
  });

  return homeSeedInFlight;
}

async function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) as c FROM movies').get().c;
  if (count > 0) {
    // Even if we already have movies, keep "New/Upcoming" shelves fresh periodically.
    // Never block user requests on provider refresh.
    seedHomeFromProviders().catch(() => {});
    return;
  }

  await seedHomeFromProviders({ force: true }).catch(() => {});

  const seeds = ensureSeedTitles();
  for (const title of seeds) {
    try {
      const hits = await tmdbSearchMovie(title);
      if (!hits.length) continue;
      const full = await tmdbGetMovieFull(hits[0].tmdbId);
      const movieId = upsertMovieFromTmdb(db, full);
      const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : null;
      const wiki = await wikipediaTracklistForMovie({
        title: full.title,
        year,
        language: full.language,
        castNames: (full.cast || []).slice(0, 2).map((c) => c?.name).filter(Boolean)
      }).catch(() => null);
      if (wiki?.tracks?.length) {
        const ytMode = tokenize(full.title).length <= 1 ? 'strict' : 'bestEffort';
        const trackMap = await youtubeMatchVideosForTracklist({
          movieTitle: full.title,
          language: full.language,
          year,
          tracks: wiki.tracks,
          mode: ytMode
        }).catch(() => new Map());
        const songs = wiki.tracks.slice(0, 20).map((t) => ({ title: t, singers: [], youtubeUrl: trackMap.get(t) || '' }));
        replaceSongsForMovie(db, movieId, songs, { source: 'wikipedia', platform: 'YouTube', wikiUrl: wiki.url || '' });
      } else {
        const hints = hintTokensFromNames((full.cast || []).slice(0, 8).map((c) => c?.name).filter(Boolean));
        const songs = await youtubeSearchSongsForMovie({ title: full.title, year, language: full.language, hints }).catch(() => []);
        replaceSongsFromYoutube(db, movieId, songs);
      }
    } catch {
      // ignore; still allow server start
    }
  }
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: nowIso() });
});

// --- Auth ---
app.get('/api/me', (req, res) => {
  const u = getUserBySession(db, getSessionId(req));
  res.json({ user: u });
});

app.post('/api/auth/signup', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
  const avatarUrl = String(req.body?.avatarUrl || '').trim().slice(0, 400);
  const captchaToken = String(req.body?.captchaToken || '');

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'invalid_email' });
  if (password.length < 8) return res.status(400).json({ error: 'weak_password' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
  const cap = await verifyCaptcha({ token: captchaToken, ip });
  if (!cap.ok) return res.status(400).json({ error: 'captcha_failed', provider: cap.provider });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'email_in_use' });

  const { saltB64, hash } = createPasswordHash(password);
  const userId = crypto.randomBytes(16).toString('hex');
  const ts = nowIso();
  db.prepare(
    `
    INSERT INTO users(id, email, password_salt, password_hash, display_name, avatar_url, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(userId, email, saltB64, hash, displayName, avatarUrl, ts, ts);

  const session = createSession(db, userId, req);
  setSessionCookie(res, session.id);
  res.json({ ok: true, user: { id: userId, email, displayName, avatarUrl } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || '');
  const captchaToken = String(req.body?.captchaToken || '');

  if (!email || !password) return res.status(400).json({ error: 'missing_fields' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
  const cap = await verifyCaptcha({ token: captchaToken, ip });
  if (!cap.ok) return res.status(400).json({ error: 'captcha_failed', provider: cap.provider });

  const row = db
    .prepare('SELECT id, email, password_salt, password_hash, display_name, avatar_url FROM users WHERE email = ?')
    .get(email);
  if (!row) return res.status(401).json({ error: 'invalid_credentials' });

  const computed = scryptHash(password, row.password_salt);
  if (!timingSafeEqual(computed, row.password_hash)) return res.status(401).json({ error: 'invalid_credentials' });

  const session = createSession(db, row.id, req);
  setSessionCookie(res, session.id);
  res.json({ ok: true, user: { id: row.id, email: row.email, displayName: row.display_name || '', avatarUrl: row.avatar_url || '' } });
});

app.post('/api/auth/logout', (req, res) => {
  const sid = getSessionId(req);
  deleteSession(db, sid);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const captchaToken = String(req.body?.captchaToken || '');
  if (!email) return res.status(400).json({ error: 'invalid_email' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
  const cap = await verifyCaptcha({ token: captchaToken, ip });
  if (!cap.ok) return res.status(400).json({ error: 'captcha_failed', provider: cap.provider });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  // Always return ok to avoid account enumeration.
  if (!user) return res.json({ ok: true });

  const pr = createPasswordReset(db, user.id);
  // TODO: send email via SMTP/Resend/etc. For dev, optionally return the token.
  if (String(process.env.RESET_RETURN_TOKEN || '') === '1') {
    return res.json({ ok: true, devToken: pr.token, expiresAt: pr.expiresAt });
  }
  res.json({ ok: true });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const token = String(req.body?.token || '').trim();
  const newPassword = String(req.body?.newPassword || '');
  const captchaToken = String(req.body?.captchaToken || '');
  if (!email || !token || newPassword.length < 8) return res.status(400).json({ error: 'invalid_request' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
  const cap = await verifyCaptcha({ token: captchaToken, ip });
  if (!cap.ok) return res.status(400).json({ error: 'captcha_failed', provider: cap.provider });

  const consumed = consumePasswordReset(db, email, token);
  if (!consumed.ok) return res.status(400).json({ error: consumed.error });

  const { saltB64, hash } = createPasswordHash(newPassword);
  db.prepare('UPDATE users SET password_salt = ?, password_hash = ?, updated_at = ? WHERE id = ?').run(
    saltB64,
    hash,
    nowIso(),
    consumed.userId
  );
  res.json({ ok: true });
});

app.post('/api/me/profile', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const displayName = String(req.body?.displayName || '').trim().slice(0, 80);
  const avatarUrl = String(req.body?.avatarUrl || '').trim().slice(0, 400);
  db.prepare('UPDATE users SET display_name = ?, avatar_url = ?, updated_at = ? WHERE id = ?').run(
    displayName,
    avatarUrl,
    nowIso(),
    u.id
  );
  res.json({ ok: true });
});

function normalizeMovieId(raw) {
  const s = String(raw || '').trim();
  if (!s) return '';
  if (s.includes(':')) return s;
  if (/^\d+$/.test(s)) return makeId('tmdb-movie', Number(s));
  return s;
}

async function requireCaptchaForWrite(req, res) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '');
  const token = String(req.body?.captchaToken || req.query?.captchaToken || '').trim();
  const cap = await verifyCaptcha({ token, ip });
  if (!cap.ok) {
    res.status(400).json({ error: 'captcha_failed', provider: cap.provider });
    return false;
  }
  return true;
}

// --- Favorites / Watchlist ---
app.get('/api/me/favorites', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const rows = db
    .prepare(
      `
      SELECT uf.movie_id as id
      FROM user_favorites uf
      WHERE uf.user_id = ?
      ORDER BY uf.created_at DESC
      LIMIT 200
    `
    )
    .all(u.id);
  const movies = rows.map((r) => hydrateMovie(db, r.id)).filter(Boolean);
  res.json({ movies });
});

app.get('/api/me/lists/contains', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const movieId = normalizeMovieId(req.query.movieId);
  if (!movieId) return res.status(400).json({ error: 'missing_movie' });
  const fav = db.prepare('SELECT 1 as ok FROM user_favorites WHERE user_id = ? AND movie_id = ? LIMIT 1').get(u.id, movieId);
  const wl = db.prepare('SELECT 1 as ok FROM user_watchlist WHERE user_id = ? AND movie_id = ? LIMIT 1').get(u.id, movieId);
  res.json({ favorite: !!fav, watchlist: !!wl });
});

app.post('/api/me/favorites', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;
  const movieId = normalizeMovieId(req.body?.movieId);
  if (!movieId) return res.status(400).json({ error: 'missing_movie' });
  const exists = hydrateMovie(db, movieId);
  if (!exists) return res.status(404).json({ error: 'movie_not_found' });
  db.prepare('INSERT OR IGNORE INTO user_favorites(user_id, movie_id, created_at) VALUES (?, ?, ?)').run(
    u.id,
    movieId,
    nowIso()
  );
  res.json({ ok: true });
});

app.delete('/api/me/favorites/:movieId', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;
  const movieId = normalizeMovieId(req.params.movieId);
  db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND movie_id = ?').run(u.id, movieId);
  res.json({ ok: true });
});

app.get('/api/me/watchlist', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const rows = db
    .prepare(
      `
      SELECT uw.movie_id as id
      FROM user_watchlist uw
      WHERE uw.user_id = ?
      ORDER BY uw.created_at DESC
      LIMIT 200
    `
    )
    .all(u.id);
  const movies = rows.map((r) => hydrateMovie(db, r.id)).filter(Boolean);
  res.json({ movies });
});

app.post('/api/me/watchlist', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;
  const movieId = normalizeMovieId(req.body?.movieId);
  if (!movieId) return res.status(400).json({ error: 'missing_movie' });
  const exists = hydrateMovie(db, movieId);
  if (!exists) return res.status(404).json({ error: 'movie_not_found' });
  db.prepare('INSERT OR IGNORE INTO user_watchlist(user_id, movie_id, created_at) VALUES (?, ?, ?)').run(
    u.id,
    movieId,
    nowIso()
  );
  res.json({ ok: true });
});

app.delete('/api/me/watchlist/:movieId', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;
  const movieId = normalizeMovieId(req.params.movieId);
  db.prepare('DELETE FROM user_watchlist WHERE user_id = ? AND movie_id = ?').run(u.id, movieId);
  res.json({ ok: true });
});

// --- User reviews (pending -> admin approval) ---
app.get('/api/movies/:id/user-reviews', (req, res) => {
  const movieId = normalizeMovieId(req.params.id);
  const rows = db
    .prepare(
      `
      SELECT ur.id, ur.rating, ur.body, ur.created_at, u.display_name
      FROM user_reviews ur
      JOIN users u ON u.id = ur.user_id
      WHERE ur.movie_id = ?
        AND ur.status = 'approved'
      ORDER BY ur.created_at DESC
      LIMIT 20
    `
    )
    .all(movieId);
  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      rating: typeof r.rating === 'number' ? r.rating : null,
      body: r.body || '',
      createdAt: r.created_at,
      author: r.display_name || 'User'
    }))
  });
});

app.post('/api/movies/:id/user-reviews', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;
  const movieId = normalizeMovieId(req.params.id);
  if (!hydrateMovie(db, movieId)) return res.status(404).json({ error: 'movie_not_found' });

  const rating = req.body?.rating == null ? null : Number(req.body.rating);
  if (rating != null && (!Number.isFinite(rating) || rating < 1 || rating > 10)) {
    return res.status(400).json({ error: 'invalid_rating' });
  }
  const body = String(req.body?.body || '').trim().slice(0, 2000);
  if (!body) return res.status(400).json({ error: 'missing_body' });

  const id = crypto.randomBytes(16).toString('hex');
  const ts = nowIso();
  db.prepare(
    `
    INSERT INTO user_reviews(id, user_id, movie_id, rating, body, status, created_at, updated_at, reviewed_at, reviewed_by)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL)
  `
  ).run(id, u.id, movieId, rating, body, ts, ts);
  res.json({ ok: true, status: 'pending' });
});

// --- User submissions: new movie / tv show (pending -> admin approval) ---
app.post('/api/submissions', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;

  const kind = String(req.body?.kind || 'movie').toLowerCase();
  if (kind !== 'movie' && kind !== 'tv') return res.status(400).json({ error: 'invalid_kind' });
  const title = String(req.body?.title || '').trim().slice(0, 140);
  if (!title) return res.status(400).json({ error: 'missing_title' });
  const language = String(req.body?.language || '').trim().slice(0, 30);
  const cast = Array.isArray(req.body?.cast) ? req.body.cast : [];

  // If the submission contains brand-new cast members, store them as separate person submissions
  // so they can be approved once and reused forever.
  const castOut = [];
  for (const c of cast.slice(0, 30)) {
    const type = String(c?.type || 'existing');
    if (type !== 'new') {
      castOut.push(c);
      continue;
    }

    const name = String(c?.name || '').trim().slice(0, 120);
    if (!name) continue;
    const profileImage = c?.profileImage ? String(c.profileImage).slice(0, 400) : '';
    const biography = c?.biography ? String(c.biography).slice(0, 2000) : '';
    const filmography = Array.isArray(c?.filmography)
      ? c.filmography.slice(0, 60).map((t) => String(t).slice(0, 120))
      : [];

    const sid = crypto.randomBytes(16).toString('hex');
    db.prepare(
      `
      INSERT INTO user_person_submissions(
        id, user_id, name, profile_image, biography, filmography_json, status, created_at,
        reviewed_at, reviewed_by, review_note
      ) VALUES (
        ?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL
      )
    `
    ).run(sid, u.id, name, profileImage, biography, JSON.stringify(filmography), nowIso());

    castOut.push({
      type: 'person_submission',
      personSubmissionId: sid,
      name
    });
  }

  const payload = {
    title,
    kind,
    language: language || null,
    releaseDate: req.body?.releaseDate ? String(req.body.releaseDate).slice(0, 32) : null,
    synopsis: req.body?.synopsis ? String(req.body.synopsis).slice(0, 2000) : null,
    trailerUrl: req.body?.trailerUrl ? String(req.body.trailerUrl).slice(0, 400) : null,
    ottProvider: req.body?.ottProvider ? String(req.body.ottProvider).slice(0, 60) : null,
    referenceUrl: req.body?.referenceUrl ? String(req.body.referenceUrl).slice(0, 400) : null,
    notes: req.body?.notes ? String(req.body.notes).slice(0, 2000) : null,
    cast: castOut.map((c) => ({
      type: String(c?.type || 'existing').slice(0, 30),
      personId: c?.personId ? String(c.personId).slice(0, 120) : null,
      tmdbId: typeof c?.tmdbId === 'number' ? c.tmdbId : null,
      name: c?.name ? String(c.name).slice(0, 120) : null,
      personSubmissionId: c?.personSubmissionId ? String(c.personSubmissionId).slice(0, 120) : null
    }))
  };

  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(
    `
    INSERT INTO user_submissions(id, user_id, kind, title, language, payload_json, status, created_at, reviewed_at, reviewed_by, review_note)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL)
  `
  ).run(id, u.id, kind, title, language || null, JSON.stringify(payload), nowIso());
  res.json({ ok: true, status: 'pending' });
});

// Create a reusable person record (pending approval).
app.post('/api/person-submissions', async (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  if (!(await requireCaptchaForWrite(req, res))) return;
  const name = String(req.body?.name || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'missing_name' });
  const profileImage = String(req.body?.profileImage || '').trim().slice(0, 400);
  const biography = String(req.body?.biography || '').trim().slice(0, 2000);
  const filmography = Array.isArray(req.body?.filmography)
    ? req.body.filmography.slice(0, 60).map((t) => String(t).slice(0, 120))
    : [];

  const id = crypto.randomBytes(16).toString('hex');
  db.prepare(
    `
    INSERT INTO user_person_submissions(
      id, user_id, name, profile_image, biography, filmography_json, status, created_at,
      reviewed_at, reviewed_by, review_note
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, NULL, NULL, NULL)
  `
  ).run(id, u.id, name, profileImage, biography, JSON.stringify(filmography), nowIso());
  res.json({ ok: true, status: 'pending', id });
});

// Public person search for submission UX (search existing cast)
app.get('/api/people/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ persons: [] });
  const needle = `%${q.toLowerCase()}%`;
  const rows = db
    .prepare(
      `
      SELECT id, tmdb_id, name, profile_image
      FROM persons
      WHERE lower(name) LIKE ?
      ORDER BY CASE WHEN lower(name) LIKE ? THEN 0 ELSE 1 END, name ASC
      LIMIT 20
    `
    )
    .all(needle, `${q.toLowerCase()}%`);
  res.json({
    persons: rows.map((p) => ({
      id: p.id,
      tmdbId: p.tmdb_id || undefined,
      name: p.name,
      profileImage: p.profile_image || undefined
    }))
  });
});

app.get('/api/me/reviews', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const rows = db
    .prepare(
      `
      SELECT ur.id, ur.movie_id, ur.rating, ur.body, ur.status, ur.created_at, m.title as movie_title
      FROM user_reviews ur
      JOIN movies m ON m.id = ur.movie_id
      WHERE ur.user_id = ?
      ORDER BY ur.created_at DESC
      LIMIT 200
    `
    )
    .all(u.id);
  res.json({
    reviews: rows.map((r) => ({
      id: r.id,
      movieId: r.movie_id,
      movieTitle: r.movie_title,
      rating: typeof r.rating === 'number' ? r.rating : null,
      body: r.body || '',
      status: r.status,
      createdAt: r.created_at
    }))
  });
});

app.get('/api/me/submissions', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const rows = db
    .prepare(
      `
      SELECT id, kind, title, language, status, created_at, reviewed_at, review_note
      FROM user_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `
    )
    .all(u.id);
  res.json({ submissions: rows });
});

app.get('/api/me/person-submissions', (req, res) => {
  const u = requireUser(db, req, res);
  if (!u) return;
  const rows = db
    .prepare(
      `
      SELECT id, person_id, name, status, created_at, reviewed_at, review_note
      FROM user_person_submissions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 200
    `
    )
    .all(u.id);
  res.json({ personSubmissions: rows });
});

app.get('/api/spotlight', async (_req, res) => {
  // Curated "popular actors" request: return a small set of well-known names with images,
  // resolved via TMDB search (server-side key).
  const curated = {
    Hindi: ['Shah Rukh Khan', 'Deepika Padukone', 'Amitabh Bachchan', 'Alia Bhatt'],
    Kannada: ['Yash', 'Sudeep', 'Rakshit Shetty', 'Rashmika Mandanna'],
    Telugu: ['Prabhas', 'Allu Arjun', 'Mahesh Babu', 'N. T. Rama Rao Jr.']
  };

  const groups = [];
  for (const [language, names] of Object.entries(curated)) {
    const persons = [];
    for (const name of names) {
      try {
        const hits = await tmdbSearchPerson(name);
        const hit = hits?.[0];
        if (!hit?.tmdbId) continue;

        const personId = makeId('tmdb-person', hit.tmdbId);
        const ts = nowIso();
        db.prepare(
          `
          INSERT INTO persons (id, tmdb_id, name, name_soundex, biography, wiki_url, profile_image, created_at, updated_at)
          VALUES (?, ?, ?, ?, COALESCE((SELECT biography FROM persons WHERE id = ?), ''), COALESCE((SELECT wiki_url FROM persons WHERE id = ?), ''), COALESCE(?, COALESCE((SELECT profile_image FROM persons WHERE id = ?), '')), ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            name_soundex=excluded.name_soundex,
            profile_image=CASE WHEN excluded.profile_image != '' THEN excluded.profile_image ELSE persons.profile_image END,
            updated_at=excluded.updated_at
        `
        ).run(
          personId,
          hit.tmdbId,
          hit.name,
          soundex(hit.name),
          personId,
          personId,
          hit.profileImage || '',
          personId,
          ts,
          ts
        );

        persons.push({ tmdbId: hit.tmdbId, name: hit.name, profileImage: hit.profileImage });
      } catch {
        // ignore
      }
    }
    groups.push({ language, persons });
  }

  res.json({ generatedAt: nowIso(), groups });
});

app.post('/api/admin/login', (req, res) => {
  const adminPassword = String(process.env.ADMIN_PASSWORD || '');
  if (!adminPassword) return res.status(500).json({ error: 'missing_ADMIN_PASSWORD' });

  const password = String(req.body?.password || '');
  if (password !== adminPassword) return res.status(401).json({ error: 'invalid_password' });

  const token = crypto.randomBytes(24).toString('hex');
  adminTokens.set(token, Date.now() + ADMIN_TTL_MS);
  res.json({ token });
});

app.post('/api/admin/logout', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  adminTokens.delete(token);
  res.json({ ok: true });
});

app.get('/api/admin/status', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const dbPath = resolveDbPath();
  const homeSeedMeta = metaGet('last_home_seed_at');
  const lastHomeSeedAtMs = homeSeedMeta ? Number(homeSeedMeta.value) : lastHomeSeedAt;
  const safeLastHomeSeedAtMs = Number.isFinite(lastHomeSeedAtMs) ? lastHomeSeedAtMs : 0;
  const ytQuotaUntilMs = metaGetNumber('youtube_quota_until');
  const allLangSeedMs = metaGetNumber('last_all_languages_seed_at');
  const languageSeeds = {};
  for (const l of SUPPORTED_LANGUAGES) {
    const ms = metaGetNumber(`last_lang_seed_at:${String(l).toLowerCase()}`);
    languageSeeds[l] = ms ? new Date(ms).toISOString() : null;
  }

  let agentLastRun = null;
  try {
    const p = path.join(process.cwd(), '.cache', 'agent-last-run.json');
    if (fs.existsSync(p)) {
      agentLastRun = JSON.parse(fs.readFileSync(p, 'utf-8'));
    }
  } catch {
    agentLastRun = null;
  }

  const counts = {
    movies: db.prepare('SELECT COUNT(*) as c FROM movies').get().c,
    persons: db.prepare('SELECT COUNT(*) as c FROM persons').get().c,
    songs: db.prepare('SELECT COUNT(*) as c FROM songs').get().c,
    ottOffers: db.prepare('SELECT COUNT(*) as c FROM ott_offers').get().c,
    ratings: db.prepare('SELECT COUNT(*) as c FROM ratings').get().c,
    reviews: db.prepare('SELECT COUNT(*) as c FROM reviews').get().c
  };

  const pending = {
    submissions: db.prepare("SELECT COUNT(*) as c FROM user_submissions WHERE status = 'pending'").get().c,
    userReviews: db.prepare("SELECT COUNT(*) as c FROM user_reviews WHERE status = 'pending'").get().c,
    personSubmissions: db
      .prepare("SELECT COUNT(*) as c FROM user_person_submissions WHERE status = 'pending'")
      .get().c
  };

  res.json({
    now: nowIso(),
    dbPath,
    counts,
    lastHomeSeedAt: safeLastHomeSeedAtMs,
    lastHomeSeedAtIso: safeLastHomeSeedAtMs ? new Date(safeLastHomeSeedAtMs).toISOString() : null,
    lastAllLanguagesSeedAtIso: allLangSeedMs ? new Date(allLangSeedMs).toISOString() : null,
    languageSeeds,
    youtubeQuotaUntilIso: ytQuotaUntilMs ? new Date(ytQuotaUntilMs).toISOString() : null,
    agentLastRun,
    backfill: backfillJob.state || backfillStateLoad(),
    pending,
    keys: {
      tmdb: !!(process.env.TMDB_API_KEY || process.env.TMDB_BEARER_TOKEN),
      youtube: !!process.env.YOUTUBE_API_KEY,
      omdb: !!process.env.OMDB_API_KEY
    }
  });
});

app.post('/api/admin/seed/home', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const force = req.body?.force === true;
  try {
    await seedHomeFromProviders({ force: true });
    if (req.body?.seedAllLanguages === true) {
      await seedAllLanguages({ force });
    }
  } catch {
    // ignore; report best-effort
  }

  const homeSeed = metaGetNumber('last_home_seed_at');
  res.json({
    ok: true,
    lastHomeSeedAtIso: homeSeed ? new Date(homeSeed).toISOString() : null
  });
});

app.post('/api/admin/seed/language', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const lang = String(req.body?.lang || '').trim();
  if (!lang) return res.status(400).json({ error: 'missing_lang' });
  if (!SUPPORTED_LANGUAGES.includes(lang)) return res.status(400).json({ error: 'unsupported_lang' });

  try {
    const r = await seedLanguageIfSparse(lang, { force: true });
    return res.json({ ok: true, result: r || { lang, attempted: 0, wrote: 0 } });
  } catch {
    return res.status(500).json({ error: 'seed_failed' });
  }
});

app.post('/api/admin/seed/all-languages', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const force = req.body?.force === true;
  try {
    const r = await seedAllLanguages({ force: force });
    return res.json({ ok: true, ...r });
  } catch {
    return res.status(500).json({ error: 'seed_failed' });
  }
});

app.get('/api/admin/backfill/status', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  res.json({ now: nowIso(), backfill: backfillJob.state || backfillStateLoad() });
});

app.post('/api/admin/backfill/start', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const scope = String(req.body?.scope || 'all');
  const lang = String(req.body?.lang || '').trim();
  const force = req.body?.force !== false; // default true
  const overrides = normalizeBackfillOverrides(req.body?.overrides || {});
  const state = await startBackfill({ scope, lang, force, overrides });
  res.json({ ok: true, backfill: state });
});

app.post('/api/admin/backfill/cancel', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  if (!backfillJob.inFlight) return res.json({ ok: true, cancelled: false });
  backfillJob.cancelRef.cancelled = true;
  if (backfillJob.state) {
    backfillJob.state.cancelled = true;
    backfillJob.state.updatedAt = nowIso();
    backfillStateSave(backfillJob.state);
  }
  res.json({ ok: true, cancelled: true });
});

app.get('/api/admin/moderation', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const submissions = db
    .prepare(
      `
      SELECT s.id, s.kind, s.title, s.language, s.payload_json, s.created_at, u.email, u.display_name
      FROM user_submissions s
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'pending'
      ORDER BY s.created_at ASC
      LIMIT 200
    `
    )
    .all()
    .map((r) => {
      let payload = null;
      try {
        payload = r.payload_json ? JSON.parse(String(r.payload_json)) : null;
      } catch {
        payload = null;
      }
      return {
        id: r.id,
        kind: r.kind,
        title: r.title,
        language: r.language || '',
        createdAt: r.created_at,
        user: { email: r.email, displayName: r.display_name || '' },
        payload
      };
    });

  const reviews = db
    .prepare(
      `
      SELECT ur.id, ur.movie_id, ur.rating, ur.body, ur.created_at, m.title as movie_title, u.email, u.display_name
      FROM user_reviews ur
      JOIN users u ON u.id = ur.user_id
      JOIN movies m ON m.id = ur.movie_id
      WHERE ur.status = 'pending'
      ORDER BY ur.created_at ASC
      LIMIT 200
    `
    )
    .all()
    .map((r) => ({
      id: r.id,
      movieId: r.movie_id,
      movieTitle: r.movie_title,
      rating: typeof r.rating === 'number' ? r.rating : null,
      body: r.body || '',
      createdAt: r.created_at,
      user: { email: r.email, displayName: r.display_name || '' }
    }));

  const personSubmissions = db
    .prepare(
      `
      SELECT ps.id, ps.person_id, ps.name, ps.profile_image, ps.biography, ps.filmography_json, ps.created_at, u.email, u.display_name
      FROM user_person_submissions ps
      JOIN users u ON u.id = ps.user_id
      WHERE ps.status = 'pending'
      ORDER BY ps.created_at ASC
      LIMIT 200
    `
    )
    .all()
    .map((r) => {
      let filmography = [];
      try {
        filmography = r.filmography_json ? JSON.parse(String(r.filmography_json)) : [];
      } catch {
        filmography = [];
      }
      return {
        id: r.id,
        personId: r.person_id || undefined,
        name: r.name,
        profileImage: r.profile_image || '',
        biography: r.biography || '',
        filmography: Array.isArray(filmography) ? filmography : [],
        createdAt: r.created_at,
        user: { email: r.email, displayName: r.display_name || '' }
      };
    });

  res.json({ now: nowIso(), submissions, reviews, personSubmissions });
});

app.post('/api/admin/reviews/:id/approve', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const id = String(req.params.id || '');
  db.prepare("UPDATE user_reviews SET status = 'approved', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(
    nowIso(),
    token,
    id
  );
  res.json({ ok: true });
});

app.post('/api/admin/reviews/:id/reject', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const id = String(req.params.id || '');
  db.prepare("UPDATE user_reviews SET status = 'rejected', reviewed_at = ?, reviewed_by = ? WHERE id = ?").run(
    nowIso(),
    token,
    id
  );
  res.json({ ok: true });
});

app.post('/api/admin/submissions/:id/approve', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const id = String(req.params.id || '');
  db.prepare(
    "UPDATE user_submissions SET status = 'approved', reviewed_at = ?, reviewed_by = ?, review_note = ? WHERE id = ?"
  ).run(nowIso(), token, String(req.body?.note || '').slice(0, 400), id);
  res.json({ ok: true });
});

app.post('/api/admin/submissions/:id/reject', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const id = String(req.params.id || '');
  db.prepare(
    "UPDATE user_submissions SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, review_note = ? WHERE id = ?"
  ).run(nowIso(), token, String(req.body?.note || '').slice(0, 400), id);
  res.json({ ok: true });
});

app.post('/api/admin/person-submissions/:id/approve', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const id = String(req.params.id || '');
  const row = db
    .prepare(
      `
      SELECT id, user_id, person_id, name, profile_image, biography, filmography_json, status
      FROM user_person_submissions
      WHERE id = ?
    `
    )
    .get(id);
  if (!row) return res.status(404).json({ error: 'not_found' });
  if (row.status !== 'pending') return res.json({ ok: true, status: row.status, personId: row.person_id || null });

  const personId = row.person_id || hashId('user-person', row.id);
  const ts = nowIso();
  db.exec('BEGIN');
  try {
    db.prepare(
      `
      INSERT INTO persons (id, tmdb_id, name, name_soundex, biography, wiki_url, profile_image, filmography_json, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, '', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        name_soundex=excluded.name_soundex,
        biography=excluded.biography,
        profile_image=CASE WHEN excluded.profile_image != '' THEN excluded.profile_image ELSE persons.profile_image END,
        filmography_json=COALESCE(excluded.filmography_json, persons.filmography_json),
        updated_at=excluded.updated_at
    `
    ).run(
      personId,
      row.name,
      soundex(row.name),
      row.biography || '',
      row.profile_image || '',
      row.filmography_json || '[]',
      ts,
      ts
    );

    db.prepare(
      `
      UPDATE user_person_submissions
      SET status = 'approved', person_id = ?, reviewed_at = ?, reviewed_by = ?, review_note = ?
      WHERE id = ?
    `
    ).run(personId, ts, token, String(req.body?.note || '').slice(0, 400), id);

    // Best-effort: any pending submissions referencing this person submission now point at the approved person record.
    const affected = db
      .prepare(
        `
        SELECT id, payload_json
        FROM user_submissions
        WHERE status = 'pending' AND payload_json LIKE ?
      `
      )
      .all(`%${id}%`);
    for (const s of affected) {
      try {
        const payload = s.payload_json ? JSON.parse(String(s.payload_json)) : null;
        if (!payload || !Array.isArray(payload.cast)) continue;
        let changed = false;
        const cast = payload.cast.map((c) => {
          if (c?.type === 'person_submission' && c?.personSubmissionId === id) {
            changed = true;
            return { ...c, type: 'existing', personId };
          }
          return c;
        });
        if (!changed) continue;
        payload.cast = cast;
        db.prepare('UPDATE user_submissions SET payload_json = ? WHERE id = ?').run(JSON.stringify(payload), s.id);
      } catch {
        // ignore
      }
    }

    db.prepare(
      'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(hashId('attr', `${personId}:user`), 'person', personId, 'user', row.user_id, '', ts);

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    return res.status(500).json({ error: 'approve_failed' });
  }
  res.json({ ok: true, personId });
});

app.post('/api/admin/person-submissions/:id/reject', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const id = String(req.params.id || '');
  db.prepare(
    "UPDATE user_person_submissions SET status = 'rejected', reviewed_at = ?, reviewed_by = ?, review_note = ? WHERE id = ?"
  ).run(nowIso(), token, String(req.body?.note || '').slice(0, 400), id);
  res.json({ ok: true });
});

// --- Admin: catalog maintenance (movies/songs/cast) ---
app.get('/api/admin/movies/:id', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const rawId = String(req.params.id || '');
  let movieId = normalizeMovieIdInput(rawId);

  let movie = hydrateMovie(db, movieId);
  if (!movie && (/^\d+$/.test(rawId) || rawId.startsWith('tmdb-movie:'))) {
    const tmdbId = rawId.startsWith('tmdb-movie:') ? Number(rawId.split(':')[1]) : Number(rawId);
    if (Number.isFinite(tmdbId)) {
      try {
        const full = await tmdbGetMovieFull(tmdbId);
        movieId = upsertMovieFromTmdb(db, full);
        movie = hydrateMovie(db, movieId);
      } catch {
        // ignore
      }
    }
  }
  if (!movie) return res.status(404).json({ error: 'not_found' });

  const songs = db
    .prepare('SELECT id, title, singers_json, youtube_url, platform, source, created_at FROM songs WHERE movie_id = ? ORDER BY created_at DESC')
    .all(movieId)
    .map((s) => {
      let singers = [];
      try {
        singers = s.singers_json ? JSON.parse(String(s.singers_json)) : [];
      } catch {
        singers = [];
      }
      return {
        id: s.id,
        title: s.title,
        singers: Array.isArray(singers) ? singers : [],
        youtubeUrl: s.youtube_url || '',
        platform: s.platform || 'YouTube',
        source: s.source || '',
        createdAt: s.created_at
      };
    });

  const cast = db
    .prepare(
      `
      SELECT p.id as person_id, p.tmdb_id, p.name, p.profile_image, p.wiki_url, mc.character, mc.billing_order
      FROM movie_cast mc
      JOIN persons p ON p.id = mc.person_id
      WHERE mc.movie_id = ?
      ORDER BY mc.billing_order ASC
      LIMIT 80
    `
    )
    .all(movieId)
    .map((r) => ({
      personId: r.person_id,
      tmdbId: r.tmdb_id || undefined,
      name: r.name,
      profileImage: r.profile_image || '',
      profileUrl: r.wiki_url || '',
      character: r.character || '',
      billingOrder: typeof r.billing_order === 'number' ? r.billing_order : null
    }));

  res.json({ movieId, movie, songs, cast });
});

app.post('/api/admin/movies/:id/update', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const movieId = normalizeMovieIdInput(req.params.id);
  const existing = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!existing) return res.status(404).json({ error: 'not_found' });

  const pick = (k, max) => (Object.prototype.hasOwnProperty.call(req.body || {}, k) ? String(req.body?.[k] ?? '').slice(0, max) : null);
  const title = pick('title', 140);
  const language = pick('language', 40);
  const synopsis = pick('synopsis', 2400);
  const director = pick('director', 120);
  const releaseDate = pick('releaseDate', 20);
  const status = pick('status', 40);
  const trailerUrl = pick('trailerUrl', 400);
  const poster = pick('poster', 400);
  const backdrop = pick('backdrop', 400);
  const titleSoundex = title != null ? soundex(title) : null;
  const titleNorm = title != null ? normalizeForSearch(title) : null;

  const ts = nowIso();
  db.prepare(
    `
    UPDATE movies SET
      title = CASE WHEN ? IS NULL THEN title ELSE ? END,
      title_soundex = CASE WHEN ? IS NULL THEN title_soundex ELSE ? END,
      title_norm = CASE WHEN ? IS NULL THEN title_norm ELSE ? END,
      language = CASE WHEN ? IS NULL THEN language ELSE ? END,
      synopsis = CASE WHEN ? IS NULL THEN synopsis ELSE ? END,
      director = CASE WHEN ? IS NULL THEN director ELSE ? END,
      release_date = CASE WHEN ? IS NULL THEN release_date ELSE ? END,
      status = CASE WHEN ? IS NULL THEN status ELSE ? END,
      trailer_url = CASE WHEN ? IS NULL THEN trailer_url ELSE ? END,
      poster = CASE WHEN ? IS NULL THEN poster ELSE ? END,
      backdrop = CASE WHEN ? IS NULL THEN backdrop ELSE ? END,
      updated_at = ?
    WHERE id = ?
  `
  ).run(
    title, title,
    titleSoundex, titleSoundex,
    titleNorm, titleNorm,
    language, language,
    synopsis, synopsis,
    director, director,
    releaseDate, releaseDate,
    status, status,
    trailerUrl, trailerUrl,
    poster, poster,
    backdrop, backdrop,
    ts,
    movieId
  );

  if (Array.isArray(req.body?.genres)) {
    db.exec('BEGIN');
    try {
      db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(movieId);
      for (const g of req.body.genres) {
        const genre = String(g || '').trim().slice(0, 60);
        if (!genre) continue;
        db.prepare('INSERT OR IGNORE INTO movie_genres(movie_id, genre) VALUES (?, ?)').run(movieId, genre);
      }
      db.exec('COMMIT');
    } catch {
      try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    }
  }

  res.json({ ok: true });
});

app.get('/api/admin/persons/search', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const q = String(req.query.q || '').trim().slice(0, 80);
  if (!q) return res.json({ persons: [] });
  const needle = `%${q.toLowerCase()}%`;
  const persons = db
    .prepare(
      `
      SELECT id, tmdb_id, name, profile_image, wiki_url
      FROM persons
      WHERE lower(name) LIKE ?
      ORDER BY name ASC
      LIMIT 30
    `
    )
    .all(needle)
    .map((p) => ({
      id: p.id,
      tmdbId: p.tmdb_id || undefined,
      name: p.name,
      profileImage: p.profile_image || '',
      profileUrl: p.wiki_url || ''
    }));
  res.json({ persons });
});

// NOTE: this must not conflict with `/api/admin/movies/:id`, so keep a non-overlapping path.
app.get('/api/admin/movies-search', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const q = String(req.query.q || '').trim().slice(0, 100);
  if (!q) return res.json({ movies: [] });

  // If the user pastes an id, return a direct hit.
  const asId = normalizeMovieIdInput(q);
  const direct = db
    .prepare('SELECT id, tmdb_id, title, language, release_date, poster FROM movies WHERE id = ? LIMIT 1')
    .get(asId);
  if (direct) {
    return res.json({
      movies: [
        {
          id: direct.id,
          tmdbId: direct.tmdb_id || undefined,
          title: direct.title,
          language: direct.language || '',
          releaseDate: direct.release_date || '',
          poster: direct.poster || ''
        }
      ]
    });
  }

  const qLower = q.toLowerCase();
  const needle = `%${qLower}%`;
  const qNorm = normalizeForSearch(q);
  const normNeedle = qNorm ? `%${qNorm}%` : '';
  const sx = soundex(q);

  const normTokens = qLower
    .split(/[^a-z0-9]+/g)
    .filter(Boolean)
    .slice(0, 4)
    .map((t) => normalizeForSearch(t))
    .filter(Boolean);
  const useTokenAnd = normTokens.length >= 2;
  const tokenConds = useTokenAnd ? normTokens.map(() => 'title_norm LIKE ?').join(' AND ') : '';
  const tokenParams = useTokenAnd ? normTokens.map((t) => `%${t}%`) : [];

  const whereClauses = ['lower(title) LIKE ?'];
  const whereParams = [needle];
  if (qNorm) {
    whereClauses.push('title_norm LIKE ?');
    whereParams.push(normNeedle);
  }
  if (sx) {
    whereClauses.push('title_soundex = ?');
    whereParams.push(sx);
  }
  if (useTokenAnd) {
    whereClauses.push(`(${tokenConds})`);
    whereParams.push(...tokenParams);
  }

  const caseParts = ['WHEN lower(title) = ? THEN 100', 'WHEN lower(title) LIKE ? THEN 90'];
  const caseParams = [qLower, needle];
  if (qNorm) {
    caseParts.push('WHEN title_norm = ? THEN 95');
    caseParams.push(qNorm);
    caseParts.push('WHEN title_norm LIKE ? THEN 85');
    caseParams.push(normNeedle);
  }
  if (useTokenAnd) {
    caseParts.push(`WHEN (${tokenConds}) THEN 88`);
    caseParams.push(...tokenParams);
  }
  if (sx) {
    caseParts.push('WHEN title_soundex = ? THEN 70');
    caseParams.push(sx);
  }
  caseParts.push('ELSE 0');

  const rows = db
    .prepare(
      `
      SELECT id, tmdb_id, title, language, release_date, poster,
        CASE ${caseParts.join(' ')} END AS score
      FROM movies
      WHERE COALESCE(is_indian, 1) = 1
        AND (${whereClauses.join(' OR ')})
      ORDER BY score DESC, COALESCE(release_date, '0000-00-00') DESC, title ASC
      LIMIT 30
    `
    )
    .all(...caseParams, ...whereParams);

  res.json({
    movies: rows.map((m) => ({
      id: m.id,
      tmdbId: m.tmdb_id || undefined,
      title: m.title,
      language: m.language || '',
      releaseDate: m.release_date || '',
      poster: m.poster || ''
    }))
  });
});

// List incomplete movies for admin cleanup (e.g. upcoming missing synopsis/cast/artwork).
// NOTE: keep path non-overlapping with `/api/admin/movies/:id`.
app.get('/api/admin/movies-incomplete', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const status = String(req.query.status || 'Upcoming').trim();
  const lang = String(req.query.lang || '').trim();
  const limit = Math.max(1, Math.min(200, Number(req.query.limit || 60) || 60));

  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.tmdb_id,
        m.title,
        m.language,
        m.release_date,
        m.status,
        m.poster,
        m.backdrop,
        m.synopsis,
        m.updated_at,
        (SELECT COUNT(*) FROM movie_cast mc WHERE mc.movie_id = m.id) as cast_count
      FROM movies m
      WHERE COALESCE(m.is_indian, 1) = 1
        AND (? = '' OR lower(m.language) = lower(?))
        AND (? = '' OR lower(m.status) = lower(?))
        AND (
          length(trim(COALESCE(m.synopsis, ''))) < 12
          OR (trim(COALESCE(m.poster, '')) = '' AND trim(COALESCE(m.backdrop, '')) = '')
          OR (SELECT COUNT(*) FROM movie_cast mc WHERE mc.movie_id = m.id) = 0
        )
      ORDER BY
        CASE WHEN m.release_date IS NULL OR m.release_date = '' THEN 1 ELSE 0 END,
        COALESCE(m.release_date, '9999-99-99') ASC,
        COALESCE(m.updated_at, m.created_at) DESC
      LIMIT ?
    `
    )
    .all(lang, lang, status, status, limit)
    .map((r) => {
      const synopsisLen = String(r.synopsis || '').trim().length;
      const hasArtwork = !!String(r.poster || '').trim() || !!String(r.backdrop || '').trim();
      return {
        id: r.id,
        tmdbId: r.tmdb_id || undefined,
        title: r.title,
        language: r.language || '',
        releaseDate: r.release_date || '',
        status: r.status || '',
        poster: r.poster || '',
        updatedAt: r.updated_at || '',
        missing: {
          synopsis: synopsisLen < 12,
          artwork: !hasArtwork,
          cast: Number(r.cast_count || 0) === 0
        }
      };
    });

  res.json({ now: nowIso(), status, lang: lang || null, movies: rows });
});

app.post('/api/admin/movies/:id/refresh', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const movieId = normalizeMovieIdInput(req.params.id);
  const exists = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!exists) return res.status(404).json({ error: 'not_found' });

  const forceSongs = req.body?.forceSongs === true;
  try {
    await enrichMovieIfNeeded(movieId, { forceFull: true, forceSongs });
  } catch {
    // ignore
  }

  const movie = hydrateMovie(db, movieId);
  res.json({ ok: true, movieId, movie });
});

app.post('/api/admin/movies/:id/cast/add', async (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const movieId = normalizeMovieIdInput(req.params.id);
  const exists = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!exists) return res.status(404).json({ error: 'not_found' });

  const personIdRaw = String(req.body?.personId || '').trim();
  const tmdbPersonId = req.body?.tmdbPersonId != null ? Number(req.body.tmdbPersonId) : null;
  const character = String(req.body?.character || '').trim().slice(0, 120);
  const billingOrder = req.body?.billingOrder != null ? Number(req.body.billingOrder) : null;

  let personId = personIdRaw;
  if (!personId && tmdbPersonId && Number.isFinite(tmdbPersonId)) {
    personId = makeId('tmdb-person', tmdbPersonId);
    const has = db.prepare('SELECT id FROM persons WHERE id = ?').get(personId);
    if (!has) {
      try {
        const full = await tmdbGetPersonFull(tmdbPersonId);
        const ts = nowIso();
        db.prepare(
          `
          INSERT INTO persons (id, tmdb_id, name, name_soundex, biography, wiki_url, profile_image, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name=excluded.name,
            name_soundex=excluded.name_soundex,
            biography=excluded.biography,
            profile_image=excluded.profile_image,
            updated_at=excluded.updated_at
        `
        ).run(personId, full.tmdbId, full.name, soundex(full.name), full.biography || '', full.profileImage || '', ts, ts);
      } catch {
        // ignore
      }
    }
  }

  if (!personId) return res.status(400).json({ error: 'missing_person' });
  const p = db.prepare('SELECT id FROM persons WHERE id = ?').get(personId);
  if (!p) return res.status(404).json({ error: 'person_not_found' });

  const order =
    Number.isFinite(billingOrder) && billingOrder != null
      ? billingOrder
      : (db.prepare('SELECT COALESCE(MAX(billing_order), -1) as m FROM movie_cast WHERE movie_id = ?').get(movieId)?.m || -1) + 1;

  db.prepare(
    'INSERT OR REPLACE INTO movie_cast(movie_id, person_id, character, billing_order) VALUES (?, ?, ?, ?)'
  ).run(movieId, personId, character, order);

  res.json({ ok: true });
});

app.post('/api/admin/movies/:id/cast/remove', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const movieId = normalizeMovieIdInput(req.params.id);
  const personId = String(req.body?.personId || '').trim();
  if (!movieId || !personId) return res.status(400).json({ error: 'missing_fields' });
  db.prepare('DELETE FROM movie_cast WHERE movie_id = ? AND person_id = ?').run(movieId, personId);
  res.json({ ok: true });
});

app.post('/api/admin/movies/:id/songs/upsert', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;

  const movieId = normalizeMovieIdInput(req.params.id);
  const exists = db.prepare('SELECT id FROM movies WHERE id = ?').get(movieId);
  if (!exists) return res.status(404).json({ error: 'not_found' });

  const payload = req.body?.song ? [req.body.song] : Array.isArray(req.body?.songs) ? req.body.songs : [];
  if (!payload.length) return res.status(400).json({ error: 'missing_songs' });

  const ts = nowIso();
  db.exec('BEGIN');
  try {
    for (const s of payload.slice(0, 30)) {
      const title = String(s?.title || '').trim().slice(0, 140);
      if (!title) continue;
      const singers = Array.isArray(s?.singers) ? s.singers.slice(0, 12).map((x) => String(x).trim().slice(0, 80)).filter(Boolean) : [];
      const youtubeUrl = s?.youtubeUrl ? String(s.youtubeUrl).trim().slice(0, 400) : '';
      const platform = s?.platform ? String(s.platform).trim().slice(0, 40) : 'YouTube';

      let songId = s?.id ? String(s.id).trim() : '';
      if (songId) {
        const row = db.prepare('SELECT id FROM songs WHERE id = ? AND movie_id = ?').get(songId, movieId);
        if (!row) songId = '';
      }
      if (!songId) {
        const salt = crypto.randomBytes(8).toString('hex');
        songId = hashId('song', `${movieId}:admin:${normalizeText(title)}:${salt}`);
      }

      db.prepare(
        `
        INSERT OR REPLACE INTO songs(
          id, movie_id, title, singers_json, youtube_url, platform, source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(songId, movieId, title, JSON.stringify(singers), youtubeUrl, platform, 'admin', ts);

      db.prepare("DELETE FROM attributions WHERE entity_type = 'song' AND entity_id = ?").run(songId);
      db.prepare(
        'INSERT OR REPLACE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(hashId('attr', `${songId}:admin`), 'song', songId, 'admin', token, '', ts);

      if (youtubeUrl) {
        db.prepare(
          'INSERT OR REPLACE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(hashId('attr', `${songId}:youtube`), 'song', songId, 'youtube', '', youtubeUrl, ts);
      }
    }
    db.exec('COMMIT');
  } catch {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    return res.status(500).json({ error: 'upsert_failed' });
  }

  res.json({ ok: true });
});

app.post('/api/admin/movies/:id/songs/:songId/delete', (req, res) => {
  const token = requireAdmin(req, res);
  if (!token) return;
  const movieId = normalizeMovieIdInput(req.params.id);
  const songId = String(req.params.songId || '').trim();
  if (!songId) return res.status(400).json({ error: 'missing_song_id' });

  const row = db.prepare('SELECT id FROM songs WHERE id = ? AND movie_id = ?').get(songId, movieId);
  if (!row) return res.json({ ok: true });

  db.prepare("DELETE FROM attributions WHERE entity_type = 'song' AND entity_id = ?").run(songId);
  db.prepare('DELETE FROM songs WHERE id = ? AND movie_id = ?').run(songId, movieId);
  res.json({ ok: true });
});

app.get('/api/home', async (_req, res) => {
  const lang = String(_req.query.lang || '').trim();
  const refresh = String(_req.query.refresh || '') === '1';
  const ck = homeCacheKey(lang);

  if (!refresh) {
    const cached = homeCache.get(ck);
    if (cached && Date.now() < cached.expiresAt) {
      // Keep shelves fresh in the background, but return the cached payload immediately.
      seedIfEmpty().catch(() => {});
      if (lang) seedLanguageIfSparse(lang).catch(() => {});
      return res.json(cached.payload);
    }
  } else {
    homeCache.delete(ck);
  }

  await seedIfEmpty();
  if (lang) {
    // Only block if we have *zero* rows for the language (otherwise return fast and seed in background).
    const haveLang = db
      .prepare('SELECT COUNT(*) as c FROM movies WHERE lower(language) = lower(?)')
      .get(lang)?.c;
    if (!haveLang || (refresh && haveLang < 24)) {
      await seedLanguageIfSparse(lang, { force: refresh }).catch(() => {});
    } else {
      seedLanguageIfSparse(lang, { force: refresh }).catch(() => {});
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const upcomingIds = db
    .prepare(
      `
      SELECT id FROM movies
      WHERE release_date > ?
        AND COALESCE(is_indian, 1) = 1
        AND (? = '' OR lower(language) = lower(?))
      ORDER BY release_date ASC
      LIMIT 24
    `
    )
    .all(today, lang, lang)
    .map((r) => r.id);

  const newIds = db
    .prepare(
      `
      SELECT id FROM movies
      WHERE release_date BETWEEN ? AND ?
        AND COALESCE(is_indian, 1) = 1
        AND (? = '' OR lower(language) = lower(?))
      ORDER BY release_date DESC
      LIMIT 24
    `
    )
    .all(sixtyDaysAgo, today, lang, lang)
    .map((r) => r.id);

  // If a specific language has no "New" / "Upcoming" matches, fall back to "Latest" for that language
  // so the page isn't empty.
  let finalNewIds = newIds;
  if (lang && newIds.length === 0 && upcomingIds.length === 0) {
    finalNewIds = db
      .prepare(
        `
        SELECT id FROM movies
        WHERE (? = '' OR lower(language) = lower(?))
          AND COALESCE(is_indian, 1) = 1
        ORDER BY COALESCE(release_date, '0000-00-00') DESC
        LIMIT 24
      `
      )
      .all(lang, lang)
      .map((r) => r.id);
  }

  // Ensure the visible shelf items have ratings/reviews/trailer where possible.
  const toEnrich = Array.from(new Set([...finalNewIds, ...upcomingIds])).slice(0, 8);
  // Never block the home payload on external API calls (TMDB/OMDb/YouTube/etc).
  // Enrich in the background; the next request will read from SQLite.
  if (toEnrich.length) {
    (async () => {
      for (const id of toEnrich) {
        try {
          await enrichMovieIfNeeded(id);
        } catch {
          // ignore
        }
      }
    })();
  }

  const allGenres = db
    .prepare(
      `
      SELECT mg.genre as genre, COUNT(*) as c
      FROM movie_genres mg
      JOIN movies m ON m.id = mg.movie_id
      WHERE (? = '' OR lower(m.language) = lower(?))
        AND COALESCE(m.is_indian, 1) = 1
      GROUP BY mg.genre
      ORDER BY c DESC, mg.genre ASC
      LIMIT 30
    `
    )
    .all(lang, lang)
    .map((r) => ({ genre: r.genre, count: r.c }));

  const allLanguages = db
    .prepare(
      'SELECT language, COUNT(*) as c FROM movies WHERE COALESCE(is_indian, 1) = 1 GROUP BY language ORDER BY c DESC, language ASC LIMIT 20'
    )
    .all()
    .map((r) => ({ language: r.language || 'Unknown', count: r.c }));

  const payload = {
    generatedAt: nowIso(),
    sections: {
      new: finalNewIds.map((id) => hydrateMovie(db, id)).filter(Boolean),
      upcoming: upcomingIds.map((id) => hydrateMovie(db, id)).filter(Boolean)
    },
    categories: {
      genres: allGenres,
      languages: allLanguages
    }
  };

  homeCache.set(ck, { expiresAt: Date.now() + HOME_CACHE_TTL_MS, payload });
  res.json(payload);
});

app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ movies: [], persons: [] });

  const local = searchLocal(db, q);
  if (local.movies.length || local.persons.length) {
    for (const m of local.movies.slice(0, 3)) {
      await enrichMovieIfNeeded(m.id);
    }

    const refreshed = searchLocal(db, q);
    return res.json({ ...refreshed, source: 'local' });
  }

  // Not found locally -> real-time search across providers (TMDB + YouTube + Wikipedia).
  let [movieHits, personHits] = await Promise.all([
    tmdbSearchMovie(q).catch(() => []),
    tmdbSearchPerson(q).catch(() => [])
  ]);

  // Typo/alias fallback: use Wikipedia search to find the canonical page title, then retry TMDB.
  // Example: "Satte Pe Satte" -> Wikipedia likely returns "Satte Pe Satta" -> TMDB hit.
  let didYouMean = null;
  if (!movieHits.length) {
    const wikiTitle =
      (await wikipediaSearchTitle(q).catch(() => null)) ||
      (await wikipediaSearchTitle(`${q} film`).catch(() => null));
    if (wikiTitle && wikiTitle.toLowerCase() !== q.toLowerCase()) {
      const retry = await tmdbSearchMovie(wikiTitle).catch(() => []);
      if (retry.length) {
        movieHits = retry;
        didYouMean = wikiTitle;
      }
    }
  }

  // If TMDB returned a close match but the query is misspelled, keep a suggestion.
  if (!didYouMean && movieHits[0]?.title && movieHits[0].title.toLowerCase() !== q.toLowerCase()) {
    didYouMean = movieHits[0].title;
  }

  const upsertedMovieIds = [];
  const upsertedPersonIds = [];

  const upsertMovieHit = async (hit) => {
    if (!hit?.tmdbId) return null;
    const full = await tmdbGetMovieFull(hit.tmdbId);
    if (!isLikelyIndianMovie(full)) return null;
    const movieId = upsertMovieFromTmdb(db, full);
    upsertedMovieIds.push(movieId);

    // Ratings from OMDb (optional; needs OMDB_API_KEY).
    try {
      const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : undefined;
      const omdb = await omdbByTitle(full.title, year);
      upsertRatingsFromOmdb(db, movieId, omdb);
    } catch {
      // ignore
    }

    // If TMDB trailer is missing, try YouTube "official trailer".
    if (!full.trailerUrl) {
      const yt = await youtubeSearchCached(db, `${full.title} official trailer`).catch(() => []);
      const trailerUrl = yt[0]?.youtubeUrl || '';
      if (trailerUrl) {
        db.prepare('UPDATE movies SET trailer_url = ?, updated_at = ? WHERE id = ?').run(trailerUrl, nowIso(), movieId);
      }
    }

    // Songs playlist
    const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : null;
    const wiki = await wikipediaTracklistForMovie({
      title: full.title,
      year,
      language: full.language,
      castNames: (full.cast || []).slice(0, 2).map((c) => c?.name).filter(Boolean)
    }).catch(() => null);
    if (wiki?.tracks?.length) {
      const ytMode = tokenize(full.title).length <= 1 ? 'strict' : 'bestEffort';
      const trackMap = await youtubeMatchVideosForTracklist({
        movieTitle: full.title,
        language: full.language,
        year,
        tracks: wiki.tracks,
        mode: ytMode
      }).catch(() => new Map());
      const songs = wiki.tracks
        .slice(0, 20)
        .map((t) => ({ title: t, singers: [], youtubeUrl: trackMap.get(t) || '' }));
      replaceSongsForMovie(db, movieId, songs, { source: 'wikipedia', platform: 'YouTube', wikiUrl: wiki.url || '' });
    } else {
      const hints = hintTokensFromNames((full.cast || []).slice(0, 8).map((c) => c?.name).filter(Boolean));
      const songs = await youtubeSearchSongsForMovie({ title: full.title, year, language: full.language, hints }).catch(
        () => []
      );
      replaceSongsFromYoutube(db, movieId, songs);
    }

    return movieId;
  };

  for (const hit of movieHits) {
    if (upsertedMovieIds.length >= 3) break;
    try {
      await upsertMovieHit(hit);
    } catch {
      // ignore
    }
  }

  for (const hit of personHits.slice(0, 3)) {
    const personId = makeId('tmdb-person', hit.tmdbId);
    try {
      const full = await tmdbGetPersonFull(hit.tmdbId);
      const ts = nowIso();
      db.prepare(
        `
        INSERT INTO persons (id, tmdb_id, name, name_soundex, biography, wiki_url, profile_image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          name_soundex=excluded.name_soundex,
          biography=excluded.biography,
          profile_image=excluded.profile_image,
          updated_at=excluded.updated_at
      `
      ).run(personId, full.tmdbId, full.name, soundex(full.name), full.biography, full.profileImage, ts, ts);

      const wikiTitle = await wikipediaSearchTitle(full.name).catch(() => null);
      const wiki = await wikipediaSummaryByTitle(wikiTitle).catch(() => null);
      updatePersonWiki(db, personId, wiki);
      upsertedPersonIds.push(personId);

      // Pull a few top filmography titles so "search by cast" returns movies too.
      const topMovies = (full.filmography || [])
        .filter((f) => f.mediaType === 'movie' && typeof f.tmdbId === 'number')
        .slice(0, 5);
      for (const f of topMovies) {
        try {
          const movieFull = await tmdbGetMovieFull(f.tmdbId);
          const movieId = upsertMovieFromTmdb(db, movieFull);
          const year = movieFull.releaseDate ? Number(String(movieFull.releaseDate).slice(0, 4)) : null;
          const wiki = await wikipediaTracklistForMovie({
            title: movieFull.title,
            year,
            language: movieFull.language,
            castNames: (movieFull.cast || []).slice(0, 2).map((c) => c?.name).filter(Boolean)
          }).catch(() => null);
          if (wiki?.tracks?.length) {
            const ytMode = tokenize(movieFull.title).length <= 1 ? 'strict' : 'bestEffort';
            const trackMap = await youtubeMatchVideosForTracklist({
              movieTitle: movieFull.title,
              language: movieFull.language,
              year,
              tracks: wiki.tracks,
              mode: ytMode
            }).catch(() => new Map());
            const songs = wiki.tracks
              .slice(0, 20)
              .map((t) => ({ title: t, singers: [], youtubeUrl: trackMap.get(t) || '' }));
            replaceSongsForMovie(db, movieId, songs, { source: 'wikipedia', platform: 'YouTube', wikiUrl: wiki.url || '' });
          } else {
            const hints = hintTokensFromNames((movieFull.cast || []).slice(0, 8).map((c) => c?.name).filter(Boolean));
            const songs = await youtubeSearchSongsForMovie({ title: movieFull.title, year, language: movieFull.language, hints }).catch(() => []);
            replaceSongsFromYoutube(db, movieId, songs);
          }
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  let refreshed = searchLocal(db, q);
  // If local string matching still misses (typos), return what we just upserted.
  if (refreshed.movies.length === 0 && refreshed.persons.length === 0) {
    const movies = Array.from(new Set(upsertedMovieIds))
      .map((id) => hydrateMovie(db, id))
      .filter(Boolean);
    const persons = Array.from(new Set(upsertedPersonIds))
      .map((id) => hydratePerson(db, id))
      .filter(Boolean);
    refreshed = { movies, persons };
  }

  // If we *still* have nothing, try a Wikipedia canonical-title retry even if TMDB returned irrelevant hits.
  // This catches spelling variants like "Jodha Akbar" -> "Jodhaa Akbar".
  if (refreshed.movies.length === 0 && refreshed.persons.length === 0) {
    try {
      const wikiTitle =
        (await wikipediaSearchTitle(q).catch(() => null)) ||
        (await wikipediaSearchTitle(`${q} film`).catch(() => null));
      if (wikiTitle && wikiTitle.toLowerCase() !== q.toLowerCase()) {
        const retryHits = await tmdbSearchMovie(wikiTitle).catch(() => []);
        for (const hit of retryHits) {
          if (upsertedMovieIds.length >= 3) break;
          try {
            await upsertMovieHit(hit);
          } catch {
            // ignore
          }
        }
        if (!didYouMean) didYouMean = wikiTitle;
        const after = searchLocal(db, wikiTitle);
        if (after.movies.length || after.persons.length) refreshed = after;
        if (refreshed.movies.length === 0 && refreshed.persons.length === 0) {
          // Last resort: return any upserts.
          const movies = Array.from(new Set(upsertedMovieIds))
            .map((id) => hydrateMovie(db, id))
            .filter(Boolean);
          const persons = Array.from(new Set(upsertedPersonIds))
            .map((id) => hydratePerson(db, id))
            .filter(Boolean);
          refreshed = { movies, persons };
        }
      }
    } catch {
      // ignore
    }
  }

  res.json({ ...refreshed, source: 'providers', ...(didYouMean ? { didYouMean } : {}) });
});

app.get('/api/movies/:id', async (req, res) => {
  const rawId = String(req.params.id || '');
  const refresh = String(req.query.refresh || '') === '1';
  const wikiTitle = String(req.query.wikiTitle || '').trim();
  const debug = String(req.query.debug || '') === '1';
  const safeWikiTitle = wikiTitle && /^[A-Za-z0-9_()%.,' -]{3,120}$/.test(wikiTitle) ? wikiTitle : '';

  const parseTmdb = () => {
    if (rawId.startsWith('tmdb-movie:')) {
      const n = Number(rawId.split(':')[1]);
      return Number.isFinite(n) ? n : null;
    }
    if (/^\d+$/.test(rawId)) return Number(rawId);
    return null;
  };

  let movieId = rawId.includes(':')
    ? rawId
    : /^\d+$/.test(rawId)
      ? makeId('tmdb-movie', Number(rawId))
      : rawId;
  let movie = hydrateMovie(db, movieId);

  // If missing locally but it looks like a TMDB id, fetch in real time and cache.
  if (!movie) {
    const tmdbId = parseTmdb();
    if (tmdbId) {
      try {
        const full = await tmdbGetMovieFull(tmdbId);
        movieId = upsertMovieFromTmdb(db, full);
        await enrichMovieIfNeeded(movieId, { debug, autoSongs: true });
        movie = hydrateMovie(db, movieId);
      } catch {
        // ignore
      }
    }
  } else if (refresh) {
    // Optional override for ambiguous titles:
    // /api/movies/1448170?refresh=1&wikiTitle=Champion_(2025_film)
    await enrichMovieIfNeeded(movieId, {
      forceSongs: true,
      forceDeeplinks: true,
      wikiTitleOverride: safeWikiTitle ? safeWikiTitle.replace(/_/g, ' ') : '',
      debug
    });
    movie = hydrateMovie(db, movieId);
  } else {
    // On normal movie page loads, opportunistically fill any missing OTT/songs/trailer/cast/rating.
    // Do not block the response on provider calls; enrich in the background and return the cached DB payload.
    enqueueMovieEnrich(movieId, { debug, autoSongs: true });
    movie = hydrateMovie(db, movieId);
  }

  if (!movie) return res.status(404).json({ error: 'not_found' });
  if (!debug) return res.json(movie);

  const songMeta = db
    .prepare('SELECT source, platform, COUNT(*) as c FROM songs WHERE movie_id = ? GROUP BY source, platform')
    .all(movieId);
  const playableSongCount =
    db
      .prepare("SELECT COUNT(*) as c FROM songs WHERE movie_id = ? AND COALESCE(youtube_url, '') != ''")
      .get(movieId)?.c || 0;
  const sampleSongs = db
    .prepare("SELECT id, title, youtube_url FROM songs WHERE movie_id = ? ORDER BY created_at DESC LIMIT 6")
    .all(movieId)
    .map((s) => ({ id: s.id, title: s.title, hasYoutubeUrl: !!(s.youtube_url && String(s.youtube_url).trim()) }));
  const wikiAttr = db
    .prepare("SELECT url, provider_id FROM attributions WHERE entity_type = 'movie' AND entity_id = ? AND provider = 'wikipedia' LIMIT 1")
    .get(movieId);
  const itunesAttr = db
    .prepare("SELECT url, provider_id FROM attributions WHERE entity_type = 'movie' AND entity_id = ? AND provider = 'itunes' LIMIT 1")
    .get(movieId);
  res.json({
    ...movie,
    debug: {
      movieId,
      tmdbId: movie.id?.startsWith('tmdb-movie:') ? Number(movie.id.split(':')[1]) : null,
      wikiTitleParam: safeWikiTitle || null,
      wikiAttribution: wikiAttr ? { url: wikiAttr.url || '', providerId: wikiAttr.provider_id || '' } : null,
      itunesAttribution: itunesAttr ? { url: itunesAttr.url || '', providerId: itunesAttr.provider_id || '' } : null,
      songCounts: songMeta,
      playableSongCount,
      sampleSongs
    }
  });
});

app.get('/api/songs/:id', (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!id) return res.status(400).json({ error: 'missing_id' });
  const row = db
    .prepare(
      `
      SELECT s.id, s.movie_id, s.title, s.singers_json, s.youtube_url, s.platform, s.source, s.created_at,
             m.title as movie_title
      FROM songs s
      LEFT JOIN movies m ON m.id = s.movie_id
      WHERE s.id = ?
    `
    )
    .get(id);
  if (!row) return res.status(404).json({ error: 'not_found' });

  let singers = [];
  try {
    singers = row.singers_json ? JSON.parse(String(row.singers_json)) : [];
  } catch {
    singers = [];
  }

  res.json({
    id: row.id,
    movieId: row.movie_id,
    movieTitle: row.movie_title || '',
    title: row.title,
    singers: Array.isArray(singers) ? singers : [],
    youtubeUrl: row.youtube_url || undefined,
    platform: row.platform || undefined,
    source: row.source || undefined,
    createdAt: row.created_at
  });
});

app.get('/api/person/:id', async (req, res) => {
  const raw = String(req.params.id || '');
  const personId = raw.includes(':') ? raw : makeId('tmdb-person', raw);

  // If missing locally but looks like a TMDB id, fetch in real time and cache.
  let p = hydratePerson(db, personId);
  if (!p && /^\d+$/.test(raw)) {
    try {
      const full = await tmdbGetPersonFull(Number(raw));
      const ts = nowIso();
      db.prepare(
        `
        INSERT INTO persons (id, tmdb_id, name, name_soundex, biography, wiki_url, profile_image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, '', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name=excluded.name,
          name_soundex=excluded.name_soundex,
          biography=excluded.biography,
          profile_image=excluded.profile_image,
          updated_at=excluded.updated_at
      `
      ).run(personId, full.tmdbId, full.name, soundex(full.name), full.biography, full.profileImage, ts, ts);

      const wikiTitle = await wikipediaSearchTitle(full.name).catch(() => null);
      const wiki = await wikipediaSummaryByTitle(wikiTitle).catch(() => null);
      updatePersonWiki(db, personId, wiki);
      p = hydratePerson(db, personId);
    } catch {
      // ignore
    }
  }

  if (!p) return res.status(404).json({ error: 'not_found' });

  let filmography = null;
  if (p.tmdbId) {
    try {
      const full = await tmdbGetPersonFull(p.tmdbId);
      filmography = full.filmography || [];
      // Ensure wiki if still missing.
      if (!p.wikiUrl) {
        const wikiTitle = await wikipediaSearchTitle(p.name).catch(() => null);
        const wiki = await wikipediaSummaryByTitle(wikiTitle).catch(() => null);
        updatePersonWiki(db, personId, wiki);
      }
    } catch {
      // ignore
    }
  }

  const refreshed = hydratePerson(db, personId);
  const fallbackFilmography = refreshed?.filmography || [];
  res.json({ ...refreshed, filmography: Array.isArray(filmography) ? filmography : fallbackFilmography });
});

app.get('/api/categories', (_req, res) => {
  const genres = db
    .prepare(
      `
      SELECT mg.genre as genre, COUNT(*) as c
      FROM movie_genres mg
      JOIN movies m ON m.id = mg.movie_id
      WHERE COALESCE(m.is_indian, 1) = 1
      GROUP BY mg.genre
      ORDER BY c DESC, mg.genre ASC
    `
    )
    .all();
  const languages = db
    .prepare('SELECT language, COUNT(*) as c FROM movies WHERE COALESCE(is_indian, 1) = 1 GROUP BY language ORDER BY c DESC, language ASC')
    .all();
  res.json({
    genres: genres.map((r) => ({ genre: r.genre, count: r.c })),
    languages: languages.map((r) => ({ language: r.language || 'Unknown', count: r.c }))
  });
});

app.get('/api/browse', async (req, res) => {
  await seedIfEmpty();

  const lang = String(req.query.lang || '').trim();
  const genre = String(req.query.genre || '').trim();
  const page = Math.max(1, Math.min(500, Number(req.query.page || 1) || 1));
  const pageSizeRaw = req.query.pageSize ?? req.query.limit ?? 60;
  const pageSize = Math.max(1, Math.min(80, Number(pageSizeRaw) || 60));
  const offset = (page - 1) * pageSize;
  if (lang) {
    const haveLang = db
      .prepare('SELECT COUNT(*) as c FROM movies WHERE lower(language) = lower(?)')
      .get(lang)?.c;
    if (!haveLang) {
      await seedLanguageIfSparse(lang).catch(() => {});
    } else {
      seedLanguageIfSparse(lang).catch(() => {});
    }
  }

  const totalRow = genre
    ? db
        .prepare(
          `
          SELECT COUNT(DISTINCT m.id) as c
          FROM movies m
          JOIN movie_genres mg ON mg.movie_id = m.id
          WHERE (? = '' OR lower(m.language) = lower(?))
            AND COALESCE(m.is_indian, 1) = 1
            AND lower(mg.genre) = lower(?)
        `
        )
        .get(lang, lang, genre)
    : db
        .prepare(
          `
          SELECT COUNT(*) as c
          FROM movies m
          WHERE (? = '' OR lower(m.language) = lower(?))
            AND COALESCE(m.is_indian, 1) = 1
        `
        )
        .get(lang, lang);
  const total = Number(totalRow?.c || 0) || 0;

  const ids = db
    .prepare(
      `
      SELECT DISTINCT m.id as id
      FROM movies m
      LEFT JOIN movie_genres mg ON mg.movie_id = m.id
      WHERE (? = '' OR lower(m.language) = lower(?))
        AND COALESCE(m.is_indian, 1) = 1
        AND (? = '' OR lower(mg.genre) = lower(?))
      ORDER BY COALESCE(m.release_date, '0000-00-00') DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(lang, lang, genre, genre, pageSize, offset)
    .map((r) => r.id);

  // Ensure the first page is enriched for ratings/reviews/trailer.
  const toEnrich = ids.slice(0, 10);
  if (toEnrich.length) {
    (async () => {
      for (const id of toEnrich) {
        try {
          await enrichMovieIfNeeded(id);
        } catch {
          // ignore
        }
      }
    })();
  }

  res.json({
    generatedAt: nowIso(),
    movies: ids.map((id) => hydrateMovie(db, id)).filter(Boolean),
    page,
    pageSize,
    total,
    hasMore: offset + ids.length < total,
    filters: { lang: lang || null, genre: genre || null }
  });
});

// Serve the current cached catalog if you want a static snapshot (optional).
app.get('/api/catalog.json', (_req, res) => {
  const ids = db
    .prepare('SELECT id FROM movies WHERE COALESCE(is_indian, 1) = 1 ORDER BY release_date DESC LIMIT 500')
    .all()
    .map((r) => r.id);
  res.json({ generatedAt: nowIso(), movies: ids.map((id) => hydrateMovie(db, id)).filter(Boolean) });
});

// --- SEO: robots + sitemap ---
app.get('/robots.txt', (req, res) => {
  const base = SITE_URL || canonicalUrlFor(req).replace(/\/+$/, '');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.send(
    [
      'User-agent: *',
      'Disallow: /admin',
      'Disallow: /account',
      'Disallow: /login',
      'Disallow: /submit',
      'Disallow: /search',
      `Sitemap: ${base}/sitemap.xml`,
      ''
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  const base = SITE_URL || canonicalUrlFor(req).replace(/\/+$/, '');
  const maxUrls = Math.max(200, Math.min(50000, Number(process.env.SITEMAP_MAX_URLS || 0) || 2000));
  const movieLimit = Math.max(100, Math.floor(maxUrls * 0.8));
  const personLimit = Math.max(50, Math.floor(maxUrls * 0.2));

  const staticPaths = ['/', '/about', '/contact', '/feedback', '/privacy'];
  const urls = [];
  for (const p of staticPaths) {
    urls.push({ loc: `${base}${p === '/' ? '/' : p}`, lastmod: null, priority: p === '/' ? '1.0' : '0.6' });
  }

  const movies = db
    .prepare(
      `
      SELECT tmdb_id, updated_at
      FROM movies
      WHERE tmdb_id IS NOT NULL
        AND COALESCE(is_indian, 1) = 1
      ORDER BY COALESCE(updated_at, created_at) DESC
      LIMIT ?
    `
    )
    .all(movieLimit);
  for (const m of movies) {
    if (!m?.tmdb_id) continue;
    const lastmod = String(m.updated_at || '').slice(0, 10);
    urls.push({
      loc: `${base}/movie/${encodeURIComponent(String(m.tmdb_id))}`,
      lastmod: /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? lastmod : null,
      priority: '0.7'
    });
  }

  const persons = db
    .prepare(
      `
      SELECT tmdb_id, updated_at
      FROM persons
      WHERE tmdb_id IS NOT NULL
      ORDER BY COALESCE(updated_at, created_at) DESC
      LIMIT ?
    `
    )
    .all(personLimit);
  for (const p of persons) {
    if (!p?.tmdb_id) continue;
    const lastmod = String(p.updated_at || '').slice(0, 10);
    urls.push({
      loc: `${base}/person/${encodeURIComponent(String(p.tmdb_id))}`,
      lastmod: /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? lastmod : null,
      priority: '0.5'
    });
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  const body =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .slice(0, maxUrls)
      .map((u) => {
        const parts = [`  <url>`, `    <loc>${escapeXml(u.loc)}</loc>`];
        if (u.lastmod) parts.push(`    <lastmod>${escapeXml(u.lastmod)}</lastmod>`);
        if (u.priority) parts.push(`    <priority>${escapeXml(u.priority)}</priority>`);
        parts.push(`  </url>`);
        return parts.join('\n');
      })
      .join('\n') +
    `\n</urlset>\n`;
  res.send(body);
});

// Serve Vite build output for any non-API routes (SPA fallback).
// Keep this near the end so API endpoints take priority.
if (fs.existsSync(DIST_DIR)) {
  app.use(
    express.static(DIST_DIR, {
      index: false,
      maxAge: '365d',
      setHeaders: (res, filePath) => {
        // Never aggressively cache HTML.
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
      }
    })
  );

  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api')) return next();
    if (!hasDistBuild()) return next();
    res.setHeader('Cache-Control', 'no-store');
    try {
      const html = fs.readFileSync(DIST_INDEX, 'utf-8');
      const canonical = canonicalUrlFor(req);
      const siteUrl = SITE_URL || canonical.replace(/\/+$/, '');
      const seo = seoForPath(req, canonical, siteUrl);

      let out = html
        .replaceAll('__CANONICAL_URL__', canonical)
        .replaceAll('__SITE_URL__', siteUrl);

      out = setTitle(out, seo.title);
      out = setMetaName(out, 'description', seo.description);
      out = setMetaName(out, 'robots', seo.robots);
      out = setLinkRel(out, 'canonical', canonical);
      out = setMetaProp(out, 'og:url', canonical);
      out = setMetaProp(out, 'og:type', seo.ogType);
      out = setMetaProp(out, 'og:title', seo.title);
      out = setMetaProp(out, 'og:description', seo.description);
      out = setMetaProp(out, 'og:image', seo.ogImage);
      out = setMetaName(out, 'twitter:title', seo.title);
      out = setMetaName(out, 'twitter:description', seo.description);
      out = setMetaName(out, 'twitter:image', seo.ogImage);
      out = injectJsonLd(out, seo.jsonLd);
      out = injectPrerender(out, seo.prerender);
      res.status(200).send(out);
    } catch {
      res.sendFile(DIST_INDEX);
    }
  });
}

// Default to localhost for dev; bind to all interfaces in production hosting.
const HOST = String(process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1'));
app.listen(PORT, HOST, () => {
  const cacheDir = path.join(process.cwd(), '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  console.log(`Server listening on http://${HOST}:${PORT}`);
  if (hasDistBuild()) console.log(`Serving frontend from ${DIST_DIR}`);
});
