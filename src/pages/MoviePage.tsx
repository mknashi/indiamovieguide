import { useEffect, useMemo, useRef, useState } from 'react';
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
  const [songsRefreshing, setSongsRefreshing] = useState(false);
  const songPollToken = useRef(0);

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

  // Lazy-load songs: movie details should render quickly, while songs/links refresh in the background.
  // We poll a few times so the UI updates without the user needing a manual refresh.
  useEffect(() => {
    if (!movie) return;
    const songs = movie.songs || [];
    const need = songs.length === 0 || songs.every((s) => !s.youtubeUrl);
    if (!need) {
      setSongsRefreshing(false);
      return;
    }

    const token = ++songPollToken.current;
    setSongsRefreshing(true);

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      for (let i = 0; i < 6; i++) {
        await sleep(i === 0 ? 800 : 1500);
        if (songPollToken.current !== token) return;
        try {
          const res = await fetch(`/api/movies/${encodeURIComponent(id)}`, { cache: 'no-store' });
          if (!res.ok) return;
          const data = (await res.json()) as Movie;
          if (songPollToken.current !== token) return;
          setMovie(data);
          const s = data.songs || [];
          const still = s.length === 0 || s.every((x) => !x.youtubeUrl);
          if (!still) {
            setSongsRefreshing(false);
            return;
          }
        } catch {
          // ignore
        }
      }
      if (songPollToken.current === token) setSongsRefreshing(false);
    })();

    return () => {
      // Invalidate outstanding polls when navigating away.
      if (songPollToken.current === token) songPollToken.current++;
    };
  }, [id, movie?.id]);

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
          <section className="movie-hero">
            <div
              className="movie-hero-bg"
              style={{
                backgroundImage: `url(${movie.backdrop || movie.poster || ''})`
              }}
            />
            <div className="movie-hero-inner">
              <div className="movie-poster">
                {movie.poster ? (
                  <img
                    src={movie.poster}
                    alt={movie.title}
                    style={{
                      width: '100%',
                      borderRadius: 16,
                      border: '1px solid rgba(255,255,255,0.10)',
                      display: 'block'
                    }}
                    loading="lazy"
                  />
                ) : (
                  <div className="detail">No poster</div>
                )}
              </div>

              <div className="movie-hero-content">
                <h1 className="movie-title">{movie.title}</h1>
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
                  {movie.genres.slice(0, 10).map((g) => (
                    <span key={g} className="chip">
                      {g}
                    </span>
                  ))}
                </div>

                <div className="meta" style={{ marginTop: 12 }}>
                  {movie.trailerUrl ? (
                    <a
                      className="ghost-button"
                      href={`/trailer/${encodeURIComponent(id)}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        navigate(`/trailer/${encodeURIComponent(id)}`);
                      }}
                    >
                      <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiPlayLine  /></span>
                      Trailer
                    </a>
                  ) : (
                    <span className="chip">Trailer: TBA</span>
                  )}

                  <button
                    className="ghost-button"
                    type="button"
                    onClick={() => navigate(`/movie/${encodeURIComponent(id)}/reviews`)}
                  >
                    <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiChat3Line  /></span>
                    Reviews
                  </button>

                  {!me ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => navigate(`/login?next=${encodeURIComponent(`/movie/${encodeURIComponent(id)}`)}`)}
                    >
                      Login
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={`chip toggle-chip ${lists?.favorite ? 'is-active is-favorite' : ''}`}
                        onClick={async () => {
                          setActionMsg(null);
                          try {
                            const target = lists?.favorite ? 'remove' : 'add';
                            const url = lists?.favorite ? `/api/me/favorites/${encodeURIComponent(id)}` : '/api/me/favorites';
                            const res = await fetch(url, {
                              method: lists?.favorite ? 'DELETE' : 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ movieId: id, captchaToken })
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                            setLists((s) => ({ favorite: target === 'add', watchlist: !!s?.watchlist }));
                            setActionMsg(target === 'add' ? 'Added to favorites.' : 'Removed from favorites.');
                          } catch (e) {
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
                            const url = lists?.watchlist ? `/api/me/watchlist/${encodeURIComponent(id)}` : '/api/me/watchlist';
                            const res = await fetch(url, {
                              method: lists?.watchlist ? 'DELETE' : 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ movieId: id, captchaToken })
                            });
                            const data = await res.json().catch(() => ({}));
                            if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                            setLists((s) => ({ watchlist: target === 'add', favorite: !!s?.favorite }));
                            setActionMsg(target === 'add' ? 'Added to watchlist.' : 'Removed from watchlist.');
                          } catch (e) {
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
                  <details className="detail movie-captcha" style={{ marginTop: 12 }}>
                    <summary className="tagline" style={{ cursor: 'pointer' }}>
                      Human check (required for favorites/watchlist)${captchaToken ? ' · Verified' : ''}
                    </summary>
                    <div style={{ marginTop: 10 }}>
                      <CaptchaWidget onToken={(t) => setCaptchaToken(t)} />
                    </div>
                    {actionMsg ? <div className="tagline" style={{ marginTop: 10 }}>{actionMsg}</div> : null}
                  </details>
                ) : actionMsg ? (
                  <div className="tagline" style={{ marginTop: 10 }}>{actionMsg}</div>
                ) : null}
              </div>
            </div>
          </section>

          <div className="movie-grid-layout">
            <div className="movie-main">
              <div className="detail movie-section">
                <h4>Synopsis</h4>
                <div className="tagline">{movie.synopsis || 'Synopsis not available yet.'}</div>
              </div>

              <div className="detail movie-section">
                <div className="meta" style={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <h4 style={{ margin: 0 }}>Songs</h4>
                  {songsRefreshing ? (
                    <span
                      className="chip"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 10 }}
                      title="Fetching songs/links in the background"
                    >
                      <span className="spinner" />
                      Refreshing…
                    </span>
                  ) : null}
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
                        setMovie(data as Movie);
                      } catch (e) {
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
                    {(movie.songs || []).slice(0, 14).map((s) => (
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
                  <div className="tagline" style={{ marginTop: 10 }}>No songs saved yet.</div>
                )}
              </div>
            </div>

            <aside className="movie-side">
              <div className="detail movie-section">
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
                    <div className="tagline">No streaming links found yet.</div>
                  )}
                </div>
              </div>

              {(ratingChips.length > 0 || (movie.reviews?.length || 0) > 0) ? (
                <div className="detail movie-section">
                  <h4>Ratings &amp; Reviews</h4>
                  {ratingChips.length > 0 ? (
                    <div className="meta" style={{ marginTop: 10 }}>
                      {ratingChips.map((c) =>
                        c.url ? (
                          <a key={c.label} className="chip" href={c.url} target="_blank" rel="noreferrer">
                            {c.label} <RiExternalLinkLine size={14} />
                          </a>
                        ) : (
                          <span key={c.label} className="chip">
                            {c.label}
                          </span>
                        )
                      )}
                    </div>
                  ) : null}
                  {movie.reviews && movie.reviews.length > 0 ? (
                    <div className="song-list" style={{ marginTop: 12 }}>
                      {movie.reviews.slice(0, 4).map((rv, i) => (
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
                  ) : null}
                </div>
              ) : null}
            </aside>
          </div>

          <div className="detail movie-section">
            <div className="section-header" style={{ marginTop: 0 }}>
              <h3>Cast</h3>
              <span className="inline-pill">{movie.cast.length}</span>
            </div>
            <div className="movie-cast-grid">
              {movie.cast.slice(0, 18).map((c) => {
                const pid = c.tmdbId || c.personId;
                const href = pid ? personPathFromTmdbId(pid) : '#';
                return (
                  <a
                    key={`${c.name}-${String(pid || '')}`}
                    className="movie-cast-card"
                    href={href}
                    onClick={(e) => {
                      if (!pid) return;
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      navigate(href);
                    }}
                    title={pid ? 'Open profile' : 'No profile available'}
                  >
                    {c.profileImage ? (
                      <img
                        src={c.profileImage}
                        alt={c.name}
                        loading="lazy"
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 16,
                          objectFit: 'cover',
                          border: '1px solid rgba(255,255,255,0.10)'
                        }}
                      />
                    ) : (
                      <div className="chip" style={{ width: 56, height: 56, borderRadius: 16 }} />
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="movie-cast-name">{c.name}</div>
                      <div className="tagline" style={{ marginTop: 4 }}>{c.character || ''}</div>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
