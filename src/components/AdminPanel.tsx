import { useEffect, useMemo, useState } from 'react';
import {
  RiCloseLine,
  RiDashboardLine,
  RiLock2Line,
  RiLogoutBoxRLine,
  RiRefreshLine,
  RiRocketLine,
  RiSettings3Line
} from 'react-icons/ri';

interface AdminStatus {
  now: string;
  dbPath: string;
  counts: { movies: number; persons: number; songs: number; ottOffers: number; ratings: number; reviews: number };
  lastHomeSeedAt: number;
  lastHomeSeedAtIso?: string | null;
  lastAllLanguagesSeedAtIso?: string | null;
  languageSeeds?: Record<string, string | null>;
  youtubeQuotaUntilIso?: string | null;
  backfill?: any;
  agentLastRun?: {
    startedAt?: string;
    finishedAt?: string;
    discovered?: number;
    fetched?: number;
    upserted?: number;
    skippedNonIndian?: number;
    trailerUpdated?: number;
    songsUpserted?: number;
    ratingsUpserted?: number;
    errors?: number;
  } | null;
  pending?: { submissions: number; userReviews: number; personSubmissions: number };
  keys: { tmdb: boolean; youtube: boolean; omdb: boolean };
}

type AdminSongRow = {
  id: string;
  title: string;
  singers: string[];
  youtubeUrl?: string;
  platform?: string;
  source?: string;
  createdAt?: string;
};

type AdminMovieEditorPayload = {
  movieId: string;
  movie: any;
  songs: AdminSongRow[];
  cast?: {
    personId: string;
    tmdbId?: number;
    name: string;
    profileImage?: string;
    profileUrl?: string;
    character?: string;
    billingOrder?: number | null;
  }[];
};

type ModerationQueue = {
  now: string;
  submissions: {
    id: string;
    kind: string;
    title: string;
    language?: string;
    createdAt: string;
    user: { email: string; displayName?: string };
    payload: any;
  }[];
  reviews: {
    id: string;
    movieId: string;
    movieTitle: string;
    rating: number | null;
    body: string;
    createdAt: string;
    user: { email: string; displayName?: string };
  }[];
  personSubmissions: {
    id: string;
    personId?: string;
    name: string;
    profileImage?: string;
    biography?: string;
    filmography?: any[];
    createdAt: string;
    user: { email: string; displayName?: string };
  }[];
};

const ADMIN_LANGUAGE_OPTIONS = [
  'Hindi',
  'Kannada',
  'Telugu',
  'Tamil',
  'Malayalam',
  'Marathi',
  'Bengali',
  'Punjabi'
];

const ADMIN_STATUS_OPTIONS = ['Now Showing', 'Streaming', 'Upcoming', 'Announced'];

async function postJson(url: string, body: any, token?: string) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-admin-token': token } : {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

async function getJson(url: string, token: string) {
  const res = await fetch(url, { headers: { 'x-admin-token': token }, cache: 'no-store' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data;
}

export function AdminPanel({
  onClose,
  variant = 'page'
}: {
  onClose?: () => void;
  variant?: 'page' | 'modal';
}) {
  const [password, setPassword] = useState('');
  const [token, setToken] = useState<string>(() => localStorage.getItem('img_admin_token') || '');
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [queue, setQueue] = useState<ModerationQueue | null>(null);
  const [tab, setTab] = useState<'overview' | 'seeding' | 'catalog' | 'moderation' | 'ingestion'>('overview');
  const [seedLang, setSeedLang] = useState<string>('Hindi');
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [backfillScope, setBackfillScope] = useState<'all' | 'language'>('all');
  const [backfillLang, setBackfillLang] = useState<string>('Hindi');
  const [backfillParams, setBackfillParams] = useState({
    strategy: 'mixed' as 'popular' | 'mixed',
    lookbackDays: 5475,
    forwardDays: 365,
    pages: 5,
    maxIds: 120,
    desiredTotal: 2500,
    desiredUpcoming: 30,
    force: true
  });
  const [backfillState, setBackfillState] = useState<any>(null);
  const [movieSearchQuery, setMovieSearchQuery] = useState('');
  const [movieSearchResults, setMovieSearchResults] = useState<any[]>([]);
  const [editorQuery, setEditorQuery] = useState('');
  const [editor, setEditor] = useState<AdminMovieEditorPayload | null>(null);
  const [movieForm, setMovieForm] = useState({
    title: '',
    language: '',
    releaseDate: '',
    status: '',
    director: '',
    trailerUrl: '',
    synopsis: ''
  });
  const [songDrafts, setSongDrafts] = useState<
    Record<string, { title: string; singers: string; youtubeUrl: string; platform: string }>
  >({});
  const [newSong, setNewSong] = useState({ title: '', singers: '', youtubeUrl: '', platform: 'YouTube' });
  const [personQuery, setPersonQuery] = useState('');
  const [personResults, setPersonResults] = useState<any[]>([]);
  const [castAdd, setCastAdd] = useState({ personId: '', character: '', billingOrder: '' });
  const [castDrafts, setCastDrafts] = useState<Record<string, { character: string; billingOrder: string }>>({});
  const [incompleteStatus, setIncompleteStatus] = useState<'Upcoming' | 'Announced' | 'Now Showing' | 'Streaming'>('Upcoming');
  const [incompleteLang, setIncompleteLang] = useState<string>('');
  const [incompleteMovies, setIncompleteMovies] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loggedIn = !!token;

  const loadEditor = async (t: string, rawMovieId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = (await getJson(`/api/admin/movies/${encodeURIComponent(rawMovieId)}`, t)) as AdminMovieEditorPayload;
      setEditor(data);
      setMovieSearchResults([]);
      const m: any = (data as any).movie || {};
      setMovieForm({
        title: String(m.title || ''),
        language: String(m.language || ''),
        releaseDate: String(m.releaseDate || ''),
        status: String(m.status || ''),
        director: String(m.director || ''),
        trailerUrl: String(m.trailerUrl || ''),
        synopsis: String(m.synopsis || '')
      });
      const drafts: Record<string, { title: string; singers: string; youtubeUrl: string; platform: string }> = {};
      for (const s of (data.songs || []) as AdminSongRow[]) {
        drafts[s.id] = {
          title: String(s.title || ''),
          singers: Array.isArray(s.singers) ? s.singers.join(', ') : '',
          youtubeUrl: String(s.youtubeUrl || ''),
          platform: String(s.platform || 'YouTube')
        };
      }
      setSongDrafts(drafts);
      const cd: Record<string, { character: string; billingOrder: string }> = {};
      for (const c of (data.cast || []) as any[]) {
        cd[String(c.personId)] = {
          character: String(c.character || ''),
          billingOrder: c.billingOrder != null ? String(c.billingOrder) : ''
        };
      }
      setCastDrafts(cd);
    } catch (e: any) {
      setError(e?.message || 'Failed to load movie editor');
    } finally {
      setLoading(false);
    }
  };

  const loadStatus = async (t: string) => {
    setLoading(true);
    setError(null);
    try {
      const s = (await getJson('/api/admin/status', t)) as AdminStatus;
      setStatus(s);
    } catch (e: any) {
      setError(e?.message || 'Failed to load admin status');
    } finally {
      setLoading(false);
    }
  };

  const loadQueue = async (t: string) => {
    try {
      const q = (await getJson('/api/admin/moderation', t)) as ModerationQueue;
      setQueue(q);
    } catch {
      // ignore; status page should still load
    }
  };

  useEffect(() => {
    if (token) {
      loadStatus(token);
      loadQueue(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setBackfillState(status?.backfill || null);
  }, [status?.backfill]);

  useEffect(() => {
    if (!token) return;
    const running = backfillState?.status === 'running';
    if (!running) return;
    const id = window.setInterval(async () => {
      try {
        const r = await getJson('/api/admin/backfill/status', token);
        setBackfillState((r as any)?.backfill || null);
      } catch {
        // ignore
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [token, backfillState?.status]);

  const lastSeedText = useMemo(() => {
    if (!status?.lastHomeSeedAt) return 'never';
    const d = new Date(status.lastHomeSeedAt);
    return d.toLocaleString();
  }, [status]);

  const lastAllLangSeedText = useMemo(() => {
    if (!status?.lastAllLanguagesSeedAtIso) return 'never';
    const d = new Date(status.lastAllLanguagesSeedAtIso);
    return !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(status.lastAllLanguagesSeedAtIso);
  }, [status]);

  const ytQuotaText = useMemo(() => {
    const iso = status?.youtubeQuotaUntilIso;
    if (!iso) return 'ok';
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) ? `paused until ${d.toLocaleString()}` : `paused until ${iso}`;
  }, [status]);

  const agentLastRunText = useMemo(() => {
    const a = status?.agentLastRun;
    if (!a?.finishedAt && !a?.startedAt) return 'never';
    const ts = a.finishedAt || a.startedAt;
    const d = ts ? new Date(ts) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(ts);
  }, [status]);

  const body = (
    <div
      className="card admin-card"
      style={{
        width: 'min(1040px, 96vw)',
        maxHeight: variant === 'modal' ? '88vh' : 'none',
        overflow: variant === 'modal' ? 'auto' : 'visible'
      }}
    >
      <div
        style={{
          padding: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}
      >
        <div style={{ fontWeight: 900, letterSpacing: 0.2 }}>Admin Console</div>
        {variant === 'modal' && onClose ? (
          <button className="ghost-button" onClick={onClose} type="button">
            <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiCloseLine  /></span>
            Close
          </button>
        ) : null}
      </div>

      <div style={{ padding: 16 }}>
          {!loggedIn ? (
            <div className="detail">
              <h4>
                <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiLock2Line  /></span>
                Sign in
              </h4>
              <div className="tagline">Enter the admin password (server env `ADMIN_PASSWORD`).</div>
              <div className="search" style={{ marginTop: 12 }}>
                <input
                  placeholder="Admin password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  onClick={async () => {
                    setLoading(true);
                    setError(null);
                    try {
                      const data = await postJson('/api/admin/login', { password });
                      const t = String(data.token || '');
                      if (!t) throw new Error('No token returned');
                      localStorage.setItem('img_admin_token', t);
                      setToken(t);
                      await loadStatus(t);
                      await loadQueue(t);
                    } catch (e: any) {
                      setError(e?.message || 'Login failed');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Sign in
                </button>
              </div>
              {error && <div className="tagline" style={{ marginTop: 10 }}>Error: {error}</div>}
            </div>
          ) : (
            <>
              <div className="detail">
                <div className="meta" style={{ justifyContent: 'space-between' }}>
                  <span className="chip">Admin session active</span>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        setSeedMsg(null);
                        await loadStatus(token);
                        await loadQueue(token);
                      }}
                    >
                      <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiRefreshLine  /></span>
                      Refresh
                    </button>
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        try {
                          await postJson('/api/admin/logout', {}, token);
                        } catch {
                          // ignore
                        } finally {
                          localStorage.removeItem('img_admin_token');
                          setToken('');
                          setStatus(null);
                          setQueue(null);
                        }
                      }}
                    >
                      <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiLogoutBoxRLine  /></span>
                      Sign out
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  {(['overview', 'seeding', 'catalog', 'moderation', 'ingestion'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`filter ${tab === t ? 'active' : ''}`}
                      onClick={() => setTab(t)}
                      title={t}
                    >
                      {t === 'overview' ? (
                        <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiDashboardLine  /></span>
                      ) : null}
                      {t === 'seeding' ? (
                        <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiRocketLine  /></span>
                      ) : null}
                      {t === 'catalog' ? (
                        <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiSettings3Line  /></span>
                      ) : null}
                      {t[0].toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                {error ? <div className="tagline" style={{ marginTop: 10 }}>Error: {error}</div> : null}
                {seedMsg ? <div className="tagline" style={{ marginTop: 10 }}>{seedMsg}</div> : null}
              </div>

              {tab === 'overview' ? (
                <div style={{ marginTop: 12 }}>
                  <div className="detail">
                    {status ? (
                      <>
                        <div className="meta">
                          <span className="chip">Now: {new Date(status.now).toLocaleString()}</span>
                          <span className="chip">DB: {status.dbPath}</span>
                          <span className="chip">Home seed: {lastSeedText}</span>
                          <span className="chip">YouTube: {ytQuotaText}</span>
                        </div>
                        <div className="meta" style={{ marginTop: 10 }}>
                          <span className="chip">Movies: {status.counts.movies}</span>
                          <span className="chip">Persons: {status.counts.persons}</span>
                          <span className="chip">Songs: {status.counts.songs}</span>
                          <span className="chip">OTT: {status.counts.ottOffers}</span>
                          <span className="chip">Ratings: {status.counts.ratings}</span>
                          <span className="chip">Reviews: {status.counts.reviews}</span>
                        </div>
                        <div className="meta" style={{ marginTop: 10 }}>
                          <span className="chip">TMDB key: {status.keys.tmdb ? 'set' : 'missing'}</span>
                          <span className="chip">YouTube key: {status.keys.youtube ? 'set' : 'missing'}</span>
                          <span className="chip">OMDb key: {status.keys.omdb ? 'set' : 'missing'}</span>
                          {status.pending ? (
                            <span className="chip">
                              Pending: {status.pending.submissions} submissions · {status.pending.userReviews} reviews ·{' '}
                              {status.pending.personSubmissions} people
                            </span>
                          ) : null}
                        </div>
                        <div className="meta" style={{ marginTop: 10 }}>
                          <span className="chip">Agent last run: {agentLastRunText}</span>
                          {status.agentLastRun?.upserted != null ? (
                            <span className="chip">Upserted: {status.agentLastRun.upserted}</span>
                          ) : null}
                          {status.agentLastRun?.errors != null ? (
                            <span className="chip">Errors: {status.agentLastRun.errors}</span>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="tagline">Loading status…</div>
                    )}
                  </div>
                </div>
              ) : null}

              {tab === 'seeding' ? (
                <div style={{ marginTop: 12 }}>
                  <div className="detail">
                    <h4 style={{ marginTop: 0 }}>Seeding</h4>
                    <div className="tagline">
                      Use this to warm the cache on Render and refresh language shelves (New/Upcoming) for better coverage.
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          setLoading(true);
                          setError(null);
                          setSeedMsg(null);
                          try {
                            await postJson('/api/admin/seed/home', { seedAllLanguages: true }, token);
                            setSeedMsg('Home shelves seeded (and language shelves kicked off).');
                            await loadStatus(token);
                          } catch (e: any) {
                            setError(e?.message || 'Seed failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiRocketLine  /></span>
                        Seed home + languages
                      </button>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          setLoading(true);
                          setError(null);
                          setSeedMsg(null);
                          try {
                            await postJson('/api/admin/seed/all-languages', { force: true }, token);
                            setSeedMsg('All languages seeded.');
                            await loadStatus(token);
                          } catch (e: any) {
                            setError(e?.message || 'Seed failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Seed all languages (force)
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                      <select className="input" value={seedLang} onChange={(e) => setSeedLang(e.target.value)}>
                        {['Hindi', 'Kannada', 'Telugu', 'Tamil', 'Malayalam', 'Marathi', 'Bengali'].map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </select>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          setLoading(true);
                          setError(null);
                          setSeedMsg(null);
                          try {
                            const r = await postJson('/api/admin/seed/language', { lang: seedLang, force: true }, token);
                            setSeedMsg(`${seedLang}: attempted ${r?.result?.attempted ?? 0}, wrote ${r?.result?.wrote ?? 0}`);
                            await loadStatus(token);
                          } catch (e: any) {
                            setError(e?.message || 'Seed failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Seed language (force)
                      </button>
                    </div>

                    {status ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="meta">
                          <span className="chip">Last all-languages seed: {lastAllLangSeedText}</span>
                          <span className="chip">Home seed: {lastSeedText}</span>
                        </div>
                        {status.languageSeeds ? (
                          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                            {Object.entries(status.languageSeeds).map(([k, v]) => (
                              <div key={k} className="chip" title="Last language seed">
                                {k}: {v ? new Date(v).toLocaleString() : 'never'}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <div className="detail" style={{ marginTop: 14 }}>
                    <h4 style={{ marginTop: 0 }}>Bulk backfill</h4>
                    <div className="tagline">
                      Runs a longer TMDB backfill (popular bias) to grow the catalog. This can take several minutes.
                    </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                        <select
                          className="input"
                          value={backfillParams.strategy}
                          onChange={(e) =>
                            setBackfillParams((p) => ({
                              ...p,
                              strategy: e.target.value === 'popular' ? 'popular' : 'mixed'
                            }))
                          }
                          title="Discover strategy"
                          style={{ minWidth: 220 }}
                        >
                          <option value="mixed">Mixed strategy (recommended)</option>
                          <option value="popular">Popular only</option>
                        </select>

                        <select
                          className="input"
                          value={backfillScope}
                          onChange={(e) => setBackfillScope(e.target.value === 'language' ? 'language' : 'all')}
                          title="Scope"
                          style={{ minWidth: 220 }}
                        >
                          <option value="all">All languages</option>
                          <option value="language">One language</option>
                        </select>

                      {backfillScope === 'language' ? (
                        <select
                          className="input"
                          value={backfillLang}
                          onChange={(e) => setBackfillLang(e.target.value)}
                          title="Language"
                          style={{ minWidth: 220 }}
                        >
                          {ADMIN_LANGUAGE_OPTIONS.filter((l) => l !== 'Punjabi').map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      ) : null}

                      <label className="chip" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!backfillParams.force}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, force: e.target.checked }))}
                        />
                        Force
                      </label>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: 10,
                        marginTop: 12
                      }}
                    >
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="tagline">Lookback days</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(backfillParams.lookbackDays)}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, lookbackDays: Number(e.target.value || 0) }))}
                          placeholder="e.g. 5475"
                          title="How far back to discover titles (popular bias)."
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="tagline">Forward days</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(backfillParams.forwardDays)}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, forwardDays: Number(e.target.value || 0) }))}
                          placeholder="e.g. 365"
                          title="How far ahead to discover upcoming titles."
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="tagline">Pages (1–20)</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(backfillParams.pages)}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, pages: Number(e.target.value || 0) }))}
                          placeholder="e.g. 5"
                          title="How many TMDB discover pages to scan per language."
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="tagline">Max IDs (16–600)</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(backfillParams.maxIds)}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, maxIds: Number(e.target.value || 0) }))}
                          placeholder="e.g. 120"
                          title="Max unique TMDB IDs fetched per language run."
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="tagline">Desired total / language</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(backfillParams.desiredTotal)}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, desiredTotal: Number(e.target.value || 0) }))}
                          placeholder="e.g. 2500"
                          title="If the language already has at least this many titles, it may skip unless forced."
                        />
                      </label>
                      <label style={{ display: 'grid', gap: 6 }}>
                        <span className="tagline">Desired upcoming / language</span>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={String(backfillParams.desiredUpcoming)}
                          onChange={(e) => setBackfillParams((p) => ({ ...p, desiredUpcoming: Number(e.target.value || 0) }))}
                          placeholder="e.g. 30"
                          title="If the language already has at least this many upcoming titles, it may skip unless forced."
                        />
                      </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                      <button
                        className="ghost-button"
                        type="button"
                        disabled={loading || backfillState?.status === 'running'}
                        onClick={async () => {
                          if (!token) return;
                          setLoading(true);
                          setError(null);
                          try {
                            const r = await postJson(
                              '/api/admin/backfill/start',
                              {
                                scope: backfillScope,
                                lang: backfillScope === 'language' ? backfillLang : '',
                                force: !!backfillParams.force,
                                overrides: {
                                  strategy: backfillParams.strategy,
                                  lookbackDays: backfillParams.lookbackDays,
                                  forwardDays: backfillParams.forwardDays,
                                  pages: backfillParams.pages,
                                  maxIds: backfillParams.maxIds,
                                  desiredTotal: backfillParams.desiredTotal,
                                  desiredUpcoming: backfillParams.desiredUpcoming
                                }
                              },
                              token
                            );
                            setBackfillState((r as any)?.backfill || null);
                            await loadStatus(token);
                          } catch (e: any) {
                            setError(e?.message || 'Backfill failed to start');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Start backfill
                      </button>

                      <button
                        className="ghost-button"
                        type="button"
                        disabled={loading || backfillState?.status !== 'running'}
                        onClick={async () => {
                          if (!token) return;
                          setLoading(true);
                          setError(null);
                          try {
                            await postJson('/api/admin/backfill/cancel', {}, token);
                            const r = await getJson('/api/admin/backfill/status', token);
                            setBackfillState((r as any)?.backfill || null);
                          } catch (e: any) {
                            setError(e?.message || 'Cancel failed');
                          } finally {
                            setLoading(false);
                          }
                        }}
                      >
                        Cancel
                      </button>

                      {backfillState?.status ? (
                        <span className="chip" title="Backfill status">
                          Status: {String(backfillState.status)}
                        </span>
                      ) : (
                        <span className="chip" title="Backfill status">Status: idle</span>
                      )}
                    </div>

                    {backfillState ? (
                      <div style={{ marginTop: 12 }}>
                        <div className="meta">
                          {backfillState.startedAt ? <span className="chip">Started: {new Date(backfillState.startedAt).toLocaleString()}</span> : null}
                          {backfillState.finishedAt ? <span className="chip">Finished: {new Date(backfillState.finishedAt).toLocaleString()}</span> : null}
                          {backfillState.totals ? (
                            <>
                              <span className="chip">Attempted: {backfillState.totals.attempted ?? 0}</span>
                              <span className="chip">Wrote: {backfillState.totals.wrote ?? 0}</span>
                              <span className="chip">Errors: {backfillState.totals.errors ?? 0}</span>
                            </>
                          ) : null}
                        </div>
                        {backfillState.error ? (
                          <div className="tagline" style={{ marginTop: 10 }}>
                            Error: {String(backfillState.error)}
                          </div>
                        ) : null}
                        {Array.isArray(backfillState.results) && backfillState.results.length ? (
                          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                            {backfillState.results.slice(0, 12).map((x: any) => (
                              <div key={String(x.lang)} className="chip" title="Per-language result">
                                {x.lang}: attempted {x.attempted ?? 0}, wrote {x.wrote ?? 0}
                                {x.error ? ' (error)' : ''}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="tagline" style={{ marginTop: 10 }}>
                        Tip: For a 20k “popular old + new” catalog, run this a few times rather than one huge run.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {tab === 'ingestion' ? (
                <>
                  <div className="section-header">
                    <h3>Ingestion</h3>
                    <span className="inline-pill">Admin only</span>
                  </div>
                  <div className="detail">
                    {status?.agentLastRun ? (
                      <div className="meta" style={{ marginTop: 2 }}>
                        {status.agentLastRun.startedAt ? (
                          <span className="chip">Started: {new Date(status.agentLastRun.startedAt).toLocaleString()}</span>
                        ) : null}
                        {status.agentLastRun.finishedAt ? (
                          <span className="chip">Finished: {new Date(status.agentLastRun.finishedAt).toLocaleString()}</span>
                        ) : null}
                        {status.agentLastRun.discovered != null ? (
                          <span className="chip">Discovered: {status.agentLastRun.discovered}</span>
                        ) : null}
                        {status.agentLastRun.fetched != null ? (
                          <span className="chip">Fetched: {status.agentLastRun.fetched}</span>
                        ) : null}
                        {status.agentLastRun.skippedNonIndian != null ? (
                          <span className="chip">Skipped non-Indian: {status.agentLastRun.skippedNonIndian}</span>
                        ) : null}
                        {status.agentLastRun.trailerUpdated != null ? (
                          <span className="chip">Trailer updates: {status.agentLastRun.trailerUpdated}</span>
                        ) : null}
                        {status.agentLastRun.songsUpserted != null ? (
                          <span className="chip">Songs upserted: {status.agentLastRun.songsUpserted}</span>
                        ) : null}
                        {status.agentLastRun.ratingsUpserted != null ? (
                          <span className="chip">Ratings upserted: {status.agentLastRun.ratingsUpserted}</span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="tagline">Agent has not been run yet (or no `.cache/agent-last-run.json` found).</div>
                    )}
                    <div className="tagline" style={{ marginTop: 10 }}>
                      Batch ingestion is optional; the site will auto-fill on demand via TMDB and persist results in SQLite.
                    </div>
                    <div className="tagline" style={{ marginTop: 8 }}>
                      To run the batch agent manually, execute <code>npm run agent:run</code> and redeploy.
                    </div>
                  </div>
                </>
              ) : null}

              {tab === 'catalog' ? (
              <>
              <div className="section-header">
                <h3>Catalog editor</h3>
                <span className="inline-pill">Admin only</span>
              </div>
              <div className="detail">
                <div className="tagline">
                  Manage local catalog data. Edits are saved to SQLite and won&apos;t be overwritten by auto-enrichment.
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="tagline">Find incomplete movies (missing synopsis/artwork/cast)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
                    <select
                      className="input"
                      value={incompleteStatus}
                      onChange={(e) =>
                        setIncompleteStatus(
                          (['Upcoming', 'Announced', 'Now Showing', 'Streaming'].includes(e.target.value)
                            ? e.target.value
                            : 'Upcoming') as any
                        )
                      }
                      style={{ minWidth: 220 }}
                      title="Status"
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Announced">Announced</option>
                      <option value="Now Showing">Now Showing</option>
                      <option value="Streaming">Streaming</option>
                    </select>

                    <select
                      className="input"
                      value={incompleteLang}
                      onChange={(e) => setIncompleteLang(e.target.value)}
                      style={{ minWidth: 220 }}
                      title="Language"
                    >
                      <option value="">All languages</option>
                      {ADMIN_LANGUAGE_OPTIONS.filter((l) => l !== 'Punjabi').map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>

                    <button
                      className="ghost-button"
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        setLoading(true);
                        setError(null);
                        try {
                          const qp = new URLSearchParams();
                          qp.set('status', incompleteStatus);
                          if (incompleteLang) qp.set('lang', incompleteLang);
                          qp.set('limit', '60');
                          const r = await getJson(`/api/admin/movies-incomplete?${qp.toString()}`, token);
                          setIncompleteMovies(Array.isArray((r as any)?.movies) ? (r as any).movies : []);
                        } catch (e: any) {
                          setError(e?.message || 'Load failed');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Load list
                    </button>
                  </div>

                  {incompleteMovies.length ? (
                    <div className="song-list" style={{ marginTop: 10 }}>
                      {incompleteMovies.slice(0, 60).map((m) => (
                        <div key={m.id} className="song" style={{ alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, flex: 1 }}>
                            {m.poster ? (
                              <img
                                src={m.poster}
                                alt=""
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  objectFit: 'cover',
                                  border: '1px solid rgba(255,255,255,0.10)'
                                }}
                                loading="lazy"
                              />
                            ) : (
                              <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                            )}
                            <div>
                              <strong>{m.title}</strong>
                              <div className="tagline" style={{ marginTop: 4 }}>
                                {(m.language ? m.language : 'Unknown') +
                                  (m.releaseDate ? ` · ${m.releaseDate}` : '') +
                                  (m.tmdbId ? ` · tmdb:${m.tmdbId}` : '')}
                              </div>
                              <div className="meta" style={{ marginTop: 6 }}>
                                {m.missing?.synopsis ? <span className="chip">Missing synopsis</span> : null}
                                {m.missing?.artwork ? <span className="chip">Missing artwork</span> : null}
                                {m.missing?.cast ? <span className="chip">Missing cast</span> : null}
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                setLoading(true);
                                setError(null);
                                try {
                                  await postJson(`/api/admin/movies/${encodeURIComponent(String(m.id))}/refresh`, {}, token);
                                  const qp = new URLSearchParams();
                                  qp.set('status', incompleteStatus);
                                  if (incompleteLang) qp.set('lang', incompleteLang);
                                  qp.set('limit', '60');
                                  const r = await getJson(`/api/admin/movies-incomplete?${qp.toString()}`, token);
                                  setIncompleteMovies(Array.isArray((r as any)?.movies) ? (r as any).movies : []);
                                } catch (e: any) {
                                  setError(e?.message || 'Refresh failed');
                                } finally {
                                  setLoading(false);
                                }
                              }}
                            >
                              Refresh
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await loadEditor(token, String(m.id));
                              }}
                            >
                              Load
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="tagline">Search movies by title (local DB; supports punctuation/“sounds like” matching)</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <input
                      className="input"
                      value={movieSearchQuery}
                      onChange={(e) => setMovieSearchQuery(e.target.value)}
                      placeholder="e.g. Baahubali, KGF, RRR…"
                      style={{ minWidth: 260, flex: '1 1 260px' }}
                    />
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={async () => {
                        if (!token) return;
                        const q = movieSearchQuery.trim();
                        if (!q) return;
                        setLoading(true);
                        setError(null);
                        try {
                          const r = await getJson(`/api/admin/movies-search?q=${encodeURIComponent(q)}`, token);
                          setMovieSearchResults(Array.isArray((r as any)?.movies) ? (r as any).movies : []);
                        } catch (e: any) {
                          setError(e?.message || 'Search failed');
                        } finally {
                          setLoading(false);
                        }
                      }}
                    >
                      Search
                    </button>
                  </div>

                  {movieSearchResults.length ? (
                    <div className="song-list" style={{ marginTop: 10 }}>
                      {movieSearchResults.slice(0, 30).map((m) => (
                        <div key={m.id} className="song" style={{ alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, flex: 1 }}>
                            {m.poster ? (
                              <img
                                src={m.poster}
                                alt=""
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  objectFit: 'cover',
                                  border: '1px solid rgba(255,255,255,0.10)'
                                }}
                                loading="lazy"
                              />
                            ) : (
                              <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                            )}
                            <div>
                              <strong>{m.title}</strong>
                              <div className="tagline" style={{ marginTop: 4 }}>
                                {(m.language ? m.language : 'Unknown') +
                                  (m.releaseDate ? ` · ${m.releaseDate}` : '') +
                                  (m.tmdbId ? ` · tmdb:${m.tmdbId}` : '')}
                              </div>
                              <div className="tagline" style={{ marginTop: 4 }}>{m.id}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await loadEditor(token, String(m.id));
                              }}
                            >
                              Load
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                  <input
                    className="input"
                    value={editorQuery}
                    onChange={(e) => setEditorQuery(e.target.value)}
                    placeholder="Movie id (e.g. 1448170 or tmdb-movie:1448170)"
                    style={{ minWidth: 260, flex: '1 1 260px' }}
                  />
                  <button
                    className="ghost-button"
                    type="button"
                    onClick={async () => {
                      if (!token) return;
                      const q = editorQuery.trim();
                      if (!q) return;
                      await loadEditor(token, q);
                    }}
                  >
                    Load
                  </button>
                  {editor?.movieId ? (
                    <button
                      className="ghost-button"
                      type="button"
                      onClick={async () => {
                        if (!token || !editor?.movieId) return;
                        await loadEditor(token, editor.movieId);
                      }}
                    >
                      Refresh
                    </button>
                  ) : null}
                </div>

                {editor?.movieId ? (
                  <>
                    <div className="detail" style={{ marginTop: 14 }}>
                      <h4 style={{ marginTop: 0 }}>Movie</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                        <input
                          className="input"
                          value={movieForm.title}
                          onChange={(e) => setMovieForm((p) => ({ ...p, title: e.target.value }))}
                          placeholder="Title"
                        />
                        <select
                          className="input"
                          value={movieForm.language}
                          onChange={(e) => setMovieForm((p) => ({ ...p, language: e.target.value }))}
                          title="Language"
                        >
                          <option value="">Language (unknown)</option>
                          {ADMIN_LANGUAGE_OPTIONS.map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                          {movieForm.language && !ADMIN_LANGUAGE_OPTIONS.includes(movieForm.language) ? (
                            <option value={movieForm.language}>{movieForm.language}</option>
                          ) : null}
                        </select>
                        <input
                          className="input"
                          type="date"
                          value={movieForm.releaseDate}
                          onChange={(e) => setMovieForm((p) => ({ ...p, releaseDate: e.target.value }))}
                          placeholder="Release date"
                        />
                        <select
                          className="input"
                          value={movieForm.status}
                          onChange={(e) => setMovieForm((p) => ({ ...p, status: e.target.value }))}
                          title="Status"
                        >
                          <option value="">Status (auto)</option>
                          {ADMIN_STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <input
                          className="input"
                          value={movieForm.director}
                          onChange={(e) => setMovieForm((p) => ({ ...p, director: e.target.value }))}
                          placeholder="Director"
                        />
                        <input
                          className="input"
                          value={movieForm.trailerUrl}
                          onChange={(e) => setMovieForm((p) => ({ ...p, trailerUrl: e.target.value }))}
                          placeholder="Trailer URL"
                        />
                      </div>
                      <textarea
                        className="input"
                        value={movieForm.synopsis}
                        onChange={(e) => setMovieForm((p) => ({ ...p, synopsis: e.target.value }))}
                        placeholder="Synopsis"
                        rows={8}
                        style={{ marginTop: 10, minHeight: 220, resize: 'vertical' }}
                      />
                      <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                        <button
                          className="ghost-button"
                          type="button"
                          onClick={async () => {
                            if (!token || !editor?.movieId) return;
                            await postJson(`/api/admin/movies/${encodeURIComponent(editor.movieId)}/update`, movieForm, token);
                            await loadEditor(token, editor.movieId);
                          }}
                        >
                          Save movie
                        </button>
                        <span className="chip">Movie id: {editor.movieId}</span>
                      </div>
                    </div>

                    <div className="detail" style={{ marginTop: 14 }}>
                      <h4 style={{ marginTop: 0 }}>Songs</h4>
                      {(editor.songs || []).length ? (
                        <div className="song-list" style={{ marginTop: 10 }}>
                          {(editor.songs || []).slice(0, 60).map((s) => {
                            const d =
                              songDrafts[s.id] || ({
                                title: s.title,
                                singers: (s.singers || []).join(', '),
                                youtubeUrl: s.youtubeUrl || '',
                                platform: s.platform || 'YouTube'
                              } as any);
                            return (
                              <div key={s.id} className="song" style={{ alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 220 }}>
                                  <input
                                    className="input"
                                    value={d.title}
                                    onChange={(e) => setSongDrafts((p) => ({ ...p, [s.id]: { ...d, title: e.target.value } }))}
                                    placeholder="Song title"
                                  />
                                  <input
                                    className="input"
                                    value={d.singers}
                                    onChange={(e) => setSongDrafts((p) => ({ ...p, [s.id]: { ...d, singers: e.target.value } }))}
                                    placeholder="Singers (comma-separated)"
                                    style={{ marginTop: 8 }}
                                  />
                                  <input
                                    className="input"
                                    value={d.youtubeUrl}
                                    onChange={(e) => setSongDrafts((p) => ({ ...p, [s.id]: { ...d, youtubeUrl: e.target.value } }))}
                                    placeholder="YouTube URL"
                                    style={{ marginTop: 8 }}
                                  />
                                  <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                                    <input
                                      className="input"
                                      value={d.platform}
                                      onChange={(e) => setSongDrafts((p) => ({ ...p, [s.id]: { ...d, platform: e.target.value } }))}
                                      placeholder="Platform"
                                      style={{ maxWidth: 180 }}
                                    />
                                    <span className="chip">Source: {s.source || 'unknown'}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={async () => {
                                      if (!token || !editor?.movieId) return;
                                      const singers = String(d.singers || '')
                                        .split(',')
                                        .map((x) => x.trim())
                                        .filter(Boolean);
                                      await postJson(
                                        `/api/admin/movies/${encodeURIComponent(editor.movieId)}/songs/upsert`,
                                        { song: { id: s.id, title: d.title, singers, youtubeUrl: d.youtubeUrl, platform: d.platform } },
                                        token
                                      );
                                      await loadEditor(token, editor.movieId);
                                    }}
                                  >
                                    Save
                                  </button>
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={async () => {
                                      if (!token || !editor?.movieId) return;
                                      await postJson(
                                        `/api/admin/movies/${encodeURIComponent(editor.movieId)}/songs/${encodeURIComponent(s.id)}/delete`,
                                        {},
                                        token
                                      );
                                      await loadEditor(token, editor.movieId);
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="tagline" style={{ marginTop: 10 }}>
                          No songs saved locally for this movie yet.
                        </div>
                      )}

                      <div className="detail" style={{ marginTop: 12 }}>
                        <h4 style={{ marginTop: 0 }}>Add song</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
                          <input className="input" value={newSong.title} onChange={(e) => setNewSong((p) => ({ ...p, title: e.target.value }))} placeholder="Song title" />
                          <input className="input" value={newSong.singers} onChange={(e) => setNewSong((p) => ({ ...p, singers: e.target.value }))} placeholder="Singers (comma-separated)" />
                          <input className="input" value={newSong.youtubeUrl} onChange={(e) => setNewSong((p) => ({ ...p, youtubeUrl: e.target.value }))} placeholder="YouTube URL" />
                          <input className="input" value={newSong.platform} onChange={(e) => setNewSong((p) => ({ ...p, platform: e.target.value }))} placeholder="Platform" />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={async () => {
                              if (!token || !editor?.movieId) return;
                              const title = newSong.title.trim();
                              if (!title) return;
                              const singers = newSong.singers.split(',').map((x) => x.trim()).filter(Boolean);
                              await postJson(
                                `/api/admin/movies/${encodeURIComponent(editor.movieId)}/songs/upsert`,
                                { song: { title, singers, youtubeUrl: newSong.youtubeUrl, platform: newSong.platform } },
                                token
                              );
                              setNewSong({ title: '', singers: '', youtubeUrl: '', platform: 'YouTube' });
                              await loadEditor(token, editor.movieId);
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="detail" style={{ marginTop: 14 }}>
                      <h4 style={{ marginTop: 0 }}>Cast</h4>
                      {(editor.cast || []).length ? (
                        <div className="song-list" style={{ marginTop: 10 }}>
                          {(editor.cast || []).slice(0, 60).map((c) => (
                            <div key={c.personId} className="song" style={{ alignItems: 'flex-start', gap: 12 }}>
                              {(() => {
                                const d = castDrafts[c.personId] || {
                                  character: String(c.character || ''),
                                  billingOrder: c.billingOrder != null ? String(c.billingOrder) : ''
                                };
                                return (
                              <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, flex: 1 }}>
                                {c.profileImage ? (
                                  <img
                                    src={c.profileImage}
                                    alt={c.name}
                                    style={{
                                      width: 44,
                                      height: 44,
                                      borderRadius: 12,
                                      objectFit: 'cover',
                                      border: '1px solid rgba(255,255,255,0.10)'
                                    }}
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                                )}
                                <div>
                                  <strong>{c.name}</strong>
                                  <div className="tagline" style={{ marginTop: 4 }}>
                                    {c.tmdbId ? `tmdb:${c.tmdbId}` : c.personId}
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 140px', gap: 8, marginTop: 8 }}>
                                    <input
                                      className="input"
                                      value={d.character}
                                      onChange={(e) =>
                                        setCastDrafts((p) => ({
                                          ...p,
                                          [c.personId]: { ...d, character: e.target.value }
                                        }))
                                      }
                                      placeholder="Character (optional)"
                                    />
                                    <input
                                      className="input"
                                      value={d.billingOrder}
                                      onChange={(e) =>
                                        setCastDrafts((p) => ({
                                          ...p,
                                          [c.personId]: { ...d, billingOrder: e.target.value }
                                        }))
                                      }
                                      placeholder="Order"
                                      inputMode="numeric"
                                    />
                                  </div>
                                </div>
                              </div>
                                );
                              })()}
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={async () => {
                                    if (!token || !editor?.movieId) return;
                                    const d = castDrafts[c.personId] || {
                                      character: String(c.character || ''),
                                      billingOrder: c.billingOrder != null ? String(c.billingOrder) : ''
                                    };
                                    const billingOrder = d.billingOrder.trim() ? Number(d.billingOrder) : undefined;
                                    await postJson(
                                      `/api/admin/movies/${encodeURIComponent(editor.movieId)}/cast/add`,
                                      {
                                        personId: c.personId,
                                        character: d.character,
                                        billingOrder: Number.isFinite(billingOrder as any) ? billingOrder : undefined
                                      },
                                      token
                                    );
                                    await loadEditor(token, editor.movieId);
                                  }}
                                >
                                  Save
                                </button>
                                <button
                                  className="ghost-button"
                                  type="button"
                                  onClick={async () => {
                                    if (!token || !editor?.movieId) return;
                                    await postJson(
                                      `/api/admin/movies/${encodeURIComponent(editor.movieId)}/cast/remove`,
                                      { personId: c.personId },
                                      token
                                    );
                                    await loadEditor(token, editor.movieId);
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="tagline" style={{ marginTop: 10 }}>
                          No cast saved locally for this movie yet.
                        </div>
                      )}

                      <div className="detail" style={{ marginTop: 12 }}>
                        <h4 style={{ marginTop: 0 }}>Add cast member</h4>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <input
                            className="input"
                            value={personQuery}
                            onChange={(e) => setPersonQuery(e.target.value)}
                            placeholder="Search people (local DB)"
                            style={{ minWidth: 240, flex: '1 1 240px' }}
                          />
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={async () => {
                              if (!token) return;
                              const q = personQuery.trim();
                              if (!q) return;
                              const r = await getJson(`/api/admin/persons/search?q=${encodeURIComponent(q)}`, token);
                              setPersonResults(Array.isArray((r as any)?.persons) ? (r as any).persons : []);
                            }}
                          >
                            Search
                          </button>
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                            gap: 10,
                            marginTop: 10
                          }}
                        >
                          <input
                            className="input"
                            value={castAdd.character}
                            onChange={(e) => setCastAdd((p) => ({ ...p, character: e.target.value }))}
                            placeholder="Character (optional)"
                          />
                          <input
                            className="input"
                            value={castAdd.billingOrder}
                            onChange={(e) => setCastAdd((p) => ({ ...p, billingOrder: e.target.value }))}
                            placeholder="Billing order (optional number)"
                            inputMode="numeric"
                          />
                        </div>

                        {personResults.length ? (
                          <div className="song-list" style={{ marginTop: 10 }}>
                            {personResults.slice(0, 20).map((p) => (
                              <div key={p.id} className="song" style={{ alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12, flex: 1 }}>
                                  {p.profileImage ? (
                                    <img
                                      src={p.profileImage}
                                      alt={p.name}
                                      style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        objectFit: 'cover',
                                        border: '1px solid rgba(255,255,255,0.10)'
                                      }}
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                                  )}
                                  <div>
                                    <strong>{p.name}</strong>
                                    <div className="tagline" style={{ marginTop: 4 }}>
                                      {p.tmdbId ? `tmdb:${p.tmdbId}` : p.id}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button
                                    className="ghost-button"
                                    type="button"
                                    onClick={async () => {
                                      if (!token || !editor?.movieId) return;
                                      await postJson(
                                        `/api/admin/movies/${encodeURIComponent(editor.movieId)}/cast/add`,
                                        {
                                          personId: p.id,
                                          character: castAdd.character,
                                          billingOrder: castAdd.billingOrder ? Number(castAdd.billingOrder) : undefined
                                        },
                                        token
                                      );
                                      await loadEditor(token, editor.movieId);
                                    }}
                                  >
                                    Add
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginTop: 10 }}>
                          <input
                            className="input"
                            value={castAdd.personId}
                            onChange={(e) => setCastAdd((p) => ({ ...p, personId: e.target.value }))}
                            placeholder="Or paste person id (optional)"
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={async () => {
                              if (!token || !editor?.movieId) return;
                              const pid = castAdd.personId.trim();
                              if (!pid) return;
                              await postJson(
                                `/api/admin/movies/${encodeURIComponent(editor.movieId)}/cast/add`,
                                {
                                  personId: pid,
                                  character: castAdd.character,
                                  billingOrder: castAdd.billingOrder ? Number(castAdd.billingOrder) : undefined
                                },
                                token
                              );
                              setCastAdd({ personId: '', character: '', billingOrder: '' });
                              await loadEditor(token, editor.movieId);
                            }}
                          >
                            Add by id
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
              </>
              ) : null}

              {tab === 'moderation' ? (
                <>
                  <div className="section-header">
                    <h3>Moderation</h3>
                    <span className="inline-pill">Pending</span>
                  </div>
                  <div className="detail">
                    <div className="meta" style={{ justifyContent: 'space-between' }}>
                      <span className="chip">
                        Submissions: {queue?.submissions?.length ?? 0} · Reviews: {queue?.reviews?.length ?? 0} ·
                        People: {queue?.personSubmissions?.length ?? 0}
                      </span>
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={async () => {
                          if (!token) return;
                          await loadQueue(token);
                        }}
                      >
                        <span style={{marginRight: 6, display: 'inline-flex', alignItems: 'center'}}><RiRefreshLine  /></span>
                        Refresh queue
                      </button>
                    </div>

                {queue?.reviews?.length ? (
                  <div className="detail" style={{ marginTop: 12 }}>
                    <h4>Pending reviews</h4>
                    <div className="song-list" style={{ marginTop: 10 }}>
                      {queue.reviews.slice(0, 50).map((r) => (
                        <div key={r.id} className="song" style={{ alignItems: 'flex-start' }}>
                          <div>
                            <strong>{r.movieTitle}</strong>
                            <div className="tagline">
                              {(r.user.displayName || r.user.email) + (r.rating ? ` · ${r.rating}/10` : '')}
                              {' · '}
                              {new Date(r.createdAt).toLocaleString()}
                            </div>
                            <div className="tagline" style={{ marginTop: 6 }}>
                              {r.body}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await postJson(`/api/admin/reviews/${encodeURIComponent(r.id)}/approve`, {}, token);
                                await loadQueue(token);
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await postJson(`/api/admin/reviews/${encodeURIComponent(r.id)}/reject`, {}, token);
                                await loadQueue(token);
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="tagline" style={{ marginTop: 12 }}>
                    No pending reviews.
                  </div>
                )}

                {queue?.personSubmissions?.length ? (
                  <div className="detail" style={{ marginTop: 12 }}>
                    <h4>Pending people</h4>
                    <div className="song-list" style={{ marginTop: 10 }}>
                      {queue.personSubmissions.slice(0, 50).map((p) => (
                        <div key={p.id} className="song" style={{ alignItems: 'flex-start' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', gap: 12 }}>
                            {p.profileImage ? (
                              <img
                                src={p.profileImage}
                                alt={p.name}
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: 12,
                                  objectFit: 'cover',
                                  border: '1px solid rgba(255,255,255,0.10)'
                                }}
                                loading="lazy"
                              />
                            ) : (
                              <div className="chip" style={{ width: 44, height: 44, borderRadius: 12 }} />
                            )}
                            <div>
                              <strong>{p.name}</strong>
                              <div className="tagline">
                                {(p.user.displayName || p.user.email)}
                                {' · '}
                                {new Date(p.createdAt).toLocaleString()}
                              </div>
                              {p.biography ? (
                                <div className="tagline" style={{ marginTop: 6 }}>
                                  {String(p.biography).slice(0, 220)}
                                  {String(p.biography).length > 220 ? '…' : ''}
                                </div>
                              ) : null}
                              {Array.isArray(p.filmography) && p.filmography.length ? (
                                <div className="tagline" style={{ marginTop: 6 }}>
                                  Filmography: {p.filmography.length} titles
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await postJson(`/api/admin/person-submissions/${encodeURIComponent(p.id)}/approve`, {}, token);
                                await loadQueue(token);
                                await loadStatus(token);
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await postJson(`/api/admin/person-submissions/${encodeURIComponent(p.id)}/reject`, {}, token);
                                await loadQueue(token);
                                await loadStatus(token);
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="tagline" style={{ marginTop: 12 }}>
                    No pending people.
                  </div>
                )}

                {queue?.submissions?.length ? (
                  <div className="detail" style={{ marginTop: 12 }}>
                    <h4>Pending submissions</h4>
                    <div className="song-list" style={{ marginTop: 10 }}>
                      {queue.submissions.slice(0, 50).map((s) => (
                        <div key={s.id} className="song" style={{ alignItems: 'flex-start' }}>
                          <div>
                            <strong>{s.title}</strong>
                            <div className="tagline">
                              {s.kind.toUpperCase()}
                              {s.language ? ` · ${s.language}` : ''}
                              {' · '}
                              {(s.user.displayName || s.user.email)}
                              {' · '}
                              {new Date(s.createdAt).toLocaleString()}
                            </div>
                            {s.payload?.referenceUrl ? (
                              <div className="tagline" style={{ marginTop: 6 }}>
                                Ref: {s.payload.referenceUrl}
                              </div>
                            ) : null}
                            {s.payload?.notes ? (
                              <div className="tagline" style={{ marginTop: 6 }}>
                                {s.payload.notes}
                              </div>
                            ) : null}
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await postJson(`/api/admin/submissions/${encodeURIComponent(s.id)}/approve`, {}, token);
                                await loadQueue(token);
                              }}
                            >
                              Approve
                            </button>
                            <button
                              className="ghost-button"
                              type="button"
                              onClick={async () => {
                                if (!token) return;
                                await postJson(`/api/admin/submissions/${encodeURIComponent(s.id)}/reject`, {}, token);
                                await loadQueue(token);
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="tagline" style={{ marginTop: 12 }}>
                    No pending submissions.
                  </div>
                )}
                  </div>
                </>
              ) : null}
            </>
          )}

          {loading && <div className="tagline" style={{ marginTop: 10 }}>Loading…</div>}
      </div>
    </div>
  );

  if (variant === 'modal') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.62)',
          display: 'grid',
          placeItems: 'center',
          padding: 16,
          zIndex: 70
        }}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && onClose) onClose();
        }}
      >
        {body}
      </div>
    );
  }

  return body;
}
