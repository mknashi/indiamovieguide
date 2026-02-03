import { useMemo, useState } from 'react';
import { RiArrowLeftLine, RiLock2Line, RiUserAddLine } from 'react-icons/ri';
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

export function LoginPage({ next }: { next?: string }) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    if (!email.trim() || !password) return false;
    if (mode === 'signup' && displayName.trim().length < 2) return false;
    return true;
  }, [email, password, displayName, mode]);

  return (
    <div>
      <div className="section-header" style={{ marginTop: 10 }}>
        <button className="ghost-button" type="button" onClick={() => navigate('/')}>
          <RiArrowLeftLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
          Back
        </button>
        <span className="inline-pill">{mode === 'login' ? 'Sign in' : 'Create account'}</span>
      </div>

      <div className="detail" style={{ marginTop: 14 }}>
        <div className="meta">
          <button
            type="button"
            className={`filter ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            <RiLock2Line style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Sign in
          </button>
          <button
            type="button"
            className={`filter ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => setMode('signup')}
          >
            <RiUserAddLine style={{ marginRight: 6, verticalAlign: '-2px' }} />
            Sign up
          </button>
        </div>

        <div className="search" style={{ marginTop: 14 }}>
          <input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        {mode === 'signup' ? (
          <div className="search" style={{ marginTop: 10 }}>
            <input
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="nickname"
            />
            <div />
          </div>
        ) : null}

        <div className="detail" style={{ marginTop: 14 }}>
          <h4>Captcha</h4>
          <div className="tagline">Required for account actions.</div>
          <div style={{ marginTop: 10 }}>
            <CaptchaWidget onToken={(t) => setCaptchaToken(t)} compact />
          </div>
        </div>

        {error ? <div className="tagline" style={{ marginTop: 12 }}>Error: {error}</div> : null}

        <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            disabled={!canSubmit || loading}
            className="ghost-button"
            type="button"
            onClick={async () => {
              setLoading(true);
              setError(null);
              try {
                if (mode === 'login') {
                  await postJson('/api/auth/login', { email, password, captchaToken });
                } else {
                  await postJson('/api/auth/signup', { email, password, displayName, captchaToken });
                }
                navigate(next || '/account');
              } catch (e: any) {
                setError(e?.message || 'Failed');
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>

          <button className="ghost-button" type="button" onClick={() => navigate(next || '/account')}>
            Continue
          </button>
        </div>

        <div className="tagline" style={{ marginTop: 12 }}>
          Note: in local dev, set server env <code>CAPTCHA_BYPASS=1</code> if you don’t have hCaptcha keys yet.
        </div>
      </div>
    </div>
  );
}
