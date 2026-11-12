// Configuration stays in the optional, gitignored browser script. Never log SDK URLs.
export function createNaverLoader({ host = globalThis.window, document = globalThis.document, timeoutMs = 10000 } = {}) {
  let pending;
  const authListeners = new Set();
  const load = () => {
    if (pending) return pending;
    pending = new Promise((resolve, reject) => {
      let settled = false;
      const finish = (maps) => {
        if (settled) return;
        settled = true; clearTimeout(timer); resolve(maps);
      };
      const fail = () => {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(new Error('Naver map unavailable'));
      };
      const timer = setTimeout(fail, timeoutMs);
      if (!host || !document?.head) { fail(); return; }
      host.navermap_authFailure = () => { fail(); for (const listener of authListeners) listener(); };
      const config = document.createElement('script');
      config.src = './local-naver-config.js'; config.async = true;
      config.onerror = fail;
      config.onload = () => {
        if (settled) return;
        const id = host.PLOT_OS_NAVER_CONFIG?.clientId;
        if (typeof id !== 'string' || !id.trim() || /YOUR_|PLACEHOLDER|CLIENT_ID_HERE|^<|^undefined$|^null$/i.test(id)) { fail(); return; }
        const sdk = document.createElement('script');
        sdk.async = true; sdk.onerror = fail;
        sdk.onload = () => host.naver?.maps?.Map ? finish(host.naver.maps) : fail();
        sdk.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(id.trim())}`;
        document.head.append(sdk);
      };
      document.head.append(config);
    });
    return pending;
  };
  load.onAuthFailure = (listener) => { authListeners.add(listener); return () => authListeners.delete(listener); };
  return load;
}

// Delay global access until mounting, including in Node smoke imports.
let shared;
export function loadNaver() { shared ??= createNaverLoader(); return shared(); }
export function onNaverAuthFailure(listener) { shared ??= createNaverLoader(); return shared.onAuthFailure(listener); }
