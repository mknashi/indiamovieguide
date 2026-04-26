import {
  RiArrowLeftLine,
  RiExternalLinkLine,
  RiSearchLine,
  RiFilmLine,
  RiTeamLine,
  RiLiveLine,
  RiMusicLine,
  RiStarLine,
  RiHeartLine,
  RiGlobeLine,
} from 'react-icons/ri';
import { linkHandler, navigate } from '../router';

const FEATURES = [
  { icon: <RiFilmLine size={22} />, title: 'New & Upcoming', desc: 'Track fresh releases and upcoming titles across all major Indian film industries.' },
  { icon: <RiSearchLine size={22} />, title: 'Smart Search', desc: 'Search by movie, actor, genre, or language — misspellings and phonetic matches are OK.' },
  { icon: <RiTeamLine size={22} />, title: 'Cast Profiles', desc: 'Explore actor bios, filmographies, and photos with one click.' },
  { icon: <RiLiveLine size={22} />, title: 'Streaming Links', desc: 'Find where to watch on Netflix, Prime, Hotstar, JioCinema, ZEE5, and more.' },
  { icon: <RiMusicLine size={22} />, title: 'Songs & Trailers', desc: 'Watch trailers and play songs directly from the movie page.' },
  { icon: <RiStarLine size={22} />, title: 'Ratings & Reviews', desc: 'See audience ratings and critic reviews aggregated in one place.' },
];

const INDUSTRIES = [
  { label: 'Bollywood', lang: 'Hindi', flag: '🇮🇳' },
  { label: 'Tollywood', lang: 'Telugu', flag: '🎬' },
  { label: 'Kollywood', lang: 'Tamil', flag: '🎭' },
  { label: 'Mollywood', lang: 'Malayalam', flag: '🌴' },
  { label: 'Sandalwood', lang: 'Kannada', flag: '🌿' },
  { label: 'Marathi', lang: 'Marathi', flag: '🎪' },
  { label: 'Bengali', lang: 'Bengali', flag: '✨' },
];

export function AboutPage() {
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}><RiArrowLeftLine /></span>
          Back
        </button>
        <span className="inline-pill">About</span>
      </div>

      {/* Hero banner */}
      <div
        className="detail"
        style={{
          marginTop: 14,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(16,185,129,0.10) 100%)',
          borderColor: 'rgba(99,102,241,0.3)',
          padding: '28px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 12 }}>🎬</div>
        <h4 style={{ margin: '0 0 10px', fontSize: 22 }}>IndiaMovieGuide</h4>
        <div className="tagline" style={{ lineHeight: 1.8, maxWidth: 560, margin: '0 auto' }}>
          We are movie enthusiasts who are passionate about Indian cinema. IndiaMovieGuide is your
          fast, no-fuss companion for discovering new releases, exploring cast profiles, tracking
          where to stream, and staying up to date with every major film industry across India.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
          <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RiHeartLine size={13} /> Passion project
          </span>
          <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RiGlobeLine size={13} /> All languages
          </span>
          <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RiFilmLine size={13} /> Free to use
          </span>
        </div>
      </div>

      {/* Feature grid */}
      <div className="section-header" style={{ marginTop: 20 }}>
        <h3>What we offer</h3>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="detail"
            style={{ padding: '16px 18px' }}
          >
            <div style={{ color: 'var(--accent, #6366f1)', marginBottom: 8 }}>{f.icon}</div>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
            <div className="tagline" style={{ lineHeight: 1.6 }}>{f.desc}</div>
          </div>
        ))}
      </div>

      {/* Industries */}
      <div className="section-header" style={{ marginTop: 20 }}>
        <h3>Industries we cover</h3>
      </div>
      <div className="detail">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {INDUSTRIES.map((ind) => (
            <div
              key={ind.label}
              className="chip"
              style={{ padding: '8px 14px', fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <span style={{ fontSize: 18 }}>{ind.flag}</span>
              <span>
                <strong>{ind.label}</strong>
                <span className="tagline" style={{ marginLeft: 6 }}>{ind.lang}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="tagline" style={{ marginTop: 12, lineHeight: 1.7 }}>
          Whether you follow Bollywood blockbusters or regional gems, we aim to be the first place
          you check when you're curious about a movie or an actor.
        </div>
      </div>

      {/* Sources */}
      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Sources &amp; attribution</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Metadata, artwork, and streaming availability come from trusted third-party providers.
          Provider links are shown on detail pages when available.
        </div>
        <div className="meta" style={{ marginTop: 10 }}>
          <a
            className="chip"
            href="https://www.themoviedb.org/"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            TMDB <RiExternalLinkLine size={14} />
          </a>
          <a
            className="chip"
            href="https://www.youtube.com/"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            YouTube <RiExternalLinkLine size={14} />
          </a>
          <a
            className="chip"
            href="https://en.wikipedia.org/"
            target="_blank"
            rel="noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Wikipedia <RiExternalLinkLine size={14} />
          </a>
        </div>
      </div>

      {/* Contact */}
      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Get in touch</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Have a suggestion, found a bug, or want to add a missing movie? We'd love to hear from you.
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a
            className="ghost-button"
            href="/contact"
            onClick={linkHandler('/contact')}
            style={{ textDecoration: 'none' }}
          >
            Contact Us
          </a>
          <a
            className="ghost-button"
            href="/feedback"
            onClick={linkHandler('/feedback')}
            style={{ textDecoration: 'none' }}
          >
            Send Feedback
          </a>
          <a
            className="ghost-button"
            href="/submit"
            onClick={linkHandler('/submit')}
            style={{ textDecoration: 'none' }}
          >
            Add a Movie
          </a>
        </div>
      </div>
    </div>
  );
}
