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
  const onTokenRef = useRef(onToken);
  const widgetIdRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    let alive = true;

    (async () => {
      if (!sitekey) return;
      try {
        await loadRecaptcha();
        if (!alive) return;
        if (!ref.current || !window.grecaptcha) return;

        // React state updates can cause parent re-renders; avoid double-rendering the same widget.
        if (widgetIdRef.current != null) return;

        // Ensure we don't double-render into the same node (helps in some browsers).
        try {
          ref.current.innerHTML = '';
        } catch {
          // ignore
        }

        widgetIdRef.current = window.grecaptcha.render(ref.current, {
          sitekey,
          theme: 'dark',
          size: compact ? 'compact' : 'normal',
          callback: (t: string) => onTokenRef.current(String(t || '')),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current('')
        });
      } catch (e: any) {
        if (alive) setError(e?.message || 'Captcha failed to load');
      }
    })();

    return () => {
      alive = false;
      try {
        if (widgetIdRef.current != null && window.grecaptcha) window.grecaptcha.reset(widgetIdRef.current);
      } catch {
        // ignore
      }
      try {
        if (ref.current) ref.current.innerHTML = '';
      } catch {
        // ignore
      }
      widgetIdRef.current = null;
    };
  }, [sitekey, compact]);

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
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div ref={ref} />
      </div>
      {error ? <div className="tagline" style={{ marginTop: 8 }}>Captcha error: {error}</div> : null}
    </div>
  );
}
