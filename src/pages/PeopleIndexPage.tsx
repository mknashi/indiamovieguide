import { useEffect, useState } from 'react';
import { navigate } from '../router';

type PersonItem = {
  id: string;
  tmdbId?: number | null;
  name: string;
  profileImage?: string;
  filmCount?: number;
};

type PeoplePayload = {
  people: PersonItem[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
};

export function PeopleIndexPage() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<PeoplePayload | null>(null);

  const fetchPage = async (page: number) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', '36');
    const res = await fetch(`/api/people?${params.toString()}`, { cache: 'no-store' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data as PeoplePayload;
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await fetchPage(1);
        if (!alive) return;
        setPayload(data);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load people');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>People Index</h3>
          <div className="tagline">
            {payload?.total != null ? `${payload.total} profiles` : 'Actors and filmmakers'}
          </div>
        </div>
        <span className="inline-pill">People</span>
      </div>

      {loading && <div className="tagline" style={{ marginTop: 12 }}>Loading…</div>}
      {error && <div className="tagline" style={{ marginTop: 12 }}>Failed to load: {error}</div>}

      {!loading && !error && (
        <>
          <div className="grid" style={{ marginTop: 12 }}>
            {(payload?.people || []).map((p) => {
              const href = `/person/${encodeURIComponent(String(p.tmdbId || p.id))}`;
              return (
                <a
                  key={`${p.id}-${p.tmdbId || 'local'}`}
                  className="detail"
                  href={href}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    navigate(href);
                  }}
                  style={{ display: 'grid', gridTemplateColumns: '64px 1fr', gap: 12, alignItems: 'center' }}
                >
                  {p.profileImage ? (
                    <img
                      src={p.profileImage}
                      alt={p.name}
                      loading="lazy"
                      style={{
                        width: 64,
                        height: 64,
                        borderRadius: 12,
                        objectFit: 'cover',
                        border: '1px solid rgba(255,255,255,0.08)'
                      }}
                    />
                  ) : (
                    <div className="chip" style={{ width: 64, height: 64, borderRadius: 12 }} />
                  )}
                  <div>
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="tagline">
                      {Number(p.filmCount || 0) > 0 ? `${Number(p.filmCount || 0)} titles` : 'Profile'}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
          {payload?.hasMore ? (
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'center' }}>
              <button
                className="ghost-button"
                type="button"
                disabled={loadingMore}
                onClick={async () => {
                  if (!payload) return;
                  const nextPage = Number(payload.page || 1) + 1;
                  try {
                    setLoadingMore(true);
                    const next = await fetchPage(nextPage);
                    setPayload((prev) => {
                      if (!prev) return next;
                      return {
                        ...next,
                        people: [...(prev.people || []), ...(next.people || [])]
                      };
                    });
                  } catch {
                    // ignore
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
