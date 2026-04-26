import { RiArrowLeftLine } from 'react-icons/ri';
import { linkHandler, navigate } from '../router';

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
        <h4>Privacy Policy</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Effective date: April 2025. We aim to collect as little personal information as possible
          and to be transparent about what we do collect.
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Information we collect</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            <strong>Account information:</strong> If you create an account, we store your email
            address and display name to identify you across sessions. Passwords are hashed and never
            stored in plain text.
          </div>
          <div className="tagline" style={{ lineHeight: 1.7, marginTop: 8 }}>
            <strong>Usage data:</strong> We use basic analytics (page views, referrers) to
            understand how the site is used. This data is aggregated and not tied to individual
            identities.
          </div>
          <div className="tagline" style={{ lineHeight: 1.7, marginTop: 8 }}>
            <strong>Feedback &amp; submissions:</strong> If you submit a movie or send feedback, we
            store the content of your submission along with the date.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Third-party data sources</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            Movie metadata, artwork, cast photos, and streaming availability come from third-party
            providers — TMDB, YouTube, and Wikipedia — and are cached locally for performance.
            When you click external links (trailers, streaming services, etc.) those sites have their
            own privacy policies. We are not affiliated with these providers.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Advertising</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            We use Google AdSense to display ads. Google may use cookies and similar technologies to
            show you relevant ads based on your browsing activity across websites. You can learn more
            or opt out at{' '}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'underline' }}
            >
              adssettings.google.com
            </a>
            .
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Cookies &amp; local storage</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            We use a session cookie to keep you signed in. We also store small items in{' '}
            <code>sessionStorage</code> (your last browsed page) so the back button returns you to
            the right place. No tracking cookies are set by us directly; advertising cookies are
            managed by Google AdSense as described above.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Data retention &amp; deletion</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            Account data is retained as long as your account is active. You may request deletion of
            your account and associated data at any time by contacting us.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Children's privacy</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            IndiaMovieGuide is not directed at children under 13. We do not knowingly collect
            personal information from children.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Changes to this policy</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>
            We may update this policy from time to time. The effective date at the top of the page
            reflects when it was last revised.
          </div>
        </div>

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Contact</h4>
          <div className="tagline">
            For privacy questions, use the{' '}
            <a href="/contact" onClick={linkHandler('/contact')} style={{ textDecoration: 'underline' }}>
              Contact Us
            </a>{' '}
            page.
          </div>
        </div>
      </div>
    </div>
  );
}
