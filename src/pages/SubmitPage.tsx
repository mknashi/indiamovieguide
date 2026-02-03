import { useEffect, useMemo, useState } from 'react';
import { RiArrowLeftLine, RiSendPlane2Line } from 'react-icons/ri';
import { CaptchaWidget } from '../components/CaptchaWidget';
import { navigate } from '../router';

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function SubmitPage() {
  const [kind, setKind] = useState<'movie' | 'tv'>('movie');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState<'Hindi' | 'Kannada' | 'Telugu' | 'Tamil' | 'Malayalam' | 'Marathi' | 'Bengali' | 'Punjabi' | 'Other' | ''>('');
  const [languageOther, setLanguageOther] = useState('');
  const [releaseDate, setReleaseDate] = useState(''); // YYYY-MM-DD via date input
  const [trailerUrl, setTrailerUrl] = useState('');
  const [ottProvider, setOttProvider] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [notes, setNotes] = useState('');
  const [castQuery, setCastQuery] = useState('');
  const [castResults, setCastResults] = useState<any[]>([]);
  const [cast, setCast] = useState<any[]>([]);
  const [newCastName, setNewCastName] = useState('');
  const [newCastPhoto, setNewCastPhoto] = useState('');
  const [newCastBio, setNewCastBio] = useState('');
  const [newCastFilmography, setNewCastFilmography] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        if (!data?.user) {
          navigate(`/login?next=${encodeURIComponent('/submit')}`);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const q = castQuery.trim();
    if (!q) {
      setCastResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/people/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!alive) return;
        setCastResults(Array.isArray(data.persons) ? data.persons : []);
      } catch {
        // ignore
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [castQuery]);

  const effectiveLanguage = useMemo(() => {
    if (language === 'Other') return languageOther.trim();
    return String(language || '').trim();
  }, [language, languageOther]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/account')}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Back
        </button>
        <span className="inline-pill">Submit</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <h4>Add a new movie / TV show (pending approval)</h4>
        <div className="tagline" style={{ lineHeight: 1.7 }}>
          Your submission will be reviewed by an admin before it appears publicly.
        </div>

        <div className="meta" style={{ marginTop: 12 }}>
          <button type="button" className={`filter ${kind === 'movie' ? 'active' : ''}`} onClick={() => setKind('movie')}>
            Movie
          </button>
          <button type="button" className={`filter ${kind === 'tv' ? 'active' : ''}`} onClick={() => setKind('tv')}>
            TV show
          </button>
        </div>

        <div className="search" style={{ marginTop: 12 }}>
          <input placeholder="Title *" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as any)}
            style={{
              flex: 1,
              padding: '14px 16px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: 'inherit',
              outline: 'none'
            }}
          >
            <option value="">Language (optional)</option>
            <option value="Hindi">Hindi</option>
            <option value="Kannada">Kannada</option>
            <option value="Telugu">Telugu</option>
            <option value="Tamil">Tamil</option>
            <option value="Malayalam">Malayalam</option>
            <option value="Marathi">Marathi</option>
            <option value="Bengali">Bengali</option>
            <option value="Punjabi">Punjabi</option>
            <option value="Other">Other…</option>
          </select>
        </div>
        {language === 'Other' ? (
          <div className="search" style={{ marginTop: 10 }}>
            <input placeholder="Enter language" value={languageOther} onChange={(e) => setLanguageOther(e.target.value)} />
            <div />
          </div>
        ) : null}

        <div className="search" style={{ marginTop: 10 }}>
          <input type="date" value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} />
          <input placeholder="Trailer URL" value={trailerUrl} onChange={(e) => setTrailerUrl(e.target.value)} />
        </div>

        <div className="search" style={{ marginTop: 10 }}>
          <input placeholder="OTT provider (e.g., Netflix)" value={ottProvider} onChange={(e) => setOttProvider(e.target.value)} />
          <input placeholder="Reference URL (official source)" value={referenceUrl} onChange={(e) => setReferenceUrl(e.target.value)} />
        </div>

        <div className="detail" style={{ marginTop: 12 }}>
          <h4>Synopsis</h4>
          <textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            placeholder="Short synopsis (optional)"
            style={{
              width: '100%',
              minHeight: 110,
              resize: 'vertical',
              padding: '12px 12px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: 'inherit',
              outline: 'none'
            }}
          />
        </div>

        <div className="detail" style={{ marginTop: 12 }}>
          <h4>Cast</h4>
          <div className="tagline">Search an existing cast member or add a new one (we’ll enrich later).</div>

          <div className="search" style={{ marginTop: 10 }}>
            <input
              placeholder="Search cast (e.g., Shah Rukh Khan)"
              value={castQuery}
              onChange={(e) => setCastQuery(e.target.value)}
            />
            <div />
          </div>

          {castResults.length ? (
            <div className="detail" style={{ marginTop: 10 }}>
              <h4>Results</h4>
              <div className="song-list" style={{ marginTop: 10 }}>
                {castResults.slice(0, 8).map((p) => (
                  <div key={p.id} className="song">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.profileImage ? (
                        <img
                          src={p.profileImage}
                          alt={p.name}
                          style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.10)' }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="chip" style={{ width: 38, height: 38, borderRadius: 12 }} />
                      )}
                      <div>
                        <strong>{p.name}</strong>
                        <div className="tagline">{p.tmdbId ? `TMDB ${p.tmdbId}` : 'Local profile'}</div>
                      </div>
                    </div>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={() => {
                        setCast((prev) => {
                          if (prev.some((c) => c.personId === p.id)) return prev;
                          return [...prev, { type: 'existing', personId: p.id, tmdbId: p.tmdbId, name: p.name, profileImage: p.profileImage }];
                        });
                      }}
                    >
                      Add
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="detail" style={{ marginTop: 10 }}>
            <h4>Add new cast member</h4>
            <div className="search" style={{ marginTop: 10 }}>
              <input placeholder="Name" value={newCastName} onChange={(e) => setNewCastName(e.target.value)} />
              <input placeholder="Photo URL" value={newCastPhoto} onChange={(e) => setNewCastPhoto(e.target.value)} />
            </div>
            <textarea
              value={newCastBio}
              onChange={(e) => setNewCastBio(e.target.value)}
              placeholder="Short biodata (optional)"
              style={{
                width: '100%',
                minHeight: 90,
                resize: 'vertical',
                padding: '12px 12px',
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.05)',
                color: 'inherit',
                outline: 'none',
                marginTop: 10
              }}
            />
            <div className="search" style={{ marginTop: 10 }}>
              <input
                placeholder="Filmography (comma separated titles)"
                value={newCastFilmography}
                onChange={(e) => setNewCastFilmography(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  const name = newCastName.trim();
                  if (!name) return;
                  const film = newCastFilmography
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setCast((prev) => [...prev, { type: 'new', name, profileImage: newCastPhoto.trim() || null, biography: newCastBio.trim() || null, filmography: film }]);
                  setNewCastName('');
                  setNewCastPhoto('');
                  setNewCastBio('');
                  setNewCastFilmography('');
                }}
              >
                Add new
              </button>
            </div>
          </div>

          {cast.length ? (
            <div className="detail" style={{ marginTop: 10 }}>
              <h4>Selected cast</h4>
              <div className="song-list" style={{ marginTop: 10 }}>
                {cast.map((c, idx) => (
                  <div key={`${c.type}-${c.personId || c.name}-${idx}`} className="song">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {c.profileImage ? (
                        <img
                          src={c.profileImage}
                          alt={c.name}
                          style={{ width: 38, height: 38, borderRadius: 12, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.10)' }}
                          loading="lazy"
                        />
                      ) : (
                        <div className="chip" style={{ width: 38, height: 38, borderRadius: 12 }} />
                      )}
                      <div>
                        <strong>{c.name}</strong>
                        <div className="tagline">{c.type === 'existing' ? 'Existing profile' : 'New (to be enriched)'}</div>
                      </div>
                    </div>
                    <button className="ghost-button" type="button" onClick={() => setCast((prev) => prev.filter((_, i) => i !== idx))}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="tagline" style={{ marginTop: 10 }}>No cast added yet.</div>
          )}
        </div>

        <div className="detail" style={{ marginTop: 12 }}>
          <h4>Notes</h4>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else that helps verification (optional)"
            style={{
              width: '100%',
              minHeight: 90,
              resize: 'vertical',
              padding: '12px 12px',
              borderRadius: 14,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.05)',
              color: 'inherit',
              outline: 'none'
            }}
          />
        </div>

        <div className="detail" style={{ marginTop: 12 }}>
          <h4>Captcha</h4>
          <div style={{ marginTop: 10 }}>
            <CaptchaWidget onToken={(t) => setCaptchaToken(t)} />
          </div>
        </div>

        {msg ? <div className="tagline" style={{ marginTop: 12 }}>{msg}</div> : null}

        <div style={{ marginTop: 12 }}>
          <button
            className="ghost-button"
            type="button"
            disabled={!title.trim() || loading}
            onClick={async () => {
              setLoading(true);
              setMsg(null);
              try {
                await postJson('/api/submissions', {
                  kind,
                  title,
                  language: effectiveLanguage,
                  releaseDate,
                  trailerUrl,
                  ottProvider,
                  referenceUrl,
                  synopsis,
                  notes,
                  cast,
                  captchaToken
                });
                setMsg('Submitted! Your entry is pending admin review.');
                setTitle('');
                setLanguage('');
                setLanguageOther('');
                setReleaseDate('');
                setTrailerUrl('');
                setOttProvider('');
                setReferenceUrl('');
                setSynopsis('');
                setNotes('');
                setCast([]);
              } catch (e: any) {
                setMsg(`Failed: ${e?.message || 'error'}`);
              } finally {
                setLoading(false);
              }
            }}
          >
            <RiSendPlane2Line style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Submit for review
          </button>
        </div>
      </div>
    </div>
  );
}
