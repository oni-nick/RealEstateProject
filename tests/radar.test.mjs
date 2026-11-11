import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as radar from '../web-v2/js/radar.js';
import { calculate, inputFromBuilding } from '../web-v2/js/engine/index.js';
import { DEFAULT_FILTERS } from '../web-v2/js/store.js';

const buildings = JSON.parse(readFileSync(new URL('../web-v2/data/buildings.json', import.meta.url))).buildings;

test('investor matching uses engine funding and levered IRR at selected LTV', () => {
  assert.equal(typeof radar.createRadarMatcher, 'function');
  const matcher = radar.createRadarMatcher();
  const b = buildings.find((b) => b.statusKo === '매물');
  const row = matcher.evaluate([b], { ...DEFAULT_FILTERS, ltvPct: 65 })[0];
  const expected = calculate(inputFromBuilding(b, null, { ltv: .65 }));
  assert.equal(row.irr, expected.metrics.leveredIrr.value);
  assert.equal(row.equityKrw, expected.metrics.equityRequired.value);
  assert.equal(row.engineVersion, expected.engineVersion);
  assert.equal(row.checks.length, 6);
  assert.ok(row.score >= 0 && row.score <= 100);
});

test('fit scores improve with budget and IRR headroom without turning a failed criterion into a match', () => {
  const matcher = radar.createRadarMatcher();
  const b = buildings.find((b) => b.statusKo === '매물' && calculate(inputFromBuilding(b)).metrics.leveredIrr.value > .08);
  const initial = matcher.evaluate([b], DEFAULT_FILTERS)[0];
  const relaxed = matcher.evaluate([b], { ...DEFAULT_FILTERS, equityEok: 80, targetIrrPct: 0 })[0];
  assert.ok(relaxed.score > initial.score);
  assert.equal(matcher.evaluate([b], { ...DEFAULT_FILTERS, districts: ['missing'] })[0].matches, false);
});

test('all six hard gates apply, including min price, use, equity and unavailable IRR', () => {
  assert.equal(typeof radar.createRadarMatcher, 'function');
  const matcher = radar.createRadarMatcher();
  const base = { ...DEFAULT_FILTERS, equityEok: 150, targetIrrPct: -90 };
  const b = buildings.find((b) => b.statusKo === '매물' && calculate(inputFromBuilding(b)).metrics.leveredIrr.value !== null);
  assert.equal(matcher.evaluate([b], base)[0].matches, true);
  for (const patch of [{ equityEok: 1 }, { targetIrrPct: 99 }, { districts: ['does-not-exist'] }, { minPriceEok: 151 }, { maxPriceEok: 1 }, { maxWalk: 0 }, { useKo: '주거시설' }]) {
    assert.equal(matcher.evaluate([b], { ...base, ...patch })[0].matches, false, JSON.stringify(patch));
  }
  const missing = matcher.evaluate(buildings, base).find((r) => r.irr === null);
  assert.ok(missing); assert.equal(missing.matches, false);
  assert.ok(missing.checks.some((c) => c.key === 'irr' && !c.passed));
  const closed = buildings.find((b) => b.statusKo === '거래완료 참고');
  assert.equal(matcher.evaluate([closed], base)[0].matches, false);
});

test('financial cache reuses evidence across physical and target changes, invalidates for LTV and is bounded', () => {
  assert.equal(typeof radar.createRadarMatcher, 'function');
  const matcher = radar.createRadarMatcher();
  const b = buildings[0];
  const first = matcher.evaluate([b], DEFAULT_FILTERS)[0];
  const second = matcher.evaluate([b], { ...DEFAULT_FILTERS, targetIrrPct: 2, districts: ['mapo'] })[0];
  assert.equal(first.metrics, second.metrics);
  const higher = matcher.evaluate([b], { ...DEFAULT_FILTERS, ltvPct: 70 })[0];
  assert.notEqual(first.metrics, higher.metrics);
  assert.ok(higher.equityKrw < first.equityKrw);
  for (const ltvPct of [60, 40, 30]) matcher.evaluate([b], { ...DEFAULT_FILTERS, ltvPct });
  assert.notEqual(matcher.evaluate([b], DEFAULT_FILTERS)[0].metrics, first.metrics);
});

test('sorting keeps null IRR last, medians use matches only and presets screen specified locations', () => {
  assert.equal(typeof radar.sortRadarRows, 'function');
  const rows = [
    { building: { id: 'c', askingPriceKrw: 90e8, landAreaM2: 400 / 121 }, matches: false, score: 10, irr: null, equityKrw: 45e8 },
    { building: { id: 'b', askingPriceKrw: 50e8, landAreaM2: 400 / 121 }, matches: true, score: 80, irr: .10, equityKrw: 20e8 },
    { building: { id: 'a', askingPriceKrw: 30e8, landAreaM2: 400 / 121 }, matches: true, score: 85, irr: .06, equityKrw: 10e8 },
  ];
  assert.deepEqual(radar.sortRadarRows(rows, 'irr').map((r) => r.building.id), ['b', 'a', 'c']);
  assert.deepEqual(radar.sortRadarRows(rows, 'price').map((r) => r.building.id), ['a', 'b', 'c']);
  assert.deepEqual(radar.radarStats(rows), { count: 2, medianIrr: .08, medianPricePerPyeong: 40e8 });
  assert.deepEqual(radar.radarStats([]), { count: 0, medianIrr: null, medianPricePerPyeong: null });
  assert.equal(radar.RADAR_PRESETS.length, 3);
  assert.deepEqual(radar.RADAR_PRESETS[1].filters.districts, ['gangnam']);
  assert.deepEqual(radar.RADAR_PRESETS[2].filters.districts, ['seongdong']);
});
