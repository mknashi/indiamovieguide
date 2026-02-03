import { useEffect, useMemo, useState } from 'react';
import { RiArrowRightUpLine } from 'react-icons/ri';
import { fetchHome } from '../services/agent';
import { Movie } from '../types';
import { MovieCard } from '../components/MovieCard';
import { navigate } from '../router';
import { personPathFromTmdbId } from '../utils/ids';

type SpotlightGroup = {
  language: 'Hindi' | 'Kannada' | 'Telugu' | string;
  persons: { tmdbId: number; name: string; profileImage?: string }[];
};

export function HomePage({ lang }: { lang?: string }) {
  const [loading, setLoading] = useState(false);
  const [homeNew, setHomeNew] = useState<Movie[]>([]);
  const [homeUpcoming, setHomeUpcoming] = useState<Movie[]>([]);
  const [genres, setGenres] = useState<{ genre: string; count: number }[]>([]);
  const [spotlight, setSpotlight] = useState<SpotlightGroup[]>([]);
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [genreMovies, setGenreMovies] = useState<Movie[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setActiveGenre(null);
      setGenreMovies([]);
      try {
        const payload = await fetchHome(lang);
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
  }, [lang]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/spotlight', { cache: 'no-store' });
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
  }, []);

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

  return (
    <div>
      <section className="hero">
        <div className="hero-card">
          <h1>Your bold, fast guide to Indian cinema</h1>
          <p>
            Browse new and upcoming releases, explore cast profiles, and jump into trailers, OTT
            links, songs, ratings, and reviews.
          </p>
          <div className="badges">
            <a className="badge" href="#new">
              New
            </a>
            <a className="badge" href="#upcoming">
              Upcoming
            </a>
            <a className="badge" href="#genres">
              Genres
            </a>
          </div>

          <div className="detail" style={{ marginTop: 16 }}>
            <h4 style={{ marginTop: 0 }}>Quick tips</h4>
            <div className="meta" style={{ marginTop: 10 }}>
              <span className="chip">Search by actor, genre, or language</span>
              <span className="chip">Misspellings OK (sounds-like search)</span>
              <span className="chip">Click cast photos to open profiles</span>
            </div>
          </div>
        </div>

        <div className="hero-card" style={{ background: 'rgba(10, 15, 31, 0.7)' }}>
          <div className="section-header" style={{ marginTop: 0 }}>
            <h3>Star Power</h3>
            <span className="inline-pill">Popular actors</span>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
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
      </section>

      <div className="section-header" id="new">
        <h3>New</h3>
        <span className="inline-pill">{newSorted.length} titles</span>
      </div>
      {loading ? (
        <div className="tagline">Loading…</div>
      ) : (
        <div className="grid">
          {newSorted.slice(0, 12).map((m) => (
            <MovieCard key={m.id} movie={m} />
          ))}
        </div>
      )}

      <div className="section-header" id="upcoming">
        <h3>Upcoming</h3>
        <span className="inline-pill">{upcomingSorted.length} titles</span>
      </div>
      <div className="grid">
        {upcomingSorted.slice(0, 12).map((m) => (
          <MovieCard key={m.id} movie={m} />
        ))}
      </div>

      <div className="section-header" id="genres">
        <h3>Genres</h3>
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
                if (!next) return;
                setLoading(true);
                try {
                  const params = new URLSearchParams();
                  params.set('genre', next);
                  if (lang) params.set('lang', lang);
                  const res = await fetch(`/api/browse?${params.toString()}`, { cache: 'no-store' });
                  if (!res.ok) return;
                  const payload = await res.json();
                  setGenreMovies(Array.isArray(payload.movies) ? payload.movies : []);
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
              <RiArrowRightUpLine style={{ marginRight: 4, verticalAlign: '-2px' }} />
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
            <span className="inline-pill">{browseSorted.length} titles</span>
          </div>
          <div className="grid">
            {browseSorted.slice(0, 24).map((m) => (
              <MovieCard key={m.id} movie={m} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
