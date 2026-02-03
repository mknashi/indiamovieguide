function wikiUrl(title, lang = 'en') {
  const base = wikiApiBase(lang);
  const safe = encodeURIComponent(title.replace(/ /g, '_'));
  return `${base}/wiki/${safe}`;
}

function wikiApiBase(lang) {
  const l = String(lang || 'en').trim() || 'en';
  return `https://${l}.wikipedia.org`;
}

function decodeHtmlEntities(s) {
  return String(s || '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(html) {
  // Remove references and collapse whitespace.
  const noRefs = String(html || '').replace(/<sup[^>]*>.*?<\/sup>/g, '');
  const text = noRefs.replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(text).replace(/\s+/g, ' ').trim();
}

function extractTrackTitlesFromHtml(html) {
  const out = [];
  const add = (raw) => {
    let t = stripTags(raw);
    t = t.replace(/^[0-9]+[\.\)\-:]\s*/g, '').trim();
    t = t.replace(/^"(.*)"$/g, '$1').replace(/^'(.*)'$/g, '$1').trim();
    // Often list items include "Song – Singer"; keep the left side if it's plausible.
    const sep = t.match(/^(.+?)\s+[-–]\s+(.+)$/);
    if (sep) t = sep[1].trim();

    // Drop "Released: ..." and similar suffixes.
    t = t.replace(/\s+released\s*[:\-]\s*.*$/i, '').trim();
    t = t.replace(/\s+release\s*date\s*[:\-]\s*.*$/i, '').trim();

    if (!t) return;
    if (t.length < 2 || t.length > 120) return;
    const bad = ['side one', 'side two', 'track listing', 'soundtrack', 'lyrics', 'music', 'all songs'];
    const tl = t.toLowerCase();
    if (bad.some((b) => tl === b || tl.startsWith(b))) return;
    out.push(t);
  };

  // Prefer list items first.
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = liRe.exec(html))) add(m[1]);

  // Track tables.
  const tables = String(html || '').match(/<table[\s\S]*?<\/table>/gi) || [];
  for (const table of tables) {
    const rows = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    let titleIndex = 1;
    for (const r of rows) {
      const ths = (r.match(/<th[\s\S]*?<\/th>/gi) || []).map((x) => stripTags(x).toLowerCase());
      if (ths.length) {
        const idx = ths.findIndex((h) => h.includes('title') || h.includes('song'));
        if (idx >= 0) titleIndex = idx;
        continue;
      }
      const tds = (r.match(/<td[\s\S]*?<\/td>/gi) || []).map((x) => stripTags(x));
      if (tds.length < 2) continue;
      const looksNumeric = (v) => /^\s*#?\s*\d{1,3}\s*$/.test(String(v || ''));
      const looksDuration = (v) => /^\s*\d{1,2}:\d{2}\s*$/.test(String(v || ''));
      const looksTooShort = (v) => String(v || '').trim().length < 2;

      // Heuristics:
      // - If first col is a track number, title is usually the next non-duration col.
      // - If headers exist, use them; otherwise choose the best-looking cell.
      let candidate = '';
      if (looksNumeric(tds[0])) {
        for (let i = 1; i < tds.length; i++) {
          if (looksDuration(tds[i]) || looksNumeric(tds[i]) || looksTooShort(tds[i])) continue;
          candidate = tds[i];
          break;
        }
      }
      if (!candidate) {
        const pick = tds[Math.min(titleIndex, tds.length - 1)];
        if (!looksDuration(pick) && !looksNumeric(pick) && !looksTooShort(pick)) candidate = pick;
      }
      if (!candidate) {
        // Best-looking longest cell that isn't a duration/number.
        const best = tds
          .map((v) => String(v || '').trim())
          .filter((v) => v && !looksNumeric(v) && !looksDuration(v))
          .sort((a, b) => b.length - a.length)[0];
        candidate = best || '';
      }
      add(candidate);
    }
  }

  // Fallback: numbered lines in paragraphs (common when track listing isn't a <ul>/<table>).
  if (out.length < 2) {
    try {
      const withBreaks = String(html || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/tr>/gi, '\n');
      const plain = stripTags(withBreaks)
        .replace(/\s*\n\s*/g, '\n')
        .replace(/\n{2,}/g, '\n');
      const lines = plain.split('\n').map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const mm = line.match(/^\s*(\d{1,2})[\.\)\-:]\s*(.+)$/);
        if (!mm) continue;
        add(mm[2]);
      }
    } catch {
      // ignore
    }
  }

  // De-dupe while preserving order.
  const seen = new Set();
  const uniq = [];
  for (const t of out) {
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(t);
  }
  return uniq;
}

export async function wikipediaSearch(query, opts = {}) {
  const base = wikiApiBase(opts.lang);
  const url = new URL(`${base}/w/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', query);
  url.searchParams.set('srnamespace', '0'); // articles only
  url.searchParams.set('srlimit', String(opts.limit || 6));
  url.searchParams.set('format', 'json');

  const res = await fetch(url, { headers: { 'User-Agent': 'indiamovieguide.com (local dev)' } });
  if (!res.ok) throw new Error(`Wikipedia search failed: ${res.status}`);
  const data = await res.json();
  return (data?.query?.search || []).map((h) => ({
    title: h?.title || '',
    snippet: decodeHtmlEntities(String(h?.snippet || '').replace(/<[^>]+>/g, ' '))
  })).filter((h) => h.title);
}

export async function wikipediaSearchTitle(query, opts = {}) {
  const hits = await wikipediaSearch(query, opts).catch(() => []);
  return hits?.[0]?.title || null;
}

export async function wikipediaLeadByTitle(title, opts = {}) {
  if (!title) return { title: null, url: null, extract: '' };
  const base = wikiApiBase(opts.lang);
  const url = new URL(`${base}/w/api.php`);
  url.searchParams.set('action', 'query');
  url.searchParams.set('prop', 'extracts');
  url.searchParams.set('exintro', '1');
  url.searchParams.set('explaintext', '1');
  url.searchParams.set('redirects', '1');
  url.searchParams.set('titles', title);
  url.searchParams.set('format', 'json');

  const res = await fetch(url, { headers: { 'User-Agent': 'indiamovieguide.com (local dev)' } });
  if (!res.ok) return { title: null, url: null, extract: '' };
  const data = await res.json().catch(() => ({}));
  const pages = data?.query?.pages || {};
  const page = Object.values(pages)[0] || null;
  const pageTitle = page?.title || title;
  const extract = String(page?.extract || '').trim();
  return { title: pageTitle, url: wikiUrl(pageTitle, opts.lang), extract };
}

export async function wikipediaSoundtrackTracksByTitle(title, opts = {}) {
  if (!title) return { title: null, url: null, tracks: [] };
  const base = wikiApiBase(opts.lang);

  const sectionsUrl = new URL(`${base}/w/api.php`);
  sectionsUrl.searchParams.set('action', 'parse');
  sectionsUrl.searchParams.set('page', title);
  sectionsUrl.searchParams.set('prop', 'sections');
  sectionsUrl.searchParams.set('format', 'json');

  const sres = await fetch(sectionsUrl, { headers: { 'User-Agent': 'indiamovieguide.com (local dev)' } });
  if (!sres.ok) return { title: null, url: null, tracks: [] };
  const sdata = await sres.json().catch(() => ({}));
  const canonicalTitle = sdata?.parse?.title || title;
  const sections = sdata?.parse?.sections || [];
  const candidates = sections
    .map((sec) => ({ index: sec?.index, line: String(sec?.line || '') }))
    .filter((sec) => sec.index != null && /soundtrack|music|songs|track listing|tracklist/i.test(sec.line))
    // Prefer explicit track lists over generic "Music" sections.
    .sort((a, b) => {
      const w = (line) => {
        const l = String(line || '').toLowerCase();
        if (l.includes('track listing') || l.includes('tracklist')) return 0;
        if (l.includes('soundtrack')) return 1;
        if (l.includes('songs')) return 2;
        if (l.includes('music')) return 3;
        return 9;
      };
      return w(a.line) - w(b.line);
    })
    .map((sec) => sec.index);
  if (!candidates.length) return { title: canonicalTitle, url: wikiUrl(canonicalTitle, opts.lang), tracks: [] };

  for (const index of candidates) {
    const htmlUrl = new URL(`${base}/w/api.php`);
    htmlUrl.searchParams.set('action', 'parse');
    htmlUrl.searchParams.set('page', title);
    htmlUrl.searchParams.set('prop', 'text');
    htmlUrl.searchParams.set('section', String(index));
    htmlUrl.searchParams.set('format', 'json');

    const hres = await fetch(htmlUrl, { headers: { 'User-Agent': 'indiamovieguide.com (local dev)' } });
    if (!hres.ok) continue;
    const hdata = await hres.json().catch(() => ({}));
    const html = hdata?.parse?.text?.['*'] || '';
    const tracks = extractTrackTitlesFromHtml(html);
    if (tracks.length >= 2) return { title: canonicalTitle, url: wikiUrl(canonicalTitle, opts.lang), tracks };
  }

  return { title: canonicalTitle, url: wikiUrl(canonicalTitle, opts.lang), tracks: [] };
}

export async function wikipediaSummaryByTitle(title) {
  if (!title) return null;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'indiamovieguide.com (local dev)' } });
  if (!res.ok) return null;
  const data = await res.json();
  return {
    title: data.title,
    extract: data.extract || '',
    url: data.content_urls?.desktop?.page || wikiUrl(data.title),
    thumbnail: data.thumbnail?.source || ''
  };
}
