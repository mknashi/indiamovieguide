// Reclaim disk space from the SQLite database.
//
//   node server/db-shrink.js            # prune + compact in place (needs free space ≈ current file size)
//   node server/db-shrink.js --dry-run  # prune only, report what VACUUM would reclaim
//   node server/db-shrink.js --into /var/data/compact.sqlite
//                                       # write a compacted copy elsewhere, leave the original untouched
//
// Plain VACUUM is atomic and crash-safe, but SQLite builds the compacted copy
// before swapping it in, so the filesystem must hold both at once. When the disk
// is too tight for that, use --into with a path on a different volume.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { resolveDbPath } from './db/sqlite.js';

const MB = 1024 * 1024;
const mb = (bytes) => `${(bytes / MB).toFixed(1)} MB`;
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const intoIdx = args.indexOf('--into');
const intoPath = intoIdx >= 0 ? args[intoIdx + 1] : null;

const dbPath = resolveDbPath();
const db = new Database(dbPath);
const sizeOf = (p) => (fs.existsSync(p) ? fs.statSync(p).size : 0);
const fileBytes = () => sizeOf(dbPath) + sizeOf(`${dbPath}-wal`);

const before = fileBytes();
console.log(`\n${dbPath}\n  before: ${mb(before)}`);

// 1. Fold the WAL back into the main file and truncate it to zero.
db.pragma('wal_checkpoint(TRUNCATE)');

// 2. Cap the WAL so it can never balloon again between checkpoints.
db.pragma('journal_size_limit = 67108864'); // 64 MB

// 3. Drop cached API responses. They re-fetch on demand, so nothing is lost.
const cacheDeleted = db.prepare('DELETE FROM api_cache').run().changes;

// 4. Drop the redundant JSON blobs the app recomputes or re-fetches.
const countries = db
  .prepare('UPDATE movies SET production_countries_json = NULL WHERE production_countries_json IS NOT NULL')
  .run().changes;
const filmographies = db
  .prepare('UPDATE persons SET filmography_json = NULL WHERE filmography_json IS NOT NULL')
  .run().changes;

// 5. Expired auth rows.
const nowIso = new Date().toISOString();
const sessions = db.prepare('DELETE FROM user_sessions WHERE expires_at < ?').run(nowIso).changes;
const resets = db.prepare('DELETE FROM password_resets WHERE expires_at < ?').run(nowIso).changes;

// 6. FTS5 keeps deleted rows as tombstones spread over many small b-tree segments.
//    Every movie/person re-ingest adds another delete+insert pair, so on a
//    long-lived index the garbage can outweigh the live data. 'optimize' merges
//    it all into one segment and discards the tombstones.
let ftsNote = '';
try {
  db.prepare("INSERT INTO search_index(search_index) VALUES('optimize')").run();
  ftsNote = 'search_index optimized';
} catch (err) {
  ftsNote = `search_index optimize failed: ${err.message}`;
}

// 7. Rows pointing at movies or persons that no longer exist. Foreign keys are
//    only enforced on connections that enable them, so orphans do accumulate.
const orphanSql = [
  ['movie_genres', 'DELETE FROM movie_genres WHERE movie_id NOT IN (SELECT id FROM movies)'],
  ['movie_cast', 'DELETE FROM movie_cast WHERE movie_id NOT IN (SELECT id FROM movies)'],
  ['songs', 'DELETE FROM songs WHERE movie_id NOT IN (SELECT id FROM movies)'],
  ['ott_offers', 'DELETE FROM ott_offers WHERE movie_id NOT IN (SELECT id FROM movies)'],
  ['ratings', 'DELETE FROM ratings WHERE movie_id NOT IN (SELECT id FROM movies)'],
  ['reviews', 'DELETE FROM reviews WHERE movie_id NOT IN (SELECT id FROM movies)'],
  ['person_search_keys', 'DELETE FROM person_search_keys WHERE person_id NOT IN (SELECT id FROM persons)'],
  [
    'search_index',
    "DELETE FROM search_index WHERE (entity_type = 'movie' AND entity_id NOT IN (SELECT id FROM movies)) OR (entity_type = 'person' AND entity_id NOT IN (SELECT id FROM persons))",
  ],
];
const orphans = [];
for (const [label, sql] of orphanSql) {
  try {
    const n = db.prepare(sql).run().changes;
    if (n) orphans.push(`${n} ${label}`);
  } catch { /* table may not exist yet */ }
}

// 8. Indexes that are a leftmost prefix of another index on the same table.
//    SQLite never chooses them — it already prefers the wider covering index —
//    so they are pure overhead, and over millions of rows that is substantial.
//    Verified with EXPLAIN QUERY PLAN: dropping these changes no query plan.
const redundantIndexes = [
  // covered by sqlite_autoindex_person_search_keys_1 on (key, person_id) — ~8M rows
  ['idx_psk_key', 'person_search_keys'],
  // covered by sqlite_autoindex_movie_cast_1 on (movie_id, person_id) — ~3.6M rows
  ['idx_movie_cast_movie', 'movie_cast'],
  // covered by the UNIQUE(movie_id, source) autoindex
  ['idx_ratings_movie', 'ratings'],
  // covered by idx_movies_language_release on (lower(language), release_date DESC)
  ['idx_movies_language_lower', 'movies'],
  // covered by their PRIMARY KEY (user_id, movie_id) autoindexes
  ['idx_fav_user', 'user_favorites'],
  ['idx_watch_user', 'user_watchlist'],
];
const dropped = [];
for (const [idx, table] of redundantIndexes) {
  try {
    const exists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?")
      .get(idx);
    if (!exists) continue;
    const bytes = (() => {
      try { return db.prepare('SELECT SUM(pgsize) AS b FROM dbstat WHERE name = ?').get(idx)?.b || 0; }
      catch { return 0; }
    })();
    db.exec(`DROP INDEX IF EXISTS ${idx}`);
    dropped.push(`${idx} on ${table}${bytes ? ` (${mb(bytes)})` : ''}`);
  } catch { /* index may not exist on older schemas */ }
}
if (dropped.length) console.log(`  dropped redundant indexes: ${dropped.join(', ')}`);

const pageSize = db.pragma('page_size', { simple: true });
const freePages = db.pragma('freelist_count', { simple: true });

console.log(`  pruned: ${cacheDeleted} api_cache, ${countries} country blobs, ${filmographies} filmographies, ` +
  `${sessions} sessions, ${resets} resets${orphans.length ? `, ${orphans.join(', ')}` : ''}`);
console.log(`  ${ftsNote}`);
console.log(`  ${mb(freePages * pageSize)} of free pages inside the file`);

if (dryRun) {
  console.log(`\nDry run — skipping VACUUM. Re-run without --dry-run to return that space to the OS.\n`);
  db.close();
  process.exit(0);
}

// Free space on the volume holding the destination, so we fail with a clear
// message instead of filling the disk halfway through a VACUUM.
function freeBytesFor(target) {
  try {
    const dir = target.slice(0, target.lastIndexOf('/')) || '/';
    const out = execFileSync('df', ['-k', dir], { encoding: 'utf8' }).trim().split('\n').pop();
    return Number(out.split(/\s+/)[3]) * 1024;
  } catch {
    return null;
  }
}

const target = intoPath || dbPath;
const needed = sizeOf(dbPath);
const free = freeBytesFor(target);
if (free !== null && free < needed) {
  console.error(
    `\nNot enough room to compact: VACUUM needs about ${mb(needed)} free on the target volume, ` +
      `but only ${mb(free)} is available.\n` +
      `Either raise the Render disk size temporarily, or run with --into <path on another volume>.\n`
  );
  db.close();
  process.exit(1);
}

if (intoPath) {
  if (fs.existsSync(intoPath)) {
    console.error(`\n${intoPath} already exists — remove it first.\n`);
    db.close();
    process.exit(1);
  }
  db.prepare('VACUUM INTO ?').run(intoPath);
  console.log(`\n  compacted copy: ${mb(sizeOf(intoPath))} at ${intoPath}`);
  console.log(`  Stop the service, then replace the original with it and delete the -wal/-shm files.\n`);
} else {
  // auto_vacuum can only change during a full VACUUM, and only on a connection
  // with no open read transaction. Setting it now means future deletes return
  // their pages to the OS incrementally instead of leaving the file oversized.
  db.pragma('auto_vacuum = INCREMENTAL');
  db.exec('VACUUM');
  // VACUUM writes the rebuilt database through the WAL, so the file only reaches
  // its final size once that WAL is folded back in and truncated.
  db.pragma('wal_checkpoint(TRUNCATE)');
  const after = fileBytes();
  const mode = ['NONE', 'FULL', 'INCREMENTAL'][db.pragma('auto_vacuum', { simple: true })];
  console.log(`\n  after: ${mb(after)}  (reclaimed ${mb(before - after)})`);
  console.log(`  auto_vacuum is now ${mode}${mode === 'INCREMENTAL' ? ' — future deletes shrink the file on their own' : ''}.\n`);
}

db.close();
