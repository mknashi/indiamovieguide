import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    hcaptcha?: any;
  }
}

let hcaptchaScriptPromise: Promise<void> | null = null;

function loadHCaptcha(): Promise<void> {
  if (hcaptchaScriptPromise) return hcaptchaScriptPromise;
  hcaptchaScriptPromise = new Promise((resolve, reject) => {
    if (window.hcaptcha) return resolve();
    const s = document.createElement('script');
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load hCaptcha'));
    document.head.appendChild(s);
  });
  return hcaptchaScriptPromise;
}

export function CaptchaWidget({
  onToken,
  compact = false
}: {
  onToken: (token: string) => void;
  compact?: boolean;
}) {
  const sitekey = (import.meta as any).env?.VITE_HCAPTCHA_SITEKEY as string | undefined;
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let widgetId: any = null;

    (async () => {
      if (!sitekey) return;
      try {
        await loadHCaptcha();
        if (!alive) return;
        if (!ref.current || !window.hcaptcha) return;
        widgetId = window.hcaptcha.render(ref.current, {
          sitekey,
          size: compact ? 'compact' : 'normal',
          theme: 'dark',
          callback: (t: string) => onToken(String(t || '')),
          'expired-callback': () => onToken(''),
          'error-callback': () => onToken('')
        });
      } catch (e: any) {
        if (alive) setError(e?.message || 'Captcha failed to load');
      }
    })();

    return () => {
      alive = false;
      try {
        if (widgetId != null && window.hcaptcha) window.hcaptcha.remove(widgetId);
      } catch {
        // ignore
      }
    };
  }, [sitekey, compact, onToken]);

  if (!sitekey) {
    // In local dev, set CAPTCHA_BYPASS=1 on the server.
    return (
      <div className="tagline" style={{ opacity: 0.9 }}>
        Captcha not configured (set <code>VITE_HCAPTCHA_SITEKEY</code> and server <code>HCAPTCHA_SECRET</code>).
      </div>
    );
  }

  return (
    <div>
      <div ref={ref} />
      {error ? <div className="tagline" style={{ marginTop: 8 }}>Captcha error: {error}</div> : null}
    </div>
  );
}

