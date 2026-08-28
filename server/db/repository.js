import {
  INDIAN_LANGUAGES_LOWER,
  buildPersonSearchKeys,
  hashId,
  makeId,
  normalizeForSearch,
  nowIso,
  soundex,
  statusFrom,
  toIsoDate
} from '../repo.js';

// Single choke point for writing a movie. Non-Indian films are rejected here
// rather than at each call site: of the 13 places that called this, only 4
// checked, and the gaps let ~416k foreign films accumulate — 93% of the
// database, none of it reachable, since every read path filters is_indian = 1.
//
// The worst leak was person enrichment, which upserts the top 15 filmography
// titles of every person it sees; an Indian actor's credits are full of foreign
// films. Guarding the choke point means a new call site cannot reopen the hole.
//
// Pass { allowNonIndian: true } only where a human explicitly asked for a
// specific title by id, such as the admin movie lookup.
//
// Returns null when the movie is rejected, so callers must handle a missing id.
// The one definition of "is this Indian", shared by the write gate and the
// is_indian column so the two can never disagree. Mirrors the rule that was
// previously inlined in upsertMovieFromTmdb and duplicated as
// isLikelyIndianMovie in both server/index.js and agent/index.ts.
export function isIndianTmdbMovie(tmdbMovie) {
  if (!tmdbMovie) return false;
  if (Array.isArray(tmdbMovie.productionCountries) && tmdbMovie.productionCountries.includes('IN')) return true;
  return INDIAN_LANGUAGES_LOWER.includes(String(tmdbMovie.language || '').toLowerCase());
}

// Does this person belong in an Indian cinema database?
//
// Two signals, neither costing an extra API call:
//   1. Any of their top credits is already a movie we hold as Indian. This is
//      the strong one — it needs no TMDB metadata to be correct, and with
//      ~30k Indian films stored, anyone working in Indian cinema will match.
//   2. Failing that, any credit whose original_language is an Indian language.
//
// Deliberately lenient. A false accept costs one unused row; a false reject
// self-heals, because the person is written anyway by upsertMovieFromTmdb's
// cast handling the moment they appear in an Indian film we ingest. That
// asymmetry is why language alone is acceptable here, even though it was not
// good enough to classify the films themselves.
export function isIndianPerson(db, personFull) {
  const credits = personFull?.filmography;
  if (!Array.isArray(credits) || !credits.length) return false;

  const tmdbIds = credits.map((c) => c?.tmdbId).filter((id) => Number.isFinite(id));
  if (tmdbIds.length) {
    const ph = tmdbIds.map(() => '?').join(',');
    const hit = db
      .prepare(`SELECT 1 FROM movies WHERE tmdb_id IN (${ph}) AND COALESCE(is_indian, 1) = 1 LIMIT 1`)
      .get(...tmdbIds);
    if (hit) return true;
  }

  return credits.some((c) =>
    INDIAN_LANGUAGES_LOWER.includes(String(c?.originalLanguage || '').toLowerCase())
  );
}

export function upsertMovieFromTmdb(db, tmdbMovie, opts = {}) {
  if (!tmdbMovie) return null;
  if (!opts.allowNonIndian && !isIndianTmdbMovie(tmdbMovie)) return null;
  const id = makeId('tmdb-movie', tmdbMovie.tmdbId);
  const createdAt = nowIso();
  const updatedAt = createdAt;
  const releaseDate = toIsoDate(tmdbMovie.releaseDate);
  const hasStreaming = (tmdbMovie.offers || []).some((o) => o.type === 'Streaming');
  const status = statusFrom(releaseDate, hasStreaming);
  const titleSoundex = soundex(tmdbMovie.title);
  const titleNorm = normalizeForSearch(tmdbMovie.title);
  const productionCountriesJson = JSON.stringify(tmdbMovie.productionCountries || []);
  const isIndian = isIndianTmdbMovie(tmdbMovie) ? 1 : 0;

  db.prepare(
    `
    INSERT INTO movies (
      id, tmdb_id, title, title_soundex, title_norm, language, is_indian, production_countries_json, synopsis, director, release_date, status,
      poster, backdrop, trailer_url, created_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title,
      title_soundex=excluded.title_soundex,
      title_norm=excluded.title_norm,
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
    titleNorm,
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
      INSERT INTO persons (id, tmdb_id, name, name_soundex, first_name_soundex, biography, wiki_url, profile_image, created_at, updated_at)
      VALUES (
        ?, ?, ?, ?, ?,
        COALESCE((SELECT biography FROM persons WHERE id = ?), ''),
        COALESCE((SELECT wiki_url FROM persons WHERE id = ?), ''),
        COALESCE(?, COALESCE((SELECT profile_image FROM persons WHERE id = ?), '')),
        ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        name_soundex=excluded.name_soundex,
        first_name_soundex=excluded.first_name_soundex,
        profile_image=CASE WHEN excluded.profile_image != '' THEN excluded.profile_image ELSE persons.profile_image END,
        updated_at=excluded.updated_at
    `
    ).run(personId, c.tmdbId, c.name, soundex(c.name), soundex(c.name.trim().split(/\s+/)[0] || c.name), personId, personId, c.profileImage || '', personId, ts, ts);
    upsertPersonSearchKeys(db, personId, c.name);

    db.prepare(
      'INSERT OR REPLACE INTO movie_cast(movie_id, person_id, character, billing_order) VALUES (?, ?, ?, ?)'
    ).run(id, personId, c.character || '', order++);

    db.prepare(
      'INSERT OR IGNORE INTO attributions(id, entity_type, entity_id, provider, provider_id, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(hashId('attr', `${personId}:tmdb`), 'person', personId, 'tmdb', String(c.tmdbId), '', ts);
  }

  // OTT offers
  const existingOtt = db
    .prepare(
      `
      SELECT provider, offer_type, region, deep_link, deep_link_source, deep_link_verified_at
      FROM ott_offers
      WHERE movie_id = ?
    `
    )
    .all(id);
  const ottByKey = new Map();
  for (const r of existingOtt || []) {
    const k = `${String(r.provider || '').toLowerCase()}|${String(r.offer_type || '').toLowerCase()}|${String(r.region || '').toLowerCase()}`;
    ottByKey.set(k, r);
  }

  db.prepare('DELETE FROM ott_offers WHERE movie_id = ?').run(id);
  for (const o of tmdbMovie.offers || []) {
    const offerId = hashId('ott', `${id}:${o.provider}:${o.type}:${o.region || ''}`);
    const k = `${String(o.provider || '').toLowerCase()}|${String(o.type || '').toLowerCase()}|${String(o.region || '').toLowerCase()}`;
    const prev = ottByKey.get(k);
    db.prepare(
      `
      INSERT OR REPLACE INTO ott_offers (
        id, movie_id, provider, offer_type, url, logo, region, source, created_at,
        deep_link, deep_link_source, deep_link_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      offerId,
      id,
      o.provider,
      o.type,
      o.url || '',
      o.logo || '',
      o.region || '',
      'tmdb',
      nowIso(),
      prev?.deep_link || '',
      prev?.deep_link_source || '',
      prev?.deep_link_verified_at || ''
    );
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

  // Keep FTS index in sync.
  updateMovieFts(db, id);

  return id;
}

// Update the FTS entry for a movie. Call after every upsert (genres must already be in DB).
export function updateMovieFts(db, movieId) {
  try {
    const m = db.prepare('SELECT title, synopsis, language, director FROM movies WHERE id = ?').get(movieId);
    if (!m) return;
    const genres = db.prepare('SELECT genre FROM movie_genres WHERE movie_id = ?').all(movieId).map((r) => r.genre).join(' ');
    // Per-token soundex codes let phonetic queries ("saha*" → S000 = soundex("shah")) match via body.
    const sxTokens = (m.title || '').split(/\s+/).filter((t) => t.length >= 2).map((t) => soundex(t)).filter((sx) => sx && sx !== '0000').join(' ');
    const body = [m.synopsis, m.language, m.director, genres, sxTokens].filter(Boolean).join(' ').slice(0, 1200);
    db.prepare('DELETE FROM search_index WHERE entity_id = ? AND entity_type = ?').run(movieId, 'movie');
    db.prepare('INSERT INTO search_index(entity_id, entity_type, title, body) VALUES (?, ?, ?, ?)').run(movieId, 'movie', m.title || '', body);
  } catch {
    // FTS update is best-effort; never block a write for it.
  }
}

// Update the FTS entry for a person. Call after biography or name changes.
// Also rebuilds person_search_keys so key-based search stays current.
export function updatePersonFts(db, personId) {
  try {
    const p = db.prepare('SELECT name, biography FROM persons WHERE id = ?').get(personId);
    if (!p) return;
    const sxTokens = (p.name || '').split(/\s+/).filter((t) => t.length >= 2).map((t) => soundex(t)).filter((sx) => sx && sx !== '0000').join(' ');
    const body = [(p.biography || '').slice(0, 500), sxTokens].filter(Boolean).join(' ');
    db.prepare('DELETE FROM search_index WHERE entity_id = ? AND entity_type = ?').run(personId, 'person');
    db.prepare('INSERT INTO search_index(entity_id, entity_type, title, body) VALUES (?, ?, ?, ?)').run(personId, 'person', p.name || '', body);
    upsertPersonSearchKeys(db, personId, p.name);
  } catch {
    // best-effort
  }
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

// Rebuild the search key index for a person. Deletes stale keys first so name
// changes are always reflected. Called on every person upsert path.
export function upsertPersonSearchKeys(db, personId, name) {
  try {
    db.prepare('DELETE FROM person_search_keys WHERE person_id = ?').run(personId);
    const ins = db.prepare('INSERT OR IGNORE INTO person_search_keys(key, person_id) VALUES (?, ?)');
    for (const key of buildPersonSearchKeys(name)) ins.run(key, personId);
  } catch {
    // best-effort; never block a write for it
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

// Build a ranked list of FTS5 queries to try in order (most strict → most relaxed).
// Returns [] if the query produces nothing usable.
function buildFtsQueries(q) {
  const cleaned = String(q || '').replace(/["*()\^:+\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const tokens = cleaned.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  if (!tokens.length) return [];
  const queries = [];
  if (tokens.length > 1) queries.push(`"${tokens.join(' ')}"`); // exact phrase
  queries.push(tokens.join(' '));                                 // AND of tokens
  queries.push(tokens.map((t) => `${t}*`).join(' '));            // prefix of each token
  // Tier 4: per-token soundex — catches phonetic misspellings stored in body ("saha"→S000 = soundex("shah")).
  const sxTokens = tokens.map((t) => soundex(t)).filter((sx) => sx && sx !== '0000');
  if (sxTokens.length) queries.push(sxTokens.join(' '));
  return queries;
}

// Search persons by pre-built key index. Generates the same key variants as
// buildPersonSearchKeys (tokens, soundex, compounds, 'a'-bridge), looks them up
// in person_search_keys, ranks by Indian movie count, and applies a dice filter
// to remove false positives. Returns up to 5 person IDs.
function searchPersonsByKeys(db, q) {
  const normKey = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = normKey(q).split(' ').filter((t) => t.length >= 2);
  if (!tokens.length) return [];

  const queryKeys = new Set();
  const add = (k) => { const s = String(k || '').trim(); if (s.length >= 2 && s !== '0000') queryKeys.add(s); };

  add(tokens.join(' '));
  for (const t of tokens) { add(t); add(soundex(t)); }
  if (tokens.length >= 2) {
    add(tokens.join(''));
    add(soundex(tokens.join('')));
    for (let i = 0; i < tokens.length - 1; i++) {
      const pair = tokens[i] + tokens[i + 1];
      add(pair); add(soundex(pair));
      const pairA = tokens[i] + 'a' + tokens[i + 1];
      add(pairA); add(soundex(pairA));
    }
  }

  const keysArr = [...queryKeys].slice(0, 20);
  const ph = keysArr.map(() => '?').join(',');

  const rows = db
    .prepare(
      `SELECT p.id, p.name,
              COALESCE(p.tmdb_popularity, 0) AS popularity,
              COUNT(DISTINCT m.id) AS movie_count,
              CASE WHEN p.profile_image IS NOT NULL AND p.profile_image != '' THEN 1 ELSE 0 END AS has_image,
              CASE WHEN length(COALESCE(p.biography,'')) > 50 THEN 1 ELSE 0 END AS has_bio
       FROM person_search_keys psk
       JOIN persons p ON p.id = psk.person_id
       LEFT JOIN movie_cast mc ON mc.person_id = p.id
       LEFT JOIN movies m ON m.id = mc.movie_id AND COALESCE(m.is_indian, 1) = 1
       WHERE psk.key IN (${ph})
       GROUP BY p.id
       ORDER BY popularity DESC, movie_count DESC, has_image DESC, has_bio DESC
       LIMIT 200`
    )
    .all(...keysArr);

  // Dice filter removes names that only matched via a shared soundex code but
  // are not actually similar to the query (e.g. "Moitree" matching "maduri").
  const normDice = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const dice = (a, b) => {
    const s1 = normDice(a); const s2 = normDice(b);
    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;
    const bg = (s) => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const b = s.slice(i, i+2); m.set(b, (m.get(b)||0)+1); } return m; };
    const b1 = bg(s1); const b2 = bg(s2);
    let n = 0; for (const [k, c] of b1) n += Math.min(c, b2.get(k)||0);
    return (2 * n) / (s1.length - 1 + s2.length - 1);
  };

  const qn = normDice(q);
  const minDice = qn.length <= 4 ? 0.25 : qn.length <= 6 ? 0.30 : 0.35;

  // Rank on how closely the name matches, then on body of work.
  //
  // The SQL above cannot do this ordering. Its primary key, tmdb_popularity,
  // is written by only one of the seven person write paths and is set for 48
  // of 187,270 rows — so it is noise that lets a nobody with popularity 0.14
  // and no films outrank an actor with 377. Sorting here on the similarity
  // score the filter already computes is both meaningful and always available.
  //
  // The query fetches 200 rather than 15 for the same reason: a common
  // surname matches thousands of people, and truncating on a near-empty
  // column discarded the right person before this filter ever saw them.
  return rows
    .map((r) => ({ ...r, score: dice(qn, r.name) }))
    .filter((r) => r.score >= minDice)
    .sort((a, b) =>
      b.score - a.score ||
      b.movie_count - a.movie_count ||
      b.popularity - a.popularity ||
      b.has_image - a.has_image ||
      b.has_bio - a.has_bio
    )
    .slice(0, 5)
    .map((r) => r.id);
}

export function searchLocal(db, q) {
  // === Person search via pre-built key index ===
  // Indexed by exact tokens, per-token soundex, adjacent-pair compounds, and 'a'-bridge
  // variants. Ranked by Indian movie count so prominent actors always surface first.
  const personIds = searchPersonsByKeys(db, q);

  // === Movie search via FTS5 (BM25-ranked) ===
  // FTS is kept only for movies; person search moved entirely to key index above.
  const seenMovies = new Set();
  const ftsMovieIds = [];
  for (const ftsQuery of buildFtsQueries(q)) {
    try {
      const hits = db
        .prepare(
          `SELECT entity_id, entity_type
           FROM search_index
           WHERE search_index MATCH ?
           ORDER BY bm25(search_index, 0, 0, 10, 1)
           LIMIT 30`
        )
        .all(ftsQuery);
      for (const h of hits) {
        if (h.entity_type === 'movie' && !seenMovies.has(h.entity_id)) {
          seenMovies.add(h.entity_id);
          ftsMovieIds.push(h.entity_id);
        }
      }
      if (ftsMovieIds.length >= 5) break;
    } catch {
      // Malformed FTS query — try next tier.
    }
  }

  const movieIds = ftsMovieIds.length
    ? db
        .prepare(`SELECT id FROM movies WHERE id IN (${ftsMovieIds.map(() => '?').join(',')}) AND COALESCE(is_indian, 1) = 1`)
        .all(...ftsMovieIds)
        .map((r) => r.id)
    : [];

  // Always pull the filmography of a matched person, not only when the title
  // search came up empty. Searching an actor's name previously returned a
  // single film if FTS happened to match one title containing part of that
  // name — one incidental hit was enough to suppress all 89 of their films.
  let castMovieIds = [];
  if (personIds.length) {
    // Walk the matched people in relevance order and take each one's films
    // best-known first.
    //
    // Two things were wrong with doing this as a single query. Ordering by
    // release_date surfaced an actor's most recent credits — cameos,
    // documentaries, unreleased entries — instead of the work they are known
    // for. And pooling every matched person let a weak match swamp the
    // results: a search for one actor also pulled in the filmographies of two
    // similarly-named people, one of whom had 235 films.
    //
    // TMDB vote count is the popularity signal available locally; films
    // without a rating row sort last rather than dropping out.
    const perPerson = db.prepare(
      `SELECT m.id, COALESCE(r.count, 0) AS votes
         FROM movies m
         JOIN movie_cast mc ON mc.movie_id = m.id
         LEFT JOIN ratings r ON r.movie_id = m.id AND r.source = 'tmdb'
        WHERE COALESCE(m.is_indian, 1) = 1 AND mc.person_id = ?
        ORDER BY votes DESC, COALESCE(m.release_date, '0000-00-00') DESC
        LIMIT 50`
    );
    const seenCast = new Set();
    for (const pid of personIds) {
      for (const row of perPerson.all(pid)) {
        if (seenCast.has(row.id)) continue;
        seenCast.add(row.id);
        castMovieIds.push(row.id);
      }
      if (castMovieIds.length >= 50) break;
    }
    castMovieIds = castMovieIds.slice(0, 50);
  }

  // Title matches first — they are the stronger signal when the query really
  // was a title — then the matched person's films, minus anything already shown.
  const seen = new Set(movieIds);
  const allMovieIds = [...movieIds, ...castMovieIds.filter((id) => !seen.has(id))];
  return {
    movies: allMovieIds.map((id) => hydrateMovie(db, id)).filter(Boolean),
    persons: personIds.map((id) => hydratePerson(db, id)).filter(Boolean)
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
      deepLink: o.deep_link || undefined,
      logo: o.logo || undefined,
      region: o.region || undefined
    }));
  const ottLastVerifiedAt =
    db.prepare('SELECT MAX(created_at) as t FROM ott_offers WHERE movie_id = ?').get(movieId)?.t || undefined;

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
    ottLastVerifiedAt: ottLastVerifiedAt || undefined,
    songs,
    ratings,
    reviews,
    sources
  };
}

// Batch hydration for browse/list views. Runs 6 queries for any number of movies
// instead of 9 queries per movie. Omits reviews and attributions (not shown on cards).
export function hydrateMoviesForBrowse(db, ids) {
  if (!ids.length) return [];
  const ph = ids.map(() => '?').join(',');

  const movies = db
    .prepare(`SELECT id, title, language, synopsis, release_date, status, poster, backdrop, director FROM movies WHERE id IN (${ph})`)
    .all(...ids);

  const genreRows = db
    .prepare(`SELECT movie_id, genre FROM movie_genres WHERE movie_id IN (${ph})`)
    .all(...ids);

  const castRows = db
    .prepare(
      `SELECT mc.movie_id, p.id as person_id, p.tmdb_id, p.name
       FROM movie_cast mc
       JOIN persons p ON p.id = mc.person_id
       WHERE mc.movie_id IN (${ph})
       ORDER BY mc.movie_id, mc.billing_order ASC`
    )
    .all(...ids);

  const ottRows = db
    .prepare(
      `SELECT movie_id, provider, offer_type, url, deep_link, logo, region, created_at
       FROM ott_offers WHERE movie_id IN (${ph}) ORDER BY movie_id, provider ASC`
    )
    .all(...ids);

  const ratingRows = db
    .prepare(
      `SELECT movie_id, source, value, scale FROM ratings
       WHERE movie_id IN (${ph}) AND source IN ('imdb', 'tmdb')`
    )
    .all(...ids);

  const songRows = db
    .prepare(
      `SELECT movie_id, id, title, singers_json, youtube_url
       FROM songs WHERE movie_id IN (${ph}) ORDER BY movie_id, created_at DESC`
    )
    .all(...ids);

  // Group all related rows by movie_id.
  const genresByMovie = Object.create(null);
  for (const r of genreRows) (genresByMovie[r.movie_id] ??= []).push(r.genre);

  const castByMovie = Object.create(null);
  for (const r of castRows) {
    const arr = (castByMovie[r.movie_id] ??= []);
    if (arr.length < 4)
      arr.push({ personId: r.person_id, name: r.name, role: 'Actor', character: '', tmdbId: r.tmdb_id || undefined });
  }

  const ottByMovie = Object.create(null);
  for (const r of ottRows) {
    const entry = (ottByMovie[r.movie_id] ??= { offers: [], lastVerifiedAt: '' });
    if (r.created_at > entry.lastVerifiedAt) entry.lastVerifiedAt = r.created_at;
    entry.offers.push({
      provider: r.provider,
      type: r.offer_type,
      url: r.url || undefined,
      deepLink: r.deep_link || undefined,
      logo: r.logo || undefined,
      region: r.region || undefined
    });
  }

  const ratingsByMovie = Object.create(null);
  for (const r of ratingRows) (ratingsByMovie[r.movie_id] ??= []).push(r);

  const songsByMovie = Object.create(null);
  for (const r of songRows) {
    const arr = (songsByMovie[r.movie_id] ??= []);
    if (arr.length < 20)
      arr.push({ id: r.id, title: r.title, singers: JSON.parse(r.singers_json || '[]'), youtubeUrl: r.youtube_url || undefined });
  }

  const movieById = Object.create(null);
  for (const m of movies) movieById[m.id] = m;

  return ids.map((id) => {
    const m = movieById[id];
    if (!m) return null;

    const ratings = ratingsByMovie[id] || [];
    const primaryRating = (() => {
      const imdb = ratings.find((r) => r.source === 'imdb' && r.scale === 10);
      if (imdb) return imdb.value;
      return ratings.find((r) => r.source === 'tmdb' && r.scale === 10)?.value;
    })();

    const ottEntry = ottByMovie[id] || { offers: [], lastVerifiedAt: '' };

    return {
      id: m.id,
      title: m.title,
      language: m.language || 'Hindi',
      synopsis: m.synopsis || '',
      cast: castByMovie[id] || [],
      director: m.director || 'TBD',
      writers: [],
      genres: genresByMovie[id] || [],
      themes: [],
      releaseDate: m.release_date || undefined,
      status: m.status || 'Announced',
      poster: m.poster || '',
      backdrop: m.backdrop || undefined,
      rating: typeof primaryRating === 'number' ? primaryRating : undefined,
      trailerUrl: undefined,
      ott: ottEntry.offers,
      ottLastVerifiedAt: ottEntry.lastVerifiedAt || undefined,
      songs: songsByMovie[id] || [],
      ratings: [],
      reviews: [],
      sources: []
    };
  }).filter(Boolean);
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
