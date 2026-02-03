import { useEffect, useMemo, useState } from 'react';
import { Movie } from '../types';
import { searchAll } from '../services/agent';
import { MovieCard } from '../components/MovieCard';
import { SearchBar } from '../components/SearchBar';
import { navigate } from '../router';

export function SearchPage({ q }: { q: string }) {
  const [loading, setLoading] = useState(false);
  const [movies, setMovies] = useState<Movie[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const query = (q || '').trim();
      setDidYouMean(null);
      if (!query) {
        setMovies([]);
        return;
      }
      setLoading(true);
      try {
        const res = await searchAll(query);
        if (!alive) return;
        setMovies(res.movies || []);
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
