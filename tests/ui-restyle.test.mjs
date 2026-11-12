import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { installDOM, Element } from './ui-dom-fixture.mjs';
import { createDataLoader } from '../web-v2/js/data.js';
import { store, DEFAULT_FILTERS, updateFilters } from '../web-v2/js/store.js';
import { parseRoute } from '../web-v2/js/router.js';
import { h, slider } from '../web-v2/js/ui/components.js';

const loader = createDataLoader(async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) }));
const byData = (root, key) => root.querySelectorAll(`[${key}]`);

test('every route renders through the app dispatcher, including deep, summary, buyer, seller and missing records', async () => {
  const restore = installDOM();
  try {
    const { sceneView } = await import('../web-v2/js/scenes.js');
    const data = await loader.loadCore();
    const summary = data.buildings.find((b) => !b.deepPath).id;
    const context = { data, loader, store, inspect() {}, summaryNumber: (b, key, label, format) => h('span', {}, format(b[key])), metricNumber: (r, key, label, format) => h('span', {}, format(r.metrics[key].value)) };
    const paths = ['#/', '#/radar', '#/listings', '#/proposal', '#/missing'];
    for (const id of ['bld-gangnam-001', summary, 'bld-gangnam-999']) {
      for (const suffix of ['', '/bid', '/valueup', '/proposal?for=buyer', '/proposal?for=seller']) paths.push(`#/building/${id}${suffix}`);
    }
    store.setState({ filters: DEFAULT_FILTERS, selectedId: null });
    for (const path of paths) {
      const view = await sceneView(context, parseRoute(path));
      try {
        assert.ok(view.element instanceof Element, path);
        assert.ok(view.element.textContent.length > 20, path);
        if (path.includes('proposal?') && !path.includes('999')) {
          assert.equal(byData(view.element, 'data-proposal-sheet').length, 5, path);
          assert.equal(view.element.querySelectorAll('img').length, 1, 'report cover has example imagery');
          assert.ok(view.element.textContent.includes('해당 건물의 실제 사진 아님'));
        }
      } finally { view.destroy?.(); }
    }
  } finally { store.setState({ filters: DEFAULT_FILTERS, selectedId: null }); restore(); }
});

test('Radar selection opens a closeable drawer and route links while preserving filters and one map instance', async () => {
  const restore = installDOM();
  let view;
  try {
    const { radarView } = await import('../web-v2/js/ui/radar-view.js');
    const data = await loader.loadCore();
    store.setState({ filters: DEFAULT_FILTERS, selectedId: null });
    let options, mapCount = 0, resized = 0;
    const context = { data, loader, store, inspect() {}, summaryNumber: (b, key, label, format) => h('span', {}, format(b[key])), metricNumber: (r, key, label, format) => h('span', {}, format(r.metrics[key].value)),
      createRadarMap(o) { options = o; mapCount++; return { element: h('div'), update() {}, highlight() {}, select(id) { o.onSelect(id); }, resize() { resized++; }, destroy() {} }; } };
    view = radarView(context);
    const first = byData(view.element, 'data-card-id')[0].dataset.cardId;
    options.onSelect(first);
    const drawer = byData(view.element, 'data-radar-drawer')[0];
    assert.equal(drawer.hidden, false);
    assert.ok(drawer.textContent.includes(data.buildings.find((b) => b.id === first).nameKo));
    assert.ok(drawer.querySelectorAll('a').some((a) => a.getAttribute('href') === `#/building/${first}/bid`));
    const filters = store.getState().filters;
    drawer.querySelectorAll('button').find((b) => b.getAttribute('aria-label') === '건물 상세 닫기').dispatchEvent(new Event('click'));
    assert.equal(drawer.hidden, true);
    assert.equal(store.getState().selectedId, null);
    assert.equal(store.getState().filters, filters);
    assert.equal(mapCount, 1);
    assert.ok(resized >= 2);
    options.onSelect(first);
    updateFilters({ query: 'NO MATCH' });
    assert.equal(drawer.hidden, true, 'filter exclusion closes stale details');
  } finally { view?.destroy(); store.setState({ filters: DEFAULT_FILTERS, selectedId: null }); restore(); }
});

test('small-screen Radar details use a native modal and Escape restores the nonmodal drawer', async () => {
  const restore = installDOM(), savedMedia = globalThis.matchMedia;
  let view;
  const media = new EventTarget(); media.matches = true;
  globalThis.matchMedia = () => media;
  try {
    const { radarView } = await import('../web-v2/js/ui/radar-view.js');
    const data = await loader.loadCore();
    store.setState({ filters: DEFAULT_FILTERS, selectedId: null });
    let options;
    view = radarView({ data, loader, store, inspect() {}, summaryNumber: (b, key, label, format) => h('span', {}, format(b[key])), metricNumber: (r, key, label, format) => h('span', {}, format(r.metrics[key].value)),
      createRadarMap(o) { options = o; return { element: h('div'), update() {}, highlight() {}, select() {}, resize() {}, destroy() {} }; } });
    const first = byData(view.element, 'data-card-id')[0].dataset.cardId;
    options.onSelect(first);
    const modal = byData(view.element, 'data-radar-modal')[0];
    assert.ok(modal?.open, 'native showModal provides focus containment and background inertness');
    const drawer = byData(view.element, 'data-radar-drawer')[0];
    assert.equal(drawer.parentNode, modal);
    modal.dispatchEvent(new Event('cancel', { cancelable: true }));
    assert.equal(modal.open, false); assert.equal(store.getState().selectedId, null);
    options.onSelect(first); media.matches = false; media.dispatchEvent(new Event('change'));
    assert.equal(modal.open, false);
    assert.notEqual(drawer.parentNode, modal, 'desktop drawer is nonmodal again');
  } finally { view?.destroy(); store.setState({ filters: DEFAULT_FILTERS, selectedId: null }); if (savedMedia === undefined) delete globalThis.matchMedia; else globalThis.matchMedia = savedMedia; restore(); }
});

test('slider number input shares bounds, emits existing callbacks and rejects invalid edits', () => {
  const restore = installDOM();
  try {
    let value;
    const control = slider({ label: 'LTV', value: 50, min: 0, max: 80, step: 5, format: (v) => `${v}%`, onInput: (v) => { value = v; } });
    const [range, input] = control.querySelectorAll('input');
    assert.ok(input, 'direct number entry');
    assert.equal(input.getAttribute('type'), 'number');
    input.value = '65'; input.dispatchEvent(new Event('input'));
    assert.equal(value, 65); assert.equal(Number(range.value), 65);
    assert.equal(control.querySelector('output').textContent, '65%');
    input.value = ''; input.dispatchEvent(new Event('change'));
    assert.equal(value, 65); assert.equal(Number(input.value), 65);
    input.value = '95'; input.dispatchEvent(new Event('change'));
    assert.equal(value, 80); assert.equal(Number(range.value), 80);
  } finally { restore(); }
});

test('numeric editors preserve partial multi-digit and stepped values until they can be committed', () => {
  const restore = installDOM();
  try {
    for (const [min, max, step, first, final] of [[30, 150, 1, '8', '85'], [0, 80, 5, '6', '65']]) {
      let value;
      const control = slider({ label: '가격', value: 50, min, max, step, onInput: (v) => { value = v; control.setValue(v); } });
      const input = control.querySelectorAll('input')[1];
      input.value = first; input.dispatchEvent(new Event('input'));
      assert.equal(input.value, first, 'unfinished keystrokes must not be clamped or snapped');
      assert.equal(value, undefined);
      input.value += final.slice(1); input.dispatchEvent(new Event('input'));
      assert.equal(value, Number(final));
    }
  } finally { restore(); }
});

test('global search applies the query to Radar and releases listeners on cleanup', async () => {
  const restore = installDOM();
  let dispose;
  try {
    const { bindShell } = await import('../web-v2/js/ui/shell.js');
    store.setState({ filters: DEFAULT_FILTERS, selectedId: null });
    const form = h('form'), input = h('input');
    const host = { location: { hash: '#/listings' } };
    const nav = h('a', { 'data-building-scene': 'bid' });
    const root = { getElementById: (id) => id === 'global-search' ? form : input, querySelectorAll: () => [nav] };
    dispose = bindShell(store, root, host);
    input.value = '  강남  ';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    assert.equal(store.getState().filters.query, '강남');
    assert.equal(host.location.hash, '#/radar');
    updateFilters({ query: '성수' });
    assert.equal(input.value, '성수');
    store.setState({ selectedId: 'bld-mapo-002' });
    assert.equal(nav.getAttribute('href'), '#/building/bld-mapo-002/bid', 'header follows map/list selection without routing');
    dispose();
    input.value = '송파'; form.dispatchEvent(new Event('submit', { cancelable: true }));
    assert.equal(store.getState().filters.query, '성수');
  } finally { dispose?.(); store.setState({ filters: DEFAULT_FILTERS, selectedId: null }); restore(); }
});
