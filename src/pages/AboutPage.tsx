import { RiArrowLeftLine, RiExternalLinkLine } from 'react-icons/ri';
import { linkHandler, navigate } from '../router';

export function AboutPage() {
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowLeftLine  /></span>
          Back
        </button>
        <span className="inline-pill">About</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>IndiaMovieGuide</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          We are movie enthusiasts who are passionate about Indian cinema and bringing the latest,
          most useful information to fellow fans. IndiaMovieGuide is your fast, no-fuss guide to
          Indian movies across languages — from new releases and upcoming titles to cast profiles,
          trailers, songs, ratings, and where to watch.
        </div>
        <div className="tagline" style={{ lineHeight: 1.7, marginTop: 10 }}>
          Whether you follow Bollywood, Tollywood, Kollywood, or any other regional film industry,
          we want IndiaMovieGuide to be the first place you check when you're curious about a movie
          or an actor.
        </div>

        <div className="meta" style={{ marginTop: 12 }}>
          <span className="chip">New &amp; Upcoming</span>
          <span className="chip">Search by movie / cast / genre</span>
          <span className="chip">Trailers &amp; Songs</span>
          <span className="chip">Streaming links</span>
          <span className="chip">Cast profiles</span>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Sources &amp; attribution</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            Metadata and artwork may come from third-party providers (for example: TMDB, YouTube,
            Wikipedia). Provider links are shown on detail pages when available.
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

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Questions?</h4>
          <div className="tagline">
            Visit{' '}
            <a href="/contact" onClick={linkHandler('/contact')} style={{ textDecoration: 'underline' }}>
              Contact Us
            </a>{' '}
            or{' '}
            <a
              href="/feedback"
              onClick={linkHandler('/feedback')}
              style={{ textDecoration: 'underline' }}
            >
              Feedback
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

