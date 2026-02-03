function parseRatingValue(raw) {
  if (!raw) return null;
  const s = String(raw).trim();

  // 7.3/10
  const frac = s.match(/^([0-9.]+)\s*\/\s*([0-9.]+)$/);
  if (frac) {
    const value = Number(frac[1]);
    const scale = Number(frac[2]);
    if (Number.isFinite(value) && Number.isFinite(scale) && scale > 0) return { value, scale };
  }

  // 85%
  const pct = s.match(/^([0-9.]+)%$/);
  if (pct) {
    const value = Number(pct[1]);
    if (Number.isFinite(value)) return { value, scale: 100 };
  }

  // 66/100
  const outOf100 = s.match(/^([0-9.]+)\s*\/\s*100$/);
  if (outOf100) {
    const value = Number(outOf100[1]);
    if (Number.isFinite(value)) return { value, scale: 100 };
  }

  return null;
}

export async function omdbByTitle(title, year) {
  const key = process.env.OMDB_API_KEY;
  if (!key) return null;

  const url = new URL('https://www.omdbapi.com/');
  url.searchParams.set('apikey', key);
  url.searchParams.set('t', title);
  url.searchParams.set('type', 'movie');
  if (year) url.searchParams.set('y', String(year));

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`OMDb failed: ${res.status}`);
  const data = await res.json();
  if (!data || data.Response === 'False') return null;

  const ratings = [];
  for (const r of data.Ratings || []) {
    const parsed = parseRatingValue(r.Value);
    if (!parsed) continue;
    ratings.push({
      source: String(r.Source),
      value: parsed.value,
      scale: parsed.scale,
      url: data.imdbID ? `https://www.imdb.com/title/${data.imdbID}/` : ''
    });
  }

  const imdbVotes = data.imdbVotes ? String(data.imdbVotes).replace(/,/g, '') : '';
  const voteCount = imdbVotes && Number.isFinite(Number(imdbVotes)) ? Number(imdbVotes) : null;
  const imdbRating = data.imdbRating && data.imdbRating !== 'N/A' ? Number(data.imdbRating) : null;

  // OMDb also provides direct imdbRating/imdbVotes; keep it as a structured rating too.
  if (typeof imdbRating === 'number' && Number.isFinite(imdbRating)) {
    ratings.unshift({
      source: 'IMDb',
      value: imdbRating,
      scale: 10,
      count: voteCount,
      url: data.imdbID ? `https://www.imdb.com/title/${data.imdbID}/` : ''
    });
  }

  return {
    title: data.Title,
    year: data.Year ? Number(String(data.Year).slice(0, 4)) : null,
    imdbId: data.imdbID || null,
    ratings
  };
}
