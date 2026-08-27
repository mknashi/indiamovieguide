// Re-fetch production_countries from TMDB to settle is_indian for the films
// language cannot decide — chiefly English-language Indian cinema.
//
//   node server/db-recheck-countries.js                 # how many candidates, no API calls
//   node server/db-recheck-countries.js --yes           # re-check and update
//   node server/db-recheck-countries.js --yes --min-shared 1
//   node server/db-recheck-countries.js --yes --all     # every flagged movie (slow)
//
// Why this exists: the hourly prune nulled production_countries_json, so the
// original country evidence is gone from the database. TMDB is the only place
// it still exists. For an English-language Indian film with no Indian-language
// signal, refetching is the only way to classify it correctly.
//
// Only ever sets is_indian 0 -> 1. A movie TMDB does not confirm as Indian is
// left exactly as it was, so this can never remove anything the site serves.
//
// Resumable: progress is recorded in app_meta, so an interrupted run picks up
// where it stopped rather than repeating tens of thousands of API calls.
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';
import { tmdbGetMovieCountries } from './providers/tmdb.js';

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const val = (f, d) => { const i = args.indexOf(f); return i >= 0 ? (args[i + 1] ?? d) : d; };

const apply = has('--yes');
const checkAll = has('--all');
const minShared = Number(val('--min-shared', 1));
const concurrency = Number(val('--concurrency', 8));
const PROGRESS_KEY = 'recheck_countries_after_id';

const db = new Database(resolveDbPath());

// Candidates: flagged non-Indian, but with at least one cast member who also
// appears in an Indian film. That overlap is the strongest remaining signal
// now that the country data is gone, and it narrows ~416k rows to ~32k.
//
// Built once into a temp table. Expressing this as a subquery in the paging
// SELECT made SQLite re-materialise a full 3.6M-row scan of movie_cast on
// every batch — 160 batches of that never finishes. Materialising the set
// once turns each page into an ordinary indexed range scan.
const shared = Number.isFinite(minShared) && minShared > 0 ? minShared : 1;

function buildCandidates() {
  if (checkAll) {
    db.exec(`
      CREATE TEMP TABLE recheck_candidates AS
        SELECT m.id AS id, m.tmdb_id AS tmdb_id FROM movies m
         WHERE COALESCE(m.is_indian, 1) = 0 AND m.tmdb_id IS NOT NULL`);
  } else {
    // People who appear in at least one Indian film.
    db.exec(`
      CREATE TEMP TABLE indian_people AS
        SELECT DISTINCT mc.person_id AS person_id
          FROM movie_cast mc
          JOIN movies m ON m.id = mc.movie_id
         WHERE COALESCE(m.is_indian, 1) = 1`);
    db.exec('CREATE INDEX temp.idx_ip ON indian_people(person_id)');

    // Flagged films sharing at least `shared` of those people.
    db.exec(`
      CREATE TEMP TABLE recheck_candidates AS
        SELECT m.id AS id, m.tmdb_id AS tmdb_id
          FROM movies m
          JOIN movie_cast mc ON mc.movie_id = m.id
          JOIN indian_people ip ON ip.person_id = mc.person_id
         WHERE COALESCE(m.is_indian, 1) = 0 AND m.tmdb_id IS NOT NULL
         GROUP BY m.id
        HAVING COUNT(*) >= ${shared}`);
  }
  db.exec('CREATE INDEX temp.idx_rc ON recheck_candidates(id)');
  return db.prepare('SELECT COUNT(*) n FROM recheck_candidates').get().n;
}

const candidateSql =
  'SELECT id, tmdb_id FROM recheck_candidates WHERE id > ? ORDER BY id LIMIT ?';

if (!apply) {
  // Same materialised build as the apply path, so the dry run reports the
  // number that will actually be checked and takes the same time to say it.
  process.stdout.write('\nBuilding candidate set (one scan of movie_cast, please wait)... ');
  const t0 = Date.now();
  const n = buildCandidates();
  console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  const perSec = concurrency * 4;
  console.log(`\n${n} candidate movies to re-check against TMDB.`);
  console.log(`At ~${perSec} requests/sec that is roughly ${Math.ceil(n / perSec / 60)} minutes.`);
  console.log(`\nDry run — no API calls made. Re-run with --yes to start.`);
  console.log(`Use --all to check every flagged movie instead of only cast-overlap ones.\n`);
  db.close();
  process.exit(0);
}

const setIndian = db.prepare(
  'UPDATE movies SET is_indian = 1, production_countries_json = ? WHERE id = ?'
);
const setCountries = db.prepare('UPDATE movies SET production_countries_json = ? WHERE id = ?');
const saveProgress = db.prepare(
  "INSERT OR REPLACE INTO app_meta(key, value, updated_at) VALUES (?, ?, ?)"
);

process.stdout.write('\nBuilding candidate set (one scan of movie_cast, please wait)... ');
const tBuild = Date.now();
const candidateCount = buildCandidates();
console.log(`done in ${((Date.now() - tBuild) / 1000).toFixed(1)}s`);

let afterId = db.prepare('SELECT value FROM app_meta WHERE key = ?').get(PROGRESS_KEY)?.value || '';
if (afterId) console.log(`Resuming after id ${afterId}`);
const remaining = db.prepare('SELECT COUNT(*) n FROM recheck_candidates WHERE id > ?').get(afterId).n;
console.log(`${candidateCount} candidates, ${remaining} still to check. Progress updates every 200.\n`);

let checked = 0;
let recovered = 0;
let gone = 0;
let failed = 0;
const started = Date.now();

const pick = db.prepare(candidateSql);

for (;;) {
  const batch = pick.all(afterId, 200);
  if (!batch.length) break;

  // Bounded concurrency: TMDB tolerates roughly 50 requests/sec, and staying
  // well under that avoids 429s that would waste the whole run.
  for (let i = 0; i < batch.length; i += concurrency) {
    const slice = batch.slice(i, i + concurrency);
    const results = await Promise.all(
      slice.map(async (row) => {
        try {
          return { row, data: await tmdbGetMovieCountries(row.tmdb_id) };
        } catch (err) {
          return { row, error: err };
        }
      })
    );
    for (const { row, data, error } of results) {
      checked++;
      if (error) { failed++; continue; }
      if (data === null) { gone++; continue; } // withdrawn from TMDB
      const json = JSON.stringify(data.productionCountries);
      if (data.productionCountries.includes('IN')) {
        setIndian.run(json, row.id);
        recovered++;
      } else {
        // Store the countries either way: it is the evidence that this row was
        // checked and genuinely is not Indian, so a later run need not refetch.
        setCountries.run(json, row.id);
      }
    }
  }

  afterId = batch[batch.length - 1].id;
  saveProgress.run(PROGRESS_KEY, afterId, new Date().toISOString());
  const rate = checked / Math.max(1, (Date.now() - started) / 1000);
  process.stdout.write(
    `\r  checked ${checked} | recovered ${recovered} | gone ${gone} | failed ${failed} | ${rate.toFixed(1)}/s   `
  );
}

console.log('');
if (recovered) {
  db.prepare("INSERT OR REPLACE INTO app_meta(key, value, updated_at) VALUES ('fts_v', ?, ?)")
    .run('needs-rebuild', new Date().toISOString());
  console.log(`\n  recovered ${recovered} Indian films that language alone could not identify`);
  console.log(`  fts_v reset — search index rebuilds on next server start`);
}
console.log(`  ${checked} checked, ${gone} no longer on TMDB, ${failed} failed\n`);
saveProgress.run(PROGRESS_KEY, '', new Date().toISOString()); // clear for next time
db.close();
