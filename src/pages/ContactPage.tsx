import { RiArrowLeftLine, RiExternalLinkLine, RiMailLine } from 'react-icons/ri';
import { navigate } from '../router';

export function ContactPage() {
  const email = 'contact@indiamovieguide.com';
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Back
        </button>
        <span className="inline-pill">Contact</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Contact Us</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          For questions, partnership requests, or corrections, email us:
        </div>

        <div className="meta" style={{ marginTop: 12 }}>
          <a
            className="chip"
            href={`mailto:${email}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RiMailLine size={14} />
            {email}
            <RiExternalLinkLine size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}

