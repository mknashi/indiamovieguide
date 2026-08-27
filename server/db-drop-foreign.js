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

const args = process.argv.slice(2);
const apply = args.includes('--yes');
const BATCH = 2000;

// Films whose cast overlaps Indian cinema are held back from deletion.
// TMDB's metadata is wrong for many older regional Indian films — language
// comes back 'en' and production_countries is empty — so a country recheck
// cannot classify them. Who is in them still can: a Tamil film from 1998 is
// crewed by people who appear in other Tamil films, while a Hollywood film
// with an Indian actor or two sits at 1 or 2 shared. Deleting only the
// zero-overlap films removes the unambiguous foreign catalogue now and leaves
// the judgement calls for a later pass.
//
// 0 disables the hold-back and deletes every flagged film.
const keepOverlapIdx = args.indexOf('--keep-overlap');
const keepOverlap = keepOverlapIdx >= 0 ? Number(args[keepOverlapIdx + 1] ?? 1) : 1;

const db = new Database(resolveDbPath());
db.pragma('foreign_keys = ON'); // required — the ON DELETE CASCADEs do most of the work
db.pragma('journal_size_limit = 67108864');

const n = (sql, ...a) => db.prepare(sql).get(...a).n;

const flaggedTotal = n('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 0');
const indianMovies = n('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 1');
const totalPersons = n('SELECT COUNT(*) n FROM persons');

console.log(`\nmovies: ${indianMovies} Indian / ${flaggedTotal} flagged foreign`);
console.log(`persons: ${totalPersons}`);

// Build the deletion set once. Doing this as a subquery inside the paging
// SELECT makes SQLite re-scan movie_cast for every batch.
process.stdout.write(`\nBuilding deletion set (one scan of movie_cast)... `);
const tBuild = Date.now();
if (keepOverlap > 0) {
  db.exec(`
    CREATE TEMP TABLE indian_people AS
      SELECT DISTINCT mc.person_id AS person_id
        FROM movie_cast mc
        JOIN movies m ON m.id = mc.movie_id
       WHERE COALESCE(m.is_indian, 1) = 1`);
  db.exec('CREATE INDEX temp.idx_ip ON indian_people(person_id)');
  db.exec(`
    CREATE TEMP TABLE held_back AS
      SELECT m.id AS id
        FROM movies m
        JOIN movie_cast mc ON mc.movie_id = m.id
        JOIN indian_people ip ON ip.person_id = mc.person_id
       WHERE COALESCE(m.is_indian, 1) = 0
       GROUP BY m.id
      HAVING COUNT(*) >= ${keepOverlap}`);
  db.exec('CREATE INDEX temp.idx_hb ON held_back(id)');
  db.exec(`
    CREATE TEMP TABLE to_delete AS
      SELECT m.id AS id FROM movies m
       WHERE COALESCE(m.is_indian, 1) = 0
         AND m.id NOT IN (SELECT id FROM held_back)`);
} else {
  db.exec(`
    CREATE TEMP TABLE to_delete AS
      SELECT m.id AS id FROM movies m WHERE COALESCE(m.is_indian, 1) = 0`);
}
db.exec('CREATE INDEX temp.idx_td ON to_delete(id)');
console.log(`done in ${((Date.now() - tBuild) / 1000).toFixed(1)}s`);

const foreignMovies = n('SELECT COUNT(*) n FROM to_delete');
const heldBack = flaggedTotal - foreignMovies;

// Films with no cast at all cannot be judged by overlap, so they fall into the
// delete set by default. Surfaced separately because that is a real, if small,
// chance of losing an Indian film whose credits were never ingested.
const noCast = n(`SELECT COUNT(*) n FROM to_delete td
                   WHERE NOT EXISTS (SELECT 1 FROM movie_cast mc WHERE mc.movie_id = td.id)`);

if (keepOverlap > 0) {
  console.log(`\nholding back ${heldBack} films with >= ${keepOverlap} cast member(s) in Indian cinema`);
  console.log(`  (review those later with: node server/db-overlap-report.js)`);
}
console.log(`\nto delete: ${foreignMovies} films`);
console.log(`  of which ${noCast} have no cast recorded — overlap cannot vouch for them either way`);

if (!apply) {
  console.log(`\nDry run. Nothing was changed.`);
  console.log(`Re-run with --yes to apply.`);
  console.log(`Use --keep-overlap 0 to delete every flagged film (not recommended yet).\n`);
  db.close();
  process.exit(0);
}

// 1. Foreign movies. ON DELETE CASCADE clears movie_genres, movie_cast, songs,
//    ott_offers, ratings, reviews, user_favorites and user_watchlist with them.
let removed = 0;
const pickMovies = db.prepare('SELECT id FROM to_delete LIMIT ?');
const delMovie = db.prepare('DELETE FROM movies WHERE id = ?');
const dropFromSet = db.prepare('DELETE FROM to_delete WHERE id = ?');
for (;;) {
  const ids = pickMovies.all(BATCH).map((r) => r.id);
  if (!ids.length) break;
  db.transaction(() => {
    for (const id of ids) {
      delMovie.run(id);
      dropFromSet.run(id); // so the next page does not return it again
    }
  })();
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
