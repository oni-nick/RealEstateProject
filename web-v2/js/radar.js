import { calculate, inputFromBuilding, ENGINE_VERSION } from './engine/index.js';
import { DEFAULT_FILTERS, filterBuildings } from './store.js';
import { eok, median, percent } from './ui/format.js';

export const RADAR_PRESETS = Object.freeze([
  { id: 'equity30', label: '자기자본 30억 · IRR 8%', note: '전 지역 · 자기자본 30억 이내', filters: DEFAULT_FILTERS },
  { id: 'gangnam-office', label: '강남 사옥용', note: '강남구 · 업무시설 포함 · 도보 10분. 사옥 전환·자가 사용은 별도 검토', filters: { ...DEFAULT_FILTERS, districts: ['gangnam'], equityEok: 80, targetIrrPct: 0, maxWalk: 10, useKo: '업무시설' } },
  { id: 'seongsu-valueup', label: '성수 밸류업', note: '성수동 가상 후보 · 현 임대수익 기준. 밸류업 효과·공사비는 미반영', filters: { ...DEFAULT_FILTERS, districts: ['seongdong'], equityEok: 50, targetIrrPct: 0, maxWalk: 12 } },
]);

const clamp = (v) => Math.max(0, Math.min(1, v));
/** Session cache: at most three LTV slices. Only the two needed engine metrics
 * survive each calculation; full monthly evidence rows are not retained. Building
 * objects are immutable synthetic snapshot records, used as WeakMap keys. */
export function createRadarMatcher() {
  const slices = new Map();
  function metricsFor(building, ltvPct) {
    if (!slices.has(ltvPct)) {
      if (slices.size >= 3) slices.delete(slices.keys().next().value);
      slices.set(ltvPct, new WeakMap());
    }
    const cache = slices.get(ltvPct);
    slices.delete(ltvPct); slices.set(ltvPct, cache);
    if (!cache.has(building)) {
      const { metrics } = calculate(inputFromBuilding(building, null, { ltv: ltvPct / 100 }));
      cache.set(building, { leveredIrr: metrics.leveredIrr, equityRequired: metrics.equityRequired });
    }
    return cache.get(building);
  }
  return {
    evaluate(buildings, filters = DEFAULT_FILTERS) {
      const f = { ...DEFAULT_FILTERS, ...filters };
      const physical = new Set(filterBuildings(buildings, f).map((b) => b.id));
      return buildings.map((building) => {
        const metrics = metricsFor(building, f.ltvPct);
        const irr = metrics.leveredIrr.value, equityKrw = metrics.equityRequired.value;
        const validIrr = Number.isFinite(irr), validEquity = Number.isFinite(equityKrw) && equityKrw > 0;
        const checks = [
          { key: 'equity', passed: validEquity && equityKrw <= f.equityEok * 1e8, text: `필요 자기자본 ${eok(equityKrw)}억 / 예산 ${f.equityEok}억` },
          { key: 'irr', passed: validIrr && irr >= f.targetIrrPct / 100, text: `IRR ${percent(irr)} / 목표 ${f.targetIrrPct}%${validIrr ? '' : ' · 단일 수익률 확정 불가'}` },
          { key: 'district', passed: !f.districts.length || f.districts.includes(building.districtId), text: `${building.neighborhood} · ${f.districts.length ? '선택 지역' : '전 지역'}` },
          { key: 'price', passed: building.askingPriceKrw >= f.minPriceEok * 1e8 && building.askingPriceKrw <= f.maxPriceEok * 1e8, text: `호가 ${eok(building.askingPriceKrw)}억 / ${f.minPriceEok}–${f.maxPriceEok}억` },
          { key: 'use', passed: !f.useKo || building.useKo.includes(f.useKo), text: `용도 ${building.useKo}` },
          { key: 'walk', passed: building.walkMinutes <= f.maxWalk, text: `역 도보 ${building.walkMinutes}분 / ${f.maxWalk}분 이내` },
        ];
        // Six criteria, 30/30/10/10/10/10 points. At the financial thresholds
        // equity/IRR earn 15 points each, rising with available budget/headroom.
        const score = Math.round((validEquity && f.equityEok > 0 ? 30 * clamp(1 - equityKrw / (2 * f.equityEok * 1e8)) : 0)
          + (validIrr ? 30 * clamp(.5 + (irr - f.targetIrrPct / 100) / .2) : 0)
          + checks.slice(2).filter((c) => c.passed).length * 10);
        return { building, metrics, engineVersion: ENGINE_VERSION, irr, equityKrw, checks, score,
          matches: physical.has(building.id) && checks.every((c) => c.passed) };
      });
    },
  };
}

export function sortRadarRows(rows, sort = 'score') {
  const order = (a, b) => {
    if (sort === 'price') return a.building.askingPriceKrw - b.building.askingPriceKrw;
    if (sort === 'equity') return (a.equityKrw ?? Infinity) - (b.equityKrw ?? Infinity);
    if (sort === 'irr') return (b.irr ?? -Infinity) - (a.irr ?? -Infinity);
    return b.score - a.score;
  };
  return rows.toSorted((a, b) => Number(b.matches) - Number(a.matches) || order(a, b) || a.building.id.localeCompare(b.building.id));
}

export function radarStats(rows) {
  const matches = rows.filter((r) => r.matches);
  return { count: matches.length, medianIrr: median(matches.map((r) => r.irr)),
    medianPricePerPyeong: median(matches.map(({ building: b }) => b.askingPriceKrw / (b.landAreaM2 * 121 / 400))) };
}
