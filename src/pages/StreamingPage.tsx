import { useEffect, useMemo, useState } from 'react';
import { Movie } from '../types';
import { navigate } from '../router';
import { MovieCard } from '../components/MovieCard';

type ProviderFacet = { provider: string; count: number; logo?: string; lastVerifiedAt?: string };
type StreamingResponse = {
  generatedAt: string;
  filters: {
    provider: string | null;
    lang: string | null;
    genre: string | null;
    region: string | null;
  };
  providers: ProviderFacet[];
  lastVerifiedAt?: string | null;
  movies: Movie[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

function normalizeProvider(p?: string) {
  return String(p || '').trim();
}

export function StreamingPage({ lang, provider }: { lang?: string; provider?: string }) {
  const [activeProvider, setActiveProvider] = useState<string>(() => normalizeProvider(provider));
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<StreamingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local state in sync with URL changes.
  useEffect(() => {
    setActiveProvider(normalizeProvider(provider));
    setPage(1);
  }, [provider, lang]);

  const q = useMemo(() => {
    const params = new URLSearchParams();
    if (lang) params.set('lang', lang);
    if (activeProvider) params.set('provider', activeProvider);
    params.set('page', String(page));
    params.set('pageSize', '24');
    params.set('region', 'IN');
    return params.toString();
  }, [lang, activeProvider, page]);

  const fetchPage = async (mode: 'replace' | 'append') => {
    if (mode === 'append') setLoadingMore(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/streaming?${q}`, { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as StreamingResponse;
      if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
      setPayload((prev) => {
        if (mode === 'append' && prev) return { ...data, movies: [...prev.movies, ...data.movies] };
        return data;
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load streaming titles');
    } finally {
      if (mode === 'append') setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    fetchPage('replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const providers = payload?.providers || [];
  const movies = payload?.movies || [];
  const lastVerifiedText = payload?.lastVerifiedAt
    ? new Date(String(payload.lastVerifiedAt)).toLocaleString()
    : 'Unknown';

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Streaming Now</h3>
          <div className="tagline">Titles with a streaming provider link in our catalog (region: IN).</div>
        </div>
        <span className="inline-pill">Discover</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <div className="meta" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button
            className={`chip ${!activeProvider ? 'chip-active' : ''}`}
            type="button"
            onClick={() => {
              setActiveProvider('');
              setPage(1);
              const p = new URLSearchParams();
              if (lang) p.set('lang', lang);
              navigate(`/streaming${p.toString() ? `?${p.toString()}` : ''}`);
            }}
            title="All platforms"
          >
            All platforms
          </button>
          {providers.slice(0, 14).map((p) => (
            <button
              key={p.provider}
              className={`chip ${activeProvider === p.provider ? 'chip-active' : ''}`}
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center' }}
              onClick={() => {
                setActiveProvider(p.provider);
                setPage(1);
                const qs = new URLSearchParams();
                if (lang) qs.set('lang', lang);
                qs.set('provider', p.provider);
                navigate(`/streaming?${qs.toString()}`);
              }}
              title={p.lastVerifiedAt ? `Last verified: ${new Date(p.lastVerifiedAt).toLocaleString()}` : p.provider}
            >
              {p.logo ? (
                <img
                  src={p.logo}
                  alt=""
                  style={{ width: 18, height: 18, borderRadius: 6, marginRight: 8, verticalAlign: 'middle' }}
                  loading="lazy"
                />
              ) : null}
              {p.provider}
            </button>
          ))}
        </div>

        <div className="tagline" style={{ marginTop: 10 }}>
          Region: <strong>{payload?.filters?.region || 'IN'}</strong> · Last verified: <strong>{lastVerifiedText}</strong>
          <span style={{ opacity: 0.75 }}>
            {' '}
            (cached availability can change; open movie details to refresh in the background)
          </span>
        </div>
      </div>

      {loading ? <div className="tagline" style={{ marginTop: 12 }}>Loading…</div> : null}
      {error ? <div className="tagline" style={{ marginTop: 12 }}>Failed to load: {error}</div> : null}

      {!loading && !error ? (
        <>
          {movies.length ? (
            <div className="grid" style={{ marginTop: 14 }}>
              {movies.map((m) => (
                <MovieCard key={m.id} movie={m} />
              ))}
            </div>
          ) : (
            <div className="detail" style={{ marginTop: 14 }}>
              <h4 style={{ marginTop: 0 }}>No titles found</h4>
              <div className="tagline">
                This usually means we haven’t cached streaming offers for these filters yet. Try a different platform/language or run an admin refresh.
              </div>
            </div>
          )}

          {payload?.hasMore ? (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button
                className="ghost-button"
                type="button"
                disabled={loadingMore}
                onClick={async () => {
                  const next = page + 1;
                  setPage(next);
                  // fetchPage uses current `q` via useMemo, so do a manual append call here.
                  const params = new URLSearchParams();
                  if (lang) params.set('lang', lang);
                  if (activeProvider) params.set('provider', activeProvider);
                  params.set('page', String(next));
                  params.set('pageSize', '24');
                  params.set('region', 'IN');
                  try {
                    setLoadingMore(true);
                    const res = await fetch(`/api/streaming?${params.toString()}`, { cache: 'no-store' });
                    const data = (await res.json().catch(() => ({}))) as StreamingResponse;
                    if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
                    setPayload((prev) => (prev ? { ...data, movies: [...prev.movies, ...data.movies] } : data));
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
      ) : null}
    </div>
  );
}
