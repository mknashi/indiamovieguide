// Inspect what is_indian = 0 actually contains, before deleting any of it.
//
//   node server/db-verify-foreign.js              # language breakdown + suspicious rows
//   node server/db-verify-foreign.js --sample 40  # plus a random sample to eyeball
//   node server/db-verify-foreign.js --lang gujarati
//                                                 # list every flagged title in one language
//
// Read-only. Nothing here modifies the database.
//
// The classification under review (server/db/repository.js):
//   is_indian = production_countries includes 'IN'  -> 1
//             : language is one of INDIAN_LANGUAGES -> 1
//             : otherwise                           -> 0
// INDIAN_LANGUAGES covers only 8 languages, so a film in any other Indian
// language is correctly flagged only when TMDB also supplied 'IN'. That gap is
// where false negatives live, so it is what this script looks hardest at.
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';
import { INDIAN_LANGUAGES_LOWER } from './repo.js';

const args = process.argv.slice(2);
const sampleIdx = args.indexOf('--sample');
const sampleN = sampleIdx >= 0 ? Number(args[sampleIdx + 1] || 25) : 0;
const langIdx = args.indexOf('--lang');
const onlyLang = langIdx >= 0 ? String(args[langIdx + 1] || '').toLowerCase() : null;

const db = new Database(resolveDbPath(), { readonly: true });

// Indian languages the classifier does NOT know about. A movie here with
// is_indian = 0 is very likely misclassified.
const MISSING_INDIAN_LANGUAGES = [
  'gujarati', 'urdu', 'bhojpuri', 'odia', 'oriya', 'assamese', 'konkani',
  'manipuri', 'tulu', 'rajasthani', 'haryanvi', 'sindhi', 'kashmiri',
  'maithili', 'santali', 'dogri', 'nepali', 'sanskrit', 'chhattisgarhi',
  'awadhi', 'magahi', 'tibetan', 'ladakhi', 'mizo', 'khasi', 'bodo',
];

if (onlyLang) {
  const rows = db
    .prepare(
      `SELECT id, title, language, release_date, director
         FROM movies
        WHERE COALESCE(is_indian, 1) = 0 AND lower(COALESCE(language,'')) = ?
        ORDER BY release_date DESC`
    )
    .all(onlyLang);
  console.log(`\n${rows.length} movies flagged non-Indian with language "${onlyLang}":\n`);
  for (const r of rows) {
    console.log(`  ${(r.release_date || '----------').slice(0, 10)}  ${r.title}${r.director ? `  — dir. ${r.director}` : ''}`);
  }
  console.log('');
  db.close();
  process.exit(0);
}

const total = db.prepare('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 0').get().n;
console.log(`\n${total} movies are flagged is_indian = 0.\n`);

// Is the original evidence still on disk? The hourly prune in server/index.js
// nulls production_countries_json, so it usually is not, which means is_indian
// cannot be recomputed from what is stored — only judged by language and title.
const withCountries = db
  .prepare('SELECT COUNT(*) n FROM movies WHERE production_countries_json IS NOT NULL')
  .get().n;
console.log(
  withCountries
    ? `production_countries_json still present on ${withCountries} rows — is_indian is re-derivable.`
    : `production_countries_json has been nulled by the prune job, so the original country\n` +
      `evidence is gone. Judge these by language and title only.`
);

console.log('\n-- languages among flagged movies (top 30) --\n');
const byLang = db
  .prepare(
    `SELECT COALESCE(NULLIF(TRIM(language), ''), '(none)') AS lang, COUNT(*) AS n
       FROM movies WHERE COALESCE(is_indian, 1) = 0
      GROUP BY lower(lang) ORDER BY n DESC LIMIT 30`
  )
  .all();
for (const r of byLang) {
  const l = String(r.lang).toLowerCase();
  const flag = MISSING_INDIAN_LANGUAGES.includes(l)
    ? '  <-- INDIAN LANGUAGE, likely misclassified'
    : INDIAN_LANGUAGES_LOWER.includes(l)
      ? '  <-- should have been caught by the language rule; investigate'
      : '';
  console.log(`  ${String(r.n).padStart(8)}  ${r.lang}${flag}`);
}

console.log('\n-- suspected false negatives --\n');
const ph = MISSING_INDIAN_LANGUAGES.map(() => '?').join(',');
const suspect = db
  .prepare(
    `SELECT COALESCE(NULLIF(TRIM(language), ''), '(none)') AS lang, COUNT(*) AS n
       FROM movies
      WHERE COALESCE(is_indian, 1) = 0 AND lower(COALESCE(language, '')) IN (${ph})
      GROUP BY lower(lang) ORDER BY n DESC`
  )
  .all(...MISSING_INDIAN_LANGUAGES);
const suspectTotal = suspect.reduce((s, r) => s + r.n, 0);
if (suspectTotal) {
  for (const r of suspect) console.log(`  ${String(r.n).padStart(8)}  ${r.lang}`);
  console.log(`\n  ${suspectTotal} movies in Indian languages the classifier does not know.`);
  console.log(`  Inspect one with: node server/db-verify-foreign.js --lang ${suspect[0].lang.toLowerCase()}`);
} else {
  console.log('  None — no flagged movie is in an Indian language outside the known list.');
}

// A person credited in both flagged and Indian movies is a second signal: it
// suggests the flagged title may belong to the same film industry.
const crossover = db
  .prepare(
    `SELECT COUNT(*) n FROM (
       SELECT mc.movie_id FROM movie_cast mc
         JOIN movies m ON m.id = mc.movie_id AND COALESCE(m.is_indian, 1) = 0
        WHERE mc.person_id IN (
          SELECT DISTINCT mc2.person_id FROM movie_cast mc2
            JOIN movies m2 ON m2.id = mc2.movie_id AND COALESCE(m2.is_indian, 1) = 1)
        GROUP BY mc.movie_id)`
  )
  .get().n;
console.log(`\n-- ${crossover} flagged movies share at least one cast member with an Indian movie --`);
console.log(`   (expected for crossover actors; a very high number would be a warning sign)`);

if (sampleN) {
  console.log(`\n-- random sample of ${sampleN} flagged movies --\n`);
  const rows = db
    .prepare(
      `SELECT title, language, release_date, director
         FROM movies WHERE COALESCE(is_indian, 1) = 0
        ORDER BY RANDOM() LIMIT ?`
    )
    .all(sampleN);
  for (const r of rows) {
    console.log(
      `  ${(r.release_date || '----------').slice(0, 10)}  ${String(r.language || '?').padEnd(12)}  ${r.title}` +
        `${r.director ? `  — dir. ${r.director}` : ''}`
    );
  }
}

console.log('');
db.close();
