// Reroute relative /api/* calls to the backend specified by VITE_API_BASE.
const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, '');

if (typeof window !== 'undefined' && API_BASE) {
  const origFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : (input as Request).url;
      if (url.startsWith('/api/')) {
        return origFetch(`${API_BASE}${url}`, init);
      }
    } catch {}
    return origFetch(input as any, init);
  };
}
