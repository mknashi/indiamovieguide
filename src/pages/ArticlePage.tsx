import { useEffect, useState } from 'react';
import { RiArrowLeftLine, RiTimeLine } from 'react-icons/ri';
import { navigate } from '../router';
import { getArticle } from '../data/articles';
import { LANGUAGE_COLORS } from '../data/languageContent';

type PosterItem = { poster: string; title: string; id: number };

export function ArticlePage({ slug }: { slug: string }) {
  const article = getArticle(slug);
  const [posters, setPosters] = useState<PosterItem[]>([]);

  useEffect(() => {
    if (!article?.lang || article.lang === 'All') return;
    fetch(`/api/browse?lang=${encodeURIComponent(article.lang)}&page=1&pageSize=10`)
      .then((r) => r.json())
      .then((data) => {
        const movies = Array.isArray(data.movies) ? data.movies : [];
        setPosters(
          movies
            .filter((m: any) => m.poster)
            .slice(0, 8)
            .map((m: any) => ({ poster: m.poster, title: m.title, id: m.id }))
        );
      })
      .catch(() => {});
  }, [article?.lang]);

  if (!article) {
    return (
      <div>
        <div className="section-header" style={{ marginTop: 10 }}>
          <button className="ghost-button" type="button" onClick={() => navigate('/articles')}>
            <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}><RiArrowLeftLine /></span>
            All Articles
          </button>
        </div>
        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Article not found</h4>
          <div className="tagline">This article doesn't exist or has been moved.</div>
        </div>
      </div>
    );
  }

  const langKey = Object.keys(LANGUAGE_COLORS).find((k) =>
    article.industry.toLowerCase().includes(k.toLowerCase())
  );
  const colors = langKey ? LANGUAGE_COLORS[langKey] : null;

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/articles')}>
          <span style={{ marginRight: 6, display: 'inline-flex', alignItems: 'center' }}><RiArrowLeftLine /></span>
          All Articles
        </button>
        <span className="inline-pill">Article</span>
      </div>

      <div
        className="detail"
        style={{
          marginTop: 14,
          padding: '28px 24px',
          ...(colors ? { background: colors.bg, borderColor: colors.border } : {}),
        }}
      >
        {colors && (
          <span
            className="inline-pill"
            style={{ background: colors.accent, color: '#fff', border: 'none', marginBottom: 14, display: 'inline-block' }}
          >
            {article.industry}
          </span>
        )}
        <h1 style={{ margin: '0 0 10px', fontSize: 26, lineHeight: 1.3 }}>{article.title}</h1>
        <div className="tagline" style={{ fontSize: 16, lineHeight: 1.6, marginBottom: 14 }}>
          {article.subtitle}
        </div>
        <div className="meta" style={{ flexWrap: 'wrap' }}>
          <span className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <RiTimeLine size={13} />
            {article.readingTime}
          </span>
          <span className="chip">{new Date(article.publishedDate).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
        </div>
      </div>

      {posters.length > 0 && (
        <div style={{ marginTop: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', gap: 10, paddingBottom: 4 }}>
            {posters.map((p) => (
              <a
                key={p.id}
                href={`/movie/${p.id}`}
                title={p.title}
                onClick={(e) => {
                  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate(`/movie/${p.id}`);
                }}
                style={{ flexShrink: 0, borderRadius: 10, overflow: 'hidden', display: 'block', border: '1px solid var(--border)' }}
              >
                <img
                  src={p.poster}
                  alt={p.title}
                  style={{ height: 130, width: 87, objectFit: 'cover', display: 'block' }}
                  loading="lazy"
                />
              </a>
            ))}
          </div>
          <div className="tagline" style={{ marginTop: 6, fontSize: 12 }}>
            Recent {article.lang} releases — click to explore
          </div>
        </div>
      )}

      <div className="detail" style={{ marginTop: 12 }}>
        <div className="tagline" style={{ lineHeight: 1.9, fontSize: 15 }}>{article.intro}</div>
      </div>

      {article.sections.map((section) => (
        <div key={section.heading} className="detail" style={{ marginTop: 12 }}>
          <h4 style={{ marginBottom: 12 }}>{section.heading}</h4>
          {section.body.map((para, i) => (
            <div
              key={i}
              className="tagline"
              style={{ lineHeight: 1.9, fontSize: 15, marginTop: i > 0 ? 12 : 0 }}
            >
              {para}
            </div>
          ))}
        </div>
      ))}

      <div className="detail" style={{ marginTop: 12 }}>
        <h4>Must-Watch Films</h4>
        <div style={{ marginTop: 12 }}>
          {article.mustWatch.map((film, i) => (
            <div
              key={film.title}
              style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr',
                gap: '0 12px',
                paddingTop: i === 0 ? 0 : 14,
                marginTop: i === 0 ? 0 : 14,
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                alignItems: 'start',
              }}
            >
              <div
                className="tagline"
                style={{ fontWeight: 700, fontSize: 13, color: colors?.accent || 'var(--accent)', paddingTop: 2, textAlign: 'right' }}
              >
                {i + 1}.
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                  <a
                    href={`/search?q=${encodeURIComponent(film.title)}`}
                    style={{ fontWeight: 700, textDecoration: 'underline', textUnderlineOffset: 3 }}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      navigate(`/search?q=${encodeURIComponent(film.title)}`);
                    }}
                  >
                    {film.title}
                  </a>
                  <span className="tagline" style={{ fontSize: 13 }}>{film.year} · {film.language}</span>
                </div>
                <div className="tagline" style={{ lineHeight: 1.7, marginTop: 4 }}>{film.reason}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="detail" style={{ marginTop: 12 }}>
        <div className="tagline" style={{ marginBottom: 10 }}>Explore more</div>
        <div className="meta" style={{ flexWrap: 'wrap' }}>
          <button className="ghost-button" type="button" onClick={() => navigate('/articles')}>
            All Articles
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/lists')}>
            Film Guides
          </button>
          <button className="ghost-button" type="button" onClick={() => navigate('/')}>
            Browse New Releases
          </button>
        </div>
      </div>
    </div>
  );
}
