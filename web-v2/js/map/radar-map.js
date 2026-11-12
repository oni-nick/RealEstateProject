import { h, button } from '../ui/components.js';
import { buildingPhoto } from '../ui/photo.js';
import { eok, manwon, percent } from '../ui/format.js';
import { buildingCoordinates, radarGeoJSON } from './radar-geo.js';

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const empty = () => ({ type: 'FeatureCollection', features: [] });
const ATTRIBUTION = '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors</a>';

// Shared stylesheet readiness belongs to the document, not a Radar scene.
function rememberStylesheet(link) {
  link.addEventListener('load', () => {
    link.media = 'all'; link.dataset.loaded = 'true'; delete link.dataset.failed;
  }, { once: true });
  link.addEventListener('error', () => { link.dataset.failed = 'true'; }, { once: true });
}

/** WebGL is optional. This adapter never owns listing/filter state. */
export function createRadarMap({ buildings, geography, onOpen = () => {}, onSelect = () => {}, onHover = () => {}, maplibre = () => globalThis.maplibregl }) {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const districts = new Map((geography?.districts ?? []).map((d) => [d.id, d.nameKo]));
  const controller = new AbortController();
  const canvas = h('div', { className: 'radar-map-canvas', 'aria-label': '서울 예시 건물 지도 · 건물은 목록에서도 선택할 수 있습니다' });
  const message = h('span', {}, '지도를 불러오는 중입니다. 목록은 바로 사용할 수 있습니다.');
  const retry = button('다시 시도', () => restart(), 'small');
  retry.hidden = true;
  const notice = h('div', { className: 'radar-map-notice', role: 'status', 'aria-live': 'polite' }, message, retry);
  const shell = h('div', { className: 'radar-map-shell' },
    h('div', { className: 'radar-map-heading' }, h('strong', {}, '서울 딜 지도'), h('span', {}, '예시 위치 · 실제 매물 아님')),
    canvas, notice,
    h('div', { className: 'radar-map-legend', 'aria-label': '적합도 점수 범례' },
      ...[['high', '80–100점'], ['mid', '60–79점'], ['low', '0–59점'], ['unknown', '산출 불가'], ['context', '조건 외']].map(([tone, label]) => h('span', {}, h('i', { className: `radar-legend-${tone}`, 'aria-hidden': 'true' }), label)),
      h('span', {}, '숫자 원: 조건 일치 수 · 확대 시 호가(억)')),
    h('div', { className: 'radar-map-attribution' },
      h('a', { href: 'https://openfreemap.org/', target: '_blank', rel: 'noopener' }, 'OpenFreeMap'), ' · ',
      h('a', { href: 'https://www.openstreetmap.org/copyright', target: '_blank', rel: 'noopener' }, '© OpenStreetMap contributors')),
  );
  let map = null, popup = null, ready = false, destroyed = false, selectedId = null, hoveredId = null;
  let data = radarGeoJSON(buildings), revision = 0, observer = null, resizeObserver = null, timeout = null;
  let library = null, errorSeen = false;
  let detailOpen = false;
  let css = document.getElementById?.('maplibre-css');

  function status(text, canRetry = true) {
    if (destroyed) return;
    message.textContent = text; notice.hidden = false; retry.hidden = !canRetry;
  }
  function fail() {
    errorSeen = true;
    clearTimeout(timeout);
    status(ready ? '일부 지도 정보가 표시되지 않습니다. 목록에서 건물을 확인해 주세요.' : '지도를 불러오지 못했습니다. 목록에서 건물을 확인해 주세요.');
  }
  function allFeatures() { return [...data.matching.features, ...data.context.features]; }
  function resize(options = {}) {
    if (destroyed) return;
    if (Object.hasOwn(options, 'detailOpen')) detailOpen = options.detailOpen;
    if (!map) return;
    const right = detailOpen && globalThis.matchMedia?.('(min-width: 768px) and (max-width: 1439px)').matches ? 400 : 0;
    map.setPadding?.({ top: 0, bottom: 0, left: 0, right });
    map.resize();
  }
  function focusData() {
    if (!ready || !map) return;
    map.getSource('radar-focus')?.setData({ type: 'FeatureCollection', features: allFeatures().filter((f) => f.id === selectedId || f.id === hoveredId) });
  }
  function highlight(id) {
    if (destroyed) return;
    hoveredId = byId.has(id) ? id : null;
    focusData(); onHover(hoveredId);
  }
  function popupFor(id) {
    popup?.remove(); popup = null;
    const b = byId.get(id), coordinates = b && buildingCoordinates(b);
    if (!ready || !coordinates) return;
    const score = allFeatures().find((f) => f.id === id)?.properties.score;
    const content = h('article', { className: 'radar-map-popup' },
      buildingPhoto(b, { compact: true }), h('h3', {}, b.nameKo),
      h('p', { className: 'muted' }, `${districts.get(b.districtId) ?? b.districtId} · ${b.neighborhood} · 예시 위치`),
      h('strong', { className: 'radar-popup-price' }, `${eok(b.askingPriceKrw)}억`),
      h('p', {}, `대지 ${manwon(b.landAreaM2 > 0 ? b.askingPriceKrw / (b.landAreaM2 * 121 / 400) : null)}만원/평`),
      h('p', {}, `Cap rate ${percent(b.capRate)} · 적합도 ${Number.isFinite(score) ? `${score}점` : '산출 불가'}`),
      h('a', { className: 'button button-primary', href: `#/building/${b.id}`, onClick: () => onOpen(b.id) }, '상세 보기 →'));
    popup = new library.Popup({ maxWidth: '280px', offset: 22, focusAfterOpen: false, closeButton: true })
      .setLngLat(coordinates).setDOMContent(content).addTo(map);
  }
  function select(id, { fly = true, notify = true } = {}) {
    if (destroyed) return;
    selectedId = byId.has(id) ? id : null;
    // The selection may open a drawer and change map size/padding. Apply its
    // layout before computing the selected point's camera destination.
    if (notify) onSelect(selectedId);
    focusData(); popupFor(selectedId);
    const coordinates = selectedId && buildingCoordinates(byId.get(selectedId));
    if (ready && fly && coordinates) map.flyTo({ center: coordinates, zoom: Math.max(map.getZoom(), 15.5), duration: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 650 });
  }
  function update(options = {}) {
    if (destroyed) return;
    revision++;
    data = radarGeoJSON(buildings, options);
    if (Object.hasOwn(options, 'selected')) selectedId = options.selected;
    if (ready) {
      map.getSource('radar-matches').setData(data.matching);
      map.getSource('radar-context').setData(data.context);
      focusData();
      if (selectedId) popupFor(selectedId); else { popup?.remove(); popup = null; }
    }
  }
  function addLayers(instance) {
    // Preserve nontext symbols. Some styles reject individual label expressions.
    const symbols = (instance.getStyle().layers ?? []).filter((l) => l.type === 'symbol' && l.layout?.['text-field'] !== undefined);
    for (const layer of symbols) {
      try { instance.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:ko'], ['get', 'name']]); } catch { /* Other labels remain usable. */ }
    }
    const fontStacks = symbols.map((l) => l.layout['text-font']).filter((stack) => Array.isArray(stack) && stack.every((v) => typeof v === 'string'));
    const fonts = fontStacks.find((stack) => stack.some((font) => font.includes('Regular'))) ?? fontStacks[0] ?? ['Noto Sans Regular'];
    const color = (name, fallback) => globalThis.getComputedStyle?.(shell).getPropertyValue(`--map-${name}`).trim() || fallback;
    const scoreColor = ['match', ['get', 'scoreBand'], 'high', color('score-high', '#087e75'), 'mid', color('score-mid', '#285ea8'), 'low', color('score-low', '#586779'), color('score-unknown', '#6b6378')];
    instance.addSource('radar-context', { type: 'geojson', data: data.context });
    instance.addSource('radar-matches', { type: 'geojson', data: data.matching, cluster: true, clusterMaxZoom: 14, clusterRadius: 44 });
    instance.addSource('radar-focus', { type: 'geojson', data: empty() });
    const unclustered = ['!', ['has', 'point_count']];
    instance.addLayer({ id: 'radar-context', type: 'circle', source: 'radar-context', paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-stroke-color': color('context', '#65717e'), 'circle-opacity': .6 } });
    instance.addLayer({ id: 'radar-clusters', type: 'circle', source: 'radar-matches', filter: ['has', 'point_count'], paint: { 'circle-color': color('cluster', '#253b53'), 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 24], 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    instance.addLayer({ id: 'radar-cluster-count', type: 'symbol', source: 'radar-matches', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': fonts, 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff' } });
    instance.addLayer({ id: 'radar-points', type: 'circle', source: 'radar-matches', filter: unclustered, paint: { 'circle-radius': 15, 'circle-color': scoreColor, 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' } });
    instance.addLayer({ id: 'radar-score', type: 'symbol', source: 'radar-matches', filter: unclustered, layout: { 'text-field': ['get', 'scoreLabel'], 'text-font': fonts, 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff' } });
    instance.addLayer({ id: 'radar-price', type: 'symbol', source: 'radar-matches', filter: unclustered, minzoom: 14, layout: { 'text-field': ['get', 'priceLabel'], 'text-font': fonts, 'text-size': 12, 'text-offset': [0, 2], 'text-anchor': 'top' }, paint: { 'text-color': '#17283b', 'text-halo-color': '#ffffff', 'text-halo-width': 2 } });
    instance.addLayer({ id: 'radar-focus-halo', type: 'circle', source: 'radar-focus', paint: { 'circle-radius': 21, 'circle-color': '#ffffff', 'circle-stroke-width': 2, 'circle-stroke-color': color('selected', '#17283b') } });
    instance.addLayer({ id: 'radar-focus-point', type: 'circle', source: 'radar-focus', paint: { 'circle-radius': 16, 'circle-color': scoreColor } });
    instance.addLayer({ id: 'radar-focus-score', type: 'symbol', source: 'radar-focus', layout: { 'text-field': ['get', 'scoreLabel'], 'text-font': fonts, 'text-size': 12, 'text-allow-overlap': true }, paint: { 'text-color': '#ffffff' } });
  }
  function mount() {
    if (destroyed || map || !shell.isConnected) return;
    observer?.disconnect(); observer = null;
    library = maplibre();
    if (!library) { fail(); return; }
    if (css && css.dataset.loaded !== 'true') {
      if (css.dataset.failed === 'true') fail();
      else {
        status('지도 표시 정보를 불러오는 중입니다. 목록은 바로 사용할 수 있습니다.', false);
        clearTimeout(timeout); timeout = setTimeout(fail, 15000);
      }
      return;
    }
    clearTimeout(timeout);
    status('지도를 불러오는 중입니다. 목록은 바로 사용할 수 있습니다.', false);
    errorSeen = false;
    try {
      const instance = new library.Map({ container: canvas, style: STYLE, center: [126.98, 37.55], zoom: 11,
        minZoom: 9, maxZoom: 18, maxBounds: [[126.6, 37.3], [127.4, 37.8]], attributionControl: false });
      map = instance;
      resize();
      instance.addControl(new library.NavigationControl({ showCompass: false }), 'top-right');
      instance.addControl(new library.AttributionControl({ compact: false, customAttribution: ATTRIBUTION }), 'bottom-right');
      instance.on('error', () => { if (map === instance) fail(); });
      instance.on('style.load', () => {
        if (destroyed || map !== instance || ready) return;
        try {
          addLayers(instance); ready = true; focusData();
          if (selectedId) select(selectedId, { notify: false });
        } catch { fail(); }
      });
      instance.on('idle', () => {
        if (map !== instance || destroyed) return;
        clearTimeout(timeout);
        if (ready && !errorSeen) notice.hidden = true;
      });
      for (const layer of ['radar-points', 'radar-context', 'radar-focus-point']) {
        instance.on('mouseenter', layer, (e) => { instance.getCanvas().style.cursor = 'pointer'; highlight(e.features?.[0]?.properties.buildingId); });
        instance.on('mouseleave', layer, () => { instance.getCanvas().style.cursor = ''; highlight(null); });
      }
      instance.on('mouseenter', 'radar-clusters', () => { instance.getCanvas().style.cursor = 'pointer'; });
      instance.on('mouseleave', 'radar-clusters', () => { instance.getCanvas().style.cursor = ''; });
      instance.on('click', async (e) => {
        if (!ready || map !== instance) return;
        const priority = ['radar-focus-point', 'radar-points', 'radar-clusters', 'radar-context'];
        const features = instance.queryRenderedFeatures(e.point, { layers: priority });
        const feature = priority.map((id) => features.find((f) => f.layer.id === id)).find(Boolean);
        if (!feature) return;
        if (feature.layer.id !== 'radar-clusters') { select(feature.properties.buildingId); return; }
        const currentRevision = revision;
        try {
          const zoom = await instance.getSource('radar-matches').getClusterExpansionZoom(feature.properties.cluster_id);
          if (!destroyed && map === instance && revision === currentRevision) instance.easeTo({ center: feature.geometry.coordinates, zoom });
        } catch { /* Source may change during filters or navigation. */ }
      });
      instance.getCanvas().addEventListener('webglcontextlost', fail, { signal: controller.signal });
      if (globalThis.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => { if (map === instance && !destroyed) resize(); });
        resizeObserver.observe(canvas);
      }
      timeout = setTimeout(() => { if (map === instance) fail(); }, 15000);
    } catch {
      map?.remove(); map = null; ready = false; fail();
    }
  }
  function restart() {
    if (destroyed) return;
    clearTimeout(timeout); revision++; popup?.remove(); popup = null;
    resizeObserver?.disconnect(); resizeObserver = null;
    map?.remove(); map = null; ready = false;
    if (css && css.dataset.loaded !== 'true') {
      const replacement = document.createElement('link');
      replacement.id = 'maplibre-css'; replacement.rel = 'stylesheet'; replacement.media = 'print';
      replacement.crossOrigin = 'anonymous'; replacement.href = css.href;
      rememberStylesheet(replacement); bindCSS(replacement); css.replaceWith(replacement); css = replacement;
    }
    mount();
    // An async CDN load never blocks the app. Retry can also reload a failed tag.
    if (!maplibre()) {
      const old = document.getElementById?.('maplibre-cdn');
      if (old) {
        const script = document.createElement('script');
        script.id = 'maplibre-cdn'; script.src = old.src; script.async = true; script.crossOrigin = 'anonymous';
        script.addEventListener('load', mount, { signal: controller.signal });
        script.addEventListener('error', fail, { signal: controller.signal });
        old.replaceWith(script);
      }
    }
  }
  function bindCSS(link) {
    link.addEventListener('load', () => {
      if (destroyed || css !== link) return;
      link.media = 'all'; link.dataset.loaded = 'true'; delete link.dataset.failed;
      mount();
    }, { signal: controller.signal });
    link.addEventListener('error', () => {
      if (destroyed || css !== link) return;
      link.dataset.failed = 'true'; fail();
    }, { signal: controller.signal });
  }
  if (css) bindCSS(css);
  document.getElementById?.('maplibre-cdn')?.addEventListener('load', mount, { signal: controller.signal });
  // Scene factories return before app.js attaches their element.
  queueMicrotask(() => {
    if (destroyed) return;
    if (shell.isConnected) mount();
    else if (globalThis.MutationObserver && document.documentElement) {
      observer = new MutationObserver(() => { if (shell.isConnected) mount(); });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  });
  return { element: shell, mount, update, highlight, select, resize,
    destroy() {
      if (destroyed) return;
      destroyed = true; revision++; clearTimeout(timeout); controller.abort();
      observer?.disconnect(); resizeObserver?.disconnect(); popup?.remove(); map?.remove();
      map = null; popup = null; ready = false;
    },
  };
}
