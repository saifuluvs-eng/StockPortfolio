// Reroute relative /api/* calls to the backend specified by VITE_API_BASE.
// EXCEPTION: AI Summary routes always use local backend
const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, '');
const AI_LOCAL_ROUTES = ['/api/ai/summary'];

if (typeof window !== 'undefined' && API_BASE) {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : (input as Request).url;
      // Check if this is a local-only route
      const isLocalRoute = AI_LOCAL_ROUTES.some(route => url.startsWith(route));
      if (url.startsWith('/api/') && !isLocalRoute) {
        return origFetch(`${API_BASE}${url}`, init);
      }
    } catch {}
    return origFetch(input as any, init);
  };
}
