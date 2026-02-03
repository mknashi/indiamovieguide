import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { INDIAN_LANGUAGES_LOWER, soundex } from '../repo.js';

const DEFAULT_DB_PATH = path.join(process.cwd(), '.cache', 'indiamovieguide.sqlite');
const LEGACY_DB_PATH = path.join(process.cwd(), '.cache', 'indianmovieguide.sqlite');

export function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Preserve existing installs: if the legacy filename exists, keep using it.
  if (fs.existsSync(DEFAULT_DB_PATH)) return DEFAULT_DB_PATH;
  if (fs.existsSync(LEGACY_DB_PATH)) return LEGACY_DB_PATH;
  return DEFAULT_DB_PATH;
}

export function openDb() {
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS movies (
      id TEXT PRIMARY KEY,
      tmdb_id INTEGER,
      title TEXT NOT NULL,
      language TEXT,
      synopsis TEXT,
      director TEXT,
      release_date TEXT,
      status TEXT,
      poster TEXT,
      backdrop TEXT,
      trailer_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
    CREATE INDEX IF NOT EXISTS idx_movies_release ON movies(release_date);
    CREATE INDEX IF NOT EXISTS idx_movies_status ON movies(status);
    CREATE INDEX IF NOT EXISTS idx_movies_tmdb ON movies(tmdb_id);

    CREATE TABLE IF NOT EXISTS movie_genres (
      movie_id TEXT NOT NULL,
      genre TEXT NOT NULL,
      PRIMARY KEY (movie_id, genre),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_movie_genres_genre ON movie_genres(genre);

    CREATE TABLE IF NOT EXISTS persons (
      id TEXT PRIMARY KEY,
      tmdb_id INTEGER,
      name TEXT NOT NULL,
      biography TEXT,
      wiki_url TEXT,
      profile_image TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(name);
    CREATE INDEX IF NOT EXISTS idx_persons_tmdb ON persons(tmdb_id);

    CREATE TABLE IF NOT EXISTS movie_cast (
      movie_id TEXT NOT NULL,
      person_id TEXT NOT NULL,
      character TEXT,
      billing_order INTEGER,
      PRIMARY KEY (movie_id, person_id),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE,
      FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_movie_cast_movie ON movie_cast(movie_id);
    CREATE INDEX IF NOT EXISTS idx_movie_cast_person ON movie_cast(person_id);

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL,
      title TEXT NOT NULL,
      singers_json TEXT NOT NULL,
      youtube_url TEXT,
      platform TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_songs_movie ON songs(movie_id);

    CREATE TABLE IF NOT EXISTS ott_offers (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      offer_type TEXT NOT NULL,
      url TEXT,
      logo TEXT,
      region TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ott_movie ON ott_offers(movie_id);

    CREATE TABLE IF NOT EXISTS attributions (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL, -- 'movie' | 'person' | 'song' | 'ott'
      entity_id TEXT NOT NULL,
      provider TEXT NOT NULL,     -- 'tmdb' | 'youtube' | 'wikipedia' | 'imdb' | ...
      provider_id TEXT,
      url TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_attr_entity ON attributions(entity_type, entity_id);

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL,
      source TEXT NOT NULL, -- 'tmdb' | 'imdb' | 'rottentomatoes' | 'metacritic' | ...
      value REAL NOT NULL,
      scale REAL NOT NULL,
      count INTEGER,
      url TEXT,
      fetched_at TEXT NOT NULL,
      UNIQUE(movie_id, source),
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_ratings_movie ON ratings(movie_id);

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      movie_id TEXT NOT NULL,
      source TEXT NOT NULL, -- 'tmdb' | 'imdb' | ...
      author TEXT,
      rating REAL,
      url TEXT,
      excerpt TEXT,
      fetched_at TEXT NOT NULL,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_movie ON reviews(movie_id);

    -- Users / auth
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_pwreset_user ON password_resets(user_id);
    CREATE INDEX IF NOT EXISTS idx_pwreset_expires ON password_resets(expires_at);

    -- Lists
    CREATE TABLE IF NOT EXISTS user_favorites (
      user_id TEXT NOT NULL,
      movie_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, movie_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_fav_user ON user_favorites(user_id);

    CREATE TABLE IF NOT EXISTS user_watchlist (
      user_id TEXT NOT NULL,
      movie_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, movie_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_watch_user ON user_watchlist(user_id);

    -- User reviews (moderated)
    CREATE TABLE IF NOT EXISTS user_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      movie_id TEXT NOT NULL,
      rating INTEGER, -- 1..10
      body TEXT,
      status TEXT NOT NULL, -- 'pending' | 'approved' | 'rejected'
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (movie_id) REFERENCES movies(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_reviews_movie ON user_reviews(movie_id);
    CREATE INDEX IF NOT EXISTS idx_user_reviews_status ON user_reviews(status);
    CREATE INDEX IF NOT EXISTS idx_user_reviews_user ON user_reviews(user_id);

    -- User submissions (new movie/TV show suggestions; moderated)
    CREATE TABLE IF NOT EXISTS user_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL, -- 'movie' | 'tv'
      title TEXT NOT NULL,
      language TEXT,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL, -- 'pending' | 'approved' | 'rejected'
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_note TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_submissions_status ON user_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_user_submissions_user ON user_submissions(user_id);

    -- User submissions: new person profiles (cast/crew) (moderated)
    CREATE TABLE IF NOT EXISTS user_person_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      person_id TEXT, -- set on approval (reusable record id in persons)
      name TEXT NOT NULL,
      profile_image TEXT,
      biography TEXT,
      filmography_json TEXT,
      status TEXT NOT NULL, -- 'pending' | 'approved' | 'rejected'
      created_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_note TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_user_person_submissions_status ON user_person_submissions(status);
    CREATE INDEX IF NOT EXISTS idx_user_person_submissions_user ON user_person_submissions(user_id);
  `);

  // Lightweight schema evolution without a full migration framework.
  const hasColumn = (table, column) => {
    try {
      const rows = db.prepare(`PRAGMA table_info(${table})`).all();
      return rows.some((r) => r.name === column);
    } catch {
      return false;
    }
  };

  if (!hasColumn('movies', 'is_indian')) {
    db.exec('ALTER TABLE movies ADD COLUMN is_indian INTEGER DEFAULT 1');
  }
  if (!hasColumn('movies', 'title_soundex')) {
    db.exec('ALTER TABLE movies ADD COLUMN title_soundex TEXT');
  }
  if (!hasColumn('movies', 'production_countries_json')) {
    db.exec('ALTER TABLE movies ADD COLUMN production_countries_json TEXT');
  }
  if (!hasColumn('persons', 'name_soundex')) {
    db.exec('ALTER TABLE persons ADD COLUMN name_soundex TEXT');
  }
  if (!hasColumn('persons', 'filmography_json')) {
    db.exec('ALTER TABLE persons ADD COLUMN filmography_json TEXT');
  }
  if (!hasColumn('user_person_submissions', 'person_id')) {
    db.exec('ALTER TABLE user_person_submissions ADD COLUMN person_id TEXT');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_movies_is_indian ON movies(is_indian)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_movies_title_soundex ON movies(title_soundex)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_persons_name_soundex ON persons(name_soundex)');

  // Backfill for existing rows so filtering and "sounds-like" search work immediately.
  try {
    db.exec('BEGIN');
    if (hasColumn('movies', 'title_soundex') && hasColumn('movies', 'is_indian')) {
      const rows = db
        .prepare('SELECT id, title, language, title_soundex, is_indian, production_countries_json FROM movies')
        .all();
      const stmt = db.prepare('UPDATE movies SET title_soundex = ?, is_indian = ? WHERE id = ?');
      for (const r of rows) {
        const sx = r.title_soundex ? String(r.title_soundex) : '';
        const langLower = String(r.language || '').toLowerCase();
        let prod = [];
        try {
          prod = r.production_countries_json ? JSON.parse(String(r.production_countries_json)) : [];
        } catch {
          prod = [];
        }
        const isIndian =
          Array.isArray(prod) && prod.includes('IN')
            ? 1
            : !langLower || INDIAN_LANGUAGES_LOWER.includes(langLower)
              ? 1
              : 0;

        // Always set is_indian from the best available signal so we don't accidentally
        // surface non-Indian titles that were cached earlier.
        stmt.run(sx || soundex(r.title), isIndian, r.id);
      }
    }

    if (hasColumn('persons', 'name_soundex')) {
      const rows = db.prepare('SELECT id, name, name_soundex FROM persons').all();
      const stmt = db.prepare('UPDATE persons SET name_soundex = ? WHERE id = ?');
      for (const r of rows) {
        const sx = r.name_soundex ? String(r.name_soundex) : '';
        if (!sx) stmt.run(soundex(r.name), r.id);
      }
    }
    db.exec('COMMIT');
  } catch {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
  }
}
