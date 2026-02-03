import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

import { openDb, migrate } from './db/sqlite.js';
import { upsertMovieFromTmdb } from './db/repository.js';
import { defaultIndianLanguageCodes, tmdbDiscoverMovies, tmdbGetMovieFull } from './providers/tmdb.js';

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

// Support either `.env` or `env`
loadEnvFileIfPresent('env');
loadEnvFileIfPresent('.env');

const db = openDb();
migrate(db);

function iso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function seedShelves() {
  const today = iso(0);
  const past45 = iso(-45);
  const future180 = iso(180);
  const languages = defaultIndianLanguageCodes();

  const [newHits, upcomingHits] = await Promise.all([
    tmdbDiscoverMovies({
      dateGte: past45,
      dateLte: today,
      sortBy: 'popularity.desc',
      page: 1,
      region: 'IN',
      languages,
      voteCountGte: 0
    }),
    tmdbDiscoverMovies({
      dateGte: today,
      dateLte: future180,
      sortBy: 'popularity.desc',
      page: 1,
      region: 'IN',
      languages,
      voteCountGte: 0
    })
  ]);

  const ids = Array.from(new Set([...newHits, ...upcomingHits].map((h) => h.tmdbId))).slice(0, 60);

  let ok = 0;
  for (const tmdbId of ids) {
    try {
      const full = await tmdbGetMovieFull(tmdbId);
      upsertMovieFromTmdb(db, full);
      ok++;
      process.stdout.write(`Seeded ${ok}/${ids.length}: ${full.title}\n`);
    } catch (e) {
      process.stdout.write(`Skip tmdb:${tmdbId}\n`);
    }
  }

  process.stdout.write(`Done. Seeded ${ok} movies into SQLite.\n`);
}

seedShelves().catch((err) => {
  console.error(err);
  process.exit(1);
});
