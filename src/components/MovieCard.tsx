import {
  RiCalendar2Line,
  RiExternalLinkLine,
  RiPlayLine,
  RiTv2Line,
  RiUser3Line,
  RiYoutubeFill
} from 'react-icons/ri';
import { Movie } from '../types';
import { navigate } from '../router';
import { moviePathFromMovieId, personPathFromTmdbId } from '../utils/ids';

const formatDate = (iso?: string) => {
  if (!iso) return 'TBA';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
};

export function MovieCard({ movie }: { movie: Movie }) {
  const href = moviePathFromMovieId(movie.id);
  const synopsis = (movie.synopsis || '').trim();
  const showMore = synopsis.length > 180;

  const directUrlForOffer = (provider: string) => {
    const p = provider.toLowerCase();
    const title = encodeURIComponent(movie.title);
    if (p === 'netflix') return `https://www.netflix.com/search?q=${title}`;
    if (p === 'prime video' || p === 'amazon prime video')
      return `https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${title}`;
    if (p === 'hotstar' || p === 'disney+ hotstar') return `https://www.hotstar.com/in/search?q=${title}`;
    if (p === 'zee5') return `https://www.zee5.com/search?q=${title}`;
    if (p === 'sonyliv') return `https://www.sonyliv.com/search/${title}`;
    if (p === 'jiocinema') return `https://www.jiocinema.com/search/${title}`;
    return '';
  };

  const offers = (movie.ott ?? []).slice(0, 4);
  const cast = movie.cast?.slice(0, 4) || [];
  const songCount = movie.songs?.length || 0;
  const firstSong = movie.songs?.find((s) => !!s.youtubeUrl);

  return (
    <article className="card">
      <a
        href={href}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate(href);
        }}
      >
        <img src={movie.backdrop || movie.poster} alt={movie.title} loading="lazy" />
      </a>

      <div className="card-body">
        <div className="meta">
          <span className="status">{movie.status}</span>
          {typeof movie.rating === 'number' && <span className="rating">★ {movie.rating.toFixed(1)}</span>}
          <span className="chip">{movie.language}</span>
          {movie.releaseDate && (
            <span className="chip">
              <RiCalendar2Line size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
              {formatDate(movie.releaseDate)}
            </span>
          )}
        </div>

        <a
          href={href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate(href);
          }}
          style={{ display: 'inline-block' }}
        >
          <h3 style={{ margin: '0 0 6px' }}>{movie.title}</h3>
        </a>

        <div className="card-synopsis">
          <p className="tagline tagline-clamp">{synopsis || 'Synopsis not available yet.'}</p>
          {showMore ? (
            <a
              className="more-link"
              href={href}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                e.preventDefault();
                navigate(href);
              }}
            >
              More…
            </a>
            ) : null}
        </div>

        <div className="card-row">
          <div className="card-kicker">
            <RiUser3Line size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Cast
          </div>
          <div className="meta card-row-chips">
            {cast.length ? (
              cast.map((c) => {
                const pid = c.tmdbId || c.personId;
                const phref = pid ? personPathFromTmdbId(pid) : '';
                return pid ? (
                  <a
                    key={`${c.name}-${String(pid)}`}
                    className="chip"
                    href={phref}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      navigate(phref);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    title="Open profile"
                  >
                    {c.name}
                  </a>
                ) : (
                  <span key={c.name} className="chip">
                    {c.name}
                  </span>
                );
              })
            ) : (
              <span className="chip">TBA</span>
            )}
          </div>
        </div>

        <div className="card-row">
          <div className="card-kicker">
            <RiTv2Line size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Watch
          </div>
          <div className="meta card-row-chips">
            {offers.length ? (
              offers.slice(0, 3).map((o) => {
                const out = o.deepLink || directUrlForOffer(o.provider) || o.url || '';
                return (
                  <a
                    key={`${o.provider}-${o.type}`}
                    className="chip"
                    href={out || '#'}
                    target={out ? '_blank' : undefined}
                    rel={out ? 'noreferrer' : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    title="Open provider"
                  >
                    {o.provider}
                    <RiExternalLinkLine size={14} />
                  </a>
                );
              })
            ) : (
              <span className="chip">TBA</span>
            )}
          </div>
        </div>

        <div className="card-row">
          <div className="card-kicker">
            <RiYoutubeFill size={14} style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Songs
          </div>
          <div className="meta card-row-chips">
            <span className="chip">{songCount ? `${songCount} tracks` : 'TBA'}</span>
            {firstSong?.youtubeUrl ? (
              <a
                className="chip"
                href={`/song/${encodeURIComponent(firstSong.id)}`}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate(`/song/${encodeURIComponent(firstSong.id)}`);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                title="Play"
              >
                Play
                <RiExternalLinkLine size={14} />
              </a>
            ) : null}
          </div>
        </div>

        <div className="actions">
          <div className="meta">
            {movie.genres.slice(0, 2).map((g) => (
              <span key={g} className="chip">
                {g}
              </span>
            ))}
          </div>
          <a
            className="ghost-button"
            href={href}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate(href);
            }}
          >
            <RiPlayLine style={{ marginRight: 6, verticalAlign: 'text-bottom' }} />
            Open
          </a>
        </div>
      </div>
    </article>
  );
}
