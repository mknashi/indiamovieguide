import { RiArrowLeftLine } from 'react-icons/ri';
import { navigate } from '../router';

export function PrivacyPage() {
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiArrowLeftLine  /></span>
          Back
        </button>
        <span className="inline-pill">Privacy</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Privacy Policy (draft)</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          We aim to collect as little personal information as possible.
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Data shown in the app</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            Movie metadata, artwork, trailers, and profiles may be fetched from third-party providers
            and cached locally for performance. Links to external providers open on their websites.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Cookies &amp; storage</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            The site may store small pieces of data in your browser (for example, to keep you signed
            in to the admin panel on this device).
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Contact</h4>
          <div className="tagline">
            For privacy questions, email <span className="chip">privacy@indiamovieguide.com</span>.
          </div>
        </div>
      </div>
    </div>
  );
}

