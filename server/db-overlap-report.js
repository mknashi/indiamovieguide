// How well does cast overlap separate Indian films from foreign ones?
//
//   node server/db-overlap-report.js            # distribution + samples + thresholds
//   node server/db-overlap-report.js --samples 8
//
// Read-only.
//
// Context: TMDB's own metadata is wrong for many older regional Indian films —
// original_language comes back 'en' and production_countries is often empty —
// so neither the language rule nor a country recheck can classify them. What
// does survive is who is in them: a Tamil film from 1998 is crewed by people
// who appear in other Tamil films. This report shows how cleanly that
// separates the two populations, so a deletion threshold can be picked on
// evidence rather than by guessing.
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';

const args = process.argv.slice(2);
const sampleN = Number((() => { const i = args.indexOf('--samples'); return i >= 0 ? args[i + 1] : 6; })());

const db = new Database(resolveDbPath(), { readonly: true });

process.stdout.write('Building overlap table (one scan of movie_cast)... ');
const t0 = Date.now();

db.exec(`
  CREATE TEMP TABLE indian_people AS
    SELECT DISTINCT mc.person_id AS person_id
      FROM movie_cast mc
      JOIN movies m ON m.id = mc.movie_id
     WHERE COALESCE(m.is_indian, 1) = 1`);
db.exec('CREATE INDEX temp.idx_ip ON indian_people(person_id)');

// For every flagged film: how many of its cast work in Indian cinema, and how
// many cast members it has at all. The ratio matters as much as the count —
// a Hollywood blockbuster with two Indian actors is not an Indian film, while
// a film whose entire cast works in Indian cinema almost certainly is.
db.exec(`
  CREATE TEMP TABLE overlap AS
    SELECT m.id AS id,
           m.title AS title,
           m.language AS language,
           m.release_date AS release_date,
           COUNT(mc.person_id) AS total_cast,
           SUM(CASE WHEN ip.person_id IS NOT NULL THEN 1 ELSE 0 END) AS shared
      FROM movies m
      JOIN movie_cast mc ON mc.movie_id = m.id
      LEFT JOIN indian_people ip ON ip.person_id = mc.person_id
     WHERE COALESCE(m.is_indian, 1) = 0
     GROUP BY m.id`);
db.exec('CREATE INDEX temp.idx_ov ON overlap(shared)');
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const flaggedTotal = db.prepare('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian,1)=0').get().n;
const withCast = db.prepare('SELECT COUNT(*) n FROM overlap').get().n;
console.log(`\n${flaggedTotal} flagged movies, ${withCast} of them have cast recorded.`);
console.log(`${flaggedTotal - withCast} have no cast at all — overlap cannot speak to those.\n`);

console.log('-- distribution by shared-cast count --\n');
for (const r of db
  .prepare(`SELECT shared, COUNT(*) AS n FROM overlap GROUP BY shared ORDER BY shared`)
  .all()) {
  console.log(`  shared=${String(r.shared).padStart(3)}  ${String(r.n).padStart(8)} films`);
}

console.log('\n-- what each threshold would preserve --\n');
console.log('  keep films with shared >= N (i.e. exclude them from deletion)\n');
for (const n of [1, 2, 3, 4, 5, 6, 8, 10, 12]) {
  const kept = db.prepare('SELECT COUNT(*) k FROM overlap WHERE shared >= ?').get(n).k;
  const pct = ((kept / flaggedTotal) * 100).toFixed(1);
  console.log(`  N=${String(n).padStart(2)}  keep ${String(kept).padStart(7)} (${pct.padStart(5)}% of flagged), delete ${String(flaggedTotal - kept).padStart(7)}`);
}

// Ratio buckets separate "entire cast works in Indian cinema" from "a couple of
// Indian actors in a foreign production", which a raw count cannot do.
console.log('\n-- by ratio of cast working in Indian cinema --\n');
for (const [lo, hi] of [[0, 0.001], [0.001, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 0.999], [0.999, 1.001]]) {
  const r = db
    .prepare(
      `SELECT COUNT(*) n FROM overlap
        WHERE total_cast > 0
          AND (CAST(shared AS REAL) / total_cast) >= ?
          AND (CAST(shared AS REAL) / total_cast) < ?`
    )
    .get(lo, hi);
  const label = hi > 1 ? '100%' : `${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`;
  console.log(`  ${label.padStart(8)}  ${String(r.n).padStart(8)} films`);
}

console.log(`\n-- samples per shared-cast level (${sampleN} each) --`);
const pick = db.prepare(
  `SELECT title, language, release_date, total_cast, shared
     FROM overlap WHERE shared = ? ORDER BY RANDOM() LIMIT ?`
);
for (const n of [12, 10, 8, 6, 4, 3, 2, 1]) {
  const rows = pick.all(n, sampleN);
  if (!rows.length) continue;
  console.log(`\n  === shared = ${n} ===`);
  for (const r of rows) {
    console.log(
      `    ${(r.release_date || '----------').slice(0, 10)}  ${String(r.language || '?').padEnd(9)}` +
        `  ${r.shared}/${r.total_cast}  ${String(r.title || '').slice(0, 50)}`
    );
  }
}
console.log('');
db.close();
