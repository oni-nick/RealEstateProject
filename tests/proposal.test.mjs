import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { proposalAnalysis, compComparison, recommendedBidRange } from '../web-v2/js/proposal.js';
import { calculate, inputFromBuilding } from '../web-v2/js/engine/index.js';

const json = (name) => JSON.parse(readFileSync(new URL(`../web-v2/data/${name}`, import.meta.url), 'utf8'));
const buildings = json('buildings.json').buildings;
const comps = json('comps.json').comps;
const building = buildings.find((b) => b.deepPath);
const deep = json(building.deepPath);
const exact = (value, status = 'ok') => ({ maxPrice: { value, status } });

test('proposal range uses conservative/base exact ceilings capped at ask, with no fabricated bounds', () => {
  assert.deepEqual(recommendedBidRange(exact(80), exact(60), 70).value, [60, 70]);
  assert.deepEqual(recommendedBidRange(exact(80), exact(90), 100).value, [80, 80]);
  for (const status of ['infeasible', 'unavailable', 'unsupported_cashflows', 'above_search_bound']) {
    assert.equal(recommendedBidRange(exact(80, status), exact(60), 70).value, null);
    assert.equal(recommendedBidRange(exact(80), exact(60, status), 70).value, null);
  }
  assert.equal(recommendedBidRange(exact(null), exact(60), 70).value, null);
  assert.equal(recommendedBidRange(exact(NaN), exact(60), 70).value, null);
});

test('comp explanation uses land pyeong, median and unadjusted premiums with explicit missing data', () => {
  const b = { askingPriceKrw: 400, landAreaM2: 400 / 121 };
  const result = compComparison(b, [{ landPricePerPyeong: 100 }, { landPricePerPyeong: 200 }, { landPricePerPyeong: 300 }]);
  assert.equal(result.askPerPyeong.value, 400);
  assert.equal(result.medianPerPyeong.value, 200);
  assert.equal(result.premium.value, 1);
  assert.deepEqual(result.impliedPriceRange.value, [100, 300]);
  const missing = compComparison(b, []);
  assert.equal(missing.medianPerPyeong.value, null);
  assert.equal(missing.premium.value, null);
  assert.equal(missing.impliedPriceRange.value, null);
});

test('deep proposal exactly matches engine at ask, respects policy and preserves inputs', () => {
  const before = JSON.stringify({ building, deep, comps });
  const result = proposalAnalysis(building, deep, comps, { ltv: .4, targetIrr: .09 });
  const independent = calculate(inputFromBuilding(building, deep, { ltv: .4 }));
  for (const key of ['noi', 'leveredIrr', 'equityRequired', 'dscr', 'capRate']) assert.equal(result.base.metrics[key].value, independent.metrics[key].value, key);
  assert.equal(result.base.assumptions.depositsKrw, deep.rentRoll.reduce((s, u) => s + u.depositKrw, 0));
  assert.equal(result.policy.targetIrr, .09);
  assert.equal(result.policy.minDscr, 1.2);
  assert.ok(result.comps.length >= 5);
  assert.equal(JSON.stringify({ building, deep, comps }), before);
});

test('recommended endpoints meet target IRR and full-period DSCR for their stated assumptions', () => {
  const p = proposalAnalysis(building, deep, comps);
  assert.ok(p.bidRange.value, 'representative fixture must yield exact ceilings');
  const [lower, upper] = p.bidRange.value;
  assert.ok(lower <= upper && upper <= building.askingPriceKrw);
  for (const [input, price] of [[p.conservative.assumptions, lower], [p.base.assumptions, upper]]) {
    const result = calculate({ ...input, purchasePriceKrw: price });
    assert.ok(result.metrics.leveredIrr.value >= p.policy.targetIrr - 1e-7);
    assert.ok(result.metrics.minDscr.value >= p.policy.minDscr - 1e-7);
  }
});

test('scenario proposal includes real capex/downtime and unavailable IRR stays null', () => {
  const p = proposalAnalysis(building, deep, comps);
  assert.deepEqual(p.scenarios.map((s) => s.id), ['base', 'conservative', 'lease-up', 'remodel', 'use-change']);
  for (const s of p.scenarios.slice(2)) {
    const settings = s.result.assumptions.intervention;
    const note = deep.valueUpNotes.find((n) => n.intervention === s.id);
    assert.equal(settings.capexKrw, note.budgetKrw);
    assert.equal(settings.downtimeMonths, note.downtimeMonths);
    assert.equal(s.capexKrw, note.budgetKrw);
    assert.ok(s.result.cashflow.some((m) => m.capexKrw.value >= note.budgetKrw));
    if (s.result.metrics.leveredIrr.status !== 'ok') assert.equal(s.result.metrics.leveredIrr.value, null);
  }
  assert.equal(p.conservative.assumptions.annualRentGrowth, 0);
  assert.equal(p.conservative.assumptions.annualInterestRate, p.base.assumptions.annualInterestRate + .01);
  assert.equal(p.conservative.assumptions.exitCapRate, p.base.assumptions.exitCapRate + .005);
});

test('summary-only, missing comps and zero debt remain honest proposal states', () => {
  const b = buildings.find((row) => !row.deepPath);
  const p = proposalAnalysis(b, null, [], { ltv: 0 });
  assert.equal(p.base.metrics.noi.value, b.noiAnnualKrw);
  assert.equal(p.base.metrics.dscr.status, 'not_applicable');
  assert.equal(p.comps.length, 0);
  assert.equal(p.comparison.premium.value, null);
  assert.equal(p.detailSource, 'summary');
  assert.ok(p.risks.some((r) => r.includes('상세 임대차')));
});

test('proposal range and comp metrics retain formulas, inputs and low-confidence provenance', () => {
  const p = proposalAnalysis(building, deep, comps);
  for (const row of [p.bidRange, p.comparison.askPerPyeong, p.comparison.premium]) {
    assert.ok(row.formula);
    assert.ok(row.inputs);
    assert.equal(row.provenance.confidence, 'low');
    assert.equal(row.provenance.needsVerification, true);
  }
  assert.equal(p.years.at(-1).year, p.base.assumptions.holdYears);
  assert.ok(Math.abs(p.years.reduce((s, y) => s + y.totalKrw, 0) - p.base.leveredCashflows.value.reduce((s, v) => s + v, 0)) < .01);
});

test('non-positive equity at ask suppresses a range even if a higher-price solver domain exists', () => {
  const ask = building.askingPriceKrw;
  const b = { ...building, depositKrw: ask * .7, annualRentKrw: ask * .3,
    potentialAnnualRentKrw: ask * .3, annualMgmtKrw: 0, annualOpexKrw: ask * .01 };
  const p = proposalAnalysis(b, null, comps, { ltv: .5 });
  assert.equal(p.base.status, 'invalid_equity');
  assert.equal(p.base.metrics.leveredIrr.value, null);
  assert.equal(p.bidRange.value, null, 'capping a valid high price at an invalid ask must not create a recommendation');
});
