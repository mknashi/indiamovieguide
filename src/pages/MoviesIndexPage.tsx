import { useEffect, useMemo, useState } from 'react';
import { MovieCard } from '../components/MovieCard';
import type { Movie } from '../types';
import { decodeSlugLabel, languageFromSlug, titleCaseLabel } from '../utils/slugs';
import { navigate } from '../router';

type Mode = 'all' | 'language' | 'genre';

type BrowsePayload = {
  movies: Movie[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  filters?: {
    lang?: string | null;
    genre?: string | null;
  };
};

export function MoviesIndexPage({ mode, slug }: { mode: Mode; slug?: string }) {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<BrowsePayload | null>(null);

  const lang = useMemo(() => (mode === 'language' ? languageFromSlug(slug || '') : ''), [mode, slug]);
  const genreLabel = useMemo(() => (mode === 'genre' ? titleCaseLabel(slug || '') : ''), [mode, slug]);

  const heading = useMemo(() => {
    if (mode === 'language') return `${lang || 'Language'} Movies`;
    if (mode === 'genre') return `${genreLabel || 'Genre'} Movies`;
    return 'Movie Index';
  }, [genreLabel, lang, mode]);

  const fetchPage = async (page: number) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '24');
    if (mode === 'language' && slug) {
      params.set('langSlug', slug);
      if (lang) params.set('lang', lang);
    }
    if (mode === 'genre' && slug) {
      params.set('genreSlug', slug);
      params.set('genre', decodeSlugLabel(slug));
    }

    const res = await fetch(`/api/browse?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as BrowsePayload;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await fetchPage(1);
        if (!alive) return;
        setPayload(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load movies');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [mode, slug, lang]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>{heading}</h3>
          <div className="tagline">
            {payload?.total != null ? `${payload.total} titles` : 'Discover Indian cinema titles'}
          </div>
        </div>
        <span className="inline-pill">Index</span>
      </div>

      <div className="meta" style={{ marginTop: 8 }}>
        <a
          className="chip"
          href="/movies"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate('/movies');
          }}
        >
          All movies
        </a>
        <a
          className="chip"
          href="/people"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate('/people');
          }}
        >
          People index
        </a>
      </div>

      {loading && <div className="tagline" style={{ marginTop: 12 }}>Loading…</div>}
      {error && <div className="tagline" style={{ marginTop: 12 }}>Failed to load: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid" style={{ marginTop: 12 }}>
            {(payload?.movies || []).map((movie) => (
              <MovieCard key={movie.id} movie={movie} />
            ))}
          </div>
          {payload?.hasMore ? (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button
                className="ghost-button"
                type="button"
                disabled={loadingMore}
                onClick={async () => {
                  if (!payload) return;
                  const nextPage = Number(payload.page || 1) + 1;
                  try {
                    setLoadingMore(true);
                    const next = await fetchPage(nextPage);
                    setPayload((prev) => {
                      if (!prev) return next;
                      return {
                        ...next,
                        movies: [...(prev.movies || []), ...(next.movies || [])]
                      };
                    });
                  } catch {
                    // ignore
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
