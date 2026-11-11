import { calculate, inputFromBuilding, maxPurchasePrice } from './engine/index.js';
import { evidence } from './engine/evidence.js';
import { bidPolicy, exactPrice, annualCashflows } from './bid.js';
import { selectComps } from './building-analysis.js';
import { valueUpAnalysis, valueUpDefaults, VALUEUP_TYPES } from './valueup.js';
import { median } from './ui/format.js';

/** A disclosed negotiation convention, never an appraised fair-value band. */
export function recommendedBidRange(basePricing, conservativePricing, askingPriceKrw) {
  const base = exactPrice(basePricing), conservative = exactPrice(conservativePricing);
  const valid = base !== null && conservative !== null && base > 0 && conservative > 0;
  return { ...evidence(valid ? [Math.min(conservative, base, askingPriceKrw), Math.min(base, askingPriceKrw)] : null,
    '[min(conservativeMaxPrice, baseMaxPrice, ask), min(baseMaxPrice, ask)]; exact ceilings only',
    { baseMaxPrice: basePricing.maxPrice, conservativeMaxPrice: conservativePricing.maxPrice, askingPriceKrw }),
    status: valid ? 'ok' : 'unavailable' };
}

/** Same basis throughout: KRW per land pyeong, with NO time/use/size adjustment. */
export function compComparison(building, comps) {
  const values = comps.map((c) => c.landPricePerPyeong).filter((v) => Number.isFinite(v) && v > 0);
  const landPyeong = building.landAreaM2 * 121 / 400;
  const ask = building.askingPriceKrw / landPyeong;
  const mid = median(values);
  const inputs = { buildingId: building.id, askingPriceKrw: building.askingPriceKrw, landAreaM2: building.landAreaM2,
    landPyeong, comps: comps.map((c) => ({ id: c.id, landPricePerPyeong: c.landPricePerPyeong })) };
  return {
    count: values.length,
    askPerPyeong: evidence(ask, 'askingPriceKrw / (landAreaM2 * 121 / 400)', inputs),
    medianPerPyeong: evidence(mid, 'median(unadjusted synthetic comp landPricePerPyeong)', inputs),
    premium: evidence(mid === null ? null : ask / mid - 1, 'askLandPricePerPyeong / compMedianLandPricePerPyeong - 1', inputs),
    impliedPriceRange: evidence(values.length ? [Math.min(...values) * landPyeong, Math.max(...values) * landPyeong] : null,
      '[min(comp land price per pyeong), max(comp land price per pyeong)] * subject land pyeong; unadjusted, not valuation', inputs),
  };
}

export function proposalAnalysis(building, deep = null, inventory = [], options = {}) {
  const policy = bidPolicy({ targetIrr: options.targetIrr ?? .08, minDscr: options.minDscr ?? 1.2 });
  const input = inputFromBuilding(building, deep, { ltv: options.ltv ?? .5 });
  const base = calculate(input);
  const changes = { annualInterestRate: Math.min(1, input.annualInterestRate + .01),
    vacancyRate: Math.min(1, input.vacancyRate + .05), annualRentGrowth: 0,
    exitCapRate: Math.min(1, input.exitCapRate + .005) };
  const conservativeInput = { ...input, ...changes, provenance: { ...input.provenance,
    ...Object.fromEntries(Object.keys(changes).map((key) => [key, { kind: 'assumption', assumptionId: `proposal.conservative.${key}`,
      confidence: 'low', verificationStatus: 'not_verified', needsVerification: true }])) } };
  const conservative = calculate(conservativeInput);
  const basePricing = maxPurchasePrice(input, policy), conservativePricing = maxPurchasePrice(conservativeInput, policy);
  const bidRange = recommendedBidRange(basePricing, conservativePricing, building.askingPriceKrw);
  bidRange.inputs.initialEquityKrw = base.metrics.equityRequired.value;
  // Capping a feasible higher price at ask can leave the positive-equity domain.
  if (base.status !== 'ok') {
    bidRange.value = null;
    bidRange.status = 'unavailable';
    bidRange.reason = 'Non-positive initial equity at ask; a capped recommendation is outside the valid equity domain.';
  }
  const defaults = valueUpDefaults(deep);
  const scenarios = [
    { id: 'base', label: '기준 운영', result: base, capexKrw: 0, downtimeMonths: 0 },
    { id: 'conservative', label: '보수적 금융·공실', result: conservative, capexKrw: 0, downtimeMonths: 0 },
    ...VALUEUP_TYPES.map((id) => {
      const analysis = valueUpAnalysis(input, id, defaults[id]);
      return { id, label: { 'lease-up': '공실 해소', remodel: '리모델링', 'use-change': '용도 변경' }[id],
        result: analysis.afterResult, capexKrw: analysis.capex.value, downtimeMonths: analysis.timeline.downtimeMonths,
        analysis };
    }),
  ];
  const comps = selectComps(building, deep, inventory);
  const risks = [
    deep ? '상세 임대차·보증금·운영비는 합성 예시입니다. 계약 원본과 증빙을 확인해야 합니다.'
      : '상세 임대차 없음 · 요약 수익·보증금만 사용합니다. 호실별 만기·집중도는 UNKNOWN입니다.',
    '금리·공실·매각 Cap 상승에 따라 수익률과 매수 한도가가 하락할 수 있습니다.',
    '보증금은 반환 부채입니다. 대출기관의 보증금 공제와 실제 담보인정비율은 확인하지 않았습니다.',
    '공사비·임대 중단·임대료 인상은 가정이며 용도 변경은 인허가·임차인 동의 확인이 필요합니다.',
    '비교 거래는 가상·미보정 자료입니다. 입지·시점·면적·용도 차이를 실거래로 검증해야 합니다.',
  ];
  return { building, base, conservative, policy, basePricing, conservativePricing,
    bidRange,
    scenarios, comps, comparison: compComparison(building, comps), risks, years: annualCashflows(base),
    detailSource: deep ? 'rent-roll' : 'summary' };
}
