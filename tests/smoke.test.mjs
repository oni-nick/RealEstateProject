import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname, relative, resolve, sep } from 'node:path';
import test from 'node:test';
import * as engine from '../web-v2/js/engine/index.js';
import { createDataLoader } from '../web-v2/js/data.js';
import { createStore, DEFAULT_FILTERS, filterBuildings, store as appStore, updateFilters } from '../web-v2/js/store.js';
import { createRouter, parseRoute } from '../web-v2/js/router.js';
import { createProjection, clampViewBox, zoomViewBox } from '../web-v2/js/ui/map.js';
import { eok, median, percent } from '../web-v2/js/ui/format.js';
import { createRadarMatcher } from '../web-v2/js/radar.js';

const root = fileURLToPath(new URL('../web-v2/', import.meta.url));
function walk(path) {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(path, entry.name)) : [join(path, entry.name)]);
}
const files = walk(root);
const json = (name) => JSON.parse(readFileSync(join(root, 'data', name), 'utf8'));
const buildings = json('buildings.json').buildings;
const geography = json('districts.json');

test('every web-v2 JSON file parses, and text assets are UTF-8 without BOM below 1 MB', () => {
  let parsed = 0;
  for (const file of files.filter((p) => /\.(?:json|js|css|html)$/.test(p))) {
    const bytes = readFileSync(file);
    assert.ok(bytes.length < 1_000_000, relative(root, file));
    assert.notDeepEqual([...bytes.subarray(0, 3)], [239, 187, 191], file);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!text.includes('\ufffd'), file);
    if (file.endsWith('.json')) { JSON.parse(text); parsed++; }
  }
  assert.ok(parsed >= 32, `Only ${parsed} JSON files checked`);
});

test('index references existing relative local assets, Korean routes and persistent example badge', () => {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const resources = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]).filter((value) => !value.startsWith('#') && !value.startsWith('data:'));
  assert.ok(resources.length >= 6);
  for (const resource of resources) {
    assert.ok(resource.startsWith('./'), resource);
    assert.ok(existsSync(resolve(root, resource)), resource);
  }
  assert.ok(html.includes('type="module" src="./js/app.js"'));
  for (const name of ['radar', 'listings', 'proposal']) assert.ok(html.includes(`href="#/${name}"`), name);
  assert.ok(html.includes('예시 데이터 · 실제 매물 아님'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(!/https?:\/\//.test(html));
});

test('all native ES modules import in Node and their relative imports exist', async () => {
  assert.equal(typeof engine.calculate, 'function');
  assert.equal(typeof engine.maxPurchasePrice, 'function');
  for (const file of files.filter((p) => p.endsWith('.js'))) {
    const source = readFileSync(file, 'utf8');
    assert.ok(!/\b(?:from|import)\s*['"](?:https?:|[a-z@])/.test(source), file);
    for (const match of source.matchAll(/(?:from\s+|import\s*)['"](\.[^'"]+)['"]/g)) assert.ok(existsSync(resolve(dirname(file), match[1])), `${file}: ${match[1]}`);
    await import(pathToFileURL(file));
  }
});

test('hash routes parse direct links and query strings; browser history listener disposes', () => {
  assert.equal(parseRoute('').name, 'home');
  assert.equal(parseRoute('#/radar').name, 'radar');
  assert.equal(parseRoute('#/listings').name, 'listings');
  assert.equal(parseRoute('#/building/bld-gangnam-001').id, 'bld-gangnam-001');
  const proposal = parseRoute('#/building/bld-mapo-002/proposal?for=seller');
  assert.equal(proposal.name, 'proposal');
  assert.equal(proposal.params.get('for'), 'seller');
  assert.equal(parseRoute('#/building/bld-gangnam-001/bid').name, 'bid');
  assert.equal(parseRoute('#/building/../../secrets').name, 'not-found');
  assert.equal(parseRoute('#/%xx').name, 'not-found');
  const handlers = new Map();
  const host = { location: { hash: '#/radar' }, addEventListener: (event, handler) => handlers.set(event, handler), removeEventListener: (event, handler) => { assert.equal(handlers.get(event), handler); handlers.delete(event); } };
  const seen = [];
  const stop = createRouter((route) => seen.push(route.name), host);
  host.location.hash = '#/listings'; handlers.get('hashchange')();
  assert.deepEqual(seen, ['radar', 'listings']);
  stop(); assert.equal(handlers.size, 0);
});

test('session store updates subscribers, preserves old state and releases subscriptions', () => {
  const store = createStore();
  const previous = store.getState();
  let called = 0;
  const release = store.subscribe(() => called++);
  store.setState((state) => ({ evidenceMode: !state.evidenceMode }));
  assert.equal(store.getState().evidenceMode, true);
  assert.equal(previous.evidenceMode, false);
  assert.ok(Object.isFrozen(store.getState()));
  release(); store.setState({ selectedId: 'bld-mapo-001' });
  assert.equal(called, 1);
});

test('shared filters exclude closed records, combine conditions and handle no matches', () => {
  const all = filterBuildings(buildings, DEFAULT_FILTERS);
  assert.ok(all.length > 0 && all.length < buildings.length);
  assert.ok(all.every((b) => b.statusKo !== '거래완료 참고'));
  const selected = filterBuildings(buildings, { ...DEFAULT_FILTERS, districts: ['gangnam'], maxPriceEok: 90, maxWalk: 12, deepOnly: true });
  assert.ok(selected.length > 0);
  assert.ok(selected.every((b) => b.districtId === 'gangnam' && b.deepPath && b.askingPriceKrw <= 90e8 && b.walkMinutes <= 12));
  assert.equal(filterBuildings(buildings, { ...DEFAULT_FILTERS, query: '  NO SUCH MOCK BUILDING  ' }).length, 0);
  const query = filterBuildings(buildings, { ...DEFAULT_FILTERS, query: '역삼' });
  assert.ok(query.length > 0);
});

test('relative data loader deduplicates concurrent fetches and loads all core data', async () => {
  const calls = [];
  const loader = createDataLoader(async (url) => {
    const path = fileURLToPath(url);
    assert.ok(path.startsWith(join(root, 'data') + sep));
    calls.push(path);
    return { ok: true, json: async () => JSON.parse(readFileSync(path, 'utf8')) };
  });
  const [a, b] = await Promise.all([loader.load('buildings.json'), loader.load('buildings.json')]);
  assert.equal(a, b); assert.equal(calls.length, 1);
  const core = await loader.loadCore();
  assert.equal(core.buildings.length, 400); assert.equal(calls.length, 4);
  const building = core.buildings.find((b) => b.deepPath);
  assert.equal((await loader.loadDeep(building)).buildingId, building.id);
  assert.equal(await loader.loadDeep(core.buildings.find((b) => !b.deepPath)), null);
  assert.throws(() => loader.load('../../private.json'));
});

test('failed HTTP and malformed JSON requests can retry; mismatched detail is rejected', async () => {
  let attempts = 0;
  const loader = createDataLoader(async () => ++attempts === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => ({ buildings: [] }) });
  await assert.rejects(loader.load('buildings.json'), /503/);
  await loader.load('buildings.json'); assert.equal(attempts, 2);
  const invalid = createDataLoader(async () => ({ ok: true, json: async () => { throw new SyntaxError('Bad JSON'); } }));
  await assert.rejects(invalid.load('districts.json'), SyntaxError);
  const mismatch = createDataLoader(async () => ({ ok: true, json: async () => ({ buildingId: 'other', rentRoll: [] }) }));
  await assert.rejects(mismatch.loadDeep(buildings[0]), /일치/);
});

test('schematic map projection fits every polygon, river point and building with uniform scale', () => {
  const project = createProjection(geography);
  for (const point of [...geography.districts.flatMap((d) => d.polygon), ...geography.river.points, ...buildings]) {
    const p = project(point);
    assert.ok(p.x >= 52 - 1e-8 && p.x <= 848 + 1e-8, JSON.stringify(p));
    assert.ok(p.y >= 52 - 1e-8 && p.y <= 548 + 1e-8, JSON.stringify(p));
  }
  const a = project({ lng: 127, lat: 37.5 });
  const b = project({ lng: 127.01, lat: 37.51 });
  assert.ok(Math.abs((b.x - a.x) + (b.y - a.y)) < 1e-8);
  assert.throws(() => createProjection({ districts: [], river: { points: [] } }));
});

test('viewBox pan/zoom stays within bounds, preserves aspect and anchors before clamping', () => {
  const base = { x: 0, y: 0, width: 900, height: 600 };
  const zoomed = zoomViewBox(base, .5, { x: 300, y: 200 });
  assert.deepEqual(zoomed, { x: 150, y: 100, width: 450, height: 300 });
  assert.deepEqual(zoomViewBox(zoomed, 2), base);
  const clamped = clampViewBox({ x: -1e9, y: 1e9, width: 1 });
  assert.deepEqual(clamped, { x: 0, y: 480, width: 180, height: 120 });
  for (let i = 0; i < 30; i++) {
    const v = zoomViewBox(zoomed, .1, { x: i * 100, y: i * 80 });
    assert.ok(v.width >= 180 && v.width <= 900);
    assert.ok(v.x >= 0 && v.x + v.width <= 900);
    assert.ok(v.y >= 0 && v.y + v.height <= 600);
    assert.equal(v.width / v.height, 1.5);
  }
});

test('unavailable values never format as zero and aggregate medians are deterministic', () => {
  assert.equal(eok(null), '—'); assert.equal(percent(null), '산출 불가');
  assert.equal(median([]), null); assert.equal(median([1, 7, 3, 5]), 4);
  assert.equal(median([null, 5, NaN, 1, 3]), 3);
});

test('views construct with real mock data; filters, map activation and cleanup work in a minimal DOM fixture', async () => {
  // This fixture checks DOM construction/events, not browser layout or rendering.
  class Element extends EventTarget {
    constructor(tag, text = '') {
      super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this.dataset = {}; this.className = ''; this._text = text;
      this.classList = {
        toggle: (name, force) => {
          const classes = new Set(this.className.split(/\s+/).filter(Boolean));
          const enabled = force ?? !classes.has(name);
          if (enabled) classes.add(name); else classes.delete(name);
          this.className = [...classes].join(' '); return enabled;
        },
        add: (name) => this.classList.toggle(name, true), remove: (name) => this.classList.toggle(name, false),
      };
    }
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      if (name === 'class') this.className = value;
      if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = value;
    }
    getAttribute(name) { return this.attributes.get(name); }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    get textContent() { return this._text + this.children.map((child) => child.textContent ?? String(child)).join(''); }
    set textContent(value) { this._text = String(value); this.children = []; }
    querySelectorAll(selector) {
      const all = this.children.flatMap((child) => child instanceof Element ? [child, ...child.querySelectorAll('*')] : []);
      if (selector === '*') return all;
      if (selector.startsWith('[')) return all.filter((child) => child.attributes.has(selector.slice(1, -1)));
      return all.filter((child) => child.tagName === selector);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getScreenCTM() { return null; }
  }
  const savedDocument = globalThis.document, savedNode = globalThis.Node;
  globalThis.Node = Element;
  globalThis.document = { createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag), createTextNode: (text) => new Element('#text', text) };
  const views = [];
  try {
    const { homeView, radarView, listingsView, buildingView, proposalView } = await import('../web-v2/js/views.js');
    const { bidView } = await import('../web-v2/js/ui/bid-view.js');
    const { h } = await import('../web-v2/js/ui/components.js');
    const loader = createDataLoader(async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) }));
    const data = await loader.loadCore();
    appStore.setState({ filters: DEFAULT_FILTERS, selectedId: null });
    let inspected, lastMetricResult;
    const context = { data, loader, store: appStore, inspect(details) { inspected = details; }, summaryNumber: (b, key, label, format) => h('span', {}, format(b[key])), metricNumber: (result, key, label, format) => { lastMetricResult = result; return h('span', {}, format(result.metrics[key].value)); } };
    const home = homeView(context); views.push(home);
    assert.ok(home.element.textContent.includes('지도를 보는 도구가 아니라, 딜을 성사시키는 도구'));
    assert.equal(home.element.querySelectorAll('circle').length, 400);
    const radar = radarView(context); views.push(radar);
    assert.equal(radar.element.querySelectorAll('polygon').length, 10);
    const listing = listingsView(context); views.push(listing);
    assert.ok(listing.element.textContent.includes('현재 조건'));
    updateFilters({ query: 'NO SUCH MOCK BUILDING' });
    assert.ok(radar.element.textContent.includes('일치하는 후보가 없습니다'));
    assert.ok(listing.element.textContent.includes('검색 결과가 없습니다'));
    updateFilters(DEFAULT_FILTERS);
    assert.ok(!radar.element.textContent.includes('일치하는 후보가 없습니다'));
    const matchCount = createRadarMatcher().evaluate(buildings, DEFAULT_FILTERS).filter((r) => r.matches).length;
    assert.equal(radar.element.querySelectorAll('[data-card-id]').length, Math.min(20, matchCount));
    assert.ok(radar.element.textContent.includes('왜 맞는지'));
    assert.ok(radar.element.textContent.includes('중앙값 IRR'));
    assert.ok(radar.element.textContent.includes('강남 사옥용'));
    const marked = radar.element.querySelectorAll('circle').filter((dot) => !dot.className.includes('is-dimmed'));
    assert.equal(marked.length, matchCount);
    const controlByLabel = (label) => radar.element.querySelectorAll('*').find((el) => el.getAttribute('aria-label') === label);
    const preset = radar.element.querySelectorAll('button').find((el) => el.textContent === '강남 사옥용');
    preset.dispatchEvent(new Event('click'));
    assert.deepEqual(appStore.getState().filters.districts, ['gangnam']);
    assert.equal(preset.getAttribute('aria-pressed'), 'true');
    const minPrice = radar.element.querySelectorAll('input').find((el) => el.getAttribute('aria-valuetext') === '30억' && Number(el.getAttribute('min')) === 30);
    minPrice.value = '140'; minPrice.dispatchEvent(new Event('input'));
    const maxPrice = radar.element.querySelectorAll('input').find((el) => el.getAttribute('aria-valuetext') === '150억' && Number(el.getAttribute('min')) === 30);
    maxPrice.value = '70'; maxPrice.dispatchEvent(new Event('input'));
    assert.equal(appStore.getState().filters.minPriceEok, 70);
    assert.equal(appStore.getState().filters.maxPriceEok, 70);
    assert.equal(minPrice.value, 70);
    updateFilters(DEFAULT_FILTERS);
    const sortControl = controlByLabel('후보 정렬');
    sortControl.value = 'price'; sortControl.dispatchEvent(new Event('change'));
    const expectedIds = createRadarMatcher().evaluate(buildings, DEFAULT_FILTERS).filter((r) => r.matches).sort((a, b) => a.building.askingPriceKrw - b.building.askingPriceKrw).map((r) => r.building.id);
    assert.deepEqual(radar.element.querySelectorAll('[data-card-id]').map((el) => el.dataset.cardId), expectedIds);
    // Select the list checkbox by its container text rather than DOM order.
    const outsideLabel = radar.element.querySelectorAll('label').find((el) => el.textContent === '조건 외도 보기');
    const outsideInput = outsideLabel.querySelector('input');
    outsideInput.checked = true; outsideInput.dispatchEvent(new Event('change'));
    assert.equal(radar.element.querySelectorAll('[data-card-id]').length, 20);
    const firstPage = radar.element.querySelectorAll('[data-card-id]')[0].dataset.cardId;
    radar.element.querySelectorAll('button').find((el) => el.textContent === '다음 →').dispatchEvent(new Event('click'));
    assert.notEqual(radar.element.querySelectorAll('[data-card-id]')[0].dataset.cardId, firstPage);
    outsideInput.checked = false; outsideInput.dispatchEvent(new Event('change'));
    const ltv = radar.element.querySelectorAll('input').find((el) => el.getAttribute('aria-valuetext') === '50%');
    ltv.value = '65'; ltv.dispatchEvent(new Event('input'));
    await new Promise((resolve) => setTimeout(resolve, 130));
    assert.ok(radar.element.textContent.includes('LTV 65%'));
    updateFilters(DEFAULT_FILTERS);
    const detail = await buildingView(context, parseRoute('#/building/bld-gangnam-001')); views.push(detail);
    assert.ok(detail.element.textContent.includes('가상 강남구 001'));
    assert.ok(detail.element.textContent.includes('1F-A (가상)'));
    assert.equal(detail.selectId, 'bld-gangnam-001');
    assert.ok(detail.element.textContent.includes('임대차 만기 워터폴'));
    assert.ok(detail.element.textContent.includes('가상 비교 거래'));
    assert.ok(detail.element.textContent.includes('cmp-gangnam-011'));
    const compPrice = detail.element.querySelectorAll('button').find((b) => b.getAttribute('aria-label')?.startsWith('가상 비교 거래가'));
    assert.ok(compPrice, 'comparable prices must have their own evidence');
    compPrice.dispatchEvent(new Event('click'));
    assert.ok(inspected.source.includes('data/comps.json'));
    assert.equal(inspected.evidence.inputs.compId, 'cmp-gangnam-011');
    assert.ok(!JSON.stringify(inspected).includes('undefined'));
    assert.ok(detail.element.querySelectorAll('a').some((a) => a.getAttribute('href') === '#/building/bld-gangnam-001/bid'));
    const summaryBuilding = buildings.find((b) => !b.deepPath);
    const summaryDetail = await buildingView(context, parseRoute(`#/building/${summaryBuilding.id}`)); views.push(summaryDetail);
    assert.ok(summaryDetail.element.textContent.includes('만기 노출은 상세 임대차 보유 건물에서만'));
    assert.equal(summaryDetail.element.querySelectorAll('svg').length, 0);
    assert.ok(summaryDetail.element.textContent.includes('가상 비교 거래'));
    const bid = await bidView(context, parseRoute('#/building/bld-gangnam-001/bid')); views.push(bid);
    assert.equal(bid.selectId, 'bld-gangnam-001');
    assert.ok(bid.element.textContent.includes('상세 임대차'));
    assert.ok(bid.element.textContent.includes('예시 데이터 · 실제 매물 아님'));
    assert.ok(bid.element.textContent.includes('WALK-AWAY'));
    assert.equal(bid.element.querySelectorAll('svg').length, 3);
    const bidControl = (name) => bid.element.querySelectorAll('[data-bid-control]').find((el) => el.dataset.bidControl === name);
    const bidKpiText = () => bid.element.querySelector('[data-bid-kpis]').textContent;
    for (const [name, value] of [['purchasePriceKrw', '70'], ['annualInterestRate', '6'], ['ltv', '60'], ['vacancyRate', '20'], ['annualRentGrowth', '3'], ['exitCapRate', '5'], ['holdYears', '7']]) {
      const control = bidControl(name), before = lastMetricResult;
      assert.ok(control, name);
      control.value = value; control.dispatchEvent(new Event('input'));
      assert.equal(bidControl(name), control, 'native controls must remain mounted');
      assert.notEqual(lastMetricResult, before, `${name} recalculates core metrics synchronously`);
      const scale = name === 'purchasePriceKrw' ? 1e8 : name === 'holdYears' ? 1 : .01;
      assert.ok(Math.abs(lastMetricResult.assumptions[name] - Number(value) * scale) < .00001, `${name} reaches the model`);
      assert.ok(bid.element.textContent.includes('민감도 다시 계산 중'));
    }
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.ok(!bid.element.textContent.includes('민감도 다시 계산 중'));
    assert.ok(bid.element.textContent.includes('금리 × 매각 Cap'));
    const target = bidControl('targetIrr'), floor = bidControl('floorIrr');
    target.value = '2'; target.dispatchEvent(new Event('change'));
    assert.equal(Number(floor.value), 2, 'lower target clamps the IRR floor');
    floor.value = '9'; floor.dispatchEvent(new Event('change'));
    assert.equal(Number(target.value), 9, 'higher floor raises the target');
    const dscrPolicy = bidControl('minDscr');
    dscrPolicy.value = '1.4'; dscrPolicy.dispatchEvent(new Event('change'));
    assert.ok(bid.element.textContent.includes('1.4배'));
    target.value = ''; target.dispatchEvent(new Event('change'));
    assert.equal(Number(target.value), 9, 'empty numeric input preserves the last valid policy');
    bidControl('ltv').value = '0'; bidControl('ltv').dispatchEvent(new Event('input'));
    assert.ok(bidKpiText().includes('해당 없음'));
    bidControl('vacancyRate').value = '100'; bidControl('vacancyRate').dispatchEvent(new Event('input'));
    assert.ok(bid.element.textContent.includes('제안가 판단 보류'));
    assert.ok(!bid.element.querySelector('[data-bid-ruler]').textContent.includes('BUY 0'));
    bid.element.querySelectorAll('button').find((el) => el.textContent === '가정 초기화').dispatchEvent(new Event('click'));
    assert.equal(Number(bidControl('ltv').value), DEFAULT_FILTERS.ltvPct);
    const buyEvidence = bid.element.querySelectorAll('button').find((el) => el.getAttribute('aria-label')?.startsWith('BUY 한도가'));
    buyEvidence.dispatchEvent(new Event('click'));
    assert.ok(inspected.evidence.formula.includes('min('));
    assert.ok(inspected.evidence.inputs.targetIrr === DEFAULT_FILTERS.targetIrrPct / 100);
    const bidSummary = await bidView(context, parseRoute(`#/building/${summaryBuilding.id}/bid`)); views.push(bidSummary);
    assert.ok(bidSummary.element.textContent.includes('요약 수익 데이터'));
    updateFilters({ targetIrrPct: -10 });
    const negativeBid = await bidView(context, parseRoute(`#/building/${summaryBuilding.id}/bid`)); views.push(negativeBid);
    const negativeControls = negativeBid.element.querySelectorAll('[data-bid-control]');
    assert.equal(Number(negativeControls.find((el) => el.dataset.bidControl === 'targetIrr').value), -10);
    assert.equal(Number(negativeControls.find((el) => el.dataset.bidControl === 'floorIrr').value), -13);
    updateFilters(DEFAULT_FILTERS);
    const missingBid = await bidView(context, parseRoute('#/building/bld-gangnam-999/bid')); views.push(missingBid);
    assert.ok(missingBid.element.textContent.includes('찾을 수 없습니다'));
    bidControl('annualInterestRate').value = '7'; bidControl('annualInterestRate').dispatchEvent(new Event('input'));
    bid.destroy();
    const destroyedText = bid.element.textContent;
    await new Promise((resolve) => setTimeout(resolve, 230));
    assert.equal(bid.element.textContent, destroyedText, 'destroy cancels pending sensitivity work');
    const picker = await proposalView(context, parseRoute('#/proposal')); views.push(picker);
    assert.equal(picker.element.querySelectorAll('[data-card-id]').length, 3);
    const proposal = await proposalView(context, parseRoute('#/building/bld-gangnam-001/proposal?for=seller')); views.push(proposal);
    assert.ok(proposal.element.textContent.includes('SELLER BRIEF'));
    assert.ok(proposal.element.textContent.includes('예시 데이터 · 실제 매물 아님'));
    let opened;
    const map = (await import('../web-v2/js/ui/map.js')).createSeoulMap({ geography, buildings, onOpen: (id) => { opened = id; } });
    views.push({ destroy: map.destroy });
    const svg = map.element.querySelector('svg');
    const event = new Event('click');
    Object.defineProperties(event, { detail: { value: 0 }, target: { value: map.element.querySelector('circle') } });
    svg.dispatchEvent(event);
    assert.equal(opened, buildings[0].id);
    map.destroy(); opened = null; svg.dispatchEvent(event);
    assert.equal(opened, null, 'destroyed map must release activation handlers');
  } finally {
    for (const view of views) view.destroy?.();
    appStore.setState({ filters: DEFAULT_FILTERS, selectedId: null });
    if (savedDocument === undefined) delete globalThis.document; else globalThis.document = savedDocument;
    if (savedNode === undefined) delete globalThis.Node; else globalThis.Node = savedNode;
  }
});
