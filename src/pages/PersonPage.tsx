import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiExternalLinkLine } from 'react-icons/ri';
import { PersonProfile } from '../types/person';
import { navigate } from '../router';

export function PersonPage({ id }: { id: string }) {
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/person/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PersonProfile;
        if (alive) setProfile(data);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load profile');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const filmography = useMemo(() => {
    if (!profile?.filmography?.length) return [];
    return profile.filmography.slice(0, 24);
  }, [profile]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
          Back
        </button>
        <span className="inline-pill">Profile</span>
      </div>

      {loading && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {!loading && profile && (
        <>
          <div className="hero" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <div className="hero-card" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt={profile.name}
                    style={{
                      width: '100%',
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  />
                ) : (
                  <div className="detail">No image</div>
                )}
                <div>
                  <h1 style={{ margin: 0, fontSize: 30 }}>{profile.name}</h1>
                  <div className="meta" style={{ marginTop: 10 }}>
                    {profile.wikiUrl ? (
                      <a
                        className="chip"
                        href={profile.wikiUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        Wikipedia <RiExternalLinkLine size={14} />
                      </a>
                    ) : null}
                    {typeof profile.tmdbId === 'number' ? (
                      <a
                        className="chip"
                        href={`https://www.themoviedb.org/person/${profile.tmdbId}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        TMDB <RiExternalLinkLine size={14} />
                      </a>
                    ) : null}
                  </div>
                  <div className="detail" style={{ marginTop: 12 }}>
                    <h4>Bio</h4>
                    <div className="tagline">{profile.biography || 'Biography not available yet.'}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-card" style={{ padding: 18, background: 'rgba(10, 15, 31, 0.7)' }}>
              <div className="section-header" style={{ marginTop: 0 }}>
                <h3>Filmography</h3>
                <span className="inline-pill">{filmography.length} items</span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {filmography.slice(0, 8).map((f) => (
                  <a
                    key={`${f.title}-${f.releaseDate || ''}`}
                    className="detail"
                    href={typeof f.tmdbId === 'number' ? `/movie/${encodeURIComponent(String(f.tmdbId))}` : '#'}
                    onClick={(e) => {
                      if (typeof f.tmdbId !== 'number') return;
                      e.preventDefault();
                      navigate(`/movie/${encodeURIComponent(String(f.tmdbId))}`);
                    }}
                    style={{ padding: 10, textAlign: 'left' }}
                  >
                    <div style={{ fontWeight: 700 }}>{f.title}</div>
                    <div className="tagline">
                      {(f.releaseDate || '').toString().slice(0, 4)}
                      {f.character ? ` · ${f.character}` : ''}
                    </div>
                  </a>
                ))}
              </div>
              <div className="tagline" style={{ marginTop: 10 }}>
                Click a title to open movie details.
              </div>
            </div>
          </div>

          <div className="section-header">
            <h3>All Titles</h3>
            <span className="inline-pill">Top {filmography.length}</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {filmography.map((f) => (
              <a
                key={`${f.title}-${f.releaseDate || ''}-grid`}
                className="detail"
                href={typeof f.tmdbId === 'number' ? `/movie/${encodeURIComponent(String(f.tmdbId))}` : '#'}
                onClick={(e) => {
                  if (typeof f.tmdbId !== 'number') return;
                  e.preventDefault();
                  navigate(`/movie/${encodeURIComponent(String(f.tmdbId))}`);
                }}
                style={{ textAlign: 'left' }}
              >
                {f.poster ? (
                  <img
                    src={f.poster}
                    alt={f.title}
                    style={{
                      width: '100%',
                      height: 220,
                      objectFit: 'cover',
                      borderRadius: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      marginBottom: 10
                    }}
                    loading="lazy"
                  />
                ) : null}
                <div style={{ fontWeight: 700 }}>{f.title}</div>
                <div className="tagline">
                  {(f.releaseDate || '').toString().slice(0, 4)}
                  {f.character ? ` · ${f.character}` : ''}
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
