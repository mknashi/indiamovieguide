import { useEffect, useMemo, useState } from 'react';
import {
  RiArrowRightUpLine,
  RiTimeLine,
  RiFireLine,
  RiCalendarLine,
  RiApps2Line,
  RiBookmarkLine,
  RiArticleLine,
  RiUserStarLine,
  RiBookOpenLine,
} from 'react-icons/ri';
import { fetchHome, HomePayload } from '../services/agent';
import { Movie } from '../types';
import { MovieCard } from '../components/MovieCard';
import { FeaturedMovieBanner } from '../components/FeaturedMovieBanner';
import { navigate } from '../router';
import { personPathFromTmdbId } from '../utils/ids';
import { LANGUAGE_INTROS, LANGUAGE_COLORS } from '../data/languageContent';
import { ARTICLES } from '../data/articles';

type SpotlightGroup = {
  language: 'Hindi' | 'Kannada' | 'Telugu' | string;
  persons: { tmdbId: number; name: string; profileImage?: string }[];
};

// Module-level cache — seeded from server-injected __INITIAL_DATA__ on first load.
const homeInitialCache = new Map<string, { data: HomePayload; ts: number }>();
const HOME_INITIAL_TTL = 5 * 60 * 1000;

if (typeof window !== 'undefined') {
  const d = (window as any).__INITIAL_DATA__;
  if (d?._route === 'home' && d._key) {
    homeInitialCache.set(d._key, { data: d as HomePayload, ts: Date.now() });
    delete (window as any).__INITIAL_DATA__;
  }
}

function getHomeCached(key: string): HomePayload | null {
  const c = homeInitialCache.get(key);
  return c && Date.now() - c.ts < HOME_INITIAL_TTL ? c.data : null;
}

export function HomePage({ lang, refresh }: { lang?: string; refresh?: boolean }) {
  const initialData = !lang && !refresh ? getHomeCached('home:all') : null;
  const [loading, setLoading] = useState(!initialData);
  const [homeNew, setHomeNew] = useState<Movie[]>(initialData?.sections?.new || []);
  const [homeUpcoming, setHomeUpcoming] = useState<Movie[]>(initialData?.sections?.upcoming || []);
  const [genres, setGenres] = useState<{ genre: string; count: number }[]>(initialData?.categories?.genres || []);
  const [spotlight, setSpotlight] = useState<SpotlightGroup[]>([]);
  const [featured, setFeatured] = useState<any>(null);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [genreMovies, setGenreMovies] = useState<Movie[]>([]);
  const [genrePage, setGenrePage] = useState(1);
  const [genreHasMore, setGenreHasMore] = useState(false);
  const [genreTotal, setGenreTotal] = useState<number | null>(null);

  useEffect(() => {
    setActiveGenre(null);
    setGenreMovies([]);
    setGenrePage(1);
    setGenreHasMore(false);
    setGenreTotal(null);

    // Skip fetch if server-injected initial data covers this view.
    if (!lang && !refresh && getHomeCached('home:all')) {
      const cached = getHomeCached('home:all')!;
      setHomeNew(cached.sections?.new || []);
      setHomeUpcoming(cached.sections?.upcoming || []);
      setGenres(cached.categories?.genres || []);
      setLoading(false);
      return;
    }

    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const payload = await fetchHome(lang, { refresh: !!refresh });
        if (!alive) return;
        setHomeNew(payload?.sections?.new || []);
        setHomeUpcoming(payload?.sections?.upcoming || []);
        setGenres(payload?.categories?.genres || []);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang, refresh]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = lang ? `/api/spotlight?lang=${encodeURIComponent(lang)}` : '/api/spotlight';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setSpotlight(Array.isArray(data.groups) ? data.groups : []);
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, [lang]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const url = lang ? `/api/featured?lang=${encodeURIComponent(lang)}` : '/api/featured';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!alive) return;
        setFeatured(data.featured || null);
      } catch {
        // ignore
      }
    })();
    return () => { alive = false; };
  }, [lang]);

  const newSorted = useMemo(() => {
    return homeNew.slice().sort((a, b) => {
      const ar = typeof a.rating === 'number' ? a.rating : -1;
      const br = typeof b.rating === 'number' ? b.rating : -1;
      if (br !== ar) return br - ar;
      const ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return bd - ad;
    });
  }, [homeNew]);

  const upcomingSorted = useMemo(() => {
    return homeUpcoming.slice().sort((a, b) => {
      const ad = a.releaseDate ? new Date(a.releaseDate).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.releaseDate ? new Date(b.releaseDate).getTime() : Number.POSITIVE_INFINITY;
      if (ad !== bd) return ad - bd;
      const ar = typeof a.rating === 'number' ? a.rating : -1;
      const br = typeof b.rating === 'number' ? b.rating : -1;
      return br - ar;
    });
  }, [homeUpcoming]);

  const browseSorted = useMemo(() => {
    return genreMovies.slice().sort((a, b) => {
      const ar = typeof a.rating === 'number' ? a.rating : -1;
      const br = typeof b.rating === 'number' ? b.rating : -1;
      if (br !== ar) return br - ar;
      const ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return bd - ad;
    });
  }, [genreMovies]);

  const fetchGenrePage = async (nextGenre: string, page: number) => {
    const params = new URLSearchParams();
    params.set('genre', nextGenre);
    if (lang) params.set('lang', lang);
    params.set('page', String(page));
    params.set('pageSize', String(24));
    const res = await fetch(`/api/browse?${params.toString()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };

  return (
    <div>
      <section className="hero">
        {lang && LANGUAGE_INTROS[lang] ? (() => {
          const colors = LANGUAGE_COLORS[lang];
          const intro = LANGUAGE_INTROS[lang];
          return (
            <div
              className="hero-card"
              style={{
                background: colors?.bg,
                borderColor: colors?.border,
              }}
            >
              {colors && (
                <span
                  className="inline-pill"
                  style={{
                    background: colors.accent,
                    color: '#fff',
                    border: 'none',
                    marginBottom: 12,
                    display: 'inline-block',
                  }}
                >
                  {colors.industry}
                </span>
              )}
              <h1 style={{ marginTop: 8 }}>{intro.headline}</h1>
              {intro.body.map((para, i) => (
                <p key={i} className="tagline" style={{ lineHeight: 1.8, marginTop: i === 0 ? 10 : 10 }}>
                  {para}
                </p>
              ))}
              <div className="badges" style={{ marginTop: 16 }}>
                <a className="badge" href="#new"><RiFireLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />New</a>
                <a className="badge" href="#upcoming"><RiCalendarLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Upcoming</a>
                <a className="badge" href="#genres"><RiApps2Line size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Genres</a>
                <a className="badge" href={`/lists?lang=${encodeURIComponent(lang!)}`} onClick={(e) => { e.preventDefault(); navigate(`/lists?lang=${encodeURIComponent(lang!)}`); }}><RiBookmarkLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Film Guides</a>
                <a className="badge" href="/articles" onClick={(e) => { e.preventDefault(); navigate('/articles'); }}><RiArticleLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Articles</a>
              </div>
            </div>
          );
        })() : (
          <div className="hero-card">
            <h1>Your bold, fast guide to Indian cinema</h1>
            <p>
              India produces more films per year than any other country, spanning eight major
              language industries — Bollywood, Kollywood, Tollywood, Mollywood, Sandalwood, Marathi,
              Bengali, and Punjabi — each with its own stars, studios, storytelling traditions, and
              devoted global audience. IndiaMovieGuide is your one-stop companion for discovering
              what to watch across all of them.
            </p>
            <p>
              Browse new theatrical releases and upcoming titles, explore full cast profiles with
              filmographies and bios, find where to stream on Netflix, Prime Video, Disney+ Hotstar,
              JioCinema, ZEE5, SonyLIV, and more — all in one place, updated continuously.
            </p>
            <div className="badges">
              <a className="badge" href="#new"><RiFireLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />New</a>
              <a className="badge" href="#upcoming"><RiCalendarLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Upcoming</a>
              <a className="badge" href="#genres"><RiApps2Line size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Genres</a>
              <a className="badge" href="/lists" onClick={(e) => { e.preventDefault(); navigate('/lists'); }}><RiBookmarkLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Film Guides</a>
              <a className="badge" href="/articles" onClick={(e) => { e.preventDefault(); navigate('/articles'); }}><RiArticleLine size={13} style={{ marginRight: 5, verticalAlign: 'middle' }} />Articles</a>
            </div>
            <div className="detail hero-tips" style={{ marginTop: 16 }}>
              <h4 style={{ marginTop: 0 }}>Quick tips</h4>
              <div className="meta" style={{ marginTop: 10 }}>
                <span className="chip">Search by actor, genre, or language</span>
                <span className="chip">Misspellings OK (sounds-like search)</span>
                <span className="chip">Click cast photos to open profiles</span>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="hero-card" style={{ background: 'rgba(10, 15, 31, 0.7)' }}>
            <div className="section-header" style={{ marginTop: 0 }}>
              <h3><RiUserStarLine size={18} style={{ marginRight: 7, verticalAlign: 'middle', opacity: 0.85 }} />Star Power</h3>
              <span className="inline-pill">Popular actors</span>
            </div>
            <div className="grid star-power-grid">
              {spotlight.flatMap((g) => g.persons.map((p) => ({ ...p, group: g.language }))).slice(0, 9).map((p) => (
                <a
                  key={`${p.tmdbId}-${p.name}`}
                  className="detail"
                  href={personPathFromTmdbId(p.tmdbId)}
                  onClick={(e) => {
                    e.preventDefault();
                    navigate(personPathFromTmdbId(p.tmdbId));
                  }}
                  style={{ padding: 10, textAlign: 'left' }}
                  title={`Open ${p.name}`}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 10, alignItems: 'center' }}>
                    {p.profileImage ? (
                      <img
                        src={p.profileImage}
                        alt={p.name}
                        className="star-power-avatar"
                        loading="lazy"
                      />
                    ) : (
                      <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 700, lineHeight: 1.1 }}>{p.name}</div>
                      <div className="tagline">{p.group}</div>
                    </div>
                  </div>
                </a>
              ))}
            </div>
            <div className="tagline" style={{ marginTop: 10 }}>
              Click an actor to open their profile.
            </div>
          </div>

          {(() => {
            const cinemaArticles = (lang
              ? ARTICLES.filter((a) => a.lang === lang)
              : ARTICLES).slice(0, 2);
            if (cinemaArticles.length === 0) return null;
            return (
              <div className="hero-card" style={{ background: 'rgba(10, 15, 31, 0.7)', padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}><RiBookOpenLine size={14} />Cinema Reads</span>
                  <button className="ghost-button" type="button" style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => navigate('/articles')}>All →</button>
                </div>
                {cinemaArticles.map((article, i) => {
                  const langKey = Object.keys(LANGUAGE_COLORS).find((k) =>
                    article.industry.toLowerCase().includes(k.toLowerCase())
                  );
                  const colors = langKey ? LANGUAGE_COLORS[langKey] : null;
                  const href = `/article/${encodeURIComponent(article.slug)}`;
                  return (
                    <a
                      key={article.slug}
                      href={href}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                        e.preventDefault();
                        navigate(href);
                      }}
                      style={{
                        display: 'block',
                        textDecoration: 'none',
                        color: 'inherit',
                        padding: '8px 0',
                        borderTop: i > 0 ? '1px solid var(--border)' : 'none',
                      }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.35 }}>{article.title}</div>
                      {colors && (
                        <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: colors.accent, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>
                          {article.industry} · {article.readingTime}
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            );
          })()}
        </div>
      </section>

      {featured && (
        <div style={{ marginBottom: 8 }}>
          <FeaturedMovieBanner movie={featured} />
        </div>
      )}

      <div className="section-header" id="new">
        <h3><RiFireLine size={18} style={{ marginRight: 7, verticalAlign: 'middle', opacity: 0.85 }} />New</h3>
        <span className="inline-pill">{newSorted.length} titles</span>
      </div>
      {loading ? (
        <div className="tagline">Loading…</div>
      ) : (
        <div className="grid">
          {newSorted.slice(0, 12).map((m) => (
            <div key={m.id}>
              <MovieCard movie={m} />
            </div>
          ))}
        </div>
      )}

      <div className="section-header" id="upcoming">
        <h3><RiCalendarLine size={18} style={{ marginRight: 7, verticalAlign: 'middle', opacity: 0.85 }} />Upcoming</h3>
        <span className="inline-pill">{upcomingSorted.length} titles</span>
      </div>
      <div className="grid">
        {upcomingSorted.slice(0, 12).map((m) => (
          <div key={m.id}>
            <MovieCard movie={m} />
          </div>
        ))}
      </div>

      <div className="section-header" id="genres">
        <h3><RiApps2Line size={18} style={{ marginRight: 7, verticalAlign: 'middle', opacity: 0.85 }} />Genres</h3>
        <span className="inline-pill">{lang ? `${lang}` : 'All languages'}</span>
      </div>
      <div className="detail">
        <div className="meta" style={{ flexWrap: 'wrap' }}>
          {genres.slice(0, 24).map((g) => (
            <button
              key={g.genre}
              type="button"
              className={`filter ${activeGenre === g.genre ? 'active' : ''}`}
              onClick={async () => {
                const next = activeGenre === g.genre ? null : g.genre;
                setActiveGenre(next);
                setGenreMovies([]);
                setGenrePage(1);
                setGenreHasMore(false);
                setGenreTotal(null);
                if (!next) return;
                setLoading(true);
                try {
                  const payload = await fetchGenrePage(next, 1);
                  const rows = Array.isArray(payload.movies) ? payload.movies : [];
                  setGenreMovies(rows);
                  setGenrePage(Number(payload.page || 1) || 1);
                  setGenreHasMore(!!payload.hasMore);
                  setGenreTotal(typeof payload.total === 'number' ? payload.total : null);
                } finally {
                  setLoading(false);
                }
              }}
            >
              {g.genre} <span className="tagline">({g.count})</span>
            </button>
          ))}
        </div>
        {activeGenre && (
          <div style={{ marginTop: 12 }} className="tagline">
            Showing <strong>{activeGenre}</strong> titles{' '}
            <a href="#browse-results" style={{ textDecoration: 'underline' }}>
              <span style={{marginRight: 4, display: 'inline-flex', alignItems: 'center'}}><RiArrowRightUpLine  /></span>
              jump to results
            </a>
          </div>
        )}
      </div>

      {activeGenre && (
        <>
          <div className="section-header" id="browse-results">
            <h3>
              {activeGenre} {lang ? `· ${lang}` : ''}
            </h3>
            <span className="inline-pill">
              {genreTotal != null ? `${browseSorted.length} / ${genreTotal}` : `${browseSorted.length} titles`}
            </span>
          </div>
          <div className="grid">
            {browseSorted.map((m) => (
              <div key={m.id}>
                <MovieCard movie={m} />
              </div>
            ))}
          </div>

          {genreHasMore ? (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button
                className="ghost-button"
                type="button"
                disabled={loading}
                onClick={async () => {
                  if (!activeGenre) return;
                  setLoading(true);
                  try {
                    const nextPage = genrePage + 1;
                    const payload = await fetchGenrePage(activeGenre, nextPage);
                    const rows = Array.isArray(payload.movies) ? payload.movies : [];
                    setGenreMovies((prev) => {
                      const seen = new Set(prev.map((x) => x.id));
                      const merged = prev.slice();
                      for (const r of rows) {
                        if (r?.id && !seen.has(r.id)) merged.push(r);
                      }
                      return merged;
                    });
                    setGenrePage(Number(payload.page || nextPage) || nextPage);
                    setGenreHasMore(!!payload.hasMore);
                    setGenreTotal(typeof payload.total === 'number' ? payload.total : genreTotal);
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
