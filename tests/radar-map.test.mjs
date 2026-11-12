import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { buildingCoordinates, radarGeoJSON, scoreBand } from '../web-v2/js/map/radar-geo.js';
import { createRadarMap } from '../web-v2/js/map/maplibre-map.js';

const buildings = JSON.parse(readFileSync(new URL('../web-v2/data/buildings.json', import.meta.url))).buildings;

test('Radar coordinates preserve synthetic lng/lat and derive stable local fallback by ID', () => {
  for (const b of buildings) assert.deepEqual(buildingCoordinates(b), [b.lng, b.lat]);
  const b = { id: 'missing-1', districtId: 'gangnam' };
  const a = buildingCoordinates(b);
  assert.deepEqual(a, buildingCoordinates({ ...b }));
  assert.notDeepEqual(a, buildingCoordinates({ ...b, id: 'missing-2' }));
  assert.ok(Math.abs(a[0] - 127.047) <= .012 && Math.abs(a[1] - 37.505) <= .009);
  assert.deepEqual(a, buildingCoordinates({ ...b, lng: NaN, lat: null }));
  assert.equal(buildingCoordinates({ id: 'unknown', districtId: 'unknown' }), null);
  assert.equal(buildingCoordinates({ lng: 0, lat: 0 }), null);
});

test('GeoJSON partitions matching clusters from context with exact IDs, scores and valid points', () => {
  const rows = buildings.map((building, index) => ({ building, score: index % 101, matches: index % 3 === 0 }));
  const ids = new Set(rows.filter((r) => r.matches).map((r) => r.building.id));
  const data = radarGeoJSON(buildings, { matchingIds: ids, rows });
  assert.equal(data.matching.type, 'FeatureCollection');
  assert.deepEqual(data.matching.features.map((f) => f.id), [...ids]);
  assert.equal(data.matching.features.length + data.context.features.length, 400);
  for (const f of [...data.matching.features, ...data.context.features]) {
    const b = buildings.find((b) => b.id === f.id);
    assert.equal(f.geometry.type, 'Point');
    assert.deepEqual(f.geometry.coordinates, [b.lng, b.lat]);
    assert.equal(f.properties.buildingId, b.id);
    assert.equal(f.properties.score, rows.find((r) => r.building.id === b.id).score);
    assert.match(f.properties.priceLabel, /억$/);
    assert.equal(f.properties.locationKind, 'synthetic');
  }
  assert.equal(radarGeoJSON(buildings, { matchingIds: new Set() }).matching.features.length, 0);
  assert.equal(radarGeoJSON([{ id: 'bad' }]).matching.features.length, 0);
  assert.equal(radarGeoJSON(buildings).matching.features[0].properties.score, null);
});

test('map score thresholds agree with design guide, including unavailable scores', () => {
  for (const [score, band] of [[100, 'high'], [80, 'high'], [79, 'mid'], [60, 'mid'], [59, 'low'], [0, 'low'], [null, 'unknown'], [NaN, 'unknown']]) {
    assert.equal(scoreBand(score), band);
  }
});

test('Radar adapter queues filters, selects popup/marker, handles cluster races and tears down safely', async () => {
  class Element extends EventTarget {
    constructor(tag, text = '') { super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this._text = text; this.style = {}; this.dataset = {}; this.isConnected = false; }
    setAttribute(k, v) { this.attributes.set(k, String(v)); }
    getAttribute(k) { return this.attributes.get(k); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); }
    set textContent(t) { this._text = String(t); this.children = []; }
  }
  const saved = { document: globalThis.document, Node: globalThis.Node, matchMedia: globalThis.matchMedia };
  let overlay = true;
  globalThis.matchMedia = () => ({ matches: overlay });
  globalThis.Node = Element;
  let cssTag = null;
  globalThis.document = { createElement: (tag) => new Element(tag), createTextNode: (text) => new Element('#text', text), getElementById: (id) => id === 'maplibre-css' ? cssTag : null };
  const instances = [], popups = [];
  class MapAdapter {
    constructor(options) { this.options = options; this.sources = new Map(); this.layers = []; this.handlers = []; this.canvas = new Element('canvas'); this.controls = []; instances.push(this); }
    on(type, layer, callback) { this.handlers.push({ type, layer: callback ? layer : null, callback: callback ?? layer }); return this; }
    fire(type, layer = null, event = {}) { for (const h of this.handlers) if (h.type === type && h.layer === layer) h.callback(event); }
    getStyle() { return { layers: [{ id: 'labels', type: 'symbol', layout: { 'text-field': '{name}', 'text-font': ['Noto Sans Regular'] } }, { id: 'icons', type: 'symbol', layout: {} }] }; }
    setLayoutProperty(id, key, value) { this.korean = { id, key, value }; }
    addSource(id, spec) { this.sources.set(id, { ...spec, setData(data) { this.data = data; }, getClusterExpansionZoom: () => new Promise((resolve) => { this.resolveCluster = resolve; }) }); }
    getSource(id) { return this.sources.get(id); }
    addLayer(layer) { this.layers.push(layer); }
    addControl(control) { this.controls.push(control); }
    getCanvas() { return this.canvas; }
    queryRenderedFeatures() { return this.hits ?? []; }
    getZoom() { return 11; }
    flyTo(view) { this.lastFly = view; }
    easeTo(view) { this.lastEase = view; }
    resize() { this.resized = true; }
    setPadding(padding) { this.padding = padding; }
    remove() { this.removed = true; this.handlers = []; }
  }
  class Popup {
    constructor() { popups.push(this); }
    setLngLat(p) { this.coordinates = p; return this; }
    setDOMContent(n) { this.content = n; return this; }
    addTo() { return this; }
    remove() { this.removed = true; }
  }
  const lib = { Map: MapAdapter, Popup, NavigationControl: class {}, AttributionControl: class { constructor(options) { this.options = options; } } };
  let map, fallback, failed, late, cssGate;
  try {
    const selections = [], hovered = [];
    map = createRadarMap({ buildings, maplibre: () => lib, onSelect: (id) => selections.push(id), onHover: (id) => hovered.push(id) });
    assert.equal(instances.length, 0, 'no WebGL before attachment');
    const b = buildings[0], rows = [{ building: b, score: 87, matches: true }];
    map.update({ matchingIds: new Set([b.id]), rows });
    map.resize({ detailOpen: true });
    map.element.isConnected = true; map.mount();
    const raw = instances[0];
    assert.equal(raw.padding.right, 400, 'queued drawer layout applies after delayed map creation');
    overlay = false; map.resize();
    assert.equal(raw.padding.right, 0, 'wide layout removes overlay padding');
    overlay = true; map.resize();
    assert.equal(raw.padding.right, 400, 'narrow layout restores overlay padding');
    map.resize({ detailOpen: false });
    assert.equal(raw.padding.right, 0);
    assert.equal(raw.options.style, 'https://tiles.openfreemap.org/styles/positron');
    assert.deepEqual(raw.options.center, [126.98, 37.55]);
    raw.fire('style.load');
    assert.equal(raw.getSource('radar-matches').cluster, true);
    assert.equal(raw.getSource('radar-matches').data.features.length, 1);
    assert.equal(raw.getSource('radar-matches').data.features[0].properties.score, 87);
    assert.equal(raw.getSource('radar-context').data.features.length, 399);
    assert.deepEqual(raw.korean.value, ['coalesce', ['get', 'name:ko'], ['get', 'name']]);
    assert.equal(raw.korean.id, 'labels');
    map.select(b.id);
    assert.deepEqual(raw.lastFly.center, [b.lng, b.lat]);
    assert.equal(raw.getSource('radar-focus').data.features[0].id, b.id);
    assert.equal(selections.at(-1), b.id);
    assert.ok(popups.at(-1).content.textContent.includes('예시'));
    for (const text of ['대지', 'Cap rate', '87점', '상세 보기']) assert.ok(popups.at(-1).content.textContent.includes(text), text);
    raw.hits = [
      { layer: { id: 'radar-points' }, properties: { buildingId: buildings[1].id } },
      { layer: { id: 'radar-focus-point' }, properties: { buildingId: buildings[1].id } },
      { layer: { id: 'radar-clusters' }, properties: { cluster_id: 1 }, geometry: { coordinates: [127, 37.5] } },
    ];
    const before = selections.length;
    raw.fire('click');
    assert.equal(selections.at(-1), buildings[1].id);
    assert.equal(selections.length, before + 1, 'overlapping actionable layers cause one selection');
    assert.equal(raw.resolveCluster, undefined, 'focused point takes priority over underlying cluster');
    map.highlight(b.id); assert.equal(hovered.at(-1), b.id);
    raw.hits = [{ layer: { id: 'radar-clusters' }, properties: { cluster_id: 1 }, geometry: { coordinates: [127, 37.5] } }];
    raw.fire('click');
    map.update({ matchingIds: new Set(), rows: [] });
    raw.resolveCluster(14); await Promise.resolve(); await Promise.resolve();
    assert.equal(raw.lastEase, undefined, 'obsolete cluster result must not move map');
    raw.fire('click'); raw.resolveCluster(14); await Promise.resolve(); await Promise.resolve();
    assert.equal(raw.lastEase.zoom, 14);
    raw.fire('error', null, { error: new Error('tile offline') });
    assert.ok(map.element.textContent.includes('일부 지도 정보'));
    map.destroy(); assert.equal(raw.removed, true); assert.ok(popups.at(-1).removed);
    map.mount(); assert.equal(instances.length, 1);
    fallback = createRadarMap({ buildings, maplibre: () => undefined });
    fallback.element.isConnected = true; fallback.mount();
    assert.ok(fallback.element.textContent.includes('목록에서 건물을 확인'));
    fallback.update({ matchingIds: new Set() }); fallback.select(b.id);
    failed = createRadarMap({ buildings, maplibre: () => ({ Map: class { constructor() { throw Error('WebGL'); } } }) });
    failed.element.isConnected = true; failed.mount();
    assert.ok(failed.element.textContent.includes('목록에서 건물을 확인'));
    late = createRadarMap({ buildings, maplibre: () => lib }); late.destroy(); late.element.isConnected = true; late.mount();
    assert.equal(instances.length, 1, 'destroy before mount cancels initialization');
    cssTag = new Element('link'); cssTag.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
    const failedTag = cssTag;
    cssTag.replaceWith = (next) => { cssTag = next; };
    cssGate = createRadarMap({ buildings, maplibre: () => lib });
    cssGate.element.isConnected = true; cssGate.mount();
    assert.equal(instances.length, 1, 'pending CSS cannot initialize an unstyled map');
    cssTag.dispatchEvent(new Event('error'));
    assert.ok(cssGate.element.textContent.includes('목록에서 건물을 확인'));
    cssGate.element.children[2].children[1].dispatchEvent(new Event('click'));
    assert.notEqual(cssTag, failedTag, 'retry replaces failed stylesheet');
    cssGate.destroy();
    cssTag.dispatchEvent(new Event('load'));
    assert.equal(cssTag.media, 'all', 'stylesheet completion survives leaving Radar');
    cssGate = createRadarMap({ buildings, maplibre: () => lib });
    cssGate.element.isConnected = true; cssGate.mount();
    assert.equal(instances.length, 2, 'returning after CSS recovery mounts a single map');
  } finally {
    map?.destroy(); fallback?.destroy(); failed?.destroy(); late?.destroy(); cssGate?.destroy();
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});
