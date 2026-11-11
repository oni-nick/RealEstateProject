import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calculate } from '../web-v2/js/engine/index.js';
import { createBidInput, bidAnalysis } from '../web-v2/js/bid.js';
import { createRadarMatcher, RADAR_PRESETS, radarStats } from '../web-v2/js/radar.js';
import { proposalAnalysis } from '../web-v2/js/proposal.js';
import { valueUpAnalysis, valueUpDefaults, VALUEUP_TYPES } from '../web-v2/js/valueup.js';
import { DEFAULT_FILTERS } from '../web-v2/js/store.js';

const json = (path) => JSON.parse(readFileSync(new URL(`../web-v2/data/${path}`, import.meta.url), 'utf8'));
const buildings = json('buildings.json').buildings;
const comps = json('comps.json').comps;
const close = (actual, expected, label, tolerance = 1e-6) => {
  if (expected === null) assert.equal(actual, null, label);
  else assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance, `${label}: ${actual} != ${expected}`);
};

test('Radar, deep bid, value-up and proposals reconcile across every detailed building and three LTVs', () => {
  const matcher = createRadarMatcher();
  for (const building of buildings.filter((b) => b.deepPath)) {
    const deep = json(building.deepPath);
    for (const ltvPct of [0, 50, 80]) {
      const label = `${building.id} / LTV ${ltvPct}`;
      const filters = { ...DEFAULT_FILTERS, ltvPct };
      const radar = matcher.evaluate([building], filters)[0];
      const input = createBidInput(building, deep, { ltv: ltvPct / 100 });
      const bid = bidAnalysis(input);
      const proposal = proposalAnalysis(building, deep, comps, { ltv: ltvPct / 100 });
      close(radar.irr, bid.result.metrics.leveredIrr.value, `${label} Radar IRR`, 1e-10);
      close(radar.equityKrw, bid.result.metrics.equityRequired.value, `${label} Radar equity`);
      close(bid.result.metrics.noi.value, building.noiAnnualKrw, `${label} summary NOI`);
      for (const key of ['noi', 'leveredIrr', 'equityRequired', 'dscr', 'minDscr']) {
        close(proposal.base.metrics[key].value, bid.result.metrics[key].value, `${label} proposal ${key}`);
      }
      close(proposal.basePricing.maxPrice.value, bid.buy.maxPrice.value, `${label} BUY limit`);
      const defaults = valueUpDefaults(deep);
      for (const type of VALUEUP_TYPES) {
        const simulation = valueUpAnalysis(input, type, defaults[type]);
        const report = proposal.scenarios.find((s) => s.id === type);
        close(simulation.beforeResult.metrics.leveredIrr.value, radar.irr, `${label} ${type} baseline`, 1e-10);
        for (const key of ['noi', 'leveredIrr', 'equityRequired']) {
          close(report.result.metrics[key].value, simulation.afterResult.metrics[key].value, `${label} ${type} ${key}`);
        }
        close(report.capexKrw, simulation.capex.value, `${label} ${type} capex`);
        assert.equal(report.downtimeMonths, simulation.timeline.downtimeMonths);
      }
      for (const [price, model] of [[proposal.bidRange.value?.[0], proposal.conservative], [proposal.bidRange.value?.[1], proposal.base]]) {
        if (!Number.isFinite(price)) continue;
        const endpoint = calculate({ ...model.assumptions, purchasePriceKrw: price });
        assert.ok(endpoint.metrics.leveredIrr.value >= proposal.policy.targetIrr - 1e-7, `${label} endpoint IRR`);
        assert.ok(endpoint.metrics.minDscr.status === 'not_applicable' || endpoint.metrics.minDscr.value >= proposal.policy.minDscr - 1e-7, `${label} endpoint DSCR`);
      }
    }
  }
});

test('all three demo presets produce matching candidates and aggregate only their exact member rows', () => {
  const matcher = createRadarMatcher();
  for (const preset of RADAR_PRESETS) {
    const rows = matcher.evaluate(buildings, preset.filters);
    const matches = rows.filter((r) => r.matches);
    const stats = radarStats(rows);
    assert.ok(matches.length > 0, preset.id);
    assert.equal(stats.count, matches.length);
    for (const { building, irr, equityKrw, checks } of matches) {
      assert.notEqual(building.statusKo, '거래완료 참고');
      assert.ok(checks.every((c) => c.passed));
      assert.ok(irr >= preset.filters.targetIrrPct / 100);
      assert.ok(equityKrw <= preset.filters.equityEok * 1e8);
    }
  }
});
