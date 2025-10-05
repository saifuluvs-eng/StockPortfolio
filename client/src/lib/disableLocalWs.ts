// client/src/lib/disableLocalWs.ts
(() => {
  if (typeof window === 'undefined' || (window as any).__localWsPatched) return;
  (window as any).__localWsPatched = true;

  const NativeWS = window.WebSocket;

  function PatchedWS(url: string | URL, protocols?: string | string[]) {
    try {
      const u = typeof url === 'string' ? url : url.toString();
      const host = window.location.host;

      // Block ONLY local /ws on the same host; allow everything else (e.g., Binance)
      const isLocalWs =
        u === '/ws' ||
        u === `ws://${host}/ws` ||
        u === `wss://${host}/ws`;

      if (isLocalWs) {
        console.warn('Blocking local /ws WebSocket on Vercel:', u);
        // Return a no-op socket-like object so app code doesn’t crash
        const dummy: any = {
          readyState: 3, // CLOSED
          close() {},
          send() {},
          addEventListener() {},
          removeEventListener() {},
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
        };
        // fire an async "closed" to mimic a failed connect
        setTimeout(() => dummy.onclose?.({ code: 1006, reason: 'blocked /ws' }), 0);
        return dummy;
      }
    } catch {
      /* fall through to real WS */
    }
    // Everything else (like Binance) goes through as normal
    return new NativeWS(url, protocols);
  }

  // Keep prototype so instanceof checks and event APIs keep working
  (PatchedWS as any).prototype = NativeWS.prototype;
  // @ts-expect-error: override global
  window.WebSocket = PatchedWS;
})();
