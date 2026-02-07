const MOTN_BASE = 'https://streaming-availability.p.rapidapi.com';

function motnHeaders() {
  const key = String(process.env.MOTN_API_KEY || '').trim();
  if (!key) throw new Error('missing_MOTN_API_KEY');
  // RapidAPI typically accepts the key header. Some deployments also require X-RapidAPI-Host;
  // keeping it optional avoids breaking local tests if RapidAPI gateway changes.
  const h = {
    'X-RapidAPI-Key': key
  };
  const host = String(process.env.MOTN_RAPIDAPI_HOST || '').trim();
  if (host) h['X-RapidAPI-Host'] = host;
  return h;
}

function serviceNameToProvider(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return '';
  if (n === 'netflix') return 'Netflix';
  if (n === 'prime' || n === 'prime video' || n === 'amazon prime' || n === 'amazon prime video') return 'Prime Video';
  if (n.includes('hotstar')) return 'Disney+ Hotstar';
  if (n === 'zee5' || n === 'zee') return 'ZEE5';
  if (n === 'sonyliv' || n === 'sony liv') return 'SonyLIV';
  if (n === 'jiocinema' || n === 'jio cinema') return 'JioCinema';
  if (n === 'sunnxt' || n === 'sun nxt') return 'Sun NXT';
  if (n === 'aha') return 'aha';
  return String(name || '').trim();
}

export async function motnGetDeepLinksForTmdbMovie(tmdbId, { country = 'in' } = {}) {
  const id = Number(tmdbId);
  if (!Number.isFinite(id)) throw new Error('invalid_tmdb_id');
  const c = String(country || 'in').trim().toLowerCase();

  // API expects a "show id" like "movie/12345" (TMDB id).
  const url = new URL(`${MOTN_BASE}/shows/${encodeURIComponent(`movie/${id}`)}`);
  url.searchParams.set('country', c);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: motnHeaders()
  });
  const bodyText = await res.text();
  let body = null;
  try {
    body = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const err = new Error(`motn_http_${res.status}`);
    err.status = res.status;
    err.body = bodyText.slice(0, 800);
    throw err;
  }

  // The API returns streaming options keyed by country.
  const options = body?.streamingOptions?.[c] || body?.streamingOptions?.[c.toUpperCase()] || [];
  const out = [];
  for (const opt of Array.isArray(options) ? options : []) {
    const serviceName = opt?.service?.name || opt?.service?.id || '';
    const provider = serviceNameToProvider(serviceName);
    const link = opt?.link || opt?.webUrl || opt?.url || '';
    if (!provider || !link) continue;
    out.push({ provider, deepLink: String(link), country: c });
  }

  // De-dupe by provider; prefer the first link.
  const byProvider = new Map();
  for (const r of out) {
    const k = String(r.provider).toLowerCase();
    if (!byProvider.has(k)) byProvider.set(k, r);
  }
  return Array.from(byProvider.values());
}

