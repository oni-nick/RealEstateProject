import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createDataLoader } from '../web-v2/js/data.js';
import { createStore } from '../web-v2/js/store.js';
import { parseRoute } from '../web-v2/js/router.js';
import { proposalView } from '../web-v2/js/ui/proposal-view.js';

// Checks real view construction/events, not a browser layout or print renderer.
class Element extends EventTarget {
  constructor(tag, text = '') { super(); this.tagName = tag; this.children = []; this.attributes = new Map(); this.dataset = {}; this.className = ''; this._text = text; }
  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = value;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes.get(name); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  get textContent() { return this._text + this.children.map((n) => n.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  querySelectorAll(selector) {
    const all = this.children.flatMap((n) => [n, ...n.querySelectorAll('*')]);
    if (selector === '*') return all;
    if (selector.startsWith('[')) return all.filter((n) => n.attributes.has(selector.slice(1, -1)));
    return all.filter((n) => n.tagName === selector);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

test('buyer/seller proposals build five printable sections, live broker text, evidence and native print action', async () => {
  const saved = { document: globalThis.document, Node: globalThis.Node, window: globalThis.window };
  globalThis.Node = Element;
  let printed = 0;
  globalThis.window = { print: () => printed++ };
  globalThis.document = { createElement: (tag) => new Element(tag), createElementNS: (_, tag) => new Element(tag), createTextNode: (text) => new Element('#text', text) };
  try {
    const loader = createDataLoader(async (url) => ({ ok: true, json: async () => JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) }));
    const data = await loader.loadCore(), store = createStore();
    let inspected;
    const context = { data, loader, store, inspect: (value) => { inspected = value; } };
    const route = (suffix = 'buyer', id = 'bld-gangnam-001') => parseRoute(`#/building/${id}/proposal?for=${suffix}`);
    const buyer = await proposalView(context, route());
    assert.equal(buyer.selectId, 'bld-gangnam-001');
    assert.equal(buyer.element.querySelectorAll('[data-proposal-sheet]').length, 5);
    assert.equal(buyer.element.querySelectorAll('svg').length, 2);
    for (const text of ['BUYER BRIEF', '추천 매수 제안 범위', '핵심 요약', '핵심 수치', '주요 위험', '시나리오', '가상 비교 거래', '근거 부록', '면책 고지', 'UNKNOWN', '검증 필요', '예시 중개사']) assert.ok(buyer.element.textContent.includes(text), text);
    assert.ok(buyer.element.textContent.includes('cmp-gangnam-011'));
    assert.ok(!buyer.element.textContent.includes('후속 단계'));
    const evidence = buyer.element.querySelectorAll('button').find((b) => b.getAttribute('aria-label')?.startsWith('연간 NOI'));
    evidence.dispatchEvent(new Event('click'));
    assert.equal(inspected.deep.buildingId, 'bld-gangnam-001');
    assert.ok(inspected.evidence.formula);
    const broker = buyer.element.querySelectorAll('input').find((n) => n.getAttribute('aria-label') === '중개사명');
    assert.equal(broker.value, '예시 중개사');
    broker.value = '<b>가상 담당자</b>'; broker.dispatchEvent(new Event('input'));
    assert.ok(buyer.element.textContent.includes('<b>가상 담당자</b>'));
    assert.equal(buyer.element.querySelectorAll('b').filter((n) => n.textContent === '가상 담당자').length, 0);
    assert.equal(store.getState().proposalBrokerName, '<b>가상 담당자</b>');
    buyer.element.querySelectorAll('button').find((b) => b.textContent === '인쇄').dispatchEvent(new Event('click'));
    assert.equal(printed, 1);
    assert.ok(buyer.element.querySelectorAll('a').some((n) => n.getAttribute('href') === '#/building/bld-gangnam-001/proposal?for=seller'));
    const seller = await proposalView(context, route('seller'));
    for (const text of ['SELLER BRIEF', '호가 설명', '호가 기준 매수자 IRR', '비교 중앙값', '보정하지', '<b>가상 담당자</b>']) assert.ok(seller.element.textContent.includes(text), text);
    assert.ok(seller.element.querySelectorAll('a').some((n) => n.getAttribute('href') === '#/building/bld-gangnam-001/proposal?for=buyer'));
    const invalidAudience = await proposalView(context, route('unknown'));
    assert.ok(invalidAudience.element.textContent.includes('BUYER BRIEF'));
    broker.value = '   '; broker.dispatchEvent(new Event('input'));
    assert.ok(buyer.element.textContent.includes('예시 중개사'));
    buyer.destroy(); broker.value = 'after dispose'; broker.dispatchEvent(new Event('input'));
    assert.equal(store.getState().proposalBrokerName, '   ');
    buyer.element.querySelectorAll('button').find((b) => b.textContent === '인쇄').dispatchEvent(new Event('click'));
    assert.equal(printed, 1);
    const picker = await proposalView(context, parseRoute('#/proposal'));
    assert.equal(picker.element.querySelectorAll('[data-card-id]').length, 3);
    store.setState({ selectedId: 'bld-gangnam-001' });
    const selected = await proposalView(context, parseRoute('#/proposal'));
    assert.equal(selected.selectId, 'bld-gangnam-001');
    const missing = await proposalView(context, route('buyer', 'bld-gangnam-999'));
    assert.ok(missing.element.textContent.includes('찾을 수 없습니다'));
    const summaryBuilding = data.buildings.find((b) => !b.deepPath);
    const summary = await proposalView(context, route('seller', summaryBuilding.id));
    assert.ok(summary.element.textContent.includes('상세 임대차 없음'));
    const noComps = await proposalView({ ...context, loader: { loadDeep: async () => null, load: async () => ({ comps: [] }) } }, route('seller', summaryBuilding.id));
    assert.ok(noComps.element.textContent.includes('비교 거래 없음'));
    assert.ok(noComps.element.textContent.includes('호가를 뒷받침할 비교 근거가 없습니다'));
    const ask = summaryBuilding.askingPriceKrw;
    const invalidFundingBuilding = { ...summaryBuilding, depositKrw: ask * .7, annualRentKrw: ask * .3,
      potentialAnnualRentKrw: ask * .3, annualMgmtKrw: 0, annualOpexKrw: ask * .01 };
    const invalidFunding = await proposalView({ ...context, data: { ...data, buildings: [invalidFundingBuilding] } }, route('buyer', summaryBuilding.id));
    assert.ok(invalidFunding.element.textContent.includes('제안가 판단 보류'));
    await assert.rejects(proposalView({ ...context, loader: { loadDeep: async () => { throw new Error('fixture failure'); }, load: loader.load } }, route()), /fixture failure/);
  } finally {
    for (const [key, value] of Object.entries(saved)) if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
  }
});

test('proposal styles explicitly define A4 breaks and hide controls without truncating appendix', () => {
  const css = readFileSync(new URL('../web-v2/css/print.css', import.meta.url), 'utf8');
  assert.match(css, /size:\s*A4 portrait/);
  assert.match(css, /\.proposal-sheet\s*\+\s*\.proposal-sheet\s*\{[^}]*break-before:\s*page/);
  assert.match(css, /\.proposal-toolbar/);
  assert.match(css, /thead\s*\{\s*display:\s*table-header-group/);
  assert.ok(!/\.proposal-(?:sheet|appendix)[^{]*\{[^}]*(?:overflow:\s*hidden|height:\s*\d+mm;)/.test(css));
});
