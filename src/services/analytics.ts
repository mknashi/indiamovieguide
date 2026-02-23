const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
const GA_DEBUG_FLAG = import.meta.env.VITE_GA_DEBUG?.trim().toLowerCase();

let analyticsInitialized = false;
let lastTrackedPath: string | null = null;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function isAnalyticsEnabled(): boolean {
  return Boolean(GA_MEASUREMENT_ID) && typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isAnalyticsDebugEnabled(): boolean {
  if (GA_DEBUG_FLAG === '1' || GA_DEBUG_FLAG === 'true') return true;
  if (typeof window === 'undefined') return false;

  if (import.meta.env.DEV) return true;

  try {
    if (window.localStorage.getItem('img_ga_debug') === '1') return true;
  } catch {
    // ignore
  }

  try {
    return new URLSearchParams(window.location.search).get('ga_debug') === '1';
  } catch {
    return false;
  }
}

function debugLog(message: string, details?: unknown): void {
  if (!isAnalyticsDebugEnabled()) return;
  if (details === undefined) {
    console.info(`[IMG GA] ${message}`);
    return;
  }
  console.info(`[IMG GA] ${message}`, details);
}

function ensureGtagScript(): void {
  if (!GA_MEASUREMENT_ID) {
    debugLog('Skipped gtag script inject: missing measurement ID');
    return;
  }
  if (document.querySelector('script[data-img-ga="true"]')) {
    debugLog('gtag script already present');
    return;
  }

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  script.setAttribute('data-img-ga', 'true');
  script.addEventListener('load', () => debugLog('gtag.js loaded'));
  script.addEventListener('error', () => debugLog('gtag.js failed to load'));
  document.head.appendChild(script);
  debugLog('Injected gtag.js script', { measurementId: GA_MEASUREMENT_ID, src: script.src });
}

export function initAnalytics(): void {
  if (!GA_MEASUREMENT_ID) {
    debugLog('Analytics disabled: missing VITE_GA_MEASUREMENT_ID');
    return;
  }
  if (!isAnalyticsEnabled()) {
    debugLog('Analytics disabled: browser globals unavailable');
    return;
  }
  if (analyticsInitialized) {
    debugLog('Analytics already initialized');
    return;
  }

  ensureGtagScript();
  window.dataLayer = window.dataLayer || [];
  // Use the canonical gtag shim shape so gtag.js can drain queued calls reliably.
  window.gtag = function gtagShim(..._args: unknown[]) {
    window.dataLayer?.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  analyticsInitialized = true;
  debugLog('Analytics initialized', {
    measurementId: GA_MEASUREMENT_ID,
    sendPageView: false,
    queueLength: window.dataLayer.length
  });
}

export function trackPageView(path = `${window.location.pathname}${window.location.search}`): void {
  if (!GA_MEASUREMENT_ID) {
    debugLog('Skipped page_view: missing VITE_GA_MEASUREMENT_ID', { path });
    return;
  }
  if (!isAnalyticsEnabled()) {
    debugLog('Skipped page_view: browser globals unavailable', { path });
    return;
  }
  if (!analyticsInitialized) initAnalytics();
  if (path === lastTrackedPath) {
    debugLog('Skipped duplicate page_view', { path });
    return;
  }

  lastTrackedPath = path;
  const payload = {
    send_to: GA_MEASUREMENT_ID,
    debug_mode: isAnalyticsDebugEnabled(),
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
    event_callback: () => debugLog('page_view callback fired', { path }),
    event_timeout: 2000
  };
  debugLog('Sending page_view', { measurementId: GA_MEASUREMENT_ID, payload });
  window.gtag?.('event', 'page_view', payload);
}
