# ID Normalization Strategy (TMDB + Wikipedia + Others)

This document describes how IndiaMovieGuide should normalize and reconcile entity IDs when content is discovered from multiple providers (TMDB, Wikipedia, YouTube, iTunes, etc.). It also captures the current behavior and a future-proof strategy we can implement later.

## Goals

- Use stable, provider-backed identifiers (avoid "guessing" IDs).
- Allow the same movie/person to be discovered via multiple sources and merged safely.
- Keep old links working even after merging (redirect/alias support).
- Preserve attribution (who provided which piece of data).

## Current Behavior (Today)

- Canonical entity IDs are primarily TMDB-based:
  - Movie: `tmdb-movie:<tmdbId>`
  - Person: `tmdb-person:<tmdbId>`
- Wikipedia is used mainly for enrichment/attribution (e.g., soundtrack lists) rather than creating standalone movies.
- The app persists provider attributions in `attributions(entity_type, entity_id, provider, provider_id, url, created_at)`.

Implication:
- If a title exists on Wikipedia but *cannot* be found on TMDB, the app currently cannot create a durable canonical movie record for it (unless it is added via admin/user submission workflows).

## Proposed Strategy (Future)

### 1) Internal IDs are provider-prefixed

Never try to "share" numeric IDs across providers. Instead, represent each provider identity explicitly.

Recommended ID formats:

- Movies:
  - TMDB: `tmdb-movie:<tmdbId>`
  - Wikipedia: `wiki-movie:<pageId>` (preferred) OR `wiki-movie:<normalizedTitle>` (fallback)
- Persons:
  - TMDB: `tmdb-person:<tmdbId>`
  - Wikipedia: `wiki-person:<pageId>` (preferred) OR `wiki-person:<normalizedTitle>` (fallback)
- Songs:
  - YouTube: keep `song:<hash>` (current) or `yt-song:<videoId>` if we later store direct IDs

Why `pageId` is preferred for Wikipedia:
- Titles can change; redirects happen. Page IDs are stable.

### 2) Store cross-provider links as attributions (already exists)

For every entity record, store one or more provider attributions:

- Example: Wikipedia-only movie record
  - `movies.id = wiki-movie:123456`
  - `attributions(provider='wikipedia', provider_id='123456', url='https://en.wikipedia.org/wiki/...')`

- Later, if TMDB mapping is found:
  - Insert attribution for TMDB on the canonical record (or on the alias record, depending on merge policy).

### 3) Add an alias/redirect table (recommended)

To keep links stable after merges, introduce a small alias table:

`id_aliases`
- `from_id TEXT PRIMARY KEY`  (old id)
- `to_id   TEXT NOT NULL`     (canonical id)
- `reason  TEXT`              (optional: 'tmdb_merge', 'wiki_redirect', etc.)
- `created_at TEXT NOT NULL`

Lookup rule:
- If a request comes in for `from_id` and there is an alias row, treat it as `to_id`.

This prevents breaking URLs and allows us to merge aggressively later without losing references.

### 4) Canonical selection policy

We need one canonical ID per real-world entity to avoid duplicates in listings.

Suggested policy:
- Prefer TMDB as canonical for movies/persons when available (better structured data and consistent IDs).
- Allow Wikipedia-only records to exist as canonical when TMDB is missing.

### 5) Merge policy (when a mapping is discovered)

When we learn that two IDs refer to the same entity:

1. Choose canonical (`to_id`) based on the policy above.
2. Create alias:
   - `id_aliases(from_id=non_canonical, to_id=canonical)`
3. Migrate dependent rows that refer to `from_id`:
   - `songs.movie_id`
   - `ott_offers.movie_id`
   - `movie_genres.movie_id`
   - `movie_cast.movie_id`
   - `ratings.movie_id`
   - `reviews.movie_id`
   - `user_favorites.movie_id`
   - `user_watchlist.movie_id`
   - `user_reviews.movie_id`
4. Merge fields on the canonical row using "best value wins":
   - Keep non-empty synopsis/director/poster/backdrop.
   - Keep richer cast/genres if canonical is missing them.
   - Keep all attributions.

Important: Do not overwrite admin-curated data unless explicitly allowed.

### 6) How to discover mappings (Wikipedia -> TMDB)

Preferred (if implemented later):
- Use TMDB "external IDs" endpoints when possible.

Fallback heuristic:
- Compare title + year + language.
- Use Wikipedia infobox signals (release year, language, cast) and validate against TMDB.

The mapping step should produce:
- `wiki-movie:<pageId>` <-> `tmdb-movie:<tmdbId>`
- Confidence score + audit info (for admin review if needed).

## Search + "Not Found" Behavior

Recommended flow:

1. Search local DB by:
   - exact/substring match
   - normalized title match
   - sounds-like match (soundex + similarity)
2. If local miss:
   - query TMDB (movies + persons)
   - query Wikipedia for canonical title (and/or pageId)
   - retry TMDB using canonical Wikipedia title if needed
3. If TMDB still misses but Wikipedia has a page:
   - create a Wikipedia-only record:
     - `movies.id = wiki-movie:<pageId>`
     - minimal fields from Wikipedia (title, synopsis/lead, year if parsed)
     - attribution stored
   - mark record as "needs enrichment" for later

## Attribution

Attribution should always be preserved per field or per entity:
- `attributions` table already exists and should be used for:
  - TMDB movie/person IDs
  - Wikipedia page IDs + URLs
  - iTunes/Spotify album URLs
  - YouTube video URLs

If we later implement field-level provenance, add a `provenance` table, but the existing `attributions` is a good baseline.

## Why This Matters

- Prevents duplicate movies across providers.
- Allows Wikipedia-only content to be shown without waiting for TMDB.
- Keeps stable URLs even after merges.
- Makes migrations (SQLite -> Postgres) simpler because IDs remain stable and explicit.

## Implementation Notes (Deferred)

This strategy is intentionally deferred; it requires:
- DB schema changes (`id_aliases`, possibly wikipedia page_id storage).
- Merge tooling (admin page for reviewing/approving merges).
- Careful updates to foreign keys and caches.

When we implement it, we should add:
- A resolver utility: `resolveEntityId(id) -> canonicalId`
- A merge function with unit tests to ensure no data loss.

