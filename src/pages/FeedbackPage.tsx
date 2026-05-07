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
        <h4>Your feedback makes IndiaMovieGuide better</h4>
        <div className="tagline" style={{ lineHeight: 1.8 }}>
          IndiaMovieGuide is a passion project built by fans of Indian cinema. We rely on the
          community to flag errors, suggest missing titles, and share ideas for new features. Every
          message is read personally.
        </div>
        <div className="tagline" style={{ lineHeight: 1.8, marginTop: 8 }}>
          The fastest way to reach us is by email. Please include as much context as possible —
          movie title, language, and a brief description of the issue — so we can address it
          quickly.
        </div>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>What to report</h4>
        <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
          {[
            { title: 'Missing movies', desc: 'A recent release or older title that should be in our catalogue.' },
            { title: 'Incorrect data', desc: 'Wrong cast, wrong release date, incorrect language tag, or a bad synopsis.' },
            { title: 'Broken links', desc: 'A streaming link, trailer, or cast photo that no longer works.' },
            { title: 'Feature requests', desc: 'A filter, language, or page type you\'d like us to add.' },
            { title: 'General bugs', desc: 'Something that looks broken or behaves unexpectedly.' },
          ].map((item) => (
            <div key={item.title} className="detail" style={{ padding: '12px 16px' }}>
              <div style={{ fontWeight: 700 }}>{item.title}</div>
              <div className="tagline" style={{ marginTop: 4 }}>{item.desc}</div>
            </div>
          ))}
        </div>
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
        <div className="tagline" style={{ marginTop: 10, lineHeight: 1.7 }}>
          For missing movies, you can also use the{' '}
          <a href="/submit" onClick={(e) => { e.preventDefault(); navigate('/submit'); }} style={{ textDecoration: 'underline' }}>
            Add a Movie
          </a>{' '}
          form so our team can review and add it directly.
        </div>
      </div>
    </div>
  );
}

