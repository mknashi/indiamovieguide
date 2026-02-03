import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiChat3Line, RiExternalLinkLine, RiHeart3Line, RiListCheck2, RiPlayLine, RiStarLine } from 'react-icons/ri';
import { Movie } from '../types';
import { navigate } from '../router';
import { personPathFromTmdbId } from '../utils/ids';
import { CaptchaWidget } from '../components/CaptchaWidget';

function formatDate(iso?: string) {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MoviePage({ id }: { id: string }) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [lists, setLists] = useState<{ favorite: boolean; watchlist: boolean } | null>(null);
  const [captchaToken, setCaptchaToken] = useState('');
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // Load from the local DB first; the server will enrich missing fields opportunistically.
        const res = await fetch(`/api/movies/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Movie;
        if (alive) setMovie(data);
      } catch (e: any) {
        if (alive) setError(e?.message || 'Failed to load movie');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const m = await fetch('/api/me', { cache: 'no-store' }).then((r) => r.json());
        if (!alive) return;
        setMe(m?.user || null);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!me) return;
      try {
        const res = await fetch(`/api/me/lists/contains?movieId=${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setLists({ favorite: !!data.favorite, watchlist: !!data.watchlist });
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [me, id]);

  const ratingChips = useMemo(() => {
    if (!movie?.ratings?.length) return [];
    return movie.ratings.slice(0, 6).map((r) => {
      const label =
        r.scale === 100
          ? `${r.source.toUpperCase()} ${Math.round(r.value)}%`
          : `${r.source.toUpperCase()} ${r.value.toFixed(1)}/${r.scale}`;
      return { label, url: r.url };
    });
  }, [movie]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowLeftLine  /></span>
          Back
        </button>
        <span className="inline-pill">Movie</span>
      </div>

      {loading && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {!loading && movie && (
        <>
          <div className="hero" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <div className="hero-card" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 16 }}>
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    style={{
                      width: '100%',
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.08)'
                    }}
                  />
                ) : (
                  <div className="detail">No poster</div>
                )}
                <div>
                  <h1 style={{ margin: 0, fontSize: 30 }}>{movie.title}</h1>
                  <div className="meta" style={{ marginTop: 10 }}>
                    <span className="status">{movie.status}</span>
                    <span className="chip">{movie.language}</span>
                    <span className="chip">{formatDate(movie.releaseDate)}</span>
                    {typeof movie.rating === 'number' ? (
                      <span className="rating">
                        <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiStarLine  /></span>
                        {movie.rating.toFixed(1)}/10
                      </span>
                    ) : null}
                  </div>
                  <div className="meta" style={{ marginTop: 10 }}>
                    {movie.genres.slice(0, 8).map((g) => (
                      <span key={g} className="chip">
                        {g}
                      </span>
                    ))}
                  </div>
                  {movie.trailerUrl && (
                    <a
                      className="ghost-button"
                      href={`/trailer/${encodeURIComponent(id)}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        navigate(`/trailer/${encodeURIComponent(id)}`);
                      }}
                      style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center' }}
                    >
                      <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiPlayLine  /></span>
                      Trailer
                    </a>
                  )}

                  <div className="meta" style={{ marginTop: 12 }}>
                    {!me ? (
                      <>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => navigate(`/movie/${encodeURIComponent(id)}/reviews`)}
                        >
                          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiChat3Line  /></span>
                          Reviews
                        </button>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={() => navigate(`/login?next=${encodeURIComponent(`/movie/${encodeURIComponent(id)}/reviews`)}`)}
                        >
                          Login to review
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="chip"
                          onClick={() => navigate(`/movie/${encodeURIComponent(id)}/reviews`)}
                          title="User ratings & reviews"
                        >
                          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiChat3Line  /></span>
                          Reviews
                        </button>

                        <button
                          type="button"
                          className={`chip toggle-chip ${lists?.favorite ? 'is-active is-favorite' : ''}`}
                          onClick={async () => {
                            setActionMsg(null);
                            try {
                              const target = lists?.favorite ? 'remove' : 'add';
                              const url = lists?.favorite
                                ? `/api/me/favorites/${encodeURIComponent(id)}`
                                : '/api/me/favorites';
                              const res = await fetch(url, {
                                method: lists?.favorite ? 'DELETE' : 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ movieId: id, captchaToken })
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                              setLists((s) => ({ favorite: target === 'add', watchlist: !!s?.watchlist }));
                              setActionMsg(target === 'add' ? 'Added to favorites.' : 'Removed from favorites.');
                            } catch (e: any) {
                              setActionMsg(`Failed: ${e?.message || 'error'}`);
                            }
                          }}
                        >
                          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiHeart3Line  /></span>
                          {lists?.favorite ? 'Favorited' : 'Favorite'}
                        </button>

                        <button
                          type="button"
                          className={`chip toggle-chip ${lists?.watchlist ? 'is-active is-watchlist' : ''}`}
                          onClick={async () => {
                            setActionMsg(null);
                            try {
                              const target = lists?.watchlist ? 'remove' : 'add';
                              const url = lists?.watchlist
                                ? `/api/me/watchlist/${encodeURIComponent(id)}`
                                : '/api/me/watchlist';
                              const res = await fetch(url, {
                                method: lists?.watchlist ? 'DELETE' : 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ movieId: id, captchaToken })
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                              setLists((s) => ({ watchlist: target === 'add', favorite: !!s?.favorite }));
                              setActionMsg(target === 'add' ? 'Added to watchlist.' : 'Removed from watchlist.');
                            } catch (e: any) {
                              setActionMsg(`Failed: ${e?.message || 'error'}`);
                            }
                          }}
                        >
                          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiListCheck2  /></span>
                          {lists?.watchlist ? 'In watchlist' : 'Watchlist'}
                        </button>
                      </>
                    )}
                  </div>
                  {me ? (
                    <div className="detail" style={{ marginTop: 12 }}>
                      <h4>Captcha</h4>
                      <div className="tagline">Required for favorites/watchlist.</div>
                      <div style={{ marginTop: 10 }}>
                        <CaptchaWidget onToken={(t) => setCaptchaToken(t)} compact />
                      </div>
                      {actionMsg ? <div className="tagline" style={{ marginTop: 10 }}>{actionMsg}</div> : null}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="detail" style={{ marginTop: 14 }}>
                <h4>Synopsis</h4>
                <div className="tagline">{movie.synopsis || 'Synopsis not available yet.'}</div>
              </div>
            </div>

            <div className="hero-card" style={{ padding: 18, background: 'rgba(10, 15, 31, 0.7)' }}>
              <div className="section-header" style={{ marginTop: 0 }}>
                <h3>Cast</h3>
                <span className="inline-pill">{movie.cast.length}</span>
              </div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                {movie.cast.slice(0, 12).map((c) => (
                  <a
                    key={`${c.name}-${c.tmdbId || c.personId || ''}`}
                    className="detail"
                    href={c.tmdbId || c.personId ? personPathFromTmdbId(c.tmdbId || c.personId!) : '#'}
                    onClick={(e) => {
                      const pid = c.tmdbId || c.personId;
                      if (!pid) return;
                      e.preventDefault();
                      navigate(personPathFromTmdbId(pid));
                    }}
                    style={{ padding: 10, display: 'grid', gridTemplateColumns: '44px 1fr', gap: 10 }}
                    title={c.tmdbId || c.personId ? 'Open profile' : 'No profile available'}
                  >
                    {c.profileImage ? (
                      <img
                        src={c.profileImage}
                        alt={c.name}
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 12,
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.10)'
                        }}
                        loading="lazy"
                      />
                    ) : (
                      <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{c.name}</div>
                      <div className="tagline">{c.character || ''}</div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {(ratingChips.length > 0 || (movie.reviews?.length || 0) > 0) && (
            <div className="detail" style={{ marginTop: 16 }}>
              <h4>Ratings &amp; Reviews</h4>
              {ratingChips.length > 0 && (
                <div className="meta" style={{ marginTop: 10 }}>
                  {ratingChips.map((c) =>
                    c.url ? (
                      <a
                        key={c.label}
                        className="chip"
                        href={c.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        {c.label}
                        <RiExternalLinkLine size={14} />
                      </a>
                    ) : (
                      <span key={c.label} className="chip">
                        {c.label}
                      </span>
                    )
                  )}
                </div>
              )}
              {movie.reviews && movie.reviews.length > 0 && (
                <div className="song-list" style={{ marginTop: 12 }}>
                  {movie.reviews.slice(0, 6).map((rv, i) => (
                    <div key={`${rv.source}-${rv.author || ''}-${i}`} className="song">
                      <div>
                        <strong>{rv.source.toUpperCase()}</strong>
                        <div className="tagline">
                          {rv.author ? `${rv.author} · ` : ''}
                          {rv.excerpt}
                        </div>
                      </div>
                      {rv.url ? (
                        <a href={rv.url} target="_blank" rel="noreferrer">
                          Read
                        </a>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="detail" style={{ marginTop: 16 }}>
            <h4>Where to watch</h4>
            <div className="meta" style={{ marginTop: 10 }}>
              {(movie.ott || []).length ? (
                (movie.ott || []).slice(0, 12).map((o) => {
                  const p = String(o.provider || '').toLowerCase();
                  const title = encodeURIComponent(movie.title);
                  const direct =
                    p === 'netflix'
                      ? `https://www.netflix.com/search?q=${title}`
                      : p === 'prime video' || p === 'amazon prime video'
                        ? `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`
                        : p === 'hotstar' || p === 'disney+ hotstar'
                          ? `https://www.hotstar.com/in/search?q=${title}`
                          : p === 'zee5'
                            ? `https://www.zee5.com/search?q=${title}`
                            : p === 'sonyliv'
                              ? `https://www.sonyliv.com/search/${title}`
                              : p === 'jiocinema'
                                ? `https://www.jiocinema.com/search/${title}`
                                : '';

                  const out = o.deepLink || direct || o.url || '';
                  return (
                    <a
                      key={`${o.provider}-${o.type}`}
                      className="chip"
                      href={out || '#'}
                      target={out ? '_blank' : undefined}
                      rel={out ? 'noreferrer' : undefined}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                      title={out ? 'Open provider' : 'No link available'}
                    >
                      {o.logo ? (
                        <img
                          src={o.logo}
                          alt=""
                          style={{ width: 16, height: 16, borderRadius: 4, objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : null}
                      {o.provider}
                      {o.type ? ` · ${o.type}` : ''}
                      {out ? <RiExternalLinkLine size={14} /> : null}
                    </a>
                  );
                })
              ) : (
                <>
                  <span className="tagline">No streaming links found yet. Try searching:</span>
                  {(() => {
                    const title = encodeURIComponent(movie.title);
                    const suggestions = [
                      { label: 'Netflix', url: `https://www.netflix.com/search?q=${title}` },
                      { label: 'Prime Video', url: `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}` },
                      { label: 'Hotstar', url: `https://www.hotstar.com/in/search?q=${title}` },
                      { label: 'ZEE5', url: `https://www.zee5.com/search?q=${title}` },
                      { label: 'SonyLIV', url: `https://www.sonyliv.com/search/${title}` },
                      { label: 'JioCinema', url: `https://www.jiocinema.com/search/${title}` }
                    ];
                    return suggestions.map((s) => (
                      <a
                        key={s.label}
                        className="chip"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
                        title={`Search on ${s.label}`}
                      >
                        {s.label}
                        <RiExternalLinkLine size={14} />
                      </a>
                    ));
                  })()}
                </>
              )}
            </div>
          </div>

          <div className="detail" style={{ marginTop: 16 }}>
            <div className="meta" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
              <h4 style={{ margin: 0 }}>Songs</h4>
              <button
                className="ghost-button"
                type="button"
                onClick={async () => {
                  setLoading(true);
                  setError(null);
                  try {
                    const res = await fetch(`/api/movies/${encodeURIComponent(id)}?refresh=1`, { cache: 'no-store' });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                    setMovie(data);
                  } catch (e: any) {
                    setError(e?.message || 'Failed to refresh');
                  } finally {
                    setLoading(false);
                  }
                }}
                title="Refresh songs and streaming providers"
              >
                Refresh
              </button>
            </div>
            {(movie.songs || []).length ? (
              <div className="song-list" style={{ marginTop: 12 }}>
                {(movie.songs || []).slice(0, 12).map((s) => (
                  <div key={s.id} className="song">
                    <div>
                      <strong>{s.title}</strong>
                      <div className="tagline">
                        {(s.singers || []).join(', ')}
                        {s.platform ? ` · ${s.platform}` : ''}
                      </div>
                    </div>
                    <a
                      href={`/song/${encodeURIComponent(s.id)}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        navigate(`/song/${encodeURIComponent(s.id)}`);
                      }}
                      title={s.youtubeUrl ? 'Play' : 'Open player (will offer search if link is missing)'}
                    >
                      Play
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tagline" style={{ marginTop: 10 }}>
                No songs found yet.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
