// Delete non-Indian movies and the people who only appear in them.
//
//   node server/db-drop-foreign.js            # dry run — counts only, changes nothing
//   node server/db-drop-foreign.js --yes      # actually delete
//
// DESTRUCTIVE and irreversible. Back up first if you have the disk headroom:
//   sqlite3 $DB_PATH ".backup /var/data/backup.sqlite"
//
// Deletes in batches and checkpoints the WAL between them. A single 400k-row
// transaction would grow the WAL by roughly the size of everything it touches,
// which on an already-full disk is the exact failure we are trying to avoid.
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';

const apply = process.argv.includes('--yes');
const BATCH = 2000;

const db = new Database(resolveDbPath());
db.pragma('foreign_keys = ON'); // required — the ON DELETE CASCADEs do most of the work
db.pragma('journal_size_limit = 67108864');

const n = (sql, ...a) => db.prepare(sql).get(...a).n;

const foreignMovies = n('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 0');
const indianMovies = n('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 1');
const totalPersons = n('SELECT COUNT(*) n FROM persons');

console.log(`\nmovies: ${indianMovies} Indian / ${foreignMovies} foreign`);
console.log(`persons: ${totalPersons}`);

if (!apply) {
  // Driven from the small side (Indian movies) so it stays fast; the correlated
  // NOT EXISTS form re-runs per person and effectively hangs at this scale.
  const keep = n(
    'SELECT COUNT(*) n FROM (SELECT DISTINCT mc.person_id FROM movies m JOIN movie_cast mc ON mc.movie_id = m.id WHERE COALESCE(m.is_indian, 1) = 1)'
  );
  console.log(`persons with at least one Indian credit: ${keep}`);
  console.log(`\nDry run. Would delete ${foreignMovies} movies and about ${totalPersons - keep} persons.`);
  console.log(`Re-run with --yes to apply.\n`);
  db.close();
  process.exit(0);
}

// 1. Foreign movies. ON DELETE CASCADE clears movie_genres, movie_cast, songs,
//    ott_offers, ratings, reviews, user_favorites and user_watchlist with them.
let removed = 0;
const pickMovies = db.prepare('SELECT id FROM movies WHERE COALESCE(is_indian, 1) = 0 LIMIT ?');
const delMovie = db.prepare('DELETE FROM movies WHERE id = ?');
for (;;) {
  const ids = pickMovies.all(BATCH).map((r) => r.id);
  if (!ids.length) break;
  db.transaction(() => { for (const id of ids) delMovie.run(id); })();
  removed += ids.length;
  db.pragma('wal_checkpoint(TRUNCATE)');
  process.stdout.write(`\r  movies deleted: ${removed}/${foreignMovies}`);
}
console.log('');

// 2. Persons left with no credits at all — person_search_keys cascades off these.
//    Computed after the movie deletes so movie_cast already reflects reality.
let personsRemoved = 0;
const pickPersons = db.prepare(
  'SELECT id FROM persons WHERE NOT EXISTS (SELECT 1 FROM movie_cast mc WHERE mc.person_id = persons.id) LIMIT ?'
);
const delPerson = db.prepare('DELETE FROM persons WHERE id = ?');
for (;;) {
  const ids = pickPersons.all(BATCH).map((r) => r.id);
  if (!ids.length) break;
  db.transaction(() => { for (const id of ids) delPerson.run(id); })();
  personsRemoved += ids.length;
  db.pragma('wal_checkpoint(TRUNCATE)');
  process.stdout.write(`\r  persons deleted: ${personsRemoved}`);
}
console.log('');

// 3. Tables keyed by a generic entity_id have no foreign key, so nothing
//    cascaded into them. They have to be swept explicitly.
const attrGone = db.prepare(`
  DELETE FROM attributions
  WHERE (entity_type = 'movie'  AND entity_id NOT IN (SELECT id FROM movies))
     OR (entity_type = 'person' AND entity_id NOT IN (SELECT id FROM persons))
     OR (entity_type = 'song'   AND entity_id NOT IN (SELECT id FROM songs))
     OR (entity_type = 'ott'    AND entity_id NOT IN (SELECT id FROM ott_offers))
`).run().changes;

const ftsGone = db.prepare(`
  DELETE FROM search_index
  WHERE (entity_type = 'movie'  AND entity_id NOT IN (SELECT id FROM movies))
     OR (entity_type = 'person' AND entity_id NOT IN (SELECT id FROM persons))
`).run().changes;

// 4. app_meta accumulates one 'last_song_*' / 'last_ott_*' marker per movie ever
//    ingested, and those keys outlive the movie rows they refer to.
const metaGone = db.prepare(`
  DELETE FROM app_meta
  WHERE (key LIKE 'last_song_%:%' OR key LIKE 'last_ott_%:%')
    AND substr(key, instr(key, ':') + 1) NOT IN (SELECT id FROM movies)
`).run().changes;

// Parameterised so the literal stays clear of shell quoting when this logic is
// pasted into a `node -e` one-liner.
db.prepare('INSERT INTO search_index(search_index) VALUES(?)').run('optimize');
db.pragma('wal_checkpoint(TRUNCATE)');

const pageSize = db.pragma('page_size', { simple: true });
const freePages = db.pragma('freelist_count', { simple: true });
console.log(`  swept: ${attrGone} attributions, ${ftsGone} search_index, ${metaGone} app_meta`);
console.log(`\n  ${((freePages * pageSize) / 1048576).toFixed(0)} MB now free inside the file.`);
console.log(`  Run "node server/db-shrink.js" to return it to the OS (VACUUM needs free disk).\n`);
db.close();
