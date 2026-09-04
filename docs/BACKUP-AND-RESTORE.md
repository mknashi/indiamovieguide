# Backup and restore

The database is a single SQLite file. It holds `users`, `user_reviews`,
`user_favorites`, `user_watchlist` and `user_submissions`, none of which exist
anywhere else — everything else (movies, people, songs, OTT offers) can be
re-ingested from TMDB, slowly. Optimise recovery for the user tables.

## What is backed up

| Layer | Covers | Frequency | Retention | Location |
|---|---|---|---|---|
| Litestream | off-machine | continuous, ~1s | 24h history, snapshot every 6h | Cloudflare R2, `site-backups/indiamovieguide/` |
| Local snapshots | same disk only | 21:00 UTC daily | 7 daily + 4 weekly (Sundays) | `/var/backups/indiamovieguide/` on the VPS |

Litestream runs as a sidecar defined in `docker-compose.yml`. It reads the WAL
and streams it to R2, so the recovery point is seconds rather than a day. It is
**not an archive**: beyond 24 hours that history is deleted from R2. Recovering
from "a table was dropped last Tuesday" is what the local snapshots are for.

The local snapshots live on the same disk as the database, so they do not
survive losing the server. That combination — an old mistake *and* a dead box —
is the one scenario neither layer covers.

## Checking it is working

```bash
ssh dokploy
sudo docker logs --tail 20 $(sudo docker ps -q -f name=india.*litestream)
```

Healthy output shows `wal segment written` lines every few seconds. Anything
repeating `failed to run` means it is crash-looping and **nothing is being
backed up** — the app keeps serving normally, so this fails silently.

Last local snapshot:

```bash
systemctl status sqlite-backup.service --no-pager
ls -lh /var/backups/indiamovieguide/
```

## Restore from Litestream

Restores into a throwaway file first. Never restore straight over a live
database.

```bash
ssh dokploy
mkdir -p ~/restore
cd /etc/dokploy/compose/my-projects-india-movie-guide-5lahy5/code

sudo docker compose run --rm -v ~/restore:/restore litestream \
  restore -config /etc/litestream.yml \
  -o /restore/out.sqlite /data/indiamovieguide.sqlite
```

Verify before trusting it:

```bash
sudo sqlite3 ~/restore/out.sqlite "PRAGMA integrity_check;"
sudo sqlite3 ~/restore/out.sqlite \
  "SELECT COUNT(*) FROM movies; SELECT COUNT(*) FROM users;"
```

To restore to a point in time, add `-timestamp 2026-09-02T14:00:00Z`. Only
works inside the 24-hour retention window.

## Restore from a local snapshot

```bash
ssh dokploy
gunzip -c /var/backups/indiamovieguide/daily-YYYYMMDD-HHMMSS.sqlite.gz > ~/restore/out.sqlite
sudo sqlite3 ~/restore/out.sqlite "PRAGMA integrity_check;"
```

## Putting a restored database back

The app must be stopped. Swapping the file under a live writer corrupts it.

```bash
cd /etc/dokploy/compose/my-projects-india-movie-guide-5lahy5/code
sudo docker compose stop app

VOL=/var/lib/docker/volumes/my-projects-india-movie-guide-5lahy5_sqlite-data/_data
sudo rm -f $VOL/indiamovieguide.sqlite $VOL/indiamovieguide.sqlite-wal $VOL/indiamovieguide.sqlite-shm
sudo cp ~/restore/out.sqlite $VOL/indiamovieguide.sqlite
sudo chown 1000:1000 $VOL/indiamovieguide.sqlite   # the container runs as uid 1000

sudo docker compose start app
```

Delete the `-wal` and `-shm` files as shown. Leaving stale ones alongside a
different database is a good way to corrupt the result.

First boot may take up to three minutes if the FTS index needs rebuilding; the
healthcheck's `start_period` allows for it.

## Losing the whole server

1. Provision a new box, install Dokploy, recreate the Compose service from this
   repo (branch `main`, `./docker-compose.yml`).
2. Set the environment variables, including the five `S3_*` values.
3. Deploy once — it comes up on an empty database.
4. Stop the app, restore from Litestream as above, swap the file in, start.

Litestream's replica is authoritative: it holds the database as of seconds
before the server died.

## Gotchas

- **Never `cp` a live SQLite file.** In WAL mode a plain copy can miss committed
  data. Use `VACUUM INTO` or Litestream. The snapshot script uses `VACUUM INTO`.
- **The container runs as uid 1000.** Files copied into the volume as root are
  unreadable by the app.
- **Litestream needs `S3_BUCKET`, `S3_ENDPOINT` and `S3_REGION` in its own
  container environment**, not just the app's — `litestream.yml` expands them
  from there. Without them it exits with `bucket required for s3 replica`.
- **The R2 endpoint must not include the bucket name.** R2's console shows the
  S3 API URL with the bucket appended; strip it.

Last verified end to end: 2026-09-02. Restored copy matched live exactly on
every table.
