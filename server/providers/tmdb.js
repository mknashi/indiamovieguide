const TMDB_BASE = 'https://api.themoviedb.org/3';

function tmdbImageUrl(p, size = 'w500') {
  if (!p) return '';
  return `https://image.tmdb.org/t/p/${size}${p}`;
}

function mapLanguage(code) {
  switch (code) {
    case 'hi':
      return 'Hindi';
    case 'ta':
      return 'Tamil';
    case 'te':
      return 'Telugu';
    case 'kn':
      return 'Kannada';
    case 'ml':
      return 'Malayalam';
    case 'bn':
      return 'Bengali';
    case 'mr':
      return 'Marathi';
    case 'pa':
      return 'Punjabi';
    case 'en':
      return 'English';
    default:
      return code || 'Hindi';
  }
}

async function tmdbFetch(pathname, params = {}) {
  const apiKey = process.env.TMDB_API_KEY;
  const bearer = process.env.TMDB_BEARER_TOKEN;
  if (!apiKey && !bearer) throw new Error('Missing TMDB_API_KEY or TMDB_BEARER_TOKEN');

  const url = new URL(`${TMDB_BASE}${pathname}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  if (!bearer && apiKey) url.searchParams.set('api_key', apiKey);

  const res = await fetch(url.toString(), {
    headers: bearer ? { Authorization: `Bearer ${bearer}` } : undefined
  });
  if (!res.ok) throw new Error(`TMDB ${pathname} failed: ${res.status} ${await res.text()}`);
  return await res.json();
}

const DEFAULT_INDIAN_LANGS = ['hi', 'ta', 'te', 'ml', 'kn'];

export async function tmdbSearchMovie(query) {
  const data = await tmdbFetch('/search/movie', {
    query,
    include_adult: 'false',
    page: '1',
    region: 'IN'
  });
  return (data.results || []).slice(0, 8).map((m) => ({
    tmdbId: m.id,
    title: m.title,
    overview: m.overview,
    releaseDate: m.release_date || null,
    language: mapLanguage(m.original_language),
    poster: tmdbImageUrl(m.poster_path, 'w500'),
    backdrop: tmdbImageUrl(m.backdrop_path, 'w780')
  }));
}

export async function tmdbDiscoverMovies({
  dateGte,
  dateLte,
  sortBy,
  page = 1,
  region = 'IN',
  languages,
  voteCountGte
} = {}) {
  const langs = Array.isArray(languages) && languages.length ? languages : null;
  const multi = langs ? langs : [null];

  const collected = [];
  for (const lang of multi) {
    const data = await tmdbFetch('/discover/movie', {
      include_adult: 'false',
      include_video: 'true',
      page,
      region,
      sort_by: sortBy || 'popularity.desc',
      'primary_release_date.gte': dateGte || '',
      'primary_release_date.lte': dateLte || '',
      ...(typeof voteCountGte === 'number' ? { 'vote_count.gte': String(voteCountGte) } : {}),
      ...(lang ? { with_original_language: lang } : {})
    });

    for (const m of data.results || []) {
      collected.push({
        tmdbId: m.id,
        title: m.title,
        releaseDate: m.release_date || null,
        originalLanguage: m.original_language,
        poster: tmdbImageUrl(m.poster_path, 'w500'),
        backdrop: tmdbImageUrl(m.backdrop_path, 'w780')
      });
    }
  }

  // De-dupe across languages/pages.
  const byId = new Map();
  for (const m of collected) byId.set(m.tmdbId, m);
  return Array.from(byId.values());
}

export async function tmdbGetMovieFull(tmdbId) {
  const details = await tmdbFetch(`/movie/${tmdbId}`, {
    append_to_response: 'credits,videos,watch/providers',
    region: 'IN'
  });

  const crew = details.credits?.crew || [];
  const director = crew.find((c) => c.job === 'Director')?.name || 'TBD';
  const writers = crew
    .filter((c) => c.department === 'Writing')
    .map((c) => c.name)
    .filter(Boolean);

  const cast = (details.credits?.cast || []).slice(0, 12).map((c) => ({
    tmdbId: c.id,
    name: c.name,
    character: c.character || '',
    profileImage: tmdbImageUrl(c.profile_path, 'w500')
  }));

  const videos = details.videos?.results || [];
  const trailer =
    videos.find((v) => v.site === 'YouTube' && v.type === 'Trailer') ||
    videos.find((v) => v.site === 'YouTube') ||
    null;
  const trailerUrl = trailer?.key ? `https://www.youtube.com/watch?v=${trailer.key}` : '';

  const preferredRegion = (process.env.OTT_REGION || 'IN').toUpperCase();
  const providerResults = details['watch/providers']?.results || {};
  const providers =
    providerResults[preferredRegion] || providerResults.IN || providerResults.US || providerResults.GB || null;

  const providerLink = providers?.link || '';
  const offers = [];
  for (const type of ['flatrate', 'rent', 'buy']) {
    for (const p of providers?.[type] || []) {
      offers.push({
        provider: p.provider_name,
        type: type === 'flatrate' ? 'Streaming' : type === 'rent' ? 'Rent' : 'Buy',
        url: providerLink || '',
        logo: tmdbImageUrl(p.logo_path, 'w500'),
        region: providers ? preferredRegion : undefined
      });
    }
  }

  // Reviews (TMDB)
  let reviews = [];
  try {
    const r = await tmdbFetch(`/movie/${tmdbId}/reviews`, { page: '1' });
    reviews = (r.results || []).slice(0, 6).map((rv) => ({
      tmdbReviewId: rv.id,
      author: rv.author || 'Unknown',
      rating: typeof rv.author_details?.rating === 'number' ? rv.author_details.rating : null,
      url: rv.url || '',
      excerpt: String(rv.content || '').slice(0, 420)
    }));
  } catch {
    // ignore
  }

  return {
    tmdbId: details.id,
    title: details.title,
    synopsis: details.overview || '',
    releaseDate: details.release_date || null,
    language: mapLanguage(details.original_language),
    productionCountries: (details.production_countries || []).map((c) => c.iso_3166_1).filter(Boolean),
    genres: (details.genres || []).map((g) => g.name).filter(Boolean),
    poster: tmdbImageUrl(details.poster_path, 'w500'),
    backdrop: tmdbImageUrl(details.backdrop_path, 'w780'),
    director,
    writers,
    cast,
    trailerUrl,
    offers,
    voteAverage: typeof details.vote_average === 'number' ? details.vote_average : null,
    voteCount: typeof details.vote_count === 'number' ? details.vote_count : null,
    reviews
  };
}

export async function tmdbGetMovieOffers(tmdbId, { region } = {}) {
  const details = await tmdbFetch(`/movie/${tmdbId}/watch/providers`, {});

  const preferredRegion = String(region || process.env.OTT_REGION || 'IN').toUpperCase();
  const providerResults = details?.results || {};
  const providers =
    providerResults[preferredRegion] || providerResults.IN || providerResults.US || providerResults.GB || null;

  const providerLink = providers?.link || '';
  const offers = [];
  for (const type of ['flatrate', 'rent', 'buy']) {
    for (const p of providers?.[type] || []) {
      offers.push({
        provider: p.provider_name,
        type: type === 'flatrate' ? 'Streaming' : type === 'rent' ? 'Rent' : 'Buy',
        url: providerLink || '',
        logo: tmdbImageUrl(p.logo_path, 'w500'),
        region: providers ? preferredRegion : undefined
      });
    }
  }

  return {
    region: providers ? preferredRegion : null,
    link: providerLink || '',
    offers
  };
}

export function defaultIndianLanguageCodes() {
  // Keep in sync with the UI header's "popular languages".
  return ['hi', 'kn', 'te', 'ta', 'ml', 'mr', 'bn'];
}

export async function tmdbSearchPerson(query) {
  const data = await tmdbFetch('/search/person', { query, include_adult: 'false', page: '1' });
  return (data.results || []).slice(0, 8).map((p) => ({
    tmdbId: p.id,
    name: p.name,
    profileImage: tmdbImageUrl(p.profile_path, 'w500'),
    knownFor: (p.known_for || []).map((k) => k.title || k.name).filter(Boolean)
  }));
}

export async function tmdbGetPersonFull(tmdbId) {
  const details = await tmdbFetch(`/person/${tmdbId}`, { append_to_response: 'combined_credits' });
  const credits = details.combined_credits || {};
  const cast = credits.cast || [];

  const filmography = cast
    .slice()
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 20)
    .map((c) => ({
      tmdbId: c.id,
      title: c.title || c.name,
      mediaType: c.media_type,
      character: c.character || '',
      releaseDate: c.release_date || c.first_air_date || null,
      poster: tmdbImageUrl(c.poster_path, 'w500')
    }));

  return {
    tmdbId: details.id,
    name: details.name,
    biography: details.biography || '',
    profileImage: tmdbImageUrl(details.profile_path, 'w500'),
    knownForDepartment: details.known_for_department || '',
    filmography
  };
}
