// Disk-usage report for the SQLite database.
//
// Run it on the server (Render shell) to find out what is actually consuming space:
//   node server/db-report.js
//
// Reads only — safe to run against the live DB while the app is serving traffic.
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';

const MB = 1024 * 1024;
const mb = (bytes) => (bytes / MB).toFixed(1).padStart(9) + ' MB';

const dbPath = resolveDbPath();
const db = new Database(dbPath, { readonly: true });

const fileBytes = fs.statSync(dbPath).size;
const walBytes = fs.existsSync(`${dbPath}-wal`) ? fs.statSync(`${dbPath}-wal`).size : 0;
const pageSize = db.pragma('page_size', { simple: true });
const pageCount = db.pragma('page_count', { simple: true });
const freePages = db.pragma('freelist_count', { simple: true });
const autoVacuum = db.pragma('auto_vacuum', { simple: true });

console.log(`\nDatabase: ${dbPath}`);
console.log(`  file on disk    ${mb(fileBytes)}`);
console.log(`  -wal            ${mb(walBytes)}`);
console.log(`  page size       ${pageSize} bytes`);
console.log(`  free pages      ${freePages} (${mb(freePages * pageSize)} reclaimable by VACUUM)`);
console.log(`  auto_vacuum     ${['NONE', 'FULL', 'INCREMENTAL'][autoVacuum] ?? autoVacuum}`);

// dbstat attributes every page to the table or index that owns it, so this is
// the ground truth for "what is big" — not row counts, which hide wide columns.
//
// Query it one object at a time. An unfiltered `GROUP BY name` makes SQLite walk
// every page in the file in one statement, which on a multi-GB database on a
// network disk looks indistinguishable from a hang. With `WHERE name = ?` it
// walks a single b-tree per call and reports progress as it goes.
const objects = db
  .prepare("SELECT name FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_stat%' ORDER BY name")
  .all()
  .map((r) => r.name);
// Implicit PK/UNIQUE indexes are not listed in sqlite_master but do occupy pages.
const autoIndexes = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
  .all()
  .flatMap((t) => db.pragma(`index_list("${t.name}")`).filter((i) => i.origin !== 'c').map((i) => i.name));

let rows = [];
try {
  const sizeOne = db.prepare('SELECT SUM(pgsize) AS bytes FROM dbstat WHERE name = ?');
  for (const name of [...new Set([...objects, ...autoIndexes])]) {
    const bytes = sizeOne.get(name)?.bytes || 0;
    if (bytes) rows.push({ name, bytes });
  }
  rows.sort((a, b) => b.bytes - a.bytes);
} catch (err) {
  console.error(`\ndbstat unavailable (${err.message}) — falling back to row counts only.\n`);
}

if (rows.length) {
  const accounted = rows.reduce((sum, r) => sum + r.bytes, 0);
  console.log(`\nSpace by table/index (${mb(accounted)} accounted for):\n`);
  for (const r of rows) {
    if (r.bytes < MB) continue; // skip noise below 1 MB
    const pct = ((r.bytes / accounted) * 100).toFixed(1).padStart(5);
    console.log(`  ${mb(r.bytes)}  ${pct}%  ${r.name}`);
  }
}

// Skip virtual tables: COUNT(*) on an FTS5 table decodes the whole index, which
// is far slower than counting its shadow tables directly (those are listed too).
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND COALESCE(sql,'') NOT LIKE 'CREATE VIRTUAL%' ORDER BY name")
  .all()
  .map((r) => r.name);

console.log('\nRow counts:\n');
for (const t of tables) {
  try {
    const n = db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n;
    if (n) console.log(`  ${String(n).padStart(12)}  ${t}`);
  } catch { /* virtual-table shadow tables may not be countable */ }
}

// The JSON blob columns are the usual cause of a movies/persons table that is
// far larger than its row count suggests.
const blobColumns = [
  ['movies', 'production_countries_json'],
  ['movies', 'synopsis'],
  ['persons', 'filmography_json'],
  ['persons', 'biography'],
  ['songs', 'singers_json'],
  ['api_cache', 'value_json'],
];
console.log('\nLargest text/JSON columns:\n');
for (const [table, col] of blobColumns) {
  try {
    const r = db.prepare(`SELECT COUNT("${col}") AS n, SUM(LENGTH("${col}")) AS bytes FROM "${table}"`).get();
    if (r.bytes) console.log(`  ${mb(r.bytes)}  ${String(r.n).padStart(9)} rows  ${table}.${col}`);
  } catch { /* column may not exist on older schemas */ }
}

console.log('');
db.close();
