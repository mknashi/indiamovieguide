import { mockMovies } from '../data/mockMovies';
import { Movie } from '../types';

export type AgentProvider = 'openai' | 'claude' | 'none';

export interface AgentOptions {
  provider: AgentProvider;
  recencyDays?: number;
  query?: string;
}

export interface HomePayload {
  generatedAt: string;
  sections: {
    new: Movie[];
    upcoming: Movie[];
    [k: string]: Movie[];
  };
  categories?: {
    genres?: { genre: string; count: number }[];
    languages?: { language: string; count: number }[];
  };
}

export async function fetchHome(language?: string, signal?: AbortSignal): Promise<HomePayload | null> {
  try {
    const url = language ? `/api/home?lang=${encodeURIComponent(language)}` : '/api/home';
    const res = await fetch(url, { cache: 'no-store', signal });
    if (!res.ok) return null;
    return (await res.json()) as HomePayload;
  } catch {
    return null;
  }
}

/**
 * Simulated agent layer.
 * Replace the body of `runAgent` with calls to your backend (or directly to OpenAI/Claude APIs)
 * that crawl multiple sources, reconcile duplicates, and return normalized Movie objects.
 */
export async function runAgent(options: AgentOptions): Promise<Movie[]> {
  // Preferred path: backend serves from local SQLite (and can do provider backfills).
  const home = await fetchHome();
  if (home?.sections) {
    const merged: Movie[] = [];
    for (const section of Object.values(home.sections || {})) {
      if (Array.isArray(section)) merged.push(...(section as Movie[]));
    }
    if (merged.length) return merged;
  }

  if (options.provider === 'none') return mockMovies;

  // Placeholder: in production, call your API route / serverless function.
  // Example (pseudo):
  // const response = await fetch('/api/aggregate', {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'application/json',
  //     'x-api-key': import.meta.env.VITE_AGENT_KEY
  //   },
  //   body: JSON.stringify(options)
  // });
  // const payload = await response.json();
  // return payload.movies as Movie[];

  // Fallback to mock data while offline.
  return mockMovies;
}

export async function searchMovies(query: string): Promise<Movie[]> {
  const normalized = query.trim();
  if (!normalized) return mockMovies;

  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
    if (res.ok) {
      const payload = await res.json();
      if (Array.isArray(payload.movies)) return payload.movies as Movie[];
    }
  } catch {
    // ignore
  }

  // Fallback to local mock search if API is down.
  const q = normalized.toLowerCase();
  return mockMovies.filter((movie) => {
    const inTitle = movie.title.toLowerCase().includes(q);
    const inSynopsis = movie.synopsis.toLowerCase().includes(q);
    const inCast = movie.cast.some((c) => c.name.toLowerCase().includes(q));
    const inThemes = (movie.themes ?? []).some((t) => t.toLowerCase().includes(q));
    const inGenres = movie.genres.some((g) => g.toLowerCase().includes(q));
    return inTitle || inSynopsis || inCast || inThemes || inGenres;
  });
}

export async function searchAll(query: string): Promise<{
  movies: Movie[];
  persons: any[];
  didYouMean?: string;
}> {
  const normalized = query.trim();
  if (!normalized) return { movies: [], persons: [] };

  const res = await fetch(`/api/search?q=${encodeURIComponent(normalized)}`, { cache: 'no-store' });
  if (!res.ok) return { movies: [], persons: [] };
  const payload = await res.json();
  return {
    movies: Array.isArray(payload.movies) ? (payload.movies as Movie[]) : [],
    persons: Array.isArray(payload.persons) ? payload.persons : [],
    didYouMean: typeof payload.didYouMean === 'string' ? payload.didYouMean : undefined
  };
}
