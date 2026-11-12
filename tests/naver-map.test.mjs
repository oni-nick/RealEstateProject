import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDOM, Element } from './ui-dom-fixture.mjs';
import { createNaverMap } from '../web-v2/js/map/naver-map.js';
import { clusterFeatures } from '../web-v2/js/map/marker-clustering.js';
import { radarGeoJSON } from '../web-v2/js/map/radar-geo.js';

test('Naver renderer clusters matches only, synchronizes selection/hover and releases overlays', () => {
  const restore = installDOM(), handlers = new Set(), markers = [], maps = [], popups = [], selected = [], hovered = [];
  const buildings = [0, 1, 2].map((n) => ({ id: `building-${n}`, lng: 127 + n * .00001, lat: 37.5, askingPriceKrw: 5e9, nameKo: '예시 건물', capRate: .04 }));
  class MapSDK {
    constructor(element, options) { this.options = options; this.zoom = options.zoom; maps.push(this); }
    getZoom() { return this.zoom; } setZoom(zoom) { this.zoom = zoom; }
    setCenter(center) { this.center = center; } panTo(center) { this.center = center; }
    destroy() { this.destroyed = true; }
  }
  class Marker { constructor(options) { this.options = options; markers.push(this); } setMap(map) { this.removed = map === null; } }
  class InfoWindow { constructor(options) { this.options = options; popups.push(this); } open(map, position) { this.position = position; } close() { this.closed = true; } }
  const naver = { Map: MapSDK, Marker, InfoWindow, LatLng: class { constructor(lat, lng) { this.lat = lat; this.lng = lng; } }, Point: class {}, Size: class {},
    Event: { addListener(target, type, callback) { const listener = { target, type, callback }; handlers.add(listener); return listener; }, removeListener(listener) { handlers.delete(listener); } } };
  let adapter;
  try {
    adapter = createNaverMap({ buildings, naver, onSelect: (id) => selected.push(id), onHover: (id) => hovered.push(id) });
    adapter.update({ matchingIds: new Set(buildings.slice(0, 2).map((b) => b.id)), rows: [{ building: buildings[0], score: 87 }] });
    adapter.element.isConnected = true; adapter.mount();
    assert.equal(maps.length, 1);
    assert.equal(maps[0].options.logoControl, true); assert.equal(maps[0].options.mapDataControl, true);
    const active = markers.filter((m) => !m.removed);
    assert.equal(active.length, 2, 'one cluster plus one hollow context point');
    const cluster = active.find((m) => m.options.icon.content.className.includes('naver-cluster'));
    assert.equal(cluster.options.icon.content.textContent, '2');
    [...handlers].find((h) => h.target === cluster && h.type === 'click').callback();
    assert.equal(maps[0].getZoom(), 13);
    adapter.select(buildings[0].id);
    assert.equal(selected.at(-1), buildings[0].id); assert.equal(maps[0].getZoom(), 16);
    assert.equal(popups.at(-1).position.lat, 37.5); assert.equal(popups.at(-1).position.lng, 127);
    assert.ok(popups.at(-1).options.content.textContent.includes('87점'));
    assert.ok(popups.at(-1).options.content.textContent.includes('예시 사진 · 실제 매물 아님'));
    assert.ok(popups.at(-1).options.content.querySelector('img'));
    adapter.highlight(buildings[1].id); assert.equal(hovered.at(-1), buildings[1].id);
    adapter.update({ matchingIds: new Set(), selected: null });
    assert.equal(markers.filter((m) => !m.removed && m.options.icon.content.className.includes('naver-cluster')).length, 0);
    adapter.destroy(); assert.equal(handlers.size, 0); assert.ok(maps[0].destroyed);
    assert.ok(markers.every((m) => m.removed));
    const features = radarGeoJSON(buildings).matching.features;
    assert.equal(clusterFeatures(features, 11)[0].length, 3);
    assert.equal(clusterFeatures(features, 15).length, 3);
  } finally { adapter?.destroy(); restore(); }
});

test('Naver loads runtime config once and uses the new product key parameter', async () => {
  const { createNaverLoader } = await import('../web-v2/js/map/naver-loader.js');
  const scripts = [], host = {};
  const document = { createElement: () => ({}), head: { append(script) {
    scripts.push(script);
    if (scripts.length === 1) { host.PLOT_OS_NAVER_CONFIG = { clientId: 'TEST_CLIENT_ID' }; script.onload(); }
    else { assert.equal(typeof host.navermap_authFailure, 'function'); host.naver = { maps: { Map: class {} } }; script.onload(); }
  } } };
  const load = createNaverLoader({ host, document });
  assert.equal(await load(), host.naver.maps);
  assert.equal(await load(), host.naver.maps);
  assert.equal(scripts.length, 2);
  assert.equal(scripts[0].src, './local-naver-config.js');
  assert.equal(scripts[1].src, 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=TEST_CLIENT_ID');
});

test('Naver auth failure, missing config, placeholders and timeout reject without exposing credentials', async () => {
  const { createNaverLoader } = await import('../web-v2/js/map/naver-loader.js');
  for (const mode of ['auth', 'missing', 'placeholder', 'timeout']) {
    const host = {}; let count = 0;
    const document = { createElement: () => ({}), head: { append(script) {
      count++;
      if (count === 1) {
        if (mode === 'missing') { script.onerror(); return; }
        host.PLOT_OS_NAVER_CONFIG = { clientId: mode === 'placeholder' ? 'YOUR_NAVER_MAPS_CLIENT_ID' : 'TEST_CLIENT_ID' };
        script.onload();
      } else if (mode === 'auth') host.navermap_authFailure();
    } } };
    await assert.rejects(createNaverLoader({ host, document, timeoutMs: 5 })(), (error) => !error.message.includes('TEST_CLIENT_ID'));
  }
});

test('provider adapter keeps queued state, falls back on auth failure and ignores late completion after destroy', async () => {
  const restore = installDOM();
  const { createRadarMap, NAVER_FALLBACK_NOTICE } = await import('../web-v2/js/map/radar-map.js');
  const calls = [];
  const renderer = () => ({ element: new Element('div'), mount() { calls.push('mount'); }, update(o) { calls.push(o); }, select(id) { calls.push(id); }, highlight() {}, resize() {}, destroy() { calls.push('destroy'); } });
  try {
    const map = createRadarMap({ buildings: [], loadNaver: async () => { throw Error('auth'); }, createFallback: renderer });
    const state = { matchingIds: new Set(), selected: null };
    map.update(state); map.element.isConnected = true;
    await map.mount();
    assert.ok(map.element.textContent.includes(NAVER_FALLBACK_NOTICE));
    assert.ok(calls.includes(state));
    map.destroy(); assert.ok(calls.includes('destroy'));
    let resolve;
    const late = createRadarMap({ buildings: [], loadNaver: () => new Promise((r) => { resolve = r; }), createNaver: renderer });
    late.element.isConnected = true; const pending = late.mount(); late.destroy(); resolve({}); await pending;
    assert.equal(calls.filter((c) => c === 'mount').length, 1);
  } finally { restore(); }
});

test('provider adapter chooses Naver on successful loading without constructing fallback', async () => {
  const restore = installDOM();
  const { createRadarMap } = await import('../web-v2/js/map/radar-map.js');
  let chosen = false, mounted = false;
  const sdk = {};
  const map = createRadarMap({ buildings: [], loadNaver: async () => sdk,
    createNaver(options) { assert.equal(options.naver, sdk); chosen = true; return { element: new Element('div'), update() {}, resize() {}, select() {}, mount() { mounted = true; }, destroy() {} }; },
    createFallback() { assert.fail('unexpected fallback'); } });
  try { map.element.isConnected = true; await map.mount(); assert.ok(chosen && mounted); }
  finally { map.destroy(); restore(); }
});

test('production loader reads the ID only at runtime and keeps attribution enabled', () => {
  const loader = readFileSync(new URL('../web-v2/js/map/naver-loader.js', import.meta.url), 'utf8');
  assert.match(loader, /PLOT_OS_NAVER_CONFIG/);
  assert.match(loader, /ncpKeyId=/);
  assert.doesNotMatch(loader, /ncpClientId|console\.|TEST_CLIENT_ID/);
  assert.doesNotMatch(loader, /clientId\s*:\s*['"]/);
  const renderer = readFileSync(new URL('../web-v2/js/map/naver-map.js', import.meta.url), 'utf8');
  assert.match(renderer, /logoControl: true/); assert.match(renderer, /mapDataControl: true/);
});
