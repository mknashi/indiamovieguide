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

export function MovieCard({ movie, contextProvider }: { movie: Movie; contextProvider?: string }) {
  const href = moviePathFromMovieId(movie.id);
  const synopsis = (movie.synopsis || '').trim();
  const showMore = synopsis.length > 180;
  const streamingOffers = (movie.ott || []).filter((o) => String(o.type || '').toLowerCase() === 'streaming');
  const primaryStreaming = (() => {
    if (contextProvider) {
      const hit = streamingOffers.find(
        (o) => String(o.provider || '').toLowerCase() === String(contextProvider).toLowerCase()
      );
      if (hit) return hit;
    }
    return streamingOffers[0] || null;
  })();
  const ottVerifiedText = movie.ottLastVerifiedAt ? new Date(movie.ottLastVerifiedAt).toLocaleString() : '';

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
      {primaryStreaming ? (
        <div
          className="card-streaming-badge"
          title={
            `Streaming on ${primaryStreaming.provider}` +
            (ottVerifiedText ? ` · Last verified: ${ottVerifiedText}` : '')
          }
        >
          {primaryStreaming.logo ? (
            <img src={primaryStreaming.logo} alt="" loading="lazy" />
          ) : (
            <RiTv2Line size={14} />
          )}
          <span style={{ fontWeight: 800 }}>{primaryStreaming.provider}</span>
          <span style={{ opacity: 0.8 }}>Streaming</span>
        </div>
      ) : null}
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
              <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiCalendar2Line size={14}  /></span>
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
            <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiUser3Line size={14}  /></span>
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
            <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiTv2Line size={14}  /></span>
            Watch
          </div>
          <div className="meta card-row-chips">
            {offers.length ? (
              offers.slice(0, 3).map((o) => {
                // Prefer TMDB/JustWatch movie pages over provider search links (more accurate).
                const out = o.deepLink || o.url || directUrlForOffer(o.provider) || '';
                return (
                  <a
                    key={`${o.provider}-${o.type}`}
                    className="chip"
                    href={out || '#'}
                    target={out ? '_blank' : undefined}
                    rel={out ? 'noreferrer' : undefined}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    title="Open watch page"
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
            <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiYoutubeFill size={14}  /></span>
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
            <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiPlayLine  /></span>
            Open
          </a>
        </div>
      </div>
    </article>
  );
}
