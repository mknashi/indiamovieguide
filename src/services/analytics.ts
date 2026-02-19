const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

let analyticsInitialized = false;
let lastTrackedPath: string | null = null;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

function isAnalyticsEnabled(): boolean {
  return Boolean(GA_MEASUREMENT_ID) && typeof window !== 'undefined' && typeof document !== 'undefined';
}

function ensureGtagScript(): void {
  if (!GA_MEASUREMENT_ID) return;
  if (document.querySelector('script[data-img-ga="true"]')) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  script.setAttribute('data-img-ga', 'true');
  document.head.appendChild(script);
}

export function initAnalytics(): void {
  if (!isAnalyticsEnabled() || analyticsInitialized || !GA_MEASUREMENT_ID) return;

  ensureGtagScript();
  window.dataLayer = window.dataLayer || [];
  window.gtag = (...args: unknown[]) => {
    window.dataLayer?.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false });
  analyticsInitialized = true;
}

export function trackPageView(path = `${window.location.pathname}${window.location.search}`): void {
  if (!isAnalyticsEnabled() || !GA_MEASUREMENT_ID) return;
  if (!analyticsInitialized) initAnalytics();
  if (path === lastTrackedPath) return;

  lastTrackedPath = path;
  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title
  });
}
