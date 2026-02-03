import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiHeart3Line, RiListCheck2, RiLogoutBoxRLine, RiPencilLine, RiSendPlane2Line } from 'react-icons/ri';
import { MovieCard } from '../components/MovieCard';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { navigate } from '../router';
import { Movie } from '../types';

async function getJson(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function AccountPage() {
  const [me, setMe] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [captchaToken, setCaptchaToken] = useState('');
  const [favorites, setFavorites] = useState<Movie[]>([]);
  const [watchlist, setWatchlist] = useState<Movie[]>([]);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [myPersonSubmissions, setMyPersonSubmissions] = useState<any[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const m = await getJson('/api/me');
      setMe(m.user || null);
      setDisplayName(m.user?.displayName || '');
      setAvatarUrl(m.user?.avatarUrl || '');
      if (m.user) {
        const [f, w, r, s, ps] = await Promise.all([
          getJson('/api/me/favorites'),
          getJson('/api/me/watchlist'),
          getJson('/api/me/reviews'),
          getJson('/api/me/submissions'),
          getJson('/api/me/person-submissions')
        ]);
        setFavorites(Array.isArray(f.movies) ? f.movies : []);
        setWatchlist(Array.isArray(w.movies) ? w.movies : []);
        setMyReviews(Array.isArray(r.reviews) ? r.reviews : []);
        setMySubmissions(Array.isArray(s.submissions) ? s.submissions : []);
        setMyPersonSubmissions(Array.isArray(ps.personSubmissions) ? ps.personSubmissions : []);
      } else {
        setFavorites([]);
        setWatchlist([]);
        setMyReviews([]);
        setMySubmissions([]);
        setMyPersonSubmissions([]);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load account');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const reviewCounts = useMemo(() => {
    const pending = myReviews.filter((r) => r.status === 'pending').length;
    const approved = myReviews.filter((r) => r.status === 'approved').length;
    return { pending, approved, total: myReviews.length };
  }, [myReviews]);

  if (loading) {
    return <div className="tagline">Loading…</div>;
  }

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowLeftLine  /></span>
          Back
        </button>
        <span className="inline-pill">Account</span>
      </div>

      {error ? <div className="tagline" style={{ marginTop: 12 }}>Error: {error}</div> : null}

      {!me ? (
        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Sign in</h4>
          <div className="tagline">Create an account to favorite, watchlist, and review titles.</div>
          <div style={{ marginTop: 12 }}>
            <button className="ghost-button" type="button" onClick={() => navigate('/login')}>
              Go to sign in
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="detail" style={{ marginTop: 14 }}>
            <div className="meta" style={{ justifyContent: 'space-between' }}>
              <span className="chip">{me.email}</span>
              <button
                className="ghost-button"
                type="button"
                onClick={async () => {
                  await postJson('/api/auth/logout', {});
                  await refresh();
                }}
              >
                <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiLogoutBoxRLine  /></span>
                Sign out
              </button>
            </div>

            <div className="detail" style={{ marginTop: 12 }}>
              <h4>Profile</h4>
              <div className="search" style={{ marginTop: 10 }}>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
                <button type="button" onClick={async () => { await postJson('/api/me/profile', { displayName, avatarUrl }); await refresh(); }}>
                  <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiPencilLine  /></span>
                  Save
                </button>
              </div>
              <div className="search" style={{ marginTop: 10 }}>
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Profile photo URL (optional)" />
                <div />
              </div>
            </div>

            <div className="detail" style={{ marginTop: 12 }}>
              <h4>Captcha</h4>
              <div className="tagline">Required for list changes, reviews, and submissions.</div>
              <div style={{ marginTop: 10 }}>
                <CaptchaWidget onToken={(t) => setCaptchaToken(t)} compact />
              </div>
            </div>

            <div className="meta" style={{ marginTop: 12 }}>
              <a className="chip" href="/submit" onClick={(e) => { e.preventDefault(); navigate('/submit'); }}>
                <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiSendPlane2Line  /></span>
                Add new movie / TV
              </a>
              <span className="chip">
                Reviews: {reviewCounts.total} ({reviewCounts.approved} approved · {reviewCounts.pending} pending)
              </span>
            </div>
          </div>

          <div className="section-header">
            <h3>
              <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiHeart3Line  /></span>
              Favorites
            </h3>
            <span className="inline-pill">{favorites.length}</span>
          </div>
          {favorites.length ? (
            <div className="grid">
              {favorites.map((m) => (
                <div key={m.id}>
                  <MovieCard movie={m} />
                </div>
              ))}
            </div>
          ) : (
            <div className="tagline">No favorites yet.</div>
          )}

          <div className="section-header">
            <h3>
              <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiListCheck2  /></span>
              Watchlist
            </h3>
            <span className="inline-pill">{watchlist.length}</span>
          </div>
          {watchlist.length ? (
            <div className="grid">
              {watchlist.map((m) => (
                <div key={m.id}>
                  <MovieCard movie={m} />
                </div>
              ))}
            </div>
          ) : (
            <div className="tagline">No watchlist items yet.</div>
          )}

          <div className="section-header">
            <h3>Your contributions</h3>
            <span className="inline-pill">{mySubmissions.length + myReviews.length + myPersonSubmissions.length}</span>
          </div>
          <div className="detail">
            <h4>Submissions</h4>
            {mySubmissions.length ? (
              <div className="song-list" style={{ marginTop: 10 }}>
                {mySubmissions.slice(0, 20).map((s) => (
                  <div key={s.id} className="song">
                    <div>
                      <strong>{s.title}</strong>
                      <div className="tagline">
                        {String(s.kind || '').toUpperCase()} · {s.status} · {new Date(s.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="chip">{s.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tagline">No submissions yet.</div>
            )}

            <h4 style={{ marginTop: 16 }}>People</h4>
            {myPersonSubmissions.length ? (
              <div className="song-list" style={{ marginTop: 10 }}>
                {myPersonSubmissions.slice(0, 20).map((p) => (
                  <div key={p.id} className="song">
                    <div>
                      <strong>{p.name}</strong>
                      <div className="tagline">
                        {p.status} · {new Date(p.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="chip">{p.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tagline">No people submissions yet.</div>
            )}

            <h4 style={{ marginTop: 16 }}>Reviews</h4>
            {myReviews.length ? (
              <div className="song-list" style={{ marginTop: 10 }}>
                {myReviews.slice(0, 20).map((r) => (
                  <div key={r.id} className="song">
                    <div>
                      <strong>{r.movieTitle}</strong>
                      <div className="tagline">
                        {r.rating ? `${r.rating}/10 · ` : ''}
                        {r.status} · {new Date(r.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <span className="chip">{r.status}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tagline">No reviews yet.</div>
            )}
          </div>

          {/* Expose captcha token for children pages via navigation state later if needed */}
          {captchaToken ? null : null}
        </>
      )}
    </div>
  );
}
