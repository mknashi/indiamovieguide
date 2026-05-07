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
          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}>
            <RiArrowLeftLine />
          </span>
          Back to movie
        </button>
        <span className="inline-pill">Trailer</span>
      </div>

      {loading && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {!loading && movie && (
        <>
          <div className="detail" style={{ marginTop: 12 }}>
            <h4 style={{ margin: 0 }}>{movie.title}</h4>
            <div className="meta" style={{ marginTop: 8, flexWrap: 'wrap' }}>
              {movie.language && <span className="chip">{movie.language}</span>}
              {movie.releaseDate && (
                <span className="chip">{new Date(movie.releaseDate).getFullYear()}</span>
              )}
              {typeof movie.rating === 'number' && (
                <span className="chip">★ {movie.rating.toFixed(1)}</span>
              )}
            </div>

            {movie.synopsis && (
              <div className="tagline" style={{ lineHeight: 1.8, marginTop: 10 }}>
                {movie.synopsis}
              </div>
            )}

            {movie.trailerUrl ? (
              <>
                <div
                  style={{
                    marginTop: 14,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.10)',
                    background: 'rgba(0,0,0,0.25)',
                  }}
                >
                  {embed ? (
                    <iframe
                      title={`${movie.title} — official trailer`}
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
                          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}>
                            <RiPlayLine />
                          </span>
                          Open trailer
                          <span style={{ marginLeft: 8, display: 'inline-flex', alignItems: 'center' }}>
                            <RiExternalLinkLine />
                          </span>
                        </a>
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 10 }}>
                  <a className="chip" href={movie.trailerUrl} target="_blank" rel="noreferrer">
                    Trailer link{' '}
                    <span style={{ marginLeft: 6, display: 'inline-flex', alignItems: 'center' }}>
                      <RiExternalLinkLine size={14} />
                    </span>
                  </a>
                </div>
              </>
            ) : (
              <div className="tagline" style={{ marginTop: 10 }}>Trailer not available yet.</div>
            )}
          </div>

          <div className="detail" style={{ marginTop: 12 }}>
            <div className="tagline" style={{ marginBottom: 8 }}>More from this film</div>
            <div className="meta" style={{ flexWrap: 'wrap' }}>
              <button
                className="ghost-button"
                type="button"
                onClick={() => navigate(`/movie/${encodeURIComponent(id)}`)}
              >
                Full movie details
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
