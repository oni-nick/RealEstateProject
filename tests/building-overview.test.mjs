import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as analysis from '../web-v2/js/building-analysis.js';

test('lease waterfall conserves occupied rent and respects snapshot anniversaries, overdue and unknown leases', () => {
  assert.equal(typeof analysis.leaseExpiry, 'function');
  const unit = (monthlyRentKrw, leaseEnd, status = 'occupied') => ({ monthlyRentKrw, leaseEnd, status });
  const result = analysis.leaseExpiry([
    unit(100, '2026-11-12'), unit(200, '2027-11-12'), unit(300, '2027-11-13'),
    unit(400, '2032-01-01'), unit(500, null), unit(600, '2027-01-01', 'vacant'),
  ], '2026-11-12');
  assert.equal(result.totalKrw, 1500);
  assert.equal(result.buckets[0].amountKrw, 100);
  assert.equal(result.buckets[1].amountKrw, 200);
  assert.equal(result.buckets[2].amountKrw, 300);
  assert.equal(result.remainingKrw, 900);
  assert.equal(result.unknownKrw, 500);
  assert.equal(result.buckets.reduce((s, b) => s + b.amountKrw, 0) + result.remainingKrw, result.totalKrw);
  assert.equal(result.buckets[1].startKrw, 1400);
  assert.equal(result.buckets[1].endKrw, 1200);
});

test('empty, invalid dates and leap anniversaries remain honest', () => {
  assert.equal(typeof analysis.leaseExpiry, 'function');
  assert.equal(analysis.leaseExpiry([], '2026-11-12').remainingKrw, 0);
  assert.throws(() => analysis.leaseExpiry([], 'UNKNOWN'));
  const units = [{ monthlyRentKrw: 10, status: 'occupied', leaseEnd: '2027-02-28' }, { monthlyRentKrw: 20, status: 'occupied', leaseEnd: '2027-02-30' }];
  const result = analysis.leaseExpiry(units, '2024-02-29');
  assert.equal(result.buckets[3].amountKrw, 10);
  assert.equal(result.unknownKrw, 20);
});

test('deep comparable ids join actual synthetic transactions; summaries use only same-district examples', () => {
  assert.equal(typeof analysis.selectComps, 'function');
  const load = (p) => JSON.parse(readFileSync(new URL('../web-v2/data/' + p, import.meta.url)));
  const buildings = load('buildings.json').buildings, comps = load('comps.json').comps;
  const b = buildings[0], deep = load(b.deepPath);
  const linked = analysis.selectComps(b, deep, comps);
  assert.equal(linked.length, deep.comps.length);
  assert.equal(linked[0].id, 'cmp-gangnam-011');
  assert.equal(linked[0].distanceM, 362);
  const summary = buildings.find((b) => !b.deepPath);
  const selected = analysis.selectComps(summary, null, comps);
  assert.equal(selected.length, 6);
  assert.ok(selected.every((c) => c.districtId === summary.districtId));
  assert.ok(selected.every((c, i) => !i || selected[i - 1].distanceM <= c.distanceM));
  assert.deepEqual(analysis.selectComps(b, { comps: [{ compId: 'missing', distanceM: 1 }] }, comps), []);
});
