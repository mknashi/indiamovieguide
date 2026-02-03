import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiExternalLinkLine, RiPlayLine } from 'react-icons/ri';
import { navigate } from '../router';
import type { Movie } from '../types';

function youtubeEmbedUrl(input?: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // youtube.com/watch?v=...
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      const m = u.pathname.match(/\/embed\/([^/]+)/);
      if (m?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(m[1])}`;
    }
    // youtu.be/...
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
  } catch {
    // ignore
  }
  return null;
}

export function TrailerPage({ id }: { id: string }) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/movies/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as Movie;
        if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
        if (!alive) return;
        setMovie(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load trailer');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const embed = useMemo(() => youtubeEmbedUrl(movie?.trailerUrl), [movie?.trailerUrl]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate(`/movie/${encodeURIComponent(id)}`)}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          Back to movie
        </button>
        <span className="inline-pill">Trailer</span>
      </div>

      {loading && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {!loading && movie && (
        <div className="detail" style={{ marginTop: 12 }}>
          <h4 style={{ margin: 0 }}>{movie.title}</h4>
          <div className="tagline" style={{ marginTop: 8 }}>
            {movie.trailerUrl ? 'Official trailer (best-effort).' : 'Trailer not available yet.'}
          </div>

          {movie.trailerUrl ? (
            <>
              <div
                style={{
                  marginTop: 12,
                  borderRadius: 16,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.10)',
                  background: 'rgba(0,0,0,0.25)'
                }}
              >
                {embed ? (
                  <iframe
                    title={`${movie.title} trailer`}
                    src={`${embed}?autoplay=1&rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: '100%', aspectRatio: '16/9', border: 0, display: 'block' }}
                  />
                ) : (
                  <div style={{ padding: 14 }}>
                    <div className="tagline">Embedded player is only supported for YouTube links right now.</div>
                    <div style={{ marginTop: 10 }}>
                      <a className="ghost-button" href={movie.trailerUrl} target="_blank" rel="noreferrer">
                        <RiPlayLine style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                        Open trailer
                        <RiExternalLinkLine style={{ marginLeft: 8, verticalAlign: 'text-bottom' }} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <a className="chip" href={movie.trailerUrl} target="_blank" rel="noreferrer">
                  Trailer link <RiExternalLinkLine size={14} style={{ marginLeft: 6, verticalAlign: 'text-bottom' }} />
                </a>
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
