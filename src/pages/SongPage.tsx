import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiExternalLinkLine, RiPlayLine } from 'react-icons/ri';
import { navigate } from '../router';

type SongPayload = {
  id: string;
  movieId?: string;
  movieTitle?: string;
  title: string;
  singers: string[];
  youtubeUrl?: string;
  platform?: string;
};

function youtubeEmbedUrl(input?: string): string | null {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      const m = u.pathname.match(/\/embed\/([^/]+)/);
      if (m?.[1]) return `https://www.youtube.com/embed/${encodeURIComponent(m[1])}`;
    }
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}`;
    }
  } catch {
    // ignore
  }
  return null;
}

export function SongPage({ id }: { id: string }) {
  const [song, setSong] = useState<SongPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/songs/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const data = (await res.json().catch(() => ({}))) as SongPayload;
        if (!res.ok) throw new Error((data as any)?.error || `HTTP ${res.status}`);
        if (!alive) return;
        setSong(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load song');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const embed = useMemo(() => youtubeEmbedUrl(song?.youtubeUrl), [song?.youtubeUrl]);
  const ytSearchUrl = useMemo(() => {
    if (!song) return '';
    const q = `${song.movieTitle ? `${song.movieTitle} ` : ''}${song.title} song`.trim();
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
  }, [song]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button
          className="ghost-button"
          type="button"
          onClick={() => {
            if (song?.movieId) navigate(`/movie/${encodeURIComponent(song.movieId)}`);
            else navigate('/');
          }}
        >
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          Back
        </button>
        <span className="inline-pill">Song</span>
      </div>

      {loading && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {!loading && song && (
        <div className="detail" style={{ marginTop: 12 }}>
          <h4 style={{ margin: 0 }}>{song.title}</h4>
          <div className="tagline" style={{ marginTop: 8 }}>
            {(song.movieTitle ? `${song.movieTitle}` : 'Movie') +
              (song.singers?.length ? ` · ${song.singers.join(', ')}` : '') +
              (song.platform ? ` · ${song.platform}` : '')}
          </div>

          {song.youtubeUrl ? (
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
                    title={`${song.title} player`}
                    src={`${embed}?autoplay=1&rel=0`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ width: '100%', aspectRatio: '16/9', border: 0, display: 'block' }}
                  />
                ) : (
                  <div style={{ padding: 14 }}>
                    <div className="tagline">Embedded player is only supported for YouTube links right now.</div>
                    <div style={{ marginTop: 10 }}>
                      <a className="ghost-button" href={song.youtubeUrl} target="_blank" rel="noreferrer">
                        <RiPlayLine style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
                        Open song
                        <RiExternalLinkLine style={{ marginLeft: 8, verticalAlign: 'text-bottom' }} />
                      </a>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ marginTop: 10 }}>
                <a className="chip" href={song.youtubeUrl} target="_blank" rel="noreferrer">
                  YouTube link <RiExternalLinkLine size={14} style={{ marginLeft: 6, verticalAlign: 'text-bottom' }} />
                </a>
              </div>
            </>
          ) : (
            <div className="tagline" style={{ marginTop: 10 }}>
              No playable link available yet.
              {ytSearchUrl ? (
                <div style={{ marginTop: 10 }}>
                  <a className="chip" href={ytSearchUrl} target="_blank" rel="noreferrer">
                    Search on YouTube <RiExternalLinkLine size={14} style={{ marginLeft: 6, verticalAlign: 'text-bottom' }} />
                  </a>
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
