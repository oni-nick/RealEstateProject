import { calculate, inputFromBuilding, maxPurchasePrice, tornado, sensitivityGrid } from './engine/index.js';

/** The adapter keeps contract rent and rent-weighted vacancy consistent. */
export function createBidInput(building, deep = null, overrides = {}) {
  const provenance = Object.fromEntries(Object.keys(overrides).filter((key) => key !== 'provenance').map((key) => [key, {
    kind: 'assumption', assumptionId: `bid.input.${key}`, confidence: 'low',
    verificationStatus: 'not_verified', needsVerification: true,
  }]));
  return inputFromBuilding(building, deep, { ...overrides, provenance });
}

export function bidPolicy(options = {}) {
  const targetIrr = options.targetIrr ?? .08;
  const floorIrr = options.floorIrr ?? Math.max(targetIrr < 0 ? -.99 : 0, targetIrr - .03);
  const minDscr = options.minDscr ?? 1.2;
  if (!Number.isFinite(targetIrr) || targetIrr < -.99 || targetIrr > 1) throw new RangeError('Target IRR must be between -0.99 and 1');
  if (!Number.isFinite(floorIrr) || floorIrr < -.99 || floorIrr > targetIrr) throw new RangeError('IRR floor must be between -0.99 and target IRR');
  if (!Number.isFinite(minDscr) || minDscr < 1 || minDscr > 5) throw new RangeError('Minimum DSCR must be between 1 and 5');
  return { targetIrr, floorIrr, minDscr };
}

export function bidAnalysis(input, options = {}) {
  const policy = bidPolicy(options);
  const result = calculate(input);
  const buy = maxPurchasePrice(input, { targetIrr: policy.targetIrr, minDscr: policy.minDscr });
  const walk = policy.floorIrr === policy.targetIrr ? buy
    : maxPurchasePrice(input, { targetIrr: policy.floorIrr, minDscr: policy.minDscr });
  return { result, policy, buy, walk, years: annualCashflows(result) };
}

export const exactPrice = (pricing) => pricing.maxPrice.status === 'ok' && Number.isFinite(pricing.maxPrice.value) ? pricing.maxPrice.value : null;

/** Check the actual cashflow result as well as the solved ceilings. */
export function bidGuidance(analysis, askingPriceKrw) {
  const { result, buy, walk, policy } = analysis;
  const buyPriceKrw = exactPrice(buy), walkPriceKrw = exactPrice(walk);
  const irr = result.metrics.leveredIrr.value, dscr = result.metrics.minDscr;
  const common = { buyPriceKrw, walkPriceKrw,
    buyVsAsk: buyPriceKrw === null ? null : buyPriceKrw / askingPriceKrw - 1,
    walkVsAsk: walkPriceKrw === null ? null : walkPriceKrw / askingPriceKrw - 1 };
  if (result.status !== 'ok' || !Number.isFinite(irr) || buyPriceKrw === null || walkPriceKrw === null) return {
    ...common, tone: 'unavailable', title: '제안가 판단 보류',
    detail: '유효한 자기자본·단일 IRR·정확한 가격 한도를 확인할 수 없습니다. 공실·차입·보증금과 현금흐름을 먼저 확인하세요.',
  };
  const debtPass = dscr.status === 'not_applicable' || (Number.isFinite(dscr.value) && dscr.value >= policy.minDscr - 1e-8);
  if (!debtPass || irr < policy.floorIrr - 1e-8 || result.assumptions.purchasePriceKrw > walkPriceKrw + 1) return {
    ...common, tone: 'walk', title: 'WALK-AWAY · 현재 검토가 재협상',
    detail: '현재 검토가는 최소 수익률 또는 상환 여력을 충족하지 못합니다. 한도 이하로 가격을 낮추거나 금융·임대 가정을 재검증하세요.',
  };
  if (irr >= policy.targetIrr - 1e-8 && result.assumptions.purchasePriceKrw <= buyPriceKrw + 1) return {
    ...common, tone: 'buy', title: 'BUY · 예시 목표 조건 충족',
    detail: '현재 검토가에서 목표 IRR과 최소 DSCR 조건을 충족합니다. 실제 계약·비용·대출 심사 확인을 전제로 협상안을 검토하세요.',
  };
  return { ...common, tone: 'negotiate', title: '협상 구간 · 목표 수익률까지 가격 조정',
    detail: '최소 수익률은 충족하지만 목표 IRR에 못 미칩니다. BUY 한도를 기준으로 가격 인하 근거를 설명하고, WALK-AWAY를 초과하지 않도록 검토하세요.' };
}

/** Keep initial funding, operating distributions and net sale settlement separate. */
export function annualCashflows(result) {
  const years = [{ year: 0, months: 0, initialKrw: result.leveredCashflows.value[0], operatingKrw: 0,
    exitKrw: 0, totalKrw: result.leveredCashflows.value[0] }];
  for (const month of result.cashflow) {
    const year = Math.ceil(month.month / 12);
    const row = years[year] ??= { year, months: 0, initialKrw: 0, operatingKrw: 0, exitKrw: 0, totalKrw: 0 };
    row.months++;
    row.operatingKrw += month.operatingCashflowKrw.value;
    row.totalKrw += month.leveredCashflowKrw.value;
  }
  for (const row of years.slice(1)) row.exitKrw = row.totalKrw - row.operatingKrw;
  return years;
}

export function bidSensitivity(input, options = {}) {
  const policy = bidPolicy(options), pricing = { targetIrr: policy.targetIrr, minDscr: policy.minDscr };
  const a = calculate(input).assumptions;
  const centered = (value, delta, min, max) => [Math.max(min, value - delta), value, Math.min(max, value + delta)];
  return {
    tornado: tornado(a, { pricing }),
    grid: sensitivityGrid(a, { pricing, xField: 'annualInterestRate',
      xValues: centered(a.annualInterestRate, .01, 0, 1), yField: 'exitCapRate',
      yValues: centered(a.exitCapRate, .005, .000001, 1) }),
  };
}

export function priceRulerDomain(values) {
  const finite = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (!finite.length) return { min: 0, max: 1e8 };
  const low = Math.min(...finite), high = Math.max(...finite), span = Math.max(high - low, high * .2, 1e8);
  return { min: Math.max(0, low - span * .12), max: high + span * .12 };
}
