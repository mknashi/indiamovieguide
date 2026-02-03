import { RiArrowLeftLine, RiExternalLinkLine } from 'react-icons/ri';
import { linkHandler, navigate } from '../router';

export function AboutPage() {
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Back
        </button>
        <span className="inline-pill">About</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>IndiaMovieGuide</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          IndiaMovieGuide helps you discover Indian movies across languages with fast browsing, cast
          profiles, trailers, songs, and where-to-watch links.
        </div>

        <div className="meta" style={{ marginTop: 12 }}>
          <span className="chip">New &amp; Upcoming</span>
          <span className="chip">Search by movie / cast / genre</span>
          <span className="chip">Local cache + live enrichment</span>
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

