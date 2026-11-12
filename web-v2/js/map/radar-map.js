import { h } from '../ui/components.js';
import { loadNaver as defaultLoadNaver, onNaverAuthFailure } from './naver-loader.js';
import { createNaverMap } from './naver-map.js';
import { createRadarMap as createMapLibreMap } from './maplibre-map.js';

export const NAVER_FALLBACK_NOTICE = '네이버 지도를 불러오지 못해 기본 지도(OpenFreeMap)를 표시합니다. Client ID와 등록된 웹 서비스 URL을 확인해 주세요.';

/** Provider choice preserves the public adapter and queued Deal Radar state. */
export function createRadarMap(options) {
  const { loadNaver = defaultLoadNaver, createNaver = createNaverMap, createFallback = createMapLibreMap } = options;
  const notice = h('div', { className: 'radar-provider-notice', role: 'status', 'aria-live': 'polite' }, '네이버 지도를 불러오는 중입니다. 기본 지도: OpenFreeMap · 예시 위치 · 실제 매물 아님');
  const host = h('div', { className: 'radar-map-provider' });
  const element = h('div', { className: 'radar-provider' }, host, notice);
  let renderer, pending, destroyed = false, fallback = false, observer, unsubscribe;
  let state = {}, selected = null, hovered = null, sizing = {};
  const providerOptions = { ...options,
    onSelect(id) { selected = id; options.onSelect?.(id); },
    onHover(id) { hovered = id; options.onHover?.(id); },
  };
  function attach(next) {
    renderer?.destroy(); renderer = next;
    host.replaceChildren(renderer.element);
    renderer.update(state); renderer.resize(sizing); renderer.mount();
    renderer.select(selected, { fly: false, notify: false });
    if (hovered) renderer.highlight(hovered);
  }
  function useFallback() {
    if (destroyed || fallback) return;
    fallback = true; notice.textContent = NAVER_FALLBACK_NOTICE; notice.hidden = false;
    attach(createFallback(providerOptions));
  }
  function mount() {
    if (destroyed || !element.isConnected) return Promise.resolve();
    observer?.disconnect();
    if (pending) return pending;
    if (loadNaver === defaultLoadNaver) unsubscribe = onNaverAuthFailure(useFallback);
    pending = (async () => {
      try {
        const naver = await loadNaver();
        if (destroyed || fallback) return;
        attach(createNaver({ ...providerOptions, naver, onFailure: useFallback }));
        if (!fallback) notice.hidden = true;
      } catch { useFallback(); }
    })();
    return pending;
  }
  queueMicrotask(() => {
    if (destroyed) return;
    if (element.isConnected) mount();
    else if (globalThis.MutationObserver && document.documentElement) {
      observer = new MutationObserver(() => { if (element.isConnected) mount(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
  return { element, mount,
    update(next = {}) { if (destroyed) return; state = next; if (Object.hasOwn(next, 'selected')) selected = next.selected; renderer?.update(next); },
    select(id, settings = {}) { if (destroyed) return; selected = id; if (renderer) renderer.select(id, settings); else if (settings.notify !== false) options.onSelect?.(id); },
    highlight(id) { if (destroyed) return; hovered = id; if (renderer) renderer.highlight(id); else options.onHover?.(id); },
    resize(next = {}) { if (destroyed) return; sizing = { ...sizing, ...next }; renderer?.resize(sizing); },
    destroy() { if (destroyed) return; destroyed = true; observer?.disconnect(); unsubscribe?.(); renderer?.destroy(); },
  };
}
