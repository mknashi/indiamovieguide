export function tmdbNumericFromCompoundId(id: string): string {
  const m = id.match(/:(\d+)$/);
  return m ? m[1] : id;
}

export function moviePathFromMovieId(id: string): string {
  return `/movie/${encodeURIComponent(tmdbNumericFromCompoundId(id))}`;
}

export function personPathFromTmdbId(id: number | string): string {
  return `/person/${encodeURIComponent(String(id))}`;
}

