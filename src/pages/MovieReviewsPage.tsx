import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiChat3Line, RiStarLine } from 'react-icons/ri';
import { navigate } from '../router';
import type { Movie } from '../types';
import { CaptchaWidget } from '../components/CaptchaWidget';

type UserReview = {
  id: string;
  rating: number | null;
  body: string;
  createdAt: string;
  author: string;
};

function formatDate(iso?: string) {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function MovieReviewsPage({ id }: { id: string }) {
  const [movie, setMovie] = useState<Movie | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [captchaToken, setCaptchaToken] = useState('');
  const [myRating, setMyRating] = useState<number>(8);
  const [myBody, setMyBody] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await fetch(`/api/movies/${encodeURIComponent(id)}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Movie;
        if (!alive) return;
        setMovie(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load movie');
      } finally {
        if (!alive) return;
        setLoading(false);
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

  const loadReviews = async () => {
    const res = await fetch(`/api/movies/${encodeURIComponent(id)}/user-reviews`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    setReviews(Array.isArray(data.reviews) ? (data.reviews as UserReview[]) : []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadReviews();
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const avgText = useMemo(() => {
    const nums = reviews.map((r) => (typeof r.rating === 'number' ? r.rating : null)).filter((x): x is number => x != null);
    if (!nums.length) return null;
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return `${avg.toFixed(1)}/10`;
  }, [reviews]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate(`/movie/${encodeURIComponent(id)}`)}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Back
        </button>
        <span className="inline-pill">Reviews</span>
      </div>

      {loading && <div className="tagline">Loading…</div>}
      {error && <div className="tagline">Failed to load: {error}</div>}

      {!loading && movie && (
        <div className="detail" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: 12, alignItems: 'center' }}>
            {movie.poster ? (
              <img
                src={movie.poster}
                alt={movie.title}
                style={{ width: 80, height: 110, objectFit: 'cover', borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)' }}
              />
            ) : (
              <div className="chip" style={{ width: 80, height: 110, borderRadius: 14 }} />
            )}
            <div>
              <h2 style={{ margin: 0 }}>{movie.title}</h2>
              <div className="tagline" style={{ marginTop: 6 }}>
                {movie.language} · {formatDate(movie.releaseDate)}
              </div>
              <div className="meta" style={{ marginTop: 10 }}>
                <span className="chip">
                  <RiChat3Line style={{ marginRight: 6, verticalAlign: '-2px' }} />
                  {reviews.length} user reviews
                </span>
                {avgText ? (
                  <span className="rating">
                    <RiStarLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
                    {avgText}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="detail" style={{ marginTop: 16 }}>
        <h4>User ratings &amp; reviews</h4>

        {reviews.length ? (
          <div className="song-list" style={{ marginTop: 12 }}>
            {reviews.slice(0, 30).map((rv) => (
              <div key={rv.id} className="song" style={{ alignItems: 'flex-start' }}>
                <div>
                  <strong>{rv.author || 'User'}</strong>
                  <div className="tagline">
                    {rv.rating ? `${rv.rating}/10 · ` : ''}
                    {new Date(rv.createdAt).toLocaleDateString()}
                  </div>
                  <div className="tagline" style={{ marginTop: 6 }}>
                    {rv.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="tagline">No user reviews yet.</div>
        )}
      </div>

      <div className="detail" style={{ marginTop: 16 }}>
        <h4>Write a review</h4>
        {!me ? (
          <button
            className="ghost-button"
            type="button"
            onClick={() => navigate(`/login?next=${encodeURIComponent(`/movie/${encodeURIComponent(id)}/reviews`)}`)}
          >
            Login to review
          </button>
        ) : (
          <>
            <div className="tagline">Your review will be visible after admin approval.</div>
            <div className="detail" style={{ marginTop: 12 }}>
              <h4>Captcha</h4>
              <div className="tagline">Required for submitting reviews.</div>
              <div style={{ marginTop: 10 }}>
                <CaptchaWidget onToken={(t) => setCaptchaToken(t)} compact />
              </div>
            </div>

            <div className="meta" style={{ marginTop: 12 }}>
              <span className="chip">Rating</span>
              <input
                type="number"
                value={myRating}
                min={1}
                max={10}
                onChange={(e) => setMyRating(Number(e.target.value))}
                style={{
                  width: 90,
                  padding: '10px 12px',
                  borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.05)',
                  color: 'inherit',
                  outline: 'none'
                }}
              />
              <span className="tagline">/10</span>
            </div>
            <textarea
              value={myBody}
              onChange={(e) => setMyBody(e.target.value)}
              placeholder="Write a helpful, spoiler-free review…"
              style={{
                width: '100%',
                minHeight: 120,
                resize: 'vertical',
                padding: '12px 12px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.05)',
                color: 'inherit',
                outline: 'none',
                marginTop: 10
              }}
            />
            <button
              className="ghost-button"
              type="button"
              style={{ marginTop: 10 }}
              onClick={async () => {
                setMsg(null);
                try {
                  const res = await fetch(`/api/movies/${encodeURIComponent(id)}/user-reviews`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rating: myRating, body: myBody, captchaToken })
                  });
                  const data = await res.json().catch(() => ({}));
                  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
                  setMyBody('');
                  setMsg('Submitted for approval.');
                  await loadReviews();
                } catch (e: any) {
                  setMsg(`Failed: ${e?.message || 'error'}`);
                }
              }}
            >
              Submit review
            </button>
            {msg ? <div className="tagline" style={{ marginTop: 10 }}>{msg}</div> : null}
          </>
        )}
      </div>
    </div>
  );
}

