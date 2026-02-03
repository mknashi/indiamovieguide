import { RiArrowLeftLine, RiExternalLinkLine, RiMailLine } from 'react-icons/ri';
import { navigate } from '../router';

export function FeedbackPage() {
  const email = 'feedback@indiamovieguide.com';
  const subject = encodeURIComponent('IndiaMovieGuide feedback');
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowLeftLine  /></span>
          Back
        </button>
        <span className="inline-pill">Feedback</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Feedback</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Tell us what to improve: missing movies, wrong cast, broken links, or feature requests.
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Send feedback</h4>
          <div className="meta" style={{ marginTop: 10 }}>
            <a
              className="chip"
              href={`mailto:${email}?subject=${subject}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RiMailLine size={14} />
              {email}
              <RiExternalLinkLine size={14} />
            </a>
          </div>
          <div className="tagline" style={{ marginTop: 10 }}>
            Tip: include the movie title, language, and where you saw the issue.
          </div>
        </div>
      </div>
    </div>
  );
}

