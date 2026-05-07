import { RiPlayCircleLine, RiStarFill, RiFireLine, RiCalendarLine, RiLiveLine } from 'react-icons/ri';
import { navigate } from '../router';
import { LANGUAGE_COLORS } from '../data/languageContent';

type FeaturedMovie = {
  id: string;
  title: string;
  language?: string;
  synopsis?: string;
  releaseDate?: string;
  status?: string;
  poster?: string;
  backdrop?: string;
  rating?: number;
  trailerUrl?: string;
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  'Now Showing': { label: 'In Cinemas', icon: <RiFireLine size={11} />, color: '#f97316' },
  'Streaming':   { label: 'Streaming Now', icon: <RiLiveLine size={11} />, color: '#22c55e' },
  'Upcoming':    { label: 'Upcoming', icon: <RiCalendarLine size={11} />, color: '#60a5fa' },
  'Announced':   { label: 'Announced', icon: <RiCalendarLine size={11} />, color: '#94a3b8' },
};

const isReleased = (status?: string) =>
  status === 'Now Showing' || status === 'Streaming';

export function FeaturedMovieBanner({ movie }: { movie: FeaturedMovie }) {
  const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : null;
  const colors = movie.language ? LANGUAGE_COLORS[movie.language] : null;
  const synopsis = movie.synopsis
    ? movie.synopsis.length > 200 ? movie.synopsis.slice(0, 200).trimEnd() + '…' : movie.synopsis
    : null;
  const statusCfg = movie.status ? STATUS_CONFIG[movie.status] : null;
  const showRating = isReleased(movie.status) && typeof movie.rating === 'number' && movie.rating > 0;
  const bg = movie.backdrop || movie.poster;

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 20,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        minHeight: 220,
        display: 'flex',
        alignItems: 'flex-end',
        cursor: 'pointer',
      }}
      onClick={() => navigate(`/movie/${movie.id}`)}
    >
      {/* Backdrop */}
      {bg && (
        <img
          src={bg}
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            filter: 'brightness(0.45)',
          }}
          loading="lazy"
        />
      )}

      {/* Gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(8,12,24,0.98) 0%, rgba(8,12,24,0.55) 55%, rgba(8,12,24,0.15) 100%)',
        }}
      />

      {/* Content */}
      <div style={{ position: 'relative', padding: '24px 28px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 20 }}>
          {/* Poster thumbnail */}
          {movie.poster && (
            <img
              src={movie.poster}
              alt={movie.title}
              style={{
                width: 72,
                height: 108,
                objectFit: 'cover',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.15)',
                flexShrink: 0,
                display: 'none',
              }}
              className="featured-poster"
              loading="lazy"
            />
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Pills row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <span className="inline-pill" style={{ fontSize: 11, padding: '2px 10px' }}>Featured</span>

              {statusCfg && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: statusCfg.color,
                    background: `${statusCfg.color}22`,
                    border: `1px solid ${statusCfg.color}55`,
                    borderRadius: 999,
                    padding: '2px 10px',
                  }}
                >
                  {statusCfg.icon}
                  {statusCfg.label}
                </span>
              )}

              {colors && (
                <span
                  className="inline-pill"
                  style={{ background: colors.accent, color: '#fff', border: 'none', fontSize: 11, padding: '2px 10px' }}
                >
                  {colors.industry}
                </span>
              )}

              {showRating && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--brand-gold)' }}>
                  <RiStarFill size={12} />
                  {movie.rating!.toFixed(1)}
                </span>
              )}
            </div>

            {/* Title */}
            <h2 style={{ margin: '0 0 6px', fontSize: 'clamp(20px, 3vw, 28px)', lineHeight: 1.15, color: '#fff' }}>
              {movie.title}
              {year && (
                <span style={{ fontWeight: 400, fontSize: '0.65em', color: 'rgba(255,255,255,0.55)', marginLeft: 10 }}>
                  {year}
                </span>
              )}
            </h2>

            {/* Synopsis */}
            {synopsis && (
              <div style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.7)', maxWidth: 640, marginBottom: 14 }}>
                {synopsis}
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
              {movie.trailerUrl && (
                <button
                  className="ghost-button"
                  type="button"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.25)' }}
                  onClick={() => navigate(`/trailer/${movie.id}`)}
                >
                  <RiPlayCircleLine size={16} />
                  Watch Trailer
                </button>
              )}
              <button
                className="ghost-button"
                type="button"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }}
                onClick={() => navigate(`/movie/${movie.id}`)}
              >
                View Movie
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
