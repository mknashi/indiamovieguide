const ITUNES_BASE = 'https://itunes.apple.com';

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(s) {
  return normalizeText(s)
    .split(/\s+/g)
    .filter(
      (t) =>
        t.length >= 3 &&
        !['the', 'and', 'for', 'from', 'with', 'movie', 'film', 'songs', 'song', 'jukebox', 'ost', 'soundtrack'].includes(
          t
        )
    );
}

async function itunesFetch(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'indiamovieguide.com (local dev)' } });
  if (!res.ok) throw new Error(`iTunes API failed: ${res.status}`);
  return await res.json();
}

export async function itunesSearchAlbums(term, { country = 'IN', limit = 10 } = {}) {
  const url = new URL(`${ITUNES_BASE}/search`);
  url.searchParams.set('term', term);
  url.searchParams.set('entity', 'album');
  url.searchParams.set('media', 'music');
  url.searchParams.set('country', country);
  url.searchParams.set('limit', String(limit));
  const data = await itunesFetch(url.toString());
  return (data.results || []).map((r) => ({
    collectionId: r.collectionId,
    collectionName: r.collectionName,
    artistName: r.artistName,
    releaseDate: r.releaseDate,
    collectionViewUrl: r.collectionViewUrl,
    trackCount: r.trackCount
  }));
}

export async function itunesLookupAlbumTracks(collectionId, { country = 'IN' } = {}) {
  const url = new URL(`${ITUNES_BASE}/lookup`);
  url.searchParams.set('id', String(collectionId));
  url.searchParams.set('entity', 'song');
  url.searchParams.set('country', country);
  const data = await itunesFetch(url.toString());
  const results = data.results || [];
  const album = results.find((r) => r.wrapperType === 'collection') || null;
  const tracks = results
    .filter((r) => r.wrapperType === 'track' && r.kind === 'song')
    .map((t) => ({
      trackId: t.trackId,
      title: t.trackName,
      artist: t.artistName,
      trackViewUrl: t.trackViewUrl,
      previewUrl: t.previewUrl,
      discNumber: t.discNumber,
      trackNumber: t.trackNumber
    }))
    .filter((t) => t.title);
  return { album, tracks };
}

function yearFromDate(iso) {
  const y = Number(String(iso || '').slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function scoreAlbum({ movieTitle, year, language }, album) {
  const name = normalizeText(album.collectionName || '');
  const artist = normalizeText(album.artistName || '');
  const hay = `${name} ${artist}`.trim();

  const tokens = tokenize(movieTitle);
  const matched = tokens.filter((t) => hay.includes(t)).length;
  const base = tokens.length ? matched / tokens.length : 0;

  let score = base;
  const langToken = normalizeText(language);
  if (langToken && hay.includes(langToken)) score += 0.25;
  if (hay.includes('soundtrack') || hay.includes('ost') || hay.includes('original motion picture')) score += 0.25;
  if (hay.includes('jukebox')) score += 0.12;

  const ay = yearFromDate(album.releaseDate);
  if (year && ay) {
    const diff = Math.abs(year - ay);
    score += diff === 0 ? 0.35 : diff === 1 ? 0.15 : -0.25;
  }

  // Single-word titles are extremely ambiguous. Require either language match or good year match.
  if (tokens.length <= 1) {
    const hasLang = !!(langToken && hay.includes(langToken));
    const ay = yearFromDate(album.releaseDate);
    const hasYear = !!(year && ay && Math.abs(year - ay) <= 1);
    if (!(hasLang || hasYear)) return -1;
  }

  return score;
}

export async function itunesFindSoundtrackForMovie({ title, year, language } = {}) {
  const movieTitle = String(title || '').trim();
  if (!movieTitle) return null;

  const queries = [
    `${movieTitle} soundtrack`,
    `${movieTitle} original motion picture soundtrack`,
    `${movieTitle} jukebox`,
    `${movieTitle} songs`
  ];
  if (language) queries.unshift(`${movieTitle} ${language} soundtrack`);

  const all = [];
  for (const q of queries) {
    const hits = await itunesSearchAlbums(q, { country: 'IN', limit: 12 }).catch(() => []);
    all.push(...hits);
  }

  const byId = new Map();
  for (const a of all) {
    if (!a.collectionId) continue;
    if (!byId.has(a.collectionId)) byId.set(a.collectionId, a);
  }

  const scored = Array.from(byId.values())
    .map((a) => ({ a, s: scoreAlbum({ movieTitle, year, language }, a) }))
    .filter((x) => x.s >= 0.55)
    .sort((x, y) => y.s - x.s)
    .slice(0, 5);

  for (const { a } of scored) {
    const { album, tracks } = await itunesLookupAlbumTracks(a.collectionId, { country: 'IN' }).catch(() => ({
      album: null,
      tracks: []
    }));
    if (tracks.length >= 2) {
      return {
        provider: 'itunes',
        albumId: a.collectionId,
        albumTitle: a.collectionName || '',
        albumUrl: a.collectionViewUrl || '',
        albumReleaseYear: yearFromDate(a.releaseDate),
        tracks: tracks
          .sort((x, y) => (x.discNumber - y.discNumber) || (x.trackNumber - y.trackNumber))
          .map((t) => ({
            title: t.title,
            artist: t.artist || '',
            url: t.trackViewUrl || '',
            previewUrl: t.previewUrl || '',
            providerId: t.trackId ? String(t.trackId) : ''
          }))
      };
    }
  }

  return null;
}

