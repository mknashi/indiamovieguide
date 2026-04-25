import { useEffect, useMemo, useState } from 'react';
import { RiUser3Line } from 'react-icons/ri';
import { Movie } from '../types';
import { PersonProfile } from '../types/person';
import { searchAll } from '../services/agent';
import { MovieCard } from '../components/MovieCard';
import { SearchBar } from '../components/SearchBar';
import { navigate } from '../router';

export function SearchPage({ q }: { q: string }) {
  const [loading, setLoading] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [persons, setPersons] = useState<PersonProfile[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const query = (q || '').trim();
      setDidYouMean(null);
      if (!query) {
        setMovies([]);
        setPersons([]);
        return;
      }
      setLoading(true);
      try {
        const res = await searchAll(query);
        if (!alive) return;
        setMovies(res.movies || []);
        setPersons((res.persons || []) as PersonProfile[]);
        setDidYouMean(res.didYouMean || null);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [q]);

  const sorted = useMemo(() => {
    return movies.slice().sort((a, b) => {
      const ar = typeof a.rating === 'number' ? a.rating : -1;
      const br = typeof b.rating === 'number' ? b.rating : -1;
      if (br !== ar) return br - ar;
      const ad = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const bd = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      if (bd !== ad) return bd - ad;
      return a.title.localeCompare(b.title);
    });
  }, [movies]);

  return (
    <div>
      <SearchBar
        initialQuery={q}
        onSubmit={(next) => {
          navigate(`/search?q=${encodeURIComponent(next)}`);
        }}
      />

      {didYouMean && (
        <div className="detail" style={{ marginTop: 12 }}>
          <div className="tagline">
            Did you mean{' '}
            <a
              href={`/search?q=${encodeURIComponent(didYouMean)}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`/search?q=${encodeURIComponent(didYouMean)}`);
              }}
              style={{ textDecoration: 'underline' }}
            >
              {didYouMean}
            </a>
            ?
          </div>
        </div>
      )}

      {persons.length > 0 && (
        <>
          <div className="section-header" style={{ marginTop: 18 }}>
            <h3>People</h3>
            <span className="inline-pill">{persons.length}</span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
            {persons.map((p) => {
              const href = `/person/${encodeURIComponent(p.id)}`;
              return (
                <a
                  key={p.id}
                  href={href}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    navigate(href);
                  }}
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ width: 110, textAlign: 'center', padding: '10px 6px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel)', transition: 'background 0.15s' }}>
                    {p.profileImage ? (
                      <img
                        src={p.profileImage}
                        alt={p.name}
                        loading="lazy"
                        style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', marginBottom: 8, display: 'block', margin: '0 auto 8px' }}
                      />
                    ) : (
                      <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                        <RiUser3Line size={28} />
                      </div>
                    )}
                    <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.3, wordBreak: 'break-word' }}>{p.name}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </>
      )}

      <div className="section-header" style={{ marginTop: 18 }}>
        <h3>Results</h3>
        <span className="inline-pill">{sorted.length} titles</span>
      </div>

      {loading ? (
        <div className="tagline">Searching…</div>
      ) : sorted.length ? (
        <div className="grid">
          {sorted.map((m) => (
            <div key={m.id}>
              <MovieCard movie={m} />
            </div>
          ))}
        </div>
      ) : (
        <div className="tagline">No results yet. Try another title or actor.</div>
      )}
    </div>
  );
}
