# IndiaMovieGuide.com

Modern, responsive React + Vite experience for discovering Indian movies (synopsis, cast, artwork, songs with YouTube links) plus hooks for an automated ingestion agent that can use OpenAI or Claude to gather data from multiple sources.

## Quick start
```bash
npm install
npm run dev
```

If you prefer Yarn or pnpm, adjust commands accordingly.

## Tech stack
- React 18 + TypeScript
- Vite bundler
- Minimal CSS with custom design tokens (no Tailwind requirement)
- `react-icons` for crisp iconography

## Project structure
```
src/
  App.tsx                // Page layout, search/filter logic
  types.ts               // Movie and Song schemas
  data/mockMovies.ts     // Temporary seed data
  services/agent.ts      // Agent hook placeholder (OpenAI/Claude-ready)
  components/
    MovieCard.tsx        // Movie cards with cast/songs
    SongRoll.tsx         // Aggregated soundtrack strip
  styles/index.css       // Design tokens & layout styles
```

## Agent ingestion hook (automated gathering)
- `runAgent` in `src/services/agent.ts` is the single entry point.
- Replace the placeholder with a call to your backend route (e.g., `/api/aggregate`) that:
  1. Fetches raw signals (official APIs like TMDb/OTT, YouTube search for trailers/songs, press releases/RSS).
  2. Sends snippets to an LLM (OpenAI/Claude) to normalize into the `Movie` schema.
  3. Returns the deduped array of `Movie` objects.
- Store keys as environment variables (`VITE_AGENT_KEY`, `OPENAI_API_KEY`, etc.). Never commit them.

### Example pseudo-backend
```ts
// /api/aggregate.ts (pseudo)
import { OpenAI } from 'openai';
export default async function handler(req, res) {
  const llm = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const raw = await fetchSources(); // scrape or API calls
  const completion = await llm.chat.completions.create({
    model: 'gpt-4.1',
    messages: [{ role: 'user', content: `Normalize to Movie schema: ${JSON.stringify(raw)}` }]
  });
  res.json({ movies: JSON.parse(completion.choices[0].message.content) });
}
```

## Search & filters
- Search bar matches title, synopsis, cast, genres, and themes.
- Filter chips switch between *All*, *Upcoming*, and *Now Showing / Streaming*.

## Styling notes
- Custom dark theme using Space Grotesk + Manrope.
- Bold gradient hero, glass panels, responsive grid (auto-fit min 260px).
- Mobile-friendly: stacked hero, vertical search, card grid reorganizes automatically.

## Next steps
1. Wire `runAgent` to your real aggregator endpoint.
2. Add persistence (Supabase/Firestore/Postgres) for crawled results.
3. Schedule the agent (CRON/Cloud Scheduler) to refresh daily; show `lastRun` from backend.
4. Extend schema with streaming provider badges and trailer embeds.

## Scripts
- `npm run dev` — start Vite dev server.
- `npm run build` — typecheck + production build.
- `npm run preview` — preview built app.
- `npm run agent:run` / `npm run agent:ingest` — batch-ingest “New/Upcoming” titles into the local SQLite DB (uses TMDB; optionally YouTube/OMDb).
- `npm run server:dev` — start the local API + SQLite cache (recommended for keeping API keys off the frontend).

## Assets
Unsplash placeholders are used for posters/backdrops. Replace with licensed artwork in production.

## Ingestion agent (batch refresh into SQLite)
The app can enrich data on-demand (via `/api/search`), but you can also run a batch ingestion to pre-fill / refresh the local DB.

- Entry: `agent/index.ts`
- Writes: `.cache/agent-last-run.json` (basic run stats)
- Config via env:
  - `TMDB_API_KEY` or `TMDB_BEARER_TOKEN` – required for ingestion.
  - `YOUTUBE_API_KEY` – optional; adds trailer fallback + song links.
  - `OMDB_API_KEY` – optional; adds extra rating sources.
  - `MOTN_API_KEY` – optional; fetches provider deeplinks (Movie of the Night / Streaming Availability via RapidAPI). Keep server-side only.
  - `AGENT_LIMIT`, `AGENT_DAYS_PAST`, `AGENT_DAYS_FUTURE`, `AGENT_LANGS`, `AGENT_ENRICH`

Run it:
```bash
npm run agent:run
```

Tune it:
```bash
npm run agent:run -- --limit=120 --daysPast=60 --daysFuture=365 --langs=hi,kn,te,ta,ml,mr,bn
```

## Local database (SQLite) + provider backfill
This repo includes a local API server that maintains a SQLite cache and performs:
"search local DB first; if not found, query providers in real time; then upsert + return."

- Server entry: `server/index.js`
- DB file: `.cache/indiamovieguide.sqlite` (configurable via `DB_PATH`). If you already have a legacy `.cache/indianmovieguide.sqlite`, the server will keep using it automatically.
- Primary endpoints:
  - `GET /api/home` — `New` + `Upcoming` sections + genre/language categories.
  - `GET /api/search?q=...` — local search; if empty, queries TMDB/YouTube/Wikipedia, stores results with attribution, then returns.
  - `GET /api/person/:id` — cast profile (bio + filmography from TMDB, Wikipedia link/summary when available).
  - `GET /api/movies/:id` — movie details.

### Home/language seeding (server-side env)
The server keeps the home page fast by reading shelves from SQLite and doing provider refresh in the background.
If the DB is empty (or a language is sparse), it will seed from TMDB.

These are **backend** environment variables (set them on the Node server / Render Web Service). They are *not* `VITE_*`.

**OTT deeplinks (optional)**
- `MOTN_API_KEY`: RapidAPI key for Movie of the Night / Streaming Availability (deeplinks). Keep server-side only.
- `MOTN_COUNTRY` (default `in`): country code for deeplinks (e.g. `in`, `us`).
- `MOTN_DAILY_BUDGET` (default `80`): safety cap for deeplink lookups per day.
- `MOTN_DEEPLINK_TTL_HOURS` (default `336`): how long deeplinks are considered fresh (default 14 days).
- `MOTN_ATTEMPT_MINUTES` (default `180`): minimum time between retries per movie when deeplinks fail.
- `MOTN_PAUSE_MINUTES` (default `360`): circuit-breaker pause when quota is hit.

**Home shelf seeding (New/Upcoming)**
- `HOME_SEED_PAGES` (default `2`, max `5`): how many TMDB discover pages to scan per shelf.
- `HOME_SEED_MAX_IDS` (default `80`, max `180`): cap on unique TMDB IDs fetched per run.
- `HOME_SEED_CONCURRENCY` (default `4`, max `8`): parallelism for `tmdbGetMovieFull` fetches.
- `HOME_SEED_ALL_LANGUAGES` (default enabled): if not `0`, triggers background language seeding during home refresh.

**Language catalog seeding (per-language backfill)**
- `LANG_SEED_DESIRED_TOTAL` (default `48`, min `24`): target minimum number of titles to keep cached per language.
- `LANG_SEED_DESIRED_UPCOMING` (default `6`, min `2`): target minimum number of upcoming titles per language.
- `LANG_SEED_PAGES` (default `3`, max `20`): how many TMDB discover pages to scan per language (per sort; see strategy + budget below).
- `LANG_SEED_MAX_IDS` (default `72`, max `600`): cap on unique TMDB IDs fetched per language run.
- `LANG_SEED_LOOKBACK_DAYS` (default `365`, max `40000`): how far back to discover titles for backfill.
- `LANG_SEED_FORWARD_DAYS` (default `365`, max `3650`): how far into the future to discover upcoming titles.
- `LANG_SEED_STRATEGY` (default `popular`, allowed: `popular|mixed`): discover ordering strategy.
  - `popular`: only `popularity.desc` (fastest, but tends to plateau after repeated runs).
  - `mixed`: rotates multiple sort orders (popularity, vote_count, revenue, release date) to find more unique titles over time.
- `LANG_SEED_DISCOVER_BUDGET` (default `40`, min `10`, max `120`): safety cap on TMDB discover calls per window per language (prevents over-aggressive settings from exploding runtime).
- `LANG_SEED_WINDOW_DAYS` (default `3650`): if lookback is large, rotate the backfill across time windows of this size (keeps repeated admin runs discovering new older titles without increasing API calls per run).

Notes:
- Seeding uses TMDB `discover` and is intentionally "popular-biased" by default; `LANG_SEED_STRATEGY=mixed` helps grow the catalog beyond the same top results.
- If you crank these values up too high, you can slow deploys/refreshes and increase TMDB API usage. Prefer running multiple admin-triggered seed runs rather than one huge run.

Dev flow (two terminals):
```bash
npm run server:dev
npm run dev
```

## Scheduling (local)
Run the ingestion agent periodically using cron (example: every day at 6am):
```bash
0 6 * * * cd /path/to/IndiaMovieGuide && npm run agent:run
```

## Admin page
- Open `/admin` to access the admin panel.
- Set `ADMIN_PASSWORD` in your `.env`.
- The admin panel shows DB status, key presence, counts, and ingestion notes.
