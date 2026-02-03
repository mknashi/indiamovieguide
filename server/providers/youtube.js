import crypto from 'node:crypto';

function nowIso() {
  return new Date().toISOString();
}

function sha1(input) {
  return crypto.createHash('sha1').update(String(input)).digest('hex');
}

function pickOpts(opts = {}) {
  return {
    maxResults: Number(opts.maxResults || 0) || 0,
    embeddableOnly: !!opts.embeddableOnly,
    videoCategoryId: opts.videoCategoryId ? String(opts.videoCategoryId) : '',
    relevanceLanguage: opts.relevanceLanguage ? String(opts.relevanceLanguage) : '',
    regionCode: opts.regionCode ? String(opts.regionCode) : ''
  };
}

function cacheGet(db, key) {
  if (!db) return null;
  try {
    const row = db.prepare('SELECT value_json, expires_at FROM api_cache WHERE key = ?').get(String(key));
    const exp = row?.expires_at ? Number(row.expires_at) : 0;
    if (!exp || Date.now() > exp) return null;
    return row?.value_json ? JSON.parse(String(row.value_json)) : null;
  } catch {
    return null;
  }
}

function cacheSet(db, key, value, ttlMs) {
  if (!db) return;
  try {
    const ts = nowIso();
    const exp = Date.now() + Math.max(1, Number(ttlMs || 0));
    db.prepare(
      'INSERT OR REPLACE INTO api_cache(key, value_json, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).run(String(key), JSON.stringify(value ?? null), exp, ts, ts);
  } catch {
    // ignore
  }
}

function metaGetNumber(db, key) {
  if (!db) return 0;
  try {
    const row = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(String(key));
    const n = row ? Number(row.value) : 0;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function metaSet(db, key, value) {
  if (!db) return;
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

function looksLikeQuotaExceeded(status, bodyText) {
  if (status !== 403) return false;
  const b = String(bodyText || '').toLowerCase();
  return b.includes('exceeded') && b.includes('quota');
}

function quotaBackoffMs() {
  const min = Number(process.env.YOUTUBE_QUOTA_BACKOFF_MINUTES || 0) || 0;
  // Default: 12 hours. Render users often hit this quickly; better to stop calling until quota resets.
  const minutes = min > 0 ? min : 12 * 60;
  return minutes * 60 * 1000;
}

export async function youtubeSearch(query, opts = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const debug = process.env.DEBUG_SONGS === '1';
  if (!apiKey) {
    if (debug) console.log('[youtube] missing YOUTUBE_API_KEY');
    return [];
  }

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', query);
  url.searchParams.set('maxResults', String(opts.maxResults || 6));
  // Optional: when we specifically need iframe embedding, request embeddable results.
  if (opts.embeddableOnly) url.searchParams.set('videoEmbeddable', 'true');
  if (opts.videoCategoryId) url.searchParams.set('videoCategoryId', String(opts.videoCategoryId));
  if (opts.relevanceLanguage) url.searchParams.set('relevanceLanguage', String(opts.relevanceLanguage));
  if (opts.regionCode) url.searchParams.set('regionCode', String(opts.regionCode));
  url.searchParams.set('key', apiKey);

  let res;
  try {
    res = await fetch(url);
  } catch (e) {
    if (debug) console.log('[youtube] fetch failed', { message: e?.message || String(e) });
    throw e;
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (debug) {
      console.log('[youtube] search failed', {
        status: res.status,
        query,
        body: String(body || '').slice(0, 300)
      });
    }
    const err = new Error(`YouTube search failed: ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  const data = await res.json();

  return (data.items || []).map((item) => ({
    title: item.snippet?.title,
    youtubeUrl: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    channel: item.snippet?.channelTitle,
    publishedAt: item.snippet?.publishedAt,
    thumbnail: item.snippet?.thumbnails?.high?.url,
    description: item.snippet?.description
  }));
}

// Cached wrapper + quota circuit breaker.
// - If quota is exceeded, short-circuit all future requests for a while to avoid hammering.
// - Cache successful results for a while to avoid repeated search.list calls.
export async function youtubeSearchCached(db, query, opts = {}) {
  const debug = process.env.DEBUG_SONGS === '1';

  const until = metaGetNumber(db, 'youtube_quota_until');
  if (until && Date.now() < until) {
    if (debug) console.log('[youtube] circuit open', { untilIso: new Date(until).toISOString() });
    return [];
  }

  const key = `ytsearch:${sha1(`${String(query || '').trim()}|${JSON.stringify(pickOpts(opts))}`)}`;
  const cached = cacheGet(db, key);
  if (cached && Array.isArray(cached.items)) return cached.items;

  try {
    const items = await youtubeSearch(query, opts);
    // Cache success for 7 days (search results are stable enough for our UX).
    cacheSet(db, key, { items }, 7 * 24 * 60 * 60 * 1000);
    return items;
  } catch (e) {
    const status = Number(e?.status || 0) || 0;
    const body = String(e?.body || e?.message || '');

    if (looksLikeQuotaExceeded(status, body)) {
      const backoffUntil = Date.now() + quotaBackoffMs();
      metaSet(db, 'youtube_quota_until', String(backoffUntil));
      metaSet(db, 'youtube_quota_last_error', String(Date.now()));
      if (debug) {
        console.log('[youtube] quota exceeded; circuit opened', {
          untilIso: new Date(backoffUntil).toISOString()
        });
      }
      // Cache this failure briefly to avoid hammering the same query even if circuit closes early.
      cacheSet(db, key, { items: [] }, 60 * 60 * 1000);
      return [];
    }

    // Other transient failures: cache briefly to avoid hot-looping on page refreshes.
    cacheSet(db, key, { items: [] }, 5 * 60 * 1000);
    return [];
  }
}

