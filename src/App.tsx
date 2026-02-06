import { RiLiveLine, RiSearchLine, RiUser3Line } from 'react-icons/ri';
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
import { StreamingPage } from './pages/StreamingPage';

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
  if (route.name === 'streaming') return route.lang || 'All';
  // Keep language selector available even off-home; default to All.
  return 'All';
}

export default function App() {
  const route = useRoute();
  const activeLang = currentLangFromRoute(route);
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    // Preserve the user's last "listing" context (home/search/streaming/etc) so the Movie back button can return there.
    // This avoids losing context when navigating from /streaming -> /movie/:id.
    if (route.name === 'movie' || route.name === 'person' || route.name === 'trailer' || route.name === 'song') return;
    try {
      sessionStorage.setItem('img_last_list_path', window.location.pathname + window.location.search);
    } catch {
      // ignore
    }
  }, [route.name]);

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
        <div className="nav-top">
          <div className="brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <img className="brand-logo" src="/brand/india-movie-guide-option2.svg" alt="IndiaMovieGuide" />
            <span className="sr-only">IndiaMovieGuide</span>
          </div>

	          <div className="nav-top-actions">
	            <button
	              className={`icon-button ${route.name === 'streaming' ? 'active' : ''}`}
	              type="button"
	              onClick={() => {
	                if (route.name === 'streaming') {
	                  navigate('/');
	                  return;
	                }
	                const q = activeLang && activeLang !== 'All' ? `?lang=${encodeURIComponent(activeLang)}` : '';
	                navigate(`/streaming${q}`);
	              }}
	              title="Streaming now"
	              aria-label="Streaming now"
	            >
	              <RiLiveLine size={18} />
	            </button>

	            <button
	              className={`icon-button ${route.name === 'search' ? 'active' : ''}`}
	              type="button"
	              onClick={() => navigate('/search')}
              title="Search"
              aria-label="Search"
            >
              <RiSearchLine size={18} />
            </button>

            <button
              className={`icon-button ${route.name === 'account' || route.name === 'login' ? 'active' : ''}`}
              type="button"
              onClick={() => navigate(me ? '/account' : '/login')}
              title={me ? 'Account' : 'Login'}
              aria-label={me ? 'Account' : 'Login'}
            >
              {me?.avatarUrl ? (
                <img
                  src={me.avatarUrl}
                  alt="Profile"
                  className="nav-avatar"
                />
              ) : me ? (
                <span className="nav-initials">{initials}</span>
              ) : (
                <RiUser3Line size={18} />
              )}
            </button>
          </div>
        </div>

	        <div className="nav-bottom">
	          <div className="filters">
	            {LANG_ORDER.map((l) => (
              <button
                key={l}
	                className={`filter ${activeLang === l ? 'active' : ''}`}
	                onClick={() => {
	                  const isStreaming = route.name === 'streaming';
	                  const base = isStreaming ? '/streaming' : '/';
	                  const url = l === 'All' ? base : `${base}?lang=${encodeURIComponent(l)}`;
	                  navigate(url);
	                  window.scrollTo({ top: 0, behavior: 'smooth' });
	                }}
	                title={l === 'All' ? 'All languages' : `Browse ${l}`}
	              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </nav>

	      <main className="app-main">
	        {route.name === 'home' && <HomePage lang={route.lang} refresh={route.refresh} />}
	        {route.name === 'streaming' && <StreamingPage lang={route.lang} provider={route.provider} />}
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
      </main>

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
