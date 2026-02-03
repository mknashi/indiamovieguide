import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { openDb, migrate } from '../server/db/sqlite.js';
import { upsertMovieFromTmdb, upsertRatingsFromOmdb, replaceSongsFromYoutube } from '../server/db/repository.js';
import { defaultIndianLanguageCodes, tmdbDiscoverMovies, tmdbGetMovieFull } from '../server/providers/tmdb.js';
import { youtubeSearch } from '../server/providers/youtube.js';
import { omdbByTitle } from '../server/providers/omdb.js';
import { INDIAN_LANGUAGES_LOWER, nowIso } from '../server/repo.js';

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

function scoreYoutubeSongCandidate(movieTitle, item) {
  const title = normalizeText(item?.title);
  const desc = normalizeText(item?.description);
  const hay = `${title} ${desc}`.trim();

  const bad = ['trailer', 'teaser', 'reaction', 'review', 'scene', 'interview', 'full movie'];
  if (bad.some((w) => hay.includes(w))) return -1;

  const tokens = normalizeText(movieTitle)
    .split(/\s+/g)
    .filter((t) => t.length >= 3 && !['the', 'and', 'for', 'from', 'with', 'movie', 'film'].includes(t));
  const uniq = Array.from(new Set(tokens));
  const matched = uniq.filter((t) => hay.includes(t)).length;
  const base = uniq.length ? matched / uniq.length : 0;

  let bonus = 0;
  if (hay.includes('jukebox') || hay.includes('full album') || hay.includes('audio jukebox')) bonus += 0.25;
  if (hay.includes('lyric') || hay.includes('lyrical') || hay.includes('audio')) bonus += 0.15;
  if (hay.includes('song') || hay.includes('songs')) bonus += 0.05;

  if (uniq.length <= 1 && matched < 1) return 0;
  if (uniq.length <= 1 && !(hay.includes('song') || hay.includes('jukebox') || hay.includes('audio'))) return 0;

  return base + bonus;
}

async function youtubeSearchSongsForMovie({ title, year, language }) {
  const movieTitle = String(title || '').trim();
  if (!movieTitle) return [];
  const y = year ? String(year) : '';
  const lang = String(language || '').trim();
  const langToken = lang ? `${lang} ` : '';

  const queries = [
    `${movieTitle} ${langToken}jukebox`.trim(),
    `${movieTitle} ${y} ${langToken}songs`.trim(),
    `${movieTitle} ${langToken}movie songs`.trim(),
    `${movieTitle} ${langToken}lyrical`.trim()
  ].filter(Boolean);
  const all = [];
  const rel = ytLangCode(lang);
  for (const q of queries) {
    const hits = await youtubeSearch(q, {
      maxResults: 12,
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
  const wordCount = normalizeText(movieTitle).split(/\s+/g).filter(Boolean).length;
  const threshold = wordCount <= 1 ? 0.55 : 0.38;

  return Array.from(byUrl.values())
    .map((h) => {
      const s = scoreYoutubeSongCandidate(movieTitle, h);
      const hay = `${normalizeText(h?.title)} ${normalizeText(h?.description)}`.trim();
      const langToken2 = normalizeText(lang);
      const okDisambiguator = (langToken2 && hay.includes(langToken2)) || (year && hay.includes(String(year)));
      const hasSongSignals = hay.includes('song') || hay.includes('songs') || hay.includes('jukebox') || hay.includes('audio');
      if (wordCount <= 1 && !(okDisambiguator && hasSongSignals)) return { h, s: -1 };
      return { h, s };
    })
    .filter((x) => x.s >= threshold)
    .sort((a, b) => b.s - a.s)
    .slice(0, 12)
    .map(({ h }) => ({ title: h.title, singers: [h.channel].filter(Boolean), youtubeUrl: h.youtubeUrl }));
}

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

function iso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseArgv(argv) {
  const out = {
    limit: undefined,
    daysPast: undefined,
    daysFuture: undefined,
    langs: undefined,
    enrich: 'all',
    dryRun: false,
    help: false
  };

  for (const raw of argv) {
    const a = String(raw || '').trim();
    if (!a) continue;
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--limit=')) out.limit = Number(a.split('=')[1]);
    else if (a.startsWith('--daysPast=')) out.daysPast = Number(a.split('=')[1]);
    else if (a.startsWith('--daysFuture=')) out.daysFuture = Number(a.split('=')[1]);
    else if (a.startsWith('--langs=')) out.langs = a.split('=')[1];
    else if (a.startsWith('--enrich=')) out.enrich = a.split('=')[1] || 'all';
  }
  return out;
}

function isLikelyIndianMovie(full) {
  if (!full) return false;
  if (Array.isArray(full.productionCountries) && full.productionCountries.includes('IN')) return true;
  return INDIAN_LANGUAGES_LOWER.includes(String(full.language || '').toLowerCase());
}

async function main() {
  const args = parseArgv(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(`\nIndiaMovieGuide ingestion agent\n\n`);
    process.stdout.write(`Usage:\n`);
    process.stdout.write(`  npm run agent:run -- [--limit=80] [--daysPast=45] [--daysFuture=180] [--langs=hi,kn,...] [--enrich=all|tmdb|none] [--dry-run]\n\n`);
    process.stdout.write(`Env:\n`);
    process.stdout.write(`  DB_PATH, TMDB_API_KEY/TMDB_BEARER_TOKEN, YOUTUBE_API_KEY (optional), OMDB_API_KEY (optional)\n`);
    return;
  }

  // Support either `.env` or a plain `env` file.
  loadEnvFileIfPresent('.env');
  loadEnvFileIfPresent('env');

  const db = openDb();
  migrate(db);

  const limit = Number.isFinite(args.limit)
    ? args.limit
    : process.env.AGENT_LIMIT
      ? Number(process.env.AGENT_LIMIT)
      : 80;
  const daysPast = Number.isFinite(args.daysPast)
    ? args.daysPast
    : process.env.AGENT_DAYS_PAST
      ? Number(process.env.AGENT_DAYS_PAST)
      : 45;
  const daysFuture = Number.isFinite(args.daysFuture)
    ? args.daysFuture
    : process.env.AGENT_DAYS_FUTURE
      ? Number(process.env.AGENT_DAYS_FUTURE)
      : 180;

  const langs =
    (args.langs || process.env.AGENT_LANGS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];
  const tmdbLangs = langs.length ? langs : defaultIndianLanguageCodes();

  const enrichMode = String(args.enrich || process.env.AGENT_ENRICH || 'all').toLowerCase();
  const doYoutube = enrichMode === 'all' && !!process.env.YOUTUBE_API_KEY;
  const doOmdb = enrichMode === 'all' && !!process.env.OMDB_API_KEY;

  const startedAt = nowIso();
  const stats = {
    startedAt,
    discovered: 0,
    fetched: 0,
    upserted: 0,
    skippedNonIndian: 0,
    trailerUpdated: 0,
    songsUpserted: 0,
    ratingsUpserted: 0,
    errors: 0
  };

  const today = iso(0);
  const past = iso(-daysPast);
  const future = iso(daysFuture);

  // Pull "New" and "Upcoming" candidates from TMDB, then upsert the full record into SQLite.
  const [newHits, upcomingHits] = await Promise.all([
    tmdbDiscoverMovies({
      dateGte: past,
      dateLte: today,
      sortBy: 'popularity.desc',
      page: 1,
      region: 'IN',
      languages: tmdbLangs,
      voteCountGte: 0
    }).catch(() => []),
    tmdbDiscoverMovies({
      dateGte: today,
      dateLte: future,
      sortBy: 'popularity.desc',
      page: 1,
      region: 'IN',
      languages: tmdbLangs,
      voteCountGte: 0
    }).catch(() => [])
  ]);

  const ids = Array.from(new Set([...newHits, ...upcomingHits].map((h) => h.tmdbId))).slice(0, limit);
  stats.discovered = ids.length;

  for (let i = 0; i < ids.length; i++) {
    const tmdbId = ids[i];
    try {
      const full = await tmdbGetMovieFull(tmdbId);
      stats.fetched++;
      if (!isLikelyIndianMovie(full)) {
        stats.skippedNonIndian++;
        continue;
      }

      if (args.dryRun) continue;

      const movieId = upsertMovieFromTmdb(db, full);
      stats.upserted++;

      if (doYoutube && !full.trailerUrl) {
        try {
          const yt = await youtubeSearch(`${full.title} official trailer`);
          const trailerUrl = yt?.[0]?.youtubeUrl || '';
          if (trailerUrl) {
            db.prepare('UPDATE movies SET trailer_url = ?, updated_at = ? WHERE id = ?').run(
              trailerUrl,
              nowIso(),
              movieId
            );
            stats.trailerUpdated++;
          }
        } catch {
          // ignore
        }
      }

      if (doYoutube) {
        try {
          const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : null;
          const songs = await youtubeSearchSongsForMovie({ title: full.title, year, language: full.language });
          if (songs?.length) {
            replaceSongsFromYoutube(db, movieId, songs);
            stats.songsUpserted += songs.length;
          }
        } catch {
          // ignore
        }
      }

      if (doOmdb) {
        try {
          const year = full.releaseDate ? Number(String(full.releaseDate).slice(0, 4)) : undefined;
          const omdb = await omdbByTitle(full.title, year);
          upsertRatingsFromOmdb(db, movieId, omdb);
          if (omdb?.ratings?.length) stats.ratingsUpserted += omdb.ratings.length;
        } catch {
          // ignore
        }
      }

      process.stdout.write(`Upserted ${i + 1}/${ids.length}: ${full.title}\n`);
    } catch {
      stats.errors++;
      process.stdout.write(`Skip tmdb:${tmdbId}\n`);
    }
  }

  const finishedAt = nowIso();
  const cacheDir = path.join(process.cwd(), '.cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(
    path.join(cacheDir, 'agent-last-run.json'),
    JSON.stringify({ ...stats, finishedAt }, null, 2),
    'utf-8'
  );

  process.stdout.write(`Done. upserted=${stats.upserted} skippedNonIndian=${stats.skippedNonIndian} errors=${stats.errors}\n`);
}

main().catch((err) => {
  console.error('Agent failed', err);
  process.exit(1);
});
