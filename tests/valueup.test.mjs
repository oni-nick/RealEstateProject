import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { inputFromBuilding } from '../web-v2/js/engine/index.js';
import { valueUpAnalysis, valueUpDefaults, rentRollHeat, comparisonDomain } from '../web-v2/js/valueup.js';

const near = (a, b, tolerance = .001) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const base = { purchasePriceKrw: 5e9, monthlyPotentialRentKrw: 30e6, monthlyPotentialMgmtIncomeKrw: 2e6,
  monthlyOpexKrw: 5e6, vacancyRate: .2, depositsKrw: 200e6, annualRentGrowth: 0, holdYears: 5, exitCapRate: .05 };
const params = { startMonth: 2, downtimeMonths: 3, capexKrw: 60e6, affectedShare: .5, rentUpliftRate: .2, leaseUpFraction: .5 };

test('lease-up fills only the chosen vacant rent share after the leasing period', () => {
  const result = valueUpAnalysis(base, 'lease-up', params);
  assert.equal(result.stabilizationMonth, 5);
  near(result.afterResult.assumptions.intervention.targetVacancyRate, .1);
  near(result.before.noi.value, 247.2e6);
  near(result.after.noi.value, 285.6e6);
  near(result.delta.noi.value, 38.4e6);
  near(result.delta.value.value, 768e6);
  near(result.afterResult.cashflow[3].rentKrw.value, 24e6);
  near(result.afterResult.cashflow[4].rentKrw.value, 27e6);
  near(result.afterResult.cashflow[1].capexKrw.value, 60e6);
  near(result.downtimeNoiLoss.value, 0);
  // No invented new deposits on future leases.
  near(result.afterResult.cashflow.at(-1).depositBalanceKrw.value, 200e6);
});

test('remodel and use change include partial shutdown, continuing opex, deposit refunds and capex', () => {
  for (const type of ['remodel', 'use-change']) {
    const result = valueUpAnalysis(base, type, params);
    near(result.afterResult.cashflow[1].rentKrw.value, 12e6);
    near(result.afterResult.cashflow[1].opexKrw.value, 5e6);
    near(result.afterResult.cashflow[1].depositChangeKrw.value, -100e6);
    near(result.afterResult.cashflow[4].depositChangeKrw.value, 100e6);
    near(result.after.noi.value, 276e6);
    near(result.delta.noi.value, 28.8e6);
    near(result.delta.value.value, 576e6);
    near(result.downtimeNoiLoss.value, 38.4e6);
    near(result.netValueAfterCapex.value, 516e6);
    assert.equal(result.after.irr.status, 'ambiguous');
    assert.equal(result.delta.irr.value, null, 'multiple-sign-change returns must be withheld');
    assert.ok(result.delta.noi.provenance.needsVerification);
  }
});

test('equal-date growth comparison, zero downtime and toggling off preserve the base input', () => {
  const input = { ...base, annualRentGrowth: .1 }, snapshot = JSON.stringify(input);
  const grown = valueUpAnalysis(input, 'remodel', { ...params, startMonth: 13, downtimeMonths: 0 });
  near(grown.before.noi.value, 277.92e6);
  near(grown.delta.noi.value, 31.68e6);
  near(grown.downtimeNoiLoss.value, 0);
  const off = valueUpAnalysis(input, null, params);
  assert.equal(off.delta.noi.value, 0); assert.equal(off.delta.value.value, 0); assert.equal(off.delta.irr.value, 0);
  assert.equal(off.timeline, null);
  assert.equal(JSON.stringify(input), snapshot);
  const full = valueUpAnalysis({ ...base, vacancyRate: 0 }, 'lease-up', { ...params, startMonth: 1 });
  assert.equal(full.delta.noi.value, 0);
  assert.ok(full.delta.irr.value < 0, 'costly no-op still costs money');
  assert.throws(() => valueUpAnalysis(base, 'other', params));
  assert.throws(() => valueUpAnalysis(base, 'lease-up', { ...params, leaseUpFraction: 2 }));
});

test('unavailable IRR stays null and negative NOI remains chartable', () => {
  const result = valueUpAnalysis({ ...base, monthlyPotentialRentKrw: 0, monthlyPotentialMgmtIncomeKrw: 0 }, 'remodel', params);
  assert.equal(result.delta.irr.value, null);
  assert.equal(result.before.irr.value, null);
  assert.equal(result.before.value.value, 0);
  assert.ok(result.after.noi.value < 0);
  const domain = comparisonDomain([-60e6, -30e6]);
  assert.ok(domain.min < -60e6); assert.ok(domain.max > 0);
  const mixed = comparisonDomain([-10, 20]); assert.ok(mixed.min < -10 && mixed.max > 20);
  assert.ok(comparisonDomain([0, 0]).max > comparisonDomain([0, 0]).min);
});

test('floor heat detects vacancy, reference rent gap, expiry boundaries and unknowns independently', () => {
  const unit = { floor: '2F', unit: 'A (가상)', status: 'occupied', areaPyeong: 10, monthlyRentKrw: 800000, leaseEnd: '2027-11-12' };
  const refs = { metrics: { upperFloorRentPerPyeongMonth: { id: 'example.upper', range: { min: 80000, max: 120000 } }, retail1fRentPerPyeongMonth: { id: 'example.first', range: { min: 200000, max: 300000 } } } };
  const floors = rentRollHeat([unit, { ...unit, floor: 'B1', unit: 'B (가상)', leaseEnd: '2027-11-13' },
    { ...unit, floor: '1F', unit: 'C (가상)', status: 'vacant', monthlyRentKrw: 0, leaseEnd: null },
    { ...unit, unit: 'D (가상)', leaseEnd: '2026-10-01' }, { ...unit, unit: 'E (가상)', leaseEnd: '2027-02-30' }], '2026-11-12', refs);
  assert.deepEqual(floors.map((f) => f.floor), ['2F', '1F', 'B1']);
  const units = floors.flatMap((f) => f.units);
  assert.equal(units.find((u) => u.unit === unit.unit).belowMarket, true);
  assert.equal(units.find((u) => u.unit === unit.unit).expiring, true);
  assert.equal(units.find((u) => u.unit === 'B (가상)').referenceRentKrw, null);
  assert.equal(units.find((u) => u.unit === 'B (가상)').expiring, false);
  const vacant = units.find((u) => u.unit === 'C (가상)');
  assert.equal(vacant.vacant, true); assert.equal(vacant.belowMarket, false); assert.equal(vacant.expiring, false);
  assert.equal(units.find((u) => u.unit === 'D (가상)').overdue, true);
  assert.equal(units.find((u) => u.unit === 'E (가상)').expiryUnknown, true);
  assert.equal(rentRollHeat([unit], '2026-11-12', null)[0].units[0].belowMarket, null);
});

test('deep defaults retain synthetic notes and summary/deep scenarios use existing adapter', () => {
  const buildings = JSON.parse(readFileSync(new URL('../web-v2/data/buildings.json', import.meta.url))).buildings;
  const building = buildings.find((b) => b.deepPath);
  const deep = JSON.parse(readFileSync(new URL(`../web-v2/data/${building.deepPath}`, import.meta.url)));
  const defaults = valueUpDefaults(deep);
  assert.equal(defaults.remodel.capexKrw, deep.valueUpNotes.find((n) => n.intervention === 'remodel').budgetKrw);
  for (const detail of [deep, null]) {
    const input = inputFromBuilding(building, detail, { ltv: .6 });
    const result = valueUpAnalysis(input, 'remodel', defaults.remodel);
    assert.equal(result.beforeResult.assumptions.ltv, .6);
    near(result.beforeResult.metrics.noi.value, building.noiAnnualKrw);
  }
});

test('invalid rent or area stays unknown rather than becoming a low-rent opportunity', () => {
  const ref = { metrics: { upperFloorRentPerPyeongMonth: { range: { min: 80000, max: 120000 } } } };
  const unit = { floor: '2F', unit: '예시', status: 'occupied', areaPyeong: 10, monthlyRentKrw: 800000, leaseEnd: null };
  for (const overrides of [{ areaPyeong: Infinity }, { areaPyeong: '10' }, { areaPyeong: 0 },
    { monthlyRentKrw: -1 }, { monthlyRentKrw: '800000' }, { monthlyRentKrw: NaN }]) {
    const actual = rentRollHeat([{ ...unit, ...overrides }], '2026-11-12', ref)[0].units[0];
    assert.equal(actual.rentPerPyeongKrw, null, JSON.stringify(overrides));
    assert.equal(actual.belowMarket, null);
  }
});
