import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createEvidenceTrace, evidenceConfidence, summaryEvidence, traceValue, DATA_SOURCES_NOTE } from '../web-v2/js/evidence-trace.js';
import { calculate, inputFromBuilding } from '../web-v2/js/engine/index.js';
import { createBidInput, bidAnalysis } from '../web-v2/js/bid.js';
import { valueUpAnalysis, valueUpDefaults } from '../web-v2/js/valueup.js';
import { createDataLoader } from '../web-v2/js/data.js';
import { createStore, store as appStore, DEFAULT_FILTERS } from '../web-v2/js/store.js';
import { openEvidence, closeEvidence, bindEvidenceMode, createEvidenceControls } from '../web-v2/js/ui/evidence-panel.js';
import { evidenceNumber } from '../web-v2/js/ui/components.js';

const json = (name) => JSON.parse(readFileSync(new URL(`../web-v2/data/${name}`, import.meta.url), 'utf8'));
const data = { buildings: json('buildings.json').buildings, references: json('market_refs.json'), generation: json('generation.json') };
const building = data.buildings[0], deep = json(building.deepPath);
const rootDetails = (evidence) => ({ label: '예시 지표', evidence, building, deep, source: `data/${building.deepPath}` });
const byKey = (trace, node, key) => trace.inputs(node).find((child) => child.key === key);

test('engine inputs retain exact values, units and overridden assumption identity through navigation', () => {
  const input = createBidInput(building, deep, { annualInterestRate: .061, purchasePriceKrw: 7e9 });
  const result = calculate(input), trace = createEvidenceTrace(rootDetails(result.metrics.equityRequired), data);
  const assumptions = byKey(trace, trace.root, 'assumptions');
  const rate = byKey(trace, assumptions, 'annualInterestRate');
  assert.equal(trace.describe(rate).text, '6.1%');
  assert.equal(rate.evidence.value, .061);
  assert.equal(rate.evidence.provenance.assumptionId, 'bid.input.annualInterestRate');
  assert.ok(!trace.sources(rate).some((node) => node.source.includes('seoul.loan_interest_rate')), 'an edited rate is not an observed market reference');
  const tax = byKey(trace, assumptions, 'acquisitionTaxRate');
  const ref = trace.sources(tax).find((node) => node.source.endsWith('seoul.acquisition_tax_rate'));
  assert.equal(ref.evidence.value, .046);
  assert.equal(trace.describe(ref).needsVerification, true);
  assert.equal(byKey(trace, ref, 'sourceRole').evidence.value, 'verification_candidates_only');
  assert.equal(byKey(trace, ref, 'tag').evidence.value, 'reference/approximate - verify');
  assert.equal(trace.describe(trace.root).rawValue, result.metrics.equityRequired.value);
});

test('rent-roll source drills through exact suite rent, area and district reference row', () => {
  const result = calculate(inputFromBuilding(building, deep));
  const trace = createEvidenceTrace(rootDetails(result.metrics.noi), data);
  const rentRoll = trace.sources(trace.root).find((node) => node.label === '호실별 임대차 원본');
  assert.equal(rentRoll.evidence.value.length, deep.rentRoll.length);
  const suite = trace.inputs(rentRoll)[0];
  assert.ok(suite.label.includes(deep.rentRoll[0].unit));
  const rent = byKey(trace, suite, 'potentialMonthlyRentKrw');
  assert.equal(rent.evidence.value, deep.rentRoll[0].potentialMonthlyRentKrw);
  assert.equal(trace.describe(rent).formula, data.generation.formulas['f.rent'].description);
  const floorRate = byKey(trace, rent, 'rentPerPyeongMonth');
  assert.equal(floorRate.evidence.value, deep.rentRoll[0].rentPerPyeongMonth);
  const ref = trace.sources(floorRate)[0];
  assert.equal(ref.source, 'data/market_refs.json · gangnam.retail1fRentPerPyeongMonth');
  assert.deepEqual(ref.evidence.value, data.references.districts[0].metrics.retail1fRentPerPyeongMonth.range);
  assert.ok(trace.inputs(ref).every((node) => node.label && node.evidence));
  const originalOpex = trace.sources(trace.root).find((node) => node.label === '소유자 운영비 원본');
  assert.deepEqual(originalOpex.evidence.value, deep.opex);
});

test('summary prices resolve generator rules and real reference ids; no deep rent roll is invented', () => {
  const b = data.buildings.find((item) => !item.deepPath);
  const trace = createEvidenceTrace({ label: '호가', building: b, evidence: summaryEvidence(b, 'askingPriceKrw') }, data);
  assert.equal(trace.inputs(trace.root).length, 2);
  assert.equal(trace.describe(trace.root).formula, data.generation.formulas['f.ask'].description);
  const sources = trace.sources(trace.root);
  assert.ok(sources.some((node) => node.source.endsWith(`${b.districtId}.landPricePerPyeong`)));
  assert.ok(sources.some((node) => node.source.endsWith(`${b.districtId}.gfaPricePerPyeong`)));
  assert.ok(!sources.some((node) => node.label === '호실별 임대차 원본'));
  const assumptions = createEvidenceTrace({ label: 'UNKNOWN', evidence: { value: null, inputs: { unknown: 'unknown.vat_treatment' } } }, data);
  const unknown = traceValue(assumptions.inputs(assumptions.root)[0].evidence.value);
  assert.equal(unknown, 'UNKNOWN');
  assert.match(traceValue(null), /UNKNOWN/);
  assert.equal(traceValue(0), '0');
});

test('BUY price, scenario delta and unavailable IRR preserve engine formula and nested inputs', () => {
  const input = createBidInput(building, deep);
  const bid = bidAnalysis(input);
  const priceTrace = createEvidenceTrace(rootDetails(bid.buy.maxPrice), data);
  assert.equal(priceTrace.describe(priceTrace.root).formula, bid.buy.maxPrice.formula);
  assert.equal(byKey(priceTrace, priceTrace.root, 'targetIrr').evidence.value, .08);
  const scenario = valueUpAnalysis(input, 'remodel', valueUpDefaults(deep).remodel);
  const trace = createEvidenceTrace(rootDetails(scenario.delta.noi), data);
  assert.equal(trace.describe(trace.root).rawValue, scenario.delta.noi.value);
  assert.ok(trace.inputs(trace.root).length > 0);
  const unavailable = createEvidenceTrace(rootDetails({ value: null, formula: 'IRR unavailable', inputs: { cashflows: [-10, 0, 0] }, provenance: { confidence: 'low' } }), data);
  assert.match(unavailable.describe(unavailable.root).text, /UNKNOWN/);
  assert.equal(trace.inputs(byKey(unavailable, unavailable.root, 'cashflows')).length, 3);
});

test('confidence inherits weakest input; missing provenance stays low; source notes disclose unverified candidates', () => {
  assert.equal(evidenceConfidence({ provenance: { confidence: 'high' }, inputs: { source: { confidence: 'low' } } }), 'low');
  assert.equal(evidenceConfidence({ provenance: { confidence: 'high' }, inputs: { a: { confidence: 'medium' } } }), 'medium');
  assert.equal(evidenceConfidence({ provenance: { confidence: 'high' } }), 'high');
  assert.equal(evidenceConfidence({ inputs: { a: { confidence: 'high' } } }), 'low');
  assert.equal(evidenceConfidence(undefined), 'low');
  assert.match(DATA_SOURCES_NOTE, /통계적 신뢰도가 아닙니다/);
  assert.match(DATA_SOURCES_NOTE, /조회한 출처가 아닙니다/);
  const note = readFileSync(new URL('../web-v2/data/data-sources.md', import.meta.url), 'utf8');
  assert.match(note, /UNKNOWN/); assert.match(note, /market_refs.json/);
  assert.ok(!/https?:\/\//.test(note));
});

// Lightweight DOM/event contract only: native browser layout/Escape are not tested.
class Element extends EventTarget {
  constructor(tag, text = '') {
    super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this.dataset = {}; this.className = ''; this._text = text;
    this.classList = { toggle: (name, on) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); if (on ?? !set.has(name)) set.add(name); else set.delete(name); this.className = [...set].join(' '); } };
    this.classList.add = (name) => this.classList.toggle(name, true);
    this.classList.remove = (name) => this.classList.toggle(name, false);
  }
  setAttribute(key, value) { this.attributes.set(key, String(value)); if (key.startsWith('data-')) this.dataset[key.slice(5)] = String(value); }
  getAttribute(key) { return this.attributes.get(key); }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { for (const child of this.children) child.parent = null; this.children = []; this.append(...nodes); }
  get textContent() { return this._text + this.children.map((node) => node.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.replaceChildren(); }
  get isConnected() { return this === document.body || Boolean(this.parent?.isConnected); }
  focus() { document.activeElement = this; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((node) => node !== this); this.parent = null; }
  querySelectorAll(selector) {
    const nodes = this.children.flatMap((child) => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return nodes;
    if (selector.startsWith('.')) return nodes.filter((node) => node.className.split(' ').includes(selector.slice(1)));
    if (selector.startsWith('[')) return nodes.filter((node) => node.attributes.has(selector.slice(1, -1)));
    return nodes.filter((node) => node.tagName === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  showModal() { this.open = true; this.querySelector('button')?.focus(); }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
}
function installDOM() {
  const previous = { document: globalThis.document, Node: globalThis.Node };
  globalThis.Node = Element;
  globalThis.document = { body: new Element('body'), createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag), createTextNode: (text) => new Element('#text', text), getElementById(id) { return this.body.querySelectorAll('*').find((node) => node.getAttribute('id') === id); } };
  return () => { closeEvidence(); globalThis.document = previous.document; globalThis.Node = previous.Node; };
}
const click = (node) => { assert.ok(node); node.dispatchEvent(new Event('click')); };

test('one evidence modal navigates inputs/source rows, Back, close/focus return and current edited values', async () => {
  const restore = installDOM();
  try {
    const input = createBidInput(building, deep, { annualInterestRate: .061 });
    const result = calculate(input), controls = createEvidenceControls(data);
    const opener = controls.metricNumber(result, 'noi', '연 NOI', String);
    document.body.append(opener); opener.focus(); click(opener);
    let dialog = document.body.querySelector('dialog');
    assert.ok(dialog.open);
    assert.equal(opener.getAttribute('data-confidence'), 'low');
    assert.equal(opener.getAttribute('aria-haspopup'), 'dialog');
    assert.ok(dialog.textContent.includes('검증 필요'));
    assert.ok(dialog.textContent.includes('data-sources.md 안내'));
    const traceLink = (prefix) => dialog.querySelectorAll('[data-trace-link]').find((node) => node.textContent.startsWith(prefix));
    click(traceLink('계산 입력 가정'));
    click(traceLink('연 대출금리'));
    assert.equal(dialog.querySelector('[data-trace-value]').textContent, '6.1%');
    assert.ok(dialog.textContent.includes('bid.input.annualInterestRate'));
    click(dialog.querySelectorAll('button').find((node) => node.textContent === '← 이전 근거'));
    click(traceLink('취득세 예산율'));
    click(traceLink('참고 행 · seoul.acquisition_tax_rate'));
    assert.ok(dialog.textContent.includes('reference/approximate - verify'));
    assert.ok(dialog.textContent.includes('verification_candidates_only'));
    assert.equal(document.body.querySelectorAll('dialog').length, 1);
    const noteLink = dialog.querySelectorAll('a').find((node) => node.getAttribute('href') === './data/data-sources.md');
    assert.ok(noteLink);
    click(dialog.querySelectorAll('button').find((node) => node.textContent === '닫기 ×'));
    assert.equal(document.body.querySelectorAll('dialog').length, 0);
    assert.equal(document.activeElement, opener);
    // Re-open after recalculation: no stale original-rate snapshot.
    const edited = calculate(createBidInput(building, deep, { annualInterestRate: .072 }));
    const next = controls.metricNumber(edited, 'noi', '연 NOI', String);
    document.body.append(next); next.focus(); click(next); dialog = document.body.querySelector('dialog');
    click(traceLink('계산 입력 가정')); click(traceLink('연 대출금리'));
    assert.equal(dialog.querySelector('[data-trace-value]').textContent, '7.2%');
    // Replacement and late async source completion cannot create orphan dialogs.
    let finish;
    const pending = openEvidence({ label: '호가', building, evidence: summaryEvidence(building, 'askingPriceKrw') }, data, { loadDeep: () => new Promise((resolve) => { finish = resolve; }) });
    await Promise.resolve(); pending.close(); finish(deep); await Promise.resolve();
    assert.equal(document.body.querySelectorAll('dialog').length, 0);
  } finally { restore(); }
});

test('global 근거 모드 synchronizes existing state and survives route-independent store updates', () => {
  const restore = installDOM();
  try {
    const toggle = new Element('button'), status = new Element('span');
    toggle.setAttribute('id', 'evidence-toggle'); status.setAttribute('id', 'evidence-status');
    toggle.append(status); document.body.append(toggle);
    const store = createStore({ evidenceMode: true }), filters = store.getState().filters;
    const dispose = bindEvidenceMode(store);
    assert.equal(status.textContent, 'ON'); assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    store.setState({ selectedId: building.id });
    assert.ok(document.body.className.includes('evidence-mode'));
    click(toggle); assert.equal(status.textContent, 'OFF'); assert.equal(store.getState().evidenceMode, false);
    assert.equal(store.getState().filters, filters);
    const high = evidenceNumber({ label: '검증된 테스트 값', text: '1', evidence: { provenance: { confidence: 'high' } } });
    assert.equal(high.getAttribute('data-confidence'), 'high');
    const css = readFileSync(new URL('../web-v2/css/components.css', import.meta.url), 'utf8');
    assert.ok(css.includes('.evidence-mode .evidence-number[data-confidence="low"]'));
    dispose(); click(toggle); assert.equal(store.getState().evidenceMode, false);
  } finally { restore(); }
});

test('lazy original sources load without inventing data and failures remain explicit', async () => {
  const restore = installDOM();
  try {
    const loader = createDataLoader(async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) }));
    const panel = openEvidence({ label: '호가', building, evidence: summaryEvidence(building, 'askingPriceKrw') }, data, loader);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(panel.element.textContent.includes('호실별 임대차 원본'));
    closeEvidence();
    const failed = openEvidence({ label: '호가', building, evidence: summaryEvidence(building, 'askingPriceKrw') }, data, { loadDeep: async () => { throw new Error('mock unavailable'); } });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(failed.element.textContent.includes('상세 임대차 원본을 불러오지 못했습니다'));
    assert.ok(!failed.element.textContent.includes('호실별 임대차 원본'));
  } finally { restore(); }
});

test('Radar, overview, bid and value-up use the real shared evidence controls and current source values', async () => {
  const restore = installDOM(), views = [], previousState = appStore.getState();
  try {
    const { radarView, buildingView } = await import('../web-v2/js/views.js');
    const { bidView } = await import('../web-v2/js/ui/bid-view.js');
    const { valueUpView } = await import('../web-v2/js/ui/valueup-view.js');
    const loader = createDataLoader(async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) }));
    const core = await loader.loadCore();
    appStore.setState({ filters: DEFAULT_FILTERS, evidenceMode: true });
    const context = { data: core, loader, store: appStore, ...createEvidenceControls(core, loader) };
    const factories = [
      [() => radarView(context), '매도 호가', 'data/buildings.json'],
      [() => buildingView(context, { id: building.id }), '월 임대료', `data/${building.deepPath}`],
      [() => bidView(context, { id: building.id }), 'BUY 한도가', '고정 LTV 가격 역산'],
      [() => valueUpView(context, { id: building.id }), '연 NOI 변화', `data/${building.deepPath}`],
    ];
    for (const [factory, label, source] of factories) {
      const view = await factory(); views.push(view); document.body.append(view.element);
      const controls = view.element.querySelectorAll('button').filter((node) => node.getAttribute('aria-haspopup') === 'dialog');
      assert.ok(controls.length > 5, label);
      assert.ok(controls.every((node) => node.getAttribute('data-confidence') === 'low'), label);
      const number = controls.find((node) => node.getAttribute('aria-label')?.startsWith(label));
      assert.ok(number, label); number.focus(); click(number);
      const panel = document.body.querySelector('dialog');
      assert.ok(panel.textContent.includes('검증 필요'), label);
      assert.ok(panel.textContent.includes(source), label);
      assert.ok(panel.querySelectorAll('[data-trace-link]').length > 0, label);
      assert.ok(panel.textContent.includes('data-sources.md 안내'));
      closeEvidence();
      assert.equal(document.activeElement, number);
      view.element.remove(); view.destroy?.();
    }
    assert.equal(appStore.getState().evidenceMode, true);
  } finally { for (const view of views) view.destroy?.(); appStore.setState(previousState); restore(); }
});
