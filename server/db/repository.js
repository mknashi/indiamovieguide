import { INDIAN_LANGUAGES_LOWER, hashId, makeId, nowIso, soundex, statusFrom, toIsoDate } from '../repo.js';

export function upsertMovieFromTmdb(db, tmdbMovie) {
  const id = makeId('tmdb-movie', tmdbMovie.tmdbId);
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const releaseDate = toIsoDate(tmdbMovie.releaseDate);
  const hasStreaming = (tmdbMovie.offers || []).some((o) => o.type === 'Streaming');
  const status = statusFrom(releaseDate, hasStreaming);
  const titleSoundex = soundex(tmdbMovie.title);
  const productionCountriesJson = JSON.stringify(tmdbMovie.productionCountries || []);
  const isIndian =
    Array.isArray(tmdbMovie.productionCountries) && tmdbMovie.productionCountries.includes('IN')
      ? 1
      : INDIAN_LANGUAGES_LOWER.includes(String(tmdbMovie.language || '').toLowerCase())
        ? 1
        : 0;

  db.prepare(
    `
    INSERT INTO movies (
      id, tmdb_id, title, title_soundex, language, is_indian, production_countries_json, synopsis, director, release_date, status,
      poster, backdrop, trailer_url, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      title_soundex=excluded.title_soundex,
      language=excluded.language,
      is_indian=excluded.is_indian,
      production_countries_json=excluded.production_countries_json,
      synopsis=excluded.synopsis,
      director=excluded.director,
      release_date=excluded.release_date,
      status=excluded.status,
      poster=excluded.poster,
      backdrop=excluded.backdrop,
      trailer_url=excluded.trailer_url,
      updated_at=excluded.updated_at
  `
  ).run(
    id,
    tmdbMovie.tmdbId,
    tmdbMovie.title,
    titleSoundex,
    tmdbMovie.language,
    isIndian,
    productionCountriesJson,
    tmdbMovie.synopsis,
    tmdbMovie.director,
    releaseDate,
    status,
    tmdbMovie.poster,
    tmdbMovie.backdrop,
    tmdbMovie.trailerUrl,
    createdAt,
    updatedAt
  );

  // genres
  db.prepare('DELETE FROM movie_genres WHERE movie_id = ?').run(id);
  for (const g of tmdbMovie.genres || []) {
    db.prepare('INSERT OR IGNORE INTO movie_genres(movie_id, genre) VALUES (?, ?)').run(id, g);
  }

  // cast
  db.prepare('DELETE FROM movie_cast WHERE movie_id = ?').run(id);
  let order = 0;
  for (const c of tmdbMovie.cast || []) {
    const personId = makeId('tmdb-person', c.tmdbId);
    const ts = nowIso();
    db.prepare(
      `
      INSERT INTO persons (id, tmdb_id, name, name_soundex, biography, wiki_url, profile_image, created_at, updated_at)
      VALUES (
        ?, ?, ?, ?,
        COALESCE((SELECT biography FROM persons WHERE id = ?), ''),
        COALESCE((SELECT wiki_url FROM persons WHERE id = ?), ''),
        COALESCE(?, COALESCE((SELECT profile_image FROM persons WHERE id = ?), '')),
        ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        name_soundex=excluded.name_soundex,
        profile_image=CASE WHEN excluded.profile_image != '' THEN excluded.profile_image ELSE persons.profile_image END,
        updated_at=excluded.updated_at
    `
    ).run(personId, c.tmdbId, c.name, soundex(c.name), personId, personId, c.profileImage || '', personId, ts, ts);

    db.prepare(
      'INSERT OR REPLACE INTO movie_cast(movie_id, person_id, character, billing_order) VALUES (?, ?, ?, ?)'
    ).run(id, personId, c.character || '', order++);

    db.prepare(
      'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(hashId('attr', `${personId}:tmdb`), 'person', personId, 'tmdb', String(c.tmdbId), '', ts);
  }

  // OTT offers
  db.prepare('DELETE FROM ott_offers WHERE movie_id = ?').run(id);
  for (const o of tmdbMovie.offers || []) {
    const offerId = hashId('ott', `${id}:${o.provider}:${o.type}:${o.region || ''}`);
    db.prepare(
      `
      INSERT OR REPLACE INTO ott_offers (
        id, movie_id, provider, offer_type, url, logo, region, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(offerId, id, o.provider, o.type, o.url || '', o.logo || '', o.region || '', 'tmdb', nowIso());
  }

  db.prepare(
    'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(
    hashId('attr', `${id}:tmdb`),
    'movie',
    id,
    'tmdb',
    String(tmdbMovie.tmdbId),
    `https://www.themoviedb.org/movie/${tmdbMovie.tmdbId}`,
    nowIso()
  );

  // Ratings (TMDB vote average)
  if (typeof tmdbMovie.voteAverage === 'number') {
    const rid = hashId('rating', `${id}:tmdb`);
    db.prepare(
      `
      INSERT OR REPLACE INTO ratings(id, movie_id, source, value, scale, count, url, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      rid,
      id,
      'tmdb',
      tmdbMovie.voteAverage,
      10,
      typeof tmdbMovie.voteCount === 'number' ? tmdbMovie.voteCount : null,
      `https://www.themoviedb.org/movie/${tmdbMovie.tmdbId}`,
      nowIso()
    );
  }

  // Reviews (TMDB)
  if (Array.isArray(tmdbMovie.reviews) && tmdbMovie.reviews.length) {
    for (const rv of tmdbMovie.reviews.slice(0, 6)) {
      const reviewId = hashId('review', `${id}:${rv.tmdbReviewId || rv.url || rv.author || ''}`);
      db.prepare(
        `
        INSERT OR REPLACE INTO reviews(id, movie_id, source, author, rating, url, excerpt, fetched_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
      ).run(
        reviewId,
        id,
        'tmdb',
        rv.author || '',
        typeof rv.rating === 'number' ? rv.rating : null,
        rv.url || '',
        rv.excerpt || '',
        nowIso()
      );
    }
  }

  return id;
}

export function upsertRatingsFromOmdb(db, movieId, omdb) {
  if (!omdb || !Array.isArray(omdb.ratings)) return;
  const ts = nowIso();
  for (const r of omdb.ratings) {
    const source = String(r.source || '').trim();
    if (!source) continue;
    const id = hashId('rating', `${movieId}:${source}`);
    db.prepare(
      `
      INSERT OR REPLACE INTO ratings(id, movie_id, source, value, scale, count, url, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      movieId,
      source.toLowerCase().includes('imdb') ? 'imdb' : source.toLowerCase().replace(/\\s+/g, ''),
      r.value,
      r.scale,
      typeof r.count === 'number' ? r.count : null,
      r.url || '',
      ts
    );
  }
}

export function upsertSongsFromYoutube(db, movieId, songs) {
  const ts = nowIso();
  for (const s of songs || []) {
    const id = hashId('song', `${movieId}:${s.youtubeUrl || s.title}`);
    db.prepare(
      `
      INSERT OR REPLACE INTO songs(
        id, movie_id, title, singers_json, youtube_url, platform, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, movieId, s.title || 'Untitled', JSON.stringify(s.singers || []), s.youtubeUrl || '', 'YouTube', 'youtube', ts);

    db.prepare(
      'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(hashId('attr', `${id}:youtube`), 'song', id, 'youtube', '', s.youtubeUrl || '', ts);
  }
}

export function replaceSongsFromYoutube(db, movieId, songs) {
  replaceSongsForMovie(db, movieId, songs, { source: 'youtube', platform: 'YouTube' });
}

export function clearSongsForMovie(db, movieId) {
  const existing = db.prepare('SELECT id FROM songs WHERE movie_id = ?').all(movieId).map((r) => r.id);
  if (existing.length) {
    const ph = existing.map(() => '?').join(',');
    db.prepare(`DELETE FROM attributions WHERE entity_type = 'song' AND entity_id IN (${ph})`).run(...existing);
  }
  db.prepare('DELETE FROM songs WHERE movie_id = ?').run(movieId);
}

export function replaceSongsForMovie(db, movieId, songs, meta = {}) {
  // Keep existing songs if we didn't find anything useful.
  if (!Array.isArray(songs) || songs.length === 0) return;

  const source = String(meta.source || 'youtube').slice(0, 40);
  const platform = String(meta.platform || 'YouTube').slice(0, 40);
  const defaultSourceUrl = meta.sourceUrl
    ? String(meta.sourceUrl).slice(0, 400)
    : meta.wikiUrl
      ? String(meta.wikiUrl).slice(0, 400)
      : '';
  const attributionProvider = String(meta.attributionProvider || source).slice(0, 40);

  clearSongsForMovie(db, movieId);

  const ts = nowIso();
  for (const s of songs) {
    const title = String(s?.title || 'Untitled').trim().slice(0, 140) || 'Untitled';
    const youtubeUrl = s?.youtubeUrl ? String(s.youtubeUrl).slice(0, 400) : '';
    const singers = Array.isArray(s?.singers) ? s.singers.slice(0, 12).map((x) => String(x).slice(0, 80)) : [];
    const sourceUrl = s?.sourceUrl ? String(s.sourceUrl).slice(0, 400) : defaultSourceUrl;
    const sourceProviderId = s?.sourceProviderId ? String(s.sourceProviderId).slice(0, 80) : '';
    const id = hashId('song', `${movieId}:${source}:${title.toLowerCase()}`);

    db.prepare(
      `
      INSERT OR REPLACE INTO songs(
        id, movie_id, title, singers_json, youtube_url, platform, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, movieId, title, JSON.stringify(singers), youtubeUrl, platform, source, ts);

    if (youtubeUrl) {
      db.prepare(
        'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(hashId('attr', `${id}:youtube`), 'song', id, 'youtube', '', youtubeUrl, ts);
    }

    if (sourceUrl) {
      db.prepare(
        'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(hashId('attr', `${id}:${attributionProvider}`), 'song', id, attributionProvider, sourceProviderId, sourceUrl, ts);
    }
  }
}

export function updatePersonWiki(db, personId, wiki) {
  if (!wiki) return;
  db.prepare('UPDATE persons SET biography = COALESCE(?, biography), wiki_url = COALESCE(?, wiki_url), profile_image = COALESCE(?, profile_image), updated_at = ? WHERE id = ?')
    .run(wiki.extract || '', wiki.url || '', wiki.thumbnail || '', nowIso(), personId);

  db.prepare(
    'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(hashId('attr', `${personId}:wikipedia`), 'person', personId, 'wikipedia', wiki.title || '', wiki.url || '', nowIso());
}

export function searchLocal(db, q) {
  const needle = `%${q.toLowerCase()}%`;
  const indianOnly = `COALESCE(m.is_indian, 1) = 1`;

  const movieRows = db
    .prepare(
      `
      SELECT DISTINCT m.*
      FROM movies m
      LEFT JOIN movie_genres mg ON mg.movie_id = m.id
      LEFT JOIN movie_cast mc ON mc.movie_id = m.id
      LEFT JOIN persons p ON p.id = mc.person_id
      WHERE ${indianOnly}
       AND (lower(m.title) LIKE ?
         OR lower(m.synopsis) LIKE ?
         OR lower(p.name) LIKE ?
         OR lower(mg.genre) LIKE ?)
      ORDER BY COALESCE(m.release_date, '0000-00-00') DESC
      LIMIT 50
    `
    )
    .all(needle, needle, needle, needle);

  const personRows = db
    .prepare(
      `
      SELECT *
      FROM persons
      WHERE lower(name) LIKE ? OR lower(biography) LIKE ?
      ORDER BY name ASC
      LIMIT 50
    `
    )
    .all(needle, needle);

  if (movieRows.length || personRows.length) {
    return {
      movies: movieRows.map((m) => hydrateMovie(db, m.id)),
      persons: personRows.map((p) => hydratePerson(db, p.id))
    };
  }

  // "Sounds like" fallback when there are no substring matches.
  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const diceCoefficient = (a, b) => {
    const s1 = normalize(a);
    const s2 = normalize(b);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;
    const bigrams = (s) => {
      const out = new Map();
      for (let i = 0; i < s.length - 1; i++) {
        const bg = s.slice(i, i + 2);
        out.set(bg, (out.get(bg) || 0) + 1);
      }
      return out;
    };
    const b1 = bigrams(s1);
    const b2 = bigrams(s2);
    let intersect = 0;
    for (const [bg, n] of b1.entries()) {
      const m = b2.get(bg) || 0;
      intersect += Math.min(n, m);
    }
    return (2 * intersect) / ((s1.length - 1) + (s2.length - 1));
  };

  const qn = normalize(q);
  const tokens = qn.split(/\s+/g).filter((t) => t.length >= 4);
  const codes = Array.from(new Set([qn, ...tokens].map((t) => soundex(t)).filter((sx) => sx && sx !== '0000'))).slice(
    0,
    6
  );

  if (!codes.length) return { movies: [], persons: [] };
  const placeholders = codes.map(() => '?').join(',');

  const rawFuzzyPersons = db
    .prepare(
      `
      SELECT *
      FROM persons
      WHERE name_soundex IN (${placeholders})
      ORDER BY name ASC
      LIMIT 50
    `
    )
    .all(...codes);

  const personMinScore = qn.length < 8 ? 0.55 : qn.length < 14 ? 0.42 : 0.32;
  const fuzzyPersonRows = rawFuzzyPersons
    .map((p) => ({ ...p, _score: diceCoefficient(qn, p.name) }))
    .filter((p) => p._score >= personMinScore)
    .sort((a, b) => b._score - a._score)
    .slice(0, 12);

  const fuzzyMoviesByCast = (() => {
    if (!fuzzyPersonRows.length) return [];
    const ids = fuzzyPersonRows.map((p) => p.id);
    const inPh = ids.map(() => '?').join(',');
    return db
      .prepare(
        `
        SELECT DISTINCT m.*
        FROM movies m
        JOIN movie_cast mc ON mc.movie_id = m.id
        WHERE ${indianOnly}
          AND mc.person_id IN (${inPh})
        ORDER BY COALESCE(m.release_date, '0000-00-00') DESC, m.title ASC
        LIMIT 50
      `
      )
      .all(...ids);
  })();

  const rawFuzzyMoviesByTitle = db
    .prepare(
      `
      SELECT DISTINCT m.*
      FROM movies m
      WHERE ${indianOnly}
        AND m.title_soundex IN (${placeholders})
      ORDER BY COALESCE(m.release_date, '0000-00-00') DESC, m.title ASC
      LIMIT 50
    `
    )
    .all(...codes);

  const movieMinScore = qn.length < 8 ? 0.55 : qn.length < 14 ? 0.42 : 0.32;
  const fuzzyMoviesByTitle = rawFuzzyMoviesByTitle
    .map((m) => ({ ...m, _score: diceCoefficient(qn, m.title) }))
    .filter((m) => m._score >= movieMinScore)
    .sort((a, b) => b._score - a._score);

  const byId = new Map();
  for (const r of [...fuzzyMoviesByTitle, ...fuzzyMoviesByCast]) byId.set(r.id, r);
  const finalMovieRows = Array.from(byId.values()).slice(0, 50);

  return {
    movies: finalMovieRows.map((m) => hydrateMovie(db, m.id)).filter(Boolean),
    persons: fuzzyPersonRows.map((p) => hydratePerson(db, p.id)).filter(Boolean)
  };
}

export function hydrateMovie(db, movieId) {
  const m = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
  if (!m) return null;

  const genres = db.prepare('SELECT genre FROM movie_genres WHERE movie_id = ?').all(movieId).map((r) => r.genre);
  const cast = db
    .prepare(
      `
      SELECT p.id as person_id, p.tmdb_id, p.name, p.wiki_url, p.profile_image, mc.character
      FROM movie_cast mc
      JOIN persons p ON p.id = mc.person_id
      WHERE mc.movie_id = ?
      ORDER BY mc.billing_order ASC
      LIMIT 12
    `
    )
    .all(movieId)
    .map((r) => ({
      personId: r.person_id,
      name: r.name,
      role: 'Actor',
      character: r.character || '',
      tmdbId: r.tmdb_id || undefined,
      profileUrl: r.wiki_url || undefined,
      profileImage: r.profile_image || undefined
    }));

  const songs = db
    .prepare('SELECT * FROM songs WHERE movie_id = ? ORDER BY created_at DESC LIMIT 20')
    .all(movieId)
    .map((s) => ({
      id: s.id,
      title: s.title,
      singers: JSON.parse(s.singers_json || '[]'),
      youtubeUrl: s.youtube_url || undefined,
      platform: s.platform || undefined
    }));

  const ott = db
    .prepare('SELECT * FROM ott_offers WHERE movie_id = ? ORDER BY provider ASC')
    .all(movieId)
    .map((o) => ({
      provider: o.provider,
      type: o.offer_type,
      url: o.url || undefined,
      deepLink: undefined,
      logo: o.logo || undefined,
      region: o.region || undefined
    }));

  const ratings = db
    .prepare('SELECT * FROM ratings WHERE movie_id = ? ORDER BY source ASC')
    .all(movieId)
    .map((r) => ({
      source: r.source,
      value: r.value,
      scale: r.scale,
      count: typeof r.count === 'number' ? r.count : undefined,
      url: r.url || undefined
    }));

  const reviews = db
    .prepare('SELECT * FROM reviews WHERE movie_id = ? ORDER BY fetched_at DESC LIMIT 6')
    .all(movieId)
    .map((rv) => ({
      source: rv.source,
      author: rv.author || undefined,
      rating: typeof rv.rating === 'number' ? rv.rating : undefined,
      url: rv.url || undefined,
      excerpt: rv.excerpt || ''
    }));

  const sources = db
    .prepare('SELECT provider, url FROM attributions WHERE entity_type = ? AND entity_id = ?')
    .all('movie', movieId)
    .map((a) => a.provider + (a.url ? `:${a.url}` : ''));

  // Choose a primary rating (prefer IMDb, then TMDB) for quick UI chips.
  const primaryRating = (() => {
    const imdb = ratings.find((r) => r.source === 'imdb' && r.scale === 10);
    if (imdb) return imdb.value;
    const tmdb = ratings.find((r) => r.source === 'tmdb' && r.scale === 10);
    if (tmdb) return tmdb.value;
    return undefined;
  })();

  return {
    id: m.id,
    title: m.title,
    language: m.language || 'Hindi',
    synopsis: m.synopsis || '',
    cast,
    director: m.director || 'TBD',
    writers: [],
    genres,
    themes: [],
    runtimeMinutes: undefined,
    releaseDate: m.release_date || undefined,
    status: m.status || 'Announced',
    poster: m.poster || '',
    backdrop: m.backdrop || undefined,
    rating: typeof primaryRating === 'number' ? primaryRating : undefined,
    certification: undefined,
    trailerUrl: m.trailer_url || undefined,
    ott,
    songs,
    ratings,
    reviews,
    sources
  };
}

export function hydratePerson(db, personId) {
  const p = db.prepare('SELECT * FROM persons WHERE id = ?').get(personId);
  if (!p) return null;

  const sources = db
    .prepare('SELECT provider, url FROM attributions WHERE entity_type = ? AND entity_id = ?')
    .all('person', personId)
    .map((a) => a.provider + (a.url ? `:${a.url}` : ''));

  return {
    id: p.id,
    tmdbId: p.tmdb_id || undefined,
    name: p.name,
    biography: p.biography || '',
    wikiUrl: p.wiki_url || undefined,
    profileImage: p.profile_image || undefined,
    filmography: (() => {
      // For user-created persons, we may store a basic filmography list for the UI.
      // TMDB persons ignore this; their filmography comes from tmdbGetPersonFull.
      try {
        const raw = p.filmography_json ? JSON.parse(String(p.filmography_json)) : [];
        if (!Array.isArray(raw)) return [];
        return raw
          .map((t) => ({ title: String(t || '').slice(0, 120) }))
          .filter((x) => x.title);
      } catch {
        return [];
      }
    })(),
    sources
  };
}
