// Eyeball the movies that db-drop-foreign.js would delete.
//
//   node server/db-browse-foreign.js                 # stratified sample, 8 per language
//   node server/db-browse-foreign.js --per 15        # more per language
//   node server/db-browse-foreign.js --risky         # the most likely misclassifications
//   node server/db-browse-foreign.js --popular       # the best-known titles being deleted
//   node server/db-browse-foreign.js --lang ja --limit 50
//   node server/db-browse-foreign.js --csv /tmp/foreign.csv   # all of them, for a spreadsheet
//
// Read-only.
//
// A random sample of 400k+ rows tells you almost nothing: if 0.1% are
// misclassified you will not see one. --risky and --popular are the useful
// modes, because they surface the rows where a mistake would actually hurt.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';

const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i >= 0 ? (args[i + 1] ?? dflt) : dflt;
};
const has = (name) => args.includes(name);

const perLang = Number(flag('--per', 8));
const limit = Number(flag('--limit', 40));
const lang = flag('--lang', null);
const csvPath = flag('--csv', null);

const db = new Database(resolveDbPath(), { readonly: true });

const total = db.prepare('SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 0').get().n;

const fmt = (r) =>
  `  ${(r.release_date || '----------').slice(0, 10)}  ${String(r.language || '?').padEnd(10)}  ` +
  `${String(r.title || '').slice(0, 58).padEnd(58)}${r.director ? ` dir. ${r.director}` : ''}`;

// ---------------------------------------------------------------- CSV export
if (csvPath) {
  // Default target is /tmp on purpose: it is the container filesystem, not the
  // persistent volume. Writing a 400k-row CSV onto an already-full /var/data
  // would make the problem worse.
  if (csvPath.startsWith('/var/data')) {
    console.error(`\nRefusing to write into /var/data — that is the volume that is full.`);
    console.error(`Use /tmp instead, then download it.\n`);
    db.close();
    process.exit(1);
  }
  const rows = db
    .prepare(
      `SELECT m.id, m.tmdb_id, m.title, m.language, m.release_date, m.director,
              (SELECT COUNT(*) FROM movie_cast mc WHERE mc.movie_id = m.id) AS cast_count
         FROM movies m WHERE COALESCE(m.is_indian, 1) = 0
        ORDER BY m.language, m.release_date DESC`
    )
    .all();
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  // Written synchronously on purpose. A createWriteStream here is buffered and
  // the process.exit below would terminate before it flushed, leaving no file
  // at all despite a success message.
  const fd = fs.openSync(csvPath, 'w');
  try {
    fs.writeSync(fd, 'id,tmdb_id,title,language,release_date,director,cast_count\n');
    // Batched so a 400k-row export never holds the whole file in memory.
    let buf = '';
    for (const r of rows) {
      buf += [r.id, r.tmdb_id, r.title, r.language, r.release_date, r.director, r.cast_count].map(esc).join(',') + '\n';
      if (buf.length > 1 << 20) {
        fs.writeSync(fd, buf);
        buf = '';
      }
    }
    if (buf) fs.writeSync(fd, buf);
  } finally {
    fs.closeSync(fd);
  }
  console.log(`\nWrote ${rows.length} rows (${(fs.statSync(csvPath).size / 1048576).toFixed(1)} MB) to ${csvPath}`);
  console.log(`Open it in a spreadsheet and sort by language to scan quickly.\n`);
  db.close();
  process.exit(0);
}

// ------------------------------------------------------- single language mode
if (lang) {
  const rows = db
    .prepare(
      `SELECT title, language, release_date, director
         FROM movies
        WHERE COALESCE(is_indian, 1) = 0 AND lower(trim(language)) = lower(?)
        ORDER BY release_date DESC LIMIT ?`
    )
    .all(lang, limit);
  const n = db
    .prepare(
      `SELECT COUNT(*) n FROM movies WHERE COALESCE(is_indian, 1) = 0 AND lower(trim(language)) = lower(?)`
    )
    .get(lang).n;
  console.log(`\n${n} flagged movies in "${lang}" — showing ${rows.length}:\n`);
  rows.forEach((r) => console.log(fmt(r)));
  console.log('');
  db.close();
  process.exit(0);
}

// ------------------------------------------------------------- risky mode
// Movies whose cast overlaps most with Indian cinema. A film crewed largely by
// people who also work in Indian films is the most plausible misclassification,
// so these are the rows worth a human look before deletion.
if (has('--risky')) {
  console.log(`\nFlagged movies with the most cast members who also appear in Indian films.`);
  console.log(`These are the likeliest misclassifications — scan for anything you recognise.\n`);
  const rows = db
    .prepare(
      `SELECT m.title, m.language, m.release_date, m.director, COUNT(*) AS shared
         FROM movies m
         JOIN movie_cast mc ON mc.movie_id = m.id
        WHERE COALESCE(m.is_indian, 1) = 0
          AND mc.person_id IN (
            SELECT DISTINCT mc2.person_id FROM movie_cast mc2
              JOIN movies m2 ON m2.id = mc2.movie_id AND COALESCE(m2.is_indian, 1) = 1)
        GROUP BY m.id
        ORDER BY shared DESC, m.release_date DESC
        LIMIT ?`
    )
    .all(limit);
  rows.forEach((r) => console.log(`${fmt(r)}   [${r.shared} shared cast]`));
  console.log('');
  db.close();
  process.exit(0);
}

// ----------------------------------------------------------- popular mode
// Ranked by TMDB vote count, so you see the best-known titles being removed.
// If a famous Indian film shows up here, the flag is wrong.
if (has('--popular')) {
  console.log(`\nMost-voted flagged movies on TMDB — the highest-profile deletions.\n`);
  const rows = db
    .prepare(
      `SELECT m.title, m.language, m.release_date, m.director, r.count AS votes
         FROM movies m
         JOIN ratings r ON r.movie_id = m.id AND r.source = 'tmdb'
        WHERE COALESCE(m.is_indian, 1) = 0 AND r.count IS NOT NULL
        ORDER BY r.count DESC LIMIT ?`
    )
    .all(limit);
  rows.forEach((r) => console.log(`${fmt(r)}   [${r.votes} votes]`));
  console.log('');
  db.close();
  process.exit(0);
}

// ------------------------------------------------- default: stratified sample
// One block per language, so every bucket gets looked at rather than the
// sample being swamped by whichever language dominates.
console.log(`\n${total} movies flagged non-Indian. Showing ${perLang} per language.\n`);
const langs = db
  .prepare(
    `SELECT COALESCE(NULLIF(TRIM(language), ''), '(none)') AS lang, COUNT(*) AS n
       FROM movies WHERE COALESCE(is_indian, 1) = 0
      GROUP BY lower(lang) ORDER BY n DESC LIMIT 25`
  )
  .all();

const pick = db.prepare(
  `SELECT title, language, release_date, director
     FROM movies
    WHERE COALESCE(is_indian, 1) = 0 AND lower(trim(COALESCE(language, ''))) = ?
    ORDER BY RANDOM() LIMIT ?`
);
for (const l of langs) {
  console.log(`\n=== ${l.lang}  (${l.n}) ===`);
  const key = l.lang === '(none)' ? '' : String(l.lang).toLowerCase();
  for (const r of pick.all(key, perLang)) console.log(fmt(r));
}
console.log(`\nDrill into one with --lang <name>, or try --risky / --popular.\n`);
db.close();
