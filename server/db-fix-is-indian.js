// Re-derive is_indian for movies misclassified by the old 8-language list.
//
//   node server/db-fix-is-indian.js          # dry run
//   node server/db-fix-is-indian.js --yes    # apply
//   node server/db-fix-is-indian.js --review-ambiguous
//                                            # sample the Urdu/Nepali/Sindhi titles
//
// Only flips 0 -> 1, never the reverse: it recovers films the old rule missed
// and cannot remove anything the site currently serves.
//
// Run this BEFORE db-drop-foreign.js, or those films get deleted.
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';
import { INDIAN_LANGUAGES_LOWER } from './repo.js';

const args = process.argv.slice(2);
const apply = args.includes('--yes');
const review = args.includes('--review-ambiguous');

// Primarily the national language of Pakistan or Nepal. A film in one of these
// is Indian often enough to matter but rarely enough that language alone is not
// evidence, so they keep depending on production_countries and are left alone.
const AMBIGUOUS = ['ur', 'urdu', 'ne', 'nepali', 'sd', 'sindhi'];

const db = new Database(resolveDbPath());

if (review) {
  const ph = AMBIGUOUS.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT lower(trim(language)) AS lang, title, release_date, director
         FROM movies
        WHERE COALESCE(is_indian, 1) = 0 AND lower(trim(language)) IN (${ph})
        ORDER BY lang, release_date DESC`
    )
    .all(...AMBIGUOUS);
  console.log(`\n${rows.length} films in ambiguous languages, flagged non-Indian:\n`);
  let lastLang = null;
  let shown = 0;
  for (const r of rows) {
    if (r.lang !== lastLang) {
      lastLang = r.lang;
      shown = 0;
      console.log(`\n  [${r.lang}]`);
    }
    if (shown++ < 25) {
      console.log(`    ${(r.release_date || '----------').slice(0, 10)}  ${r.title}${r.director ? `  — dir. ${r.director}` : ''}`);
    }
  }
  console.log(`\n  (first 25 per language shown)\n`);
  db.close();
  process.exit(0);
}

// INDIAN_LANGUAGES_LOWER now carries both names and ISO codes, and by
// construction excludes the ambiguous set.
const target = INDIAN_LANGUAGES_LOWER.filter((l) => !AMBIGUOUS.includes(l));
const ph = target.map(() => '?').join(',');

const affected = db
  .prepare(
    `SELECT lower(trim(language)) AS lang, COUNT(*) AS n
       FROM movies
      WHERE COALESCE(is_indian, 1) = 0 AND lower(trim(language)) IN (${ph})
      GROUP BY lang ORDER BY n DESC`
  )
  .all(...target);
const total = affected.reduce((s, r) => s + r.n, 0);

console.log(`\nMovies to reclassify as Indian (is_indian 0 -> 1):\n`);
for (const r of affected) console.log(`  ${String(r.n).padStart(8)}  ${r.lang}`);
console.log(`  ${String(total).padStart(8)}  TOTAL`);

if (!total) {
  console.log(`\nNothing to do.\n`);
  db.close();
  process.exit(0);
}

if (!apply) {
  console.log(`\nDry run. Re-run with --yes to apply.`);
  console.log(`Review the excluded ambiguous languages with --review-ambiguous.\n`);
  db.close();
  process.exit(0);
}

const changed = db
  .prepare(
    `UPDATE movies SET is_indian = 1
      WHERE COALESCE(is_indian, 1) = 0 AND lower(trim(language)) IN (${ph})`
  )
  .run(...target).changes;

// These movies were excluded from the FTS index while they were flagged
// non-Indian (the rebuild filters on is_indian), so they are missing from
// search until reindexed. Bumping fts_v makes the next boot rebuild it.
db.prepare("INSERT OR REPLACE INTO app_meta(key, value, updated_at) VALUES ('fts_v', ?, ?)")
  .run('needs-rebuild', new Date().toISOString());

console.log(`\n  reclassified ${changed} movies`);
console.log(`  fts_v reset — the search index rebuilds on next server start.\n`);
db.close();
