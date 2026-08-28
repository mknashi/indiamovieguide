import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiExternalLinkLine } from 'react-icons/ri';
import { PersonProfile } from '../types/person';
import { navigate } from '../router';

// Consume server-injected initial data once on module load.
let _personInitial: { key: string; person: PersonProfile } | null = null;
if (typeof window !== 'undefined') {
  const d = (window as any).__INITIAL_DATA__;
  if (d?._route === 'person') {
    _personInitial = { key: d._key, person: d.person as PersonProfile };
    delete (window as any).__INITIAL_DATA__;
  }
}

export function PersonPage({ id }: { id: string }) {
  const [profile, setProfile] = useState<PersonProfile | null>(() => {
    if (_personInitial?.key === id) {
      const p = _personInitial.person;
      _personInitial = null;
      return p;
    }
    return null;
  });
  const [loading, setLoading] = useState(!profile);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const hasInitial = !!profile;
    if (!hasInitial) { setLoading(true); setError(null); }
    (async () => {
      try {
        // Always fetch — the API adds full TMDB filmography not in local DB.
        const res = await fetch(`/api/person/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PersonProfile;
        if (alive) setProfile(data);
      } catch (e: any) {
        if (alive && !hasInitial) setError(e?.message || 'Failed to load profile');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  // No cap: prolific Indian actors genuinely have hundreds of credits, and the
  // API now returns all of them.
  const filmography = useMemo(() => profile?.filmography ?? [], [profile]);

  // Posters for the best-known work, a compact table for the long tail. A
  // thousand poster cards would bury the titles that matter; a table stays
  // scannable and keeps the whole credit list on the page.
  const FEATURED_COUNT = 12;
  const TABLE_PAGE = 50;
  const [tableLimit, setTableLimit] = useState(TABLE_PAGE);
  const featured = useMemo(() => filmography.slice(0, FEATURED_COUNT), [filmography]);
  const rest = useMemo(() => filmography.slice(FEATURED_COUNT), [filmography]);
  // Render the tail in pages so a 1,000-credit actor does not cost a thousand
  // DOM rows on first paint.
  const visibleRest = useMemo(() => rest.slice(0, tableLimit), [rest, tableLimit]);

  // A different person means a different list; start the tail over.
  useEffect(() => { setTableLimit(TABLE_PAGE); }, [id]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowLeftLine  /></span>
          Back
        </button>
        <span className="inline-pill">Profile</span>
      </div>

      {loading && !profile && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {profile && (
        <>
          <div className="hero person-hero">
            <div className="hero-card person-hero-card">
              <div className="person-header">
                {profile.profileImage ? (
                  <img
                    src={profile.profileImage}
                    alt={profile.name}
                    className="person-photo"
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
                    {filmography.length > 0 && (
                      <div className="meta" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                        <span className="tagline" style={{ alignSelf: 'center', marginRight: 2 }}>Known for</span>
                        {filmography.slice(0, 3).map((f) => {
                          const year = (f.releaseDate || '').toString().slice(0, 4);
                          return (
                            <button
                              key={`${f.title}-${year}`}
                              className="chip"
                              type="button"
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                if (typeof f.tmdbId === 'number') {
                                  navigate(`/movie/${encodeURIComponent(String(f.tmdbId))}`);
                                } else {
                                  navigate(`/search?q=${encodeURIComponent(f.title)}`);
                                }
                              }}
                            >
                              {f.title}{year ? ` (${year})` : ''}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="tagline">
                      {profile.biography?.trim() || 'Full biography not available yet.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-card person-hero-card person-filmography-card">
              <div className="section-header" style={{ marginTop: 0 }}>
                <h3>Filmography</h3>
                <span className="inline-pill">{filmography.length} items</span>
              </div>
              <div className="grid person-filmography-grid">
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
            <span className="inline-pill">{filmography.length} items</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {featured.map((f) => (
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

          {rest.length > 0 && (
            <>
              <div className="section-header">
                <h3>More Titles</h3>
                <span className="inline-pill">{rest.length} more</span>
              </div>
              <div className="filmography-table-wrap">
                <table className="filmography-table">
                  <thead>
                    <tr>
                      <th scope="col">Title</th>
                      <th scope="col">Year</th>
                      <th scope="col">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRest.map((f) => {
                      const year = (f.releaseDate || '').toString().slice(0, 4);
                      const linkable = typeof f.tmdbId === 'number';
                      return (
                        <tr key={`${f.title}-${f.releaseDate || ''}-row`}>
                          <td>
                            {linkable ? (
                              <a
                                href={`/movie/${encodeURIComponent(String(f.tmdbId))}`}
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/movie/${encodeURIComponent(String(f.tmdbId))}`);
                                }}
                              >
                                {f.title}
                              </a>
                            ) : (
                              f.title
                            )}
                          </td>
                          <td>{year || '—'}</td>
                          <td>{f.character || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {tableLimit < rest.length && (
                <div style={{ marginTop: 12, textAlign: 'center' }}>
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => setTableLimit((n) => n + TABLE_PAGE)}
                  >
                    Show more ({rest.length - tableLimit} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
