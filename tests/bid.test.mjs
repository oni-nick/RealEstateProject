import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate, inputFromBuilding, maxPurchasePrice } from '../web-v2/js/engine/index.js';
import { createBidInput, bidAnalysis, bidSensitivity, annualCashflows, bidGuidance, priceRulerDomain } from '../web-v2/js/bid.js';

const json = (name) => JSON.parse(readFileSync(new URL(`../web-v2/data/${name}`, import.meta.url), 'utf8'));
const buildings = json('buildings.json').buildings;
const deepFor = (b) => b.deepPath ? json(b.deepPath.replace(/^data\//, '')) : null;
const base = { purchasePriceKrw: 100e8, monthlyPotentialRentKrw: 5e7, monthlyOpexKrw: 5e6,
  depositsKrw: 2e8, ltv: .5, annualInterestRate: .05, vacancyRate: .05, holdYears: 5, exitCapRate: .045 };
const close = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} vs ${b}`);

test('bid inputs reconcile all 400 mock buildings, including 25 deep rent rolls', () => {
  let deepCount = 0;
  for (const b of buildings) {
    const deep = deepFor(b); if (deep) deepCount++;
    const input = createBidInput(b, deep, { ltv: .6 });
    const expected = inputFromBuilding(b, deep, { ltv: .6 });
    close(input.monthlyPotentialRentKrw, expected.monthlyPotentialRentKrw);
    close(input.depositsKrw, expected.depositsKrw);
    close(calculate(input).metrics.noi.value, b.noiAnnualKrw, 1);
    assert.equal(input.provenance.source.buildingId, b.id);
  }
  assert.equal(deepCount, 25);
  const b = buildings.find((b) => b.deepPath), deep = deepFor(b);
  const changed = structuredClone(deep); changed.rentRoll[0].potentialMonthlyRentKrw += 1e6;
  assert.notEqual(createBidInput(b, changed).monthlyPotentialRentKrw, createBidInput(b).monthlyPotentialRentKrw);
  const overridden = createBidInput(b, deep, { vacancyRate: .25 });
  assert.equal(overridden.provenance.vacancyRate.kind, 'assumption');
  assert.equal(overridden.provenance.vacancyRate.assumptionId, 'bid.input.vacancyRate');
});

test('BUY and WALK-AWAY use explicit target/floor IRR and identical minimum DSCR', () => {
  const policy = { targetIrr: .10, floorIrr: .05, minDscr: 1.2 };
  const actual = bidAnalysis(base, policy);
  const buy = maxPurchasePrice(base, { targetIrr: .10, minDscr: 1.2 });
  const walk = maxPurchasePrice(base, { targetIrr: .05, minDscr: 1.2 });
  close(actual.buy.maxPrice.value, buy.maxPrice.value, 1);
  close(actual.walk.maxPrice.value, walk.maxPrice.value, 1);
  assert.ok(actual.buy.maxPrice.value < actual.walk.maxPrice.value);
  assert.deepEqual(actual.result.metrics.leveredIrr, calculate(base).metrics.leveredIrr);
  const bound = bidAnalysis(base, { ...policy, minDscr: 4 });
  assert.equal(bound.buy.bindingConstraint, 'min_dscr');
  close(bound.buy.maxPrice.value, bound.walk.maxPrice.value, 1);
  assert.throws(() => bidAnalysis(base, { ...policy, floorIrr: .11 }), /floor/i);
});

test('guidance checks realized metrics and never recommends unavailable or invalid equity', () => {
  const a = bidAnalysis(base, { targetIrr: .1, floorIrr: .05, minDscr: 1.2 });
  const atBuy = bidAnalysis({ ...base, purchasePriceKrw: a.buy.maxPrice.value * .99 }, a.policy);
  assert.equal(bidGuidance(atBuy, base.purchasePriceKrw).tone, 'buy');
  const between = bidAnalysis({ ...base, purchasePriceKrw: (a.buy.maxPrice.value + a.walk.maxPrice.value) / 2 }, a.policy);
  assert.equal(bidGuidance(between, base.purchasePriceKrw).tone, 'negotiate');
  const high = bidAnalysis({ ...base, purchasePriceKrw: a.walk.maxPrice.value * 1.05 }, a.policy);
  assert.equal(bidGuidance(high, base.purchasePriceKrw).tone, 'walk');
  const cash = bidAnalysis({ ...base, ltv: 0 });
  assert.equal(cash.result.metrics.minDscr.status, 'not_applicable');
  assert.equal(cash.buy.atMinDscr.status, 'not_applicable');
  const invalid = bidAnalysis({ ...base, depositsKrw: 90e8 });
  assert.equal(invalid.result.status, 'invalid_equity');
  assert.equal(bidGuidance(invalid, base.purchasePriceKrw).tone, 'unavailable');
  const loss = bidAnalysis({ ...base, vacancyRate: 1 });
  assert.equal(loss.buy.maxPrice.value, null);
  assert.notEqual(bidGuidance(loss, base.purchasePriceKrw).tone, 'buy');
});

test('annual chart conserves initial funding, monthly operations, exit and total cashflows', () => {
  const result = calculate({ ...base, holdYears: 2.5 });
  const years = annualCashflows(result);
  assert.equal(years.length, 4);
  close(years[0].totalKrw, result.leveredCashflows.value[0]);
  close(years.at(-1).exitKrw, result.exit.netProceeds.value);
  assert.equal(years.at(-1).months, 6);
  close(years.reduce((sum, y) => sum + y.totalKrw, 0), result.leveredCashflows.value.reduce((a, b) => a + b, 0), .001);
  for (const year of years) close(year.totalKrw, year.initialKrw + year.operatingKrw + year.exitKrw, .001);
});

test('sensitivity grid rates are columns and exit caps rows; center matches current input', () => {
  const sensitivity = bidSensitivity(base, { targetIrr: .08, floorIrr: .05, minDscr: 1.2 });
  assert.equal(sensitivity.grid.xField, 'annualInterestRate');
  assert.equal(sensitivity.grid.yField, 'exitCapRate');
  assert.equal(sensitivity.grid.xValues[1], base.annualInterestRate);
  assert.equal(sensitivity.grid.yValues[1], base.exitCapRate);
  close(sensitivity.grid.cells[1][1].irr.value, calculate(base).metrics.leveredIrr.value);
  assert.equal(sensitivity.tornado.rows.length, 5);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) {
    const cell = sensitivity.grid.cells[y][x];
    close(cell.irr.inputs.assumptions.annualInterestRate, sensitivity.grid.xValues[x]);
    close(cell.irr.inputs.assumptions.exitCapRate, sensitivity.grid.yValues[y]);
  }
});

test('price ruler domain contains separated/overlapping extremes and ignores unavailable lines', () => {
  const domain = priceRulerDomain([100e8, 5e8, 240e8, null]);
  assert.ok(domain.min <= 5e8 && domain.max >= 240e8);
  assert.ok(priceRulerDomain([50e8, 50e8]).max > priceRulerDomain([50e8, 50e8]).min);
  assert.deepEqual(priceRulerDomain([null]), { min: 0, max: 1e8 });
});

test('negative Radar targets remain valid bid policies and keep the floor below the target', () => {
  const analysis = bidAnalysis(base, { targetIrr: -.1 });
  close(analysis.policy.floorIrr, -.13);
  assert.ok(analysis.buy.maxPrice.value <= analysis.walk.maxPrice.value + 1);
  assert.equal(bidAnalysis(base, { targetIrr: 0 }).policy.floorIrr, 0);
  assert.equal(bidAnalysis(base, { targetIrr: -.99 }).policy.floorIrr, -.99);
  assert.throws(() => bidAnalysis(base, { targetIrr: -1 }), /Target/);
});
