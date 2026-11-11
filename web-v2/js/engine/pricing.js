import { evidence, number } from './evidence.js';
import { irr, npv } from './irr.js';
import { normalizeInput, project } from './model.js';

/** Fixed-LTV policy: loan and transaction costs re-size at every candidate price. */
export function maxPurchasePrice(input, options = {}) {
  const a = normalizeInput(input);
  const targetIrr = number(options.targetIrr ?? 0.08, 'targetIrr', -0.99, 10);
  const minDscr = number(options.minDscr ?? 1.2, 'minDscr', 1e-6, 100);
  const priceToleranceKrw = number(options.priceToleranceKrw ?? 1, 'priceToleranceKrw', 1e-6, 1e9);
  const searchBoundKrw = number(options.searchBoundKrw ?? 1e15, 'searchBoundKrw', 1, 1e16);
  const monthlyTarget = Math.expm1(Math.log1p(targetIrr) / 12);
  const inputs = { assumptions: a, targetIrr, minDscr, priceToleranceKrw, searchBoundKrw, loanPolicy: 'fixed_ltv' };
  const result = (value, formula, status, extra = {}) => ({ ...evidence(value, formula, inputs), status, ...extra });
  const equityCoefficient = 1 + a.acquisitionTaxRate + a.acquisitionBrokerageRate + a.acquisitionMiscRate - a.ltv + a.ltv * a.loanFeeRate;
  // Strictly positive initial equity is the valid domain for an equity IRR.
  const fundingFloor = equityCoefficient > 0 ? (a.depositsKrw - a.initialCapexKrw) / equityCoefficient
    : a.initialCapexKrw > a.depositsKrw ? 0 : Infinity;
  const lower = Math.max(1e-6, fundingFloor + Math.max(0.01, Math.abs(fundingFloor) * 1e-12));
  const at = (price) => project({ ...a, purchasePriceKrw: price });
  const solve = (objective, formula) => {
    if (!(lower < searchBoundKrw)) return result(null, formula, 'infeasible', { reason: 'No positive-equity price inside search domain.' });
    let lo = lower, flo = objective(at(lo));
    if (flo < 0 || !Number.isFinite(flo)) return result(null, formula, 'infeasible');
    let hi = Math.min(searchBoundKrw, Math.max(a.purchasePriceKrw * 2, lo * 2, 1));
    while (objective(at(hi)) >= 0 && hi < searchBoundKrw) hi = Math.min(searchBoundKrw, hi * 2);
    if (objective(at(hi)) >= 0) return result(searchBoundKrw, formula, 'above_search_bound', { lowerBoundOnly: true });
    let iterations = 0;
    while (hi - lo > priceToleranceKrw && iterations < 100) {
      const mid = (lo + hi) / 2;
      if (objective(at(mid)) >= 0) lo = mid;
      else hi = mid;
      iterations++;
    }
    // Feasible side, never an infeasible rounded bid.
    return result(lo, formula, 'ok', { bracketKrw: [lo, hi], iterations });
  };
  const irrFormula = 'bisect purchasePrice: NPV(monthlyTarget, leveredMonthlyCashflows) = 0; fixed LTV';
  let atTargetIrr = solve((p) => npv(monthlyTarget, p.levered), irrFormula);
  if (atTargetIrr.status === 'ok') {
    const achievedIrr = irr(at(atTargetIrr.value).levered, { periodsPerYear: 12 });
    if (achievedIrr.status !== 'ok') atTargetIrr = result(null, irrFormula, 'unsupported_cashflows', {
      targetNpvPriceKrw: atTargetIrr.value, achievedIrr,
      reason: 'A unique IRR is unavailable; the NPV boundary is diagnostic only.',
    });
    else atTargetIrr.achievedIrr = achievedIrr;
  }
  const dscrFormula = 'bisect purchasePrice: minimum holding-period annual-bucket DSCR = minDscr; fixed LTV';
  const hasDebtService = at(a.purchasePriceKrw).annualDscrs.length > 0;
  const atMinDscr = hasDebtService
    ? solve((p) => Math.min(...p.annualDscrs) - minDscr, dscrFormula)
    : result(null, dscrFormula, 'not_applicable', { reason: 'No scheduled debt service; DSCR imposes no price ceiling.' });

  const constraints = [atTargetIrr, atMinDscr];
  let bindingConstraint, maxPrice;
  if (constraints.some((r) => r.status === 'infeasible')) {
    bindingConstraint = 'infeasible'; maxPrice = result(null, 'min(targetIrrPrice, minDscrPrice)', 'infeasible');
  } else if (constraints.some((r) => r.status === 'unsupported_cashflows')) {
    bindingConstraint = 'unavailable'; maxPrice = result(null, 'min(targetIrrPrice, minDscrPrice)', 'unavailable');
  } else {
    const price = Math.min(...constraints.filter((r) => r.value !== null).map((r) => r.value));
    const irrBinds = atTargetIrr.value !== null && Math.abs(atTargetIrr.value - price) <= priceToleranceKrw;
    const dscrBinds = atMinDscr.value !== null && Math.abs(atMinDscr.value - price) <= priceToleranceKrw;
    bindingConstraint = irrBinds && dscrBinds ? 'both' : irrBinds ? 'target_irr' : 'min_dscr';
    const bounded = price === searchBoundKrw;
    maxPrice = result(price, 'min(targetIrrPrice, minDscrPrice); ignore not-applicable DSCR', bounded ? 'above_search_bound' : 'ok',
      { lowerBoundOnly: bounded });
  }
  let atMax = maxPrice.value === null ? null : at(maxPrice.value);
  const achievedIrr = atMax ? irr(atMax.levered, { periodsPerYear: 12 })
    : result(null, 'IRR at combined maxPrice', 'unavailable');
  if (maxPrice.status === 'ok' && achievedIrr.status !== 'ok') {
    maxPrice = result(null, 'min(targetIrrPrice, minDscrPrice)', 'unsupported_cashflows', {
      reason: 'Combined price does not have a demonstrably unique IRR.',
    });
    bindingConstraint = 'unavailable'; atMax = null;
  }
  return { atTargetIrr, atMinDscr, maxPrice, bindingConstraint,
    achievedIrr,
    achievedDscr: result(atMax?.annualDscrs.length ? Math.min(...atMax.annualDscrs) : null,
      'minimum holding-period annual-bucket DSCR at combined maxPrice', !atMax ? 'unavailable' : atMax.annualDscrs.length ? 'ok' : 'not_applicable'),
    loanPolicy: 'fixed_ltv' };
}
