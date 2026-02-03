import { RiSearchLine, RiUser3Line } from 'react-icons/ri';
import { useRoute } from './hooks/useRoute';
import { navigate } from './router';
import { useEffect, useMemo, useState } from 'react';
import { HomePage } from './pages/HomePage';
import { SearchPage } from './pages/SearchPage';
import { MoviePage } from './pages/MoviePage';
import { PersonPage } from './pages/PersonPage';
import { AdminPage } from './pages/AdminPage';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { LoginPage } from './pages/LoginPage';
import { AccountPage } from './pages/AccountPage';
import { SubmitPage } from './pages/SubmitPage';
import { TrailerPage } from './pages/TrailerPage';
import { SongPage } from './pages/SongPage';
import { MovieReviewsPage } from './pages/MovieReviewsPage';

const LANG_ORDER = [
  'All',
  'Hindi',
  'Kannada',
  'Telugu',
  'Tamil',
  'Malayalam',
  'Marathi',
  'Bengali'
] as const;

function currentLangFromRoute(route: ReturnType<typeof useRoute>): string {
  if (route.name === 'home') return route.lang || 'All';
  // Keep language selector available even off-home; default to All.
  return 'All';
}

export default function App() {
  const route = useRoute();
  const activeLang = currentLangFromRoute(route);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setMe(data?.user || null);
      } catch {
        // ignore
      }
    };

    refresh();
    // Refresh on navigation + tab focus so the header reflects auth changes promptly.
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [route.name]);

  const initials = useMemo(() => {
    const name = String(me?.displayName || me?.email || '').trim();
    if (!name) return 'U';
    const parts = name.split(/\s+/g).filter(Boolean);
    const a = parts[0]?.[0] || 'U';
    const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : '';
    return (a + b).toUpperCase();
  }, [me]);

  return (
    <div className="app-shell">
      <nav className="nav">
        <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <img className="brand-logo" src="/brand/india-movie-guide-option2.svg" alt="IndiaMovieGuide" />
          <span className="sr-only">IndiaMovieGuide</span>
        </div>

        <div className="nav-actions">
          <div className="filters" style={{ justifyContent: 'flex-end' }}>
            {LANG_ORDER.map((l) => (
              <button
                key={l}
                className={`filter ${activeLang === l ? 'active' : ''}`}
                onClick={() => {
                  const url = l === 'All' ? '/' : `/?lang=${encodeURIComponent(l)}`;
                  navigate(url);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                title={l === 'All' ? 'All languages' : `Browse ${l}`}
              >
                {l}
              </button>
            ))}
          </div>

          <button
            className={`ghost-button ${route.name === 'search' ? 'active' : ''}`}
            type="button"
            onClick={() => navigate('/search')}
            title="Search"
          >
            <RiSearchLine style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            Search
          </button>

          <button
            className={`ghost-button ${route.name === 'account' || route.name === 'login' ? 'active' : ''}`}
            type="button"
            onClick={() => navigate(me ? '/account' : '/login')}
            title={me ? 'Account' : 'Login'}
          >
            {me?.avatarUrl ? (
              <img
                src={me.avatarUrl}
                alt="Profile"
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  objectFit: 'cover',
                  marginRight: 8,
                  verticalAlign: 'text-bottom',
                  border: '1px solid rgba(255,255,255,0.14)'
                }}
              />
            ) : me ? (
              <span
                className="chip"
                style={{
                  padding: '4px 8px',
                  marginRight: 8,
                  borderRadius: 999,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6
                }}
              >
                <RiUser3Line size={13} />
                {initials}
              </span>
            ) : (
              <RiUser3Line style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            )}
            {me ? 'Account' : 'Login'}
          </button>
        </div>
      </nav>

      {route.name === 'home' && <HomePage lang={route.lang} />}
      {route.name === 'search' && <SearchPage q={route.q} />}
      {route.name === 'movie' && <MoviePage id={route.id} />}
      {route.name === 'movie_reviews' && <MovieReviewsPage id={route.id} />}
      {route.name === 'trailer' && <TrailerPage id={route.id} />}
      {route.name === 'song' && <SongPage id={route.id} />}
      {route.name === 'person' && <PersonPage id={route.id} />}
      {route.name === 'login' && <LoginPage next={route.next} />}
      {route.name === 'account' && <AccountPage />}
      {route.name === 'submit' && <SubmitPage />}
      {route.name === 'about' && <AboutPage />}
      {route.name === 'contact' && <ContactPage />}
      {route.name === 'feedback' && <FeedbackPage />}
      {route.name === 'privacy' && <PrivacyPage />}
      {route.name === 'admin' && <AdminPage />}
      {route.name === 'not_found' && (
        <div className="detail" style={{ marginTop: 18 }}>
          <h4>Not found</h4>
          <div className="tagline">
            This page doesn’t exist.{' '}
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/');
              }}
              style={{ textDecoration: 'underline' }}
            >
              Go home
            </a>
            .
          </div>
        </div>
      )}

      <footer className="footer">
        <div className="footer-links">
          <a
            href="/submit"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('/submit');
            }}
          >
            Add New Movie
          </a>
          <span className="footer-sep">·</span>
          <a
            href="/about"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('/about');
            }}
          >
            About Us
          </a>
          <span className="footer-sep">·</span>
          <a
            href="/contact"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('/contact');
            }}
          >
            Contact Us
          </a>
          <span className="footer-sep">·</span>
          <a
            href="/feedback"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('/feedback');
            }}
          >
            Feedback
          </a>
          <span className="footer-sep">·</span>
          <a
            href="/privacy"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate('/privacy');
            }}
          >
            Privacy Policy
          </a>
        </div>
        <div className="footer-right">
          <span className="tagline">
            © {new Date().getFullYear()} IndiaMovieGuide
          </span>
        </div>
      </footer>
    </div>
  );
}
