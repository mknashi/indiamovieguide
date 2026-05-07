import { RiArrowLeftLine, RiExternalLinkLine, RiMailLine } from 'react-icons/ri';
import { linkHandler, navigate } from '../router';

const FAQ = [
  {
    q: 'How often is the movie catalog updated?',
    a: 'New releases and upcoming titles are pulled from TMDB on a rolling basis. Most new films appear within a few days of their theatrical or OTT release date being announced. If you notice a missing title, use the Add a Movie form to suggest it.',
  },
  {
    q: 'Why is streaming availability sometimes missing or outdated?',
    a: 'Streaming catalogs change frequently — titles get added, removed, and moved between platforms without notice. We cache availability data from TMDB\'s JustWatch-backed provider data for India. Opening a movie\'s detail page triggers a background refresh of its streaming links. If a title is missing an OTT link, try checking back after a few hours.',
  },
  {
    q: 'How do I report incorrect or missing movie information?',
    a: 'Email us at the address below with the movie title, what information is wrong, and the correct details. For cast errors, a link to the TMDB or Wikipedia page for the title helps speed up the fix. We aim to review corrections within a few business days.',
  },
  {
    q: 'Can I add a movie that is not in the catalog?',
    a: 'Yes — use the Add a Movie link in the navigation (or go to /submit). Submitted titles go into a review queue and are added once we can verify the details. We prioritize films with a TMDB entry, as that lets us pull cast, synopsis, posters, and streaming data automatically.',
  },
  {
    q: 'Why can\'t I find a specific actor or director?',
    a: 'Our people index currently covers cast members who appear in movies already in the catalog. If the person is missing, they may belong to a film that hasn\'t been added yet. Try searching by a film they are known for, then navigate to the cast section of that movie page.',
  },
  {
    q: 'Where does biography and cast information come from?',
    a: 'Actor biographies come from Wikipedia, and cast and crew credits come from TMDB (The Movie Database). Both are community-maintained databases. If you spot an error in a biography, the most effective fix is to correct it on Wikipedia or TMDB — our system re-fetches from those sources periodically.',
  },
  {
    q: 'What languages and industries does IndiaMovieGuide cover?',
    a: 'We cover eight major Indian film languages: Hindi (Bollywood), Tamil (Kollywood), Telugu (Tollywood), Kannada (Sandalwood), Malayalam (Mollywood), Marathi, Bengali, and Punjabi. We are adding more regional industries over time. Use the language filter in the top navigation to browse each industry separately.',
  },
  {
    q: 'Do you accept advertising or partnership requests?',
    a: 'We are open to relevant advertising partnerships, editorial collaborations, and data licensing discussions. Email us with a brief description of the partnership you have in mind and we will respond as soon as possible.',
  },
  {
    q: 'Is IndiaMovieGuide affiliated with any streaming service or studio?',
    a: 'No. IndiaMovieGuide is an independent site. We are not affiliated with Netflix, Amazon Prime Video, Disney+ Hotstar, JioCinema, ZEE5, SonyLIV, or any film studio or production house. Streaming links point to those services\' own pages and we earn no referral fees from them.',
  },
  {
    q: 'How do I delete my account or request removal of my data?',
    a: 'Email us from the address associated with your account. We will delete your account and all associated data — favorites, watchlists, and any submitted reviews — within 7 business days and confirm by email once done.',
  },
];

export function ContactPage() {
  const email = 'contact@indiamovieguide.com';
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}><RiArrowLeftLine /></span>
          Back
        </button>
        <span className="inline-pill">Contact</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Contact Us</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Have a question, found an error, want to suggest a missing film, or interested in
          partnering with us? We read every message and do our best to respond promptly.
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
        <div className="tagline" style={{ marginTop: 10, lineHeight: 1.7 }}>
          You can also use the{' '}
          <a href="/feedback" onClick={linkHandler('/feedback')} style={{ textDecoration: 'underline' }}>
            feedback form
          </a>{' '}
          for quick suggestions, or the{' '}
          <a href="/submit" onClick={linkHandler('/submit')} style={{ textDecoration: 'underline' }}>
            Add a Movie
          </a>{' '}
          form to submit missing titles directly.
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 24 }}>
        <h3>Frequently Asked Questions</h3>
      </div>

      {FAQ.map((item) => (
        <div key={item.q} className="detail" style={{ marginTop: 10 }}>
          <h4 style={{ marginTop: 0, marginBottom: 8 }}>{item.q}</h4>
          <div className="tagline" style={{ lineHeight: 1.7 }}>{item.a}</div>
        </div>
      ))}

      <div className="detail" style={{ marginTop: 16 }}>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Can't find an answer above?{' '}
          <a href={`mailto:${email}`} style={{ textDecoration: 'underline' }}>
            Email us directly
          </a>{' '}
          and we'll get back to you.
        </div>
      </div>
    </div>
  );
}
