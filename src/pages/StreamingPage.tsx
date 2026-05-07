import { useEffect, useMemo, useState } from 'react';
import { Movie } from '../types';
import { navigate } from '../router';
import { MovieCard } from '../components/MovieCard';
import { slugifySegment } from '../utils/slugs';
import { LANGUAGE_INTROS, LANGUAGE_COLORS } from '../data/languageContent';

// Module-level cache so the initial server-injected data survives route changes.
const streamingCache = new Map<string, { data: StreamingResponse; ts: number }>();
const STREAMING_CACHE_TTL = 5 * 60 * 1000;

if (typeof window !== 'undefined') {
  const d = (window as any).__INITIAL_DATA__;
  if (d?._route === 'streaming' && d._key) {
    streamingCache.set(d._key, { data: d as StreamingResponse, ts: Date.now() });
    delete (window as any).__INITIAL_DATA__;
  }
}

function getStreamingCached(key: string): StreamingResponse | null {
  const c = streamingCache.get(key);
  return c && Date.now() - c.ts < STREAMING_CACHE_TTL ? c.data : null;
}

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

const POPULAR_PROVIDERS = [
  'Netflix',
  'Prime Video',
  'Amazon Prime Video',
  'Disney+ Hotstar',
  'Hotstar',
  'JioCinema',
  'ZEE5',
  'SonyLIV',
  'Sun NXT',
  'aha',
];

const POPULAR_SET = new Set(POPULAR_PROVIDERS.map((p) => p.toLowerCase()));

export function StreamingPage({ lang, provider }: { lang?: string; provider?: string }) {
  const cacheKey = `streaming:${(lang || 'all').toLowerCase()}`;
  const [activeProvider, setActiveProvider] = useState<string>(() => normalizeProvider(provider));
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<StreamingResponse | null>(() => getStreamingCached(cacheKey));
  const [loading, setLoading] = useState(() => !getStreamingCached(cacheKey));
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
    if (page === 1 && !activeProvider && getStreamingCached(cacheKey)) {
      const cached = getStreamingCached(cacheKey)!;
      setPayload(cached);
      setLoading(false);
      return;
    }
    fetchPage('replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const providersRaw = payload?.providers || [];
  const providers = useMemo(() => {
    const rank = new Map(POPULAR_PROVIDERS.map((p, i) => [p.toLowerCase(), i]));
    return providersRaw
      .slice()
      .sort((a, b) => {
        const ra = rank.has(String(a.provider || '').toLowerCase()) ? rank.get(String(a.provider || '').toLowerCase())! : 999;
        const rb = rank.has(String(b.provider || '').toLowerCase()) ? rank.get(String(b.provider || '').toLowerCase())! : 999;
        if (ra !== rb) return ra - rb;
        const ca = Number(a.count || 0) || 0;
        const cb = Number(b.count || 0) || 0;
        if (ca !== cb) return cb - ca;
        return String(a.provider || '').localeCompare(String(b.provider || ''));
      });
  }, [providersRaw]);

  const prominentProviders = useMemo(
    () => providers.filter((p) => POPULAR_SET.has(String(p.provider || '').toLowerCase())),
    [providers]
  );
  const otherProviders = useMemo(
    () => providers.filter((p) => !POPULAR_SET.has(String(p.provider || '').toLowerCase())),
    [providers]
  );
  const movies = payload?.movies || [];
  const lastVerifiedText = payload?.lastVerifiedAt
    ? new Date(String(payload.lastVerifiedAt)).toLocaleString()
    : 'Unknown';
  const freshness = (() => {
    if (!payload?.lastVerifiedAt) return 'unknown';
    const t = Date.parse(String(payload.lastVerifiedAt));
    if (!Number.isFinite(t)) return 'unknown';
    const hours = (Date.now() - t) / (1000 * 60 * 60);
    if (hours <= 24) return 'fresh';
    if (hours <= 72) return 'warm';
    return 'stale';
  })();

  const langIntro = lang ? LANGUAGE_INTROS[lang] ?? null : null;
  const langColors = lang ? LANGUAGE_COLORS[lang] ?? null : null;

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Streaming Now</h3>
          <div className="tagline">Titles with a streaming provider link in our catalog (region: IN).</div>
        </div>
        <span className="inline-pill">Discover</span>
      </div>

      {!lang && (
        <div className="detail" style={{ marginTop: 14 }}>
          <h4 style={{ marginTop: 0 }}>Indian Cinema on Streaming</h4>
          <p className="tagline" style={{ lineHeight: 1.8, marginTop: 0 }}>
            India is one of the world's fastest-growing streaming markets, and every major global
            platform — Netflix, Amazon Prime Video, Disney+ Hotstar, JioCinema, ZEE5, and SonyLIV
            — has invested heavily in Indian content. The result is an unprecedented catalogue
            spanning Bollywood blockbusters, Malayalam art-house thrillers, Telugu pan-India epics,
            Tamil crime dramas, and originals produced specifically for streaming audiences.
          </p>
          <p className="tagline" style={{ lineHeight: 1.8 }}>
            Use the language tabs above to filter by film industry, or pick a platform below to
            see what is currently available in our catalogue. Streaming availability is updated
            continuously — opening a movie's detail page triggers a background refresh of its
            current platform links.
          </p>
        </div>
      )}

      {langIntro && langColors && (
        <div
          className="detail"
          style={{
            marginTop: 14,
            background: langColors.bg,
            borderColor: langColors.border,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span
              className="inline-pill"
              style={{ background: langColors.accent, color: '#fff', border: 'none' }}
            >
              {langColors.industry}
            </span>
            <h4 style={{ margin: 0 }}>{langIntro.headline} — Streaming</h4>
          </div>
          {langIntro.streamingBody.map((para, i) => (
            <p key={i} className="tagline" style={{ lineHeight: 1.8, marginTop: i === 0 ? 0 : 8 }}>
              {para}
            </p>
          ))}
        </div>
      )}

      <div className="detail" style={{ marginTop: 14 }}>
        <div className="provider-seg" role="tablist" aria-label="Streaming platforms">
          <button
            className={`provider-pill ${!activeProvider ? 'is-active' : ''}`}
            type="button"
            onClick={() => {
              setActiveProvider('');
              setPage(1);
              navigate(lang ? `/streaming/${slugifySegment(lang)}` : '/streaming');
            }}
          >
            All platforms
          </button>
          {prominentProviders.map((p) => (
            <button
              key={p.provider}
              className={`provider-pill ${activeProvider === p.provider ? 'is-active' : ''}`}
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center' }}
              onClick={() => {
                setActiveProvider(p.provider);
                setPage(1);
                const qs = new URLSearchParams();
                qs.set('provider', p.provider);
                const base = lang ? `/streaming/${slugifySegment(lang)}` : '/streaming';
                navigate(`${base}?${qs.toString()}`);
              }}
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
          {otherProviders.length > 0 && (
            <>
              <span className="tagline" style={{ alignSelf: 'center', padding: '0 4px', opacity: 0.4 }}>·</span>
              {otherProviders.map((p) => (
                <button
                  key={p.provider}
                  className={`provider-pill ${activeProvider === p.provider ? 'is-active' : ''}`}
                  type="button"
                  style={{ display: 'inline-flex', alignItems: 'center', opacity: 0.75 }}
                  onClick={() => {
                    setActiveProvider(p.provider);
                    setPage(1);
                    const qs = new URLSearchParams();
                    qs.set('provider', p.provider);
                    const base = lang ? `/streaming/${slugifySegment(lang)}` : '/streaming';
                    navigate(`${base}?${qs.toString()}`);
                  }}
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
            </>
          )}
        </div>

        <div className="tagline" style={{ marginTop: 10 }}>
          <span className={`verified-badge ${freshness}`}>
            {freshness === 'fresh' ? 'Verified <24h' : freshness === 'warm' ? 'Verified <72h' : freshness === 'stale' ? 'Stale' : 'Unverified'}
          </span>
          <span style={{ marginLeft: 10 }}>
            Region: <strong>{payload?.filters?.region || 'IN'}</strong> · Last verified: <strong>{lastVerifiedText}</strong>
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
                <MovieCard key={m.id} movie={m} contextProvider={activeProvider || undefined} />
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
