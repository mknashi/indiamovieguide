import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    grecaptcha?: any;
  }
}

let recaptchaScriptPromise: Promise<void> | null = null;

function loadRecaptcha(): Promise<void> {
  if (recaptchaScriptPromise) return recaptchaScriptPromise;
  recaptchaScriptPromise = new Promise((resolve, reject) => {
    if (window.grecaptcha) {
      try {
        window.grecaptcha.ready(() => resolve());
      } catch {
        resolve();
      }
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?render=explicit';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      try {
        if (!window.grecaptcha) return resolve();
        window.grecaptcha.ready(() => resolve());
      } catch {
        resolve();
      }
    };
    s.onerror = () => reject(new Error('Failed to load reCAPTCHA'));
    document.head.appendChild(s);
  });
  return recaptchaScriptPromise;
}

export function CaptchaWidget({
  onToken,
  compact = false
}: {
  onToken: (token: string) => void;
  compact?: boolean;
}) {
  const sitekey = (import.meta as any).env?.VITE_RECAPTCHA_SITEKEY as string | undefined;
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let widgetId: number | null = null;

    (async () => {
      if (!sitekey) return;
      try {
        await loadRecaptcha();
        if (!alive) return;
        if (!ref.current || !window.grecaptcha) return;

        // Ensure we don't double-render into the same node.
        ref.current.innerHTML = '';
        widgetId = window.grecaptcha.render(ref.current, {
          sitekey,
          theme: 'dark',
          size: compact ? 'compact' : 'normal',
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
        if (widgetId != null && window.grecaptcha) window.grecaptcha.reset(widgetId);
      } catch {
        // ignore
      }
      try {
        if (ref.current) ref.current.innerHTML = '';
      } catch {
        // ignore
      }
    };
  }, [sitekey, compact, onToken]);

  if (!sitekey) {
    // In local dev, set CAPTCHA_BYPASS=1 on the server.
    return (
      <div className="tagline" style={{ opacity: 0.9 }}>
        Captcha not configured (set <code>VITE_RECAPTCHA_SITEKEY</code> and server <code>RECAPTCHA_SECRET</code>).
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

