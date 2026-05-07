import { RiArrowLeftLine, RiTimeLine, RiArrowRightUpLine } from 'react-icons/ri';
import { navigate } from '../router';
import { ARTICLES } from '../data/articles';
import { LANGUAGE_COLORS } from '../data/languageContent';

export function ArticlesPage() {
  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}><RiArrowLeftLine /></span>
          Back
        </button>
        <span className="inline-pill">Articles</span>
      </div>

      <div className="detail" style={{ marginTop: 14, padding: '22px 24px' }}>
        <h4 style={{ marginTop: 0, marginBottom: 8 }}>Cinema in Depth</h4>
        <div className="tagline" style={{ lineHeight: 1.8 }}>
          Original long-form articles about Indian cinema — its industries, its history, its defining
          films, and the directors and stars who shaped it. Each piece is written to be a useful
          guide whether you are a long-time fan or discovering Indian film for the first time.
        </div>
      </div>

      <div className="section-header" style={{ marginTop: 20 }}>
        <h3>All Articles</h3>
        <span className="inline-pill">{ARTICLES.length} articles</span>
      </div>

      {ARTICLES.map((article) => {
        const langKey = Object.keys(LANGUAGE_COLORS).find((k) =>
          article.industry.toLowerCase().includes(k.toLowerCase())
        );
        const colors = langKey ? LANGUAGE_COLORS[langKey] : null;
        const href = `/article/${encodeURIComponent(article.slug)}`;

        return (
          <a
            key={article.slug}
            href={href}
            className="detail"
            style={{
              display: 'block',
              marginTop: 12,
              textDecoration: 'none',
              color: 'inherit',
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              navigate(href);
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                  {colors && (
                    <span
                      className="inline-pill"
                      style={{ background: colors.accent, color: '#fff', border: 'none' }}
                    >
                      {article.industry}
                    </span>
                  )}
                  <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <RiTimeLine size={12} />
                    {article.readingTime}
                  </span>
                </div>
                <h4 style={{ margin: '0 0 6px' }}>{article.title}</h4>
                <div className="tagline" style={{ lineHeight: 1.6 }}>{article.subtitle}</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', color: 'var(--muted)', flexShrink: 0, paddingTop: 4 }}>
                <RiArrowRightUpLine size={18} />
              </span>
            </div>
          </a>
        );
      })}

      <div className="detail" style={{ marginTop: 14 }}>
        <div className="tagline" style={{ marginBottom: 10 }}>Explore by category</div>
        <div className="meta" style={{ flexWrap: 'wrap' }}>
          <button className="ghost-button" type="button" onClick={() => navigate('/lists')}>
            Film Guides
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/streaming')}>
            What to Stream
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/people')}>
            Actor Profiles
          </button>
        </div>
      </div>
    </div>
  );
}
