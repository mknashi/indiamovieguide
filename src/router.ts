import type { MouseEvent } from 'react';

export type Route =
  | { name: 'home'; lang?: string; refresh?: boolean }
  | { name: 'streaming'; lang?: string; provider?: string }
  | { name: 'movies' }
  | { name: 'people' }
  | { name: 'language'; slug: string }
  | { name: 'genre'; slug: string }
  | { name: 'search'; q: string }
  | { name: 'movie'; id: string }
  | { name: 'movie_reviews'; id: string }
  | { name: 'trailer'; id: string }
  | { name: 'song'; id: string }
  | { name: 'person'; id: string }
  | { name: 'login'; next?: string }
  | { name: 'account' }
  | { name: 'submit' }
  | { name: 'about' }
  | { name: 'contact' }
  | { name: 'feedback' }
  | { name: 'privacy' }
  | { name: 'admin' }
  | { name: 'not_found' };

export function parseRoute(loc: Location = window.location): Route {
  const path = loc.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(loc.search);

  if (path === '/') {
    const lang = params.get('lang') || undefined;
    const refresh = params.get('refresh') === '1' || params.get('refresh') === 'true';
    return { name: 'home', ...(lang ? { lang } : {}), ...(refresh ? { refresh: true } : {}) };
  }
  if (path === '/streaming') {
    const lang = params.get('lang') || undefined;
    const provider = params.get('provider') || undefined;
    return { name: 'streaming', ...(lang ? { lang } : {}), ...(provider ? { provider } : {}) };
  }
  if (path === '/movies') return { name: 'movies' };
  if (path === '/people') return { name: 'people' };
  if (path === '/search') {
    return { name: 'search', q: params.get('q') || '' };
  }
  if (path === '/login') {
    const next = params.get('next') || undefined;
    return { name: 'login', ...(next ? { next } : {}) };
  }
  if (path === '/account') return { name: 'account' };
  if (path === '/submit') return { name: 'submit' };
  if (path === '/about') return { name: 'about' };
  if (path === '/contact') return { name: 'contact' };
  if (path === '/feedback') return { name: 'feedback' };
  if (path === '/privacy') return { name: 'privacy' };
  if (path === '/admin') return { name: 'admin' };

  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'movie' && parts[1] && parts[2] === 'reviews') {
    return { name: 'movie_reviews', id: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'language' && parts[1]) return { name: 'language', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'genre' && parts[1]) return { name: 'genre', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'movie' && parts[1]) return { name: 'movie', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'person' && parts[1]) return { name: 'person', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'trailer' && parts[1]) return { name: 'trailer', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'song' && parts[1]) return { name: 'song', id: decodeURIComponent(parts[1]) };

  return { name: 'not_found' };
}

export function navigate(to: string) {
  if (to === window.location.pathname + window.location.search) return;
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export function linkHandler(to: string) {
  return (e: MouseEvent) => {
    // allow open in new tab / etc
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
}
