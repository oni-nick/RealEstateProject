import { evidence, ENGINE_VERSION, LABEL_KO, number, sum } from './evidence.js';
import { irr } from './irr.js';

/** Explicit demo defaults. KRW amounts, decimal rates, month-end operating flows. */
export const DEFAULTS = Object.freeze({
  holdYears: 10, ltv: 0.5, annualInterestRate: 0.05, loanType: 'interest-only',
  amortizationYears: 20, vacancyRate: 0.12, creditLossRate: 0,
  annualRentGrowth: 0.02, annualOpexGrowth: 0, monthlyPotentialMgmtIncomeKrw: 0,
  depositsKrw: 0, initialCapexKrw: 0, annualCapexKrw: 0,
  acquisitionTaxRate: 0.046, acquisitionBrokerageRate: 0.005,
  acquisitionMiscRate: 0.003, loanFeeRate: 0.005, sellingCostRate: 0.005,
  exitCapRate: 0.045,
});

const DEFAULT_REFS = {
  ltv: 'seoul.typical_ltv', annualInterestRate: 'seoul.loan_interest_rate',
  acquisitionTaxRate: 'seoul.acquisition_tax_rate',
  acquisitionBrokerageRate: 'seoul.acquisition_brokerage_fee_rate',
  acquisitionMiscRate: 'seoul.acquisition_misc_cost_rate', loanFeeRate: 'seoul.loan_origination_fee_rate',
  sellingCostRate: 'seoul.sale_brokerage_fee_rate',
};

export function normalizeInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('An assumptions object is required');
  // Do not use coercion or || defaults: null / UNKNOWN / NaN must be rejected.
  const a = { ...DEFAULTS, ...input };
  for (const key of ['purchasePriceKrw', 'monthlyPotentialRentKrw', 'monthlyOpexKrw',
    'monthlyPotentialMgmtIncomeKrw', 'depositsKrw', 'initialCapexKrw', 'annualCapexKrw']) {
    number(a[key], key, key === 'purchasePriceKrw' ? 1e-6 : 0, 1e16);
  }
  for (const key of ['ltv', 'vacancyRate', 'creditLossRate', 'acquisitionTaxRate',
    'acquisitionBrokerageRate', 'acquisitionMiscRate', 'loanFeeRate', 'sellingCostRate']) number(a[key], key, 0, 1);
  number(a.annualInterestRate, 'annualInterestRate', 0, 1);
  number(a.exitCapRate, 'exitCapRate', 1e-6, 1);
  number(a.annualRentGrowth, 'annualRentGrowth', -0.99, 1);
  number(a.annualOpexGrowth, 'annualOpexGrowth', -0.99, 1);
  number(a.holdYears, 'holdYears', 1 / 12, 50);
  number(a.amortizationYears, 'amortizationYears', 1 / 12, 50);
  for (const key of ['holdYears', 'amortizationYears']) {
    if (Math.abs(a[key] * 12 - Math.round(a[key] * 12)) > 1e-8) throw new RangeError(`${key} must represent a whole number of months`);
  }
  if (!['interest-only', 'amortizing'].includes(a.loanType)) throw new RangeError('loanType must be interest-only or amortizing');
  a.months = Math.round(a.holdYears * 12);
  a.amortizationMonths = Math.round(a.amortizationYears * 12);
  a.provenance = input.provenance ? JSON.parse(JSON.stringify(input.provenance)) : {};
  for (const key of ['purchasePriceKrw', 'monthlyPotentialRentKrw', 'monthlyOpexKrw', ...Object.keys(DEFAULTS)]) {
    if (!a.provenance[key]) a.provenance[key] = {
      kind: 'assumption', confidence: 'low', verificationStatus: 'not_verified',
      assumptionId: Object.hasOwn(input, key) ? `input.${key}` : `engine.default.${key}`,
      ...(!Object.hasOwn(input, key) && DEFAULT_REFS[key] ? { refId: DEFAULT_REFS[key] } : {}),
    };
  }
  a.intervention = normalizeIntervention(input.intervention, a);
  return a;
}

function normalizeIntervention(input, a) {
  if (input === undefined || input === null) return null;
  if (typeof input !== 'object' || !['lease-up', 'remodel', 'use-change'].includes(input.type)) {
    throw new RangeError('intervention.type must be lease-up, remodel or use-change');
  }
  const s = { startMonth: 1, downtimeMonths: 0, capexKrw: 0, rentUpliftRate: 0,
    affectedShare: 1, targetVacancyRate: a.vacancyRate, addedDepositsKrw: 0, ...input };
  number(s.startMonth, 'startMonth', 1, a.months);
  number(s.downtimeMonths, 'downtimeMonths', 0, 600);
  if (!Number.isInteger(s.startMonth) || !Number.isInteger(s.downtimeMonths)) throw new RangeError('Intervention timing must use whole months');
  number(s.capexKrw, 'capexKrw', 0, 1e16);
  number(s.addedDepositsKrw, 'addedDepositsKrw', 0, 1e16);
  number(s.rentUpliftRate, 'rentUpliftRate', -1, 5);
  number(s.affectedShare, 'affectedShare', 0, 1);
  number(s.targetVacancyRate, 'targetVacancyRate', 0, 1);
  if (s.type === 'lease-up' && s.targetVacancyRate > a.vacancyRate) throw new RangeError('lease-up cannot increase vacancy');
  return s;
}

/** Operating projection also used for the forward twelve-month exit NOI. */
export function operatingMonth(a, month) {
  const yearIndex = Math.floor((month - 1) / 12);
  const growth = (1 + a.annualRentGrowth) ** yearIndex;
  const s = a.intervention;
  const during = s && month >= s.startMonth && month < s.startMonth + s.downtimeMonths;
  const complete = s && month >= s.startMonth + s.downtimeMonths;
  const unavailable = during && s.type !== 'lease-up' ? s.affectedShare : 0;
  const vacancy = complete ? s.targetVacancyRate : a.vacancyRate;
  const uplift = complete ? 1 + s.rentUpliftRate * s.affectedShare : 1;
  const potentialRentKrw = a.monthlyPotentialRentKrw * growth * uplift;
  const vacancyLossKrw = potentialRentKrw * (1 - (1 - vacancy) * (1 - unavailable));
  const creditLossKrw = (potentialRentKrw - vacancyLossKrw) * a.creditLossRate;
  const rentKrw = potentialRentKrw - vacancyLossKrw - creditLossKrw;
  const mgmtIncomeKrw = a.monthlyPotentialMgmtIncomeKrw * growth * (1 - vacancy) * (1 - unavailable) * (1 - a.creditLossRate);
  const opexKrw = a.monthlyOpexKrw * (1 + a.annualOpexGrowth) ** yearIndex;
  const noiKrw = rentKrw + mgmtIncomeKrw - opexKrw;
  // Deposits do not grow with rents. Affected deposits are refunded during a
  // shutdown and restored on completion; new lease-up deposits must be explicit.
  const depositBalanceKrw = a.depositsKrw * (1 - unavailable) + (complete ? s.addedDepositsKrw : 0);
  const capexKrw = a.annualCapexKrw / 12 + (s && month === s.startMonth ? s.capexKrw : 0);
  return { potentialRentKrw, vacancyLossKrw, creditLossKrw, rentKrw, mgmtIncomeKrw,
    opexKrw, noiKrw, depositBalanceKrw, capexKrw };
}

export function forwardNoi(a, afterMonth) {
  return sum(Array.from({ length: 12 }, (_, i) => operatingMonth(a, afterMonth + i + 1).noiKrw));
}

/** Raw internal arithmetic shared by analysis and price searches; never rounded. */
export function project(a) {
  const loanKrw = a.purchasePriceKrw * a.ltv;
  const acquisitionCostsKrw = a.purchasePriceKrw * (a.acquisitionTaxRate + a.acquisitionBrokerageRate + a.acquisitionMiscRate);
  const loanFeeKrw = loanKrw * a.loanFeeRate;
  const unleveredEquityKrw = a.purchasePriceKrw + acquisitionCostsKrw + a.initialCapexKrw - a.depositsKrw;
  const equityKrw = unleveredEquityKrw - loanKrw + loanFeeKrw;
  const monthlyRate = a.annualInterestRate / 12;
  const paymentKrw = a.loanType === 'interest-only' ? loanKrw * monthlyRate
    : monthlyRate === 0 ? loanKrw / a.amortizationMonths
      : loanKrw * monthlyRate / -Math.expm1(-a.amortizationMonths * Math.log1p(monthlyRate));
  let balance = loanKrw, depositBalance = a.depositsKrw;
  const rows = [];
  const levered = [-equityKrw], unlevered = [-unleveredEquityKrw];
  for (let month = 1; month <= a.months; month++) {
    const op = operatingMonth(a, month);
    const interestKrw = balance * monthlyRate;
    const principalKrw = a.loanType === 'interest-only' ? 0
      : month >= a.amortizationMonths ? balance : Math.min(balance, Math.max(0, paymentKrw - interestKrw));
    const debtServiceKrw = interestKrw + principalKrw;
    balance = Math.max(0, balance - principalKrw);
    const depositChangeKrw = op.depositBalanceKrw - depositBalance;
    depositBalance = op.depositBalanceKrw;
    const unleveredOperatingCashflowKrw = op.noiKrw - op.capexKrw + depositChangeKrw;
    const operatingCashflowKrw = unleveredOperatingCashflowKrw - debtServiceKrw;
    levered.push(operatingCashflowKrw); unlevered.push(unleveredOperatingCashflowKrw);
    rows.push({ month, ...op, interestKrw, principalKrw, debtServiceKrw, loanBalanceKrw: balance,
      depositChangeKrw, operatingCashflowKrw, unleveredOperatingCashflowKrw });
  }
  const exitNoiKrw = forwardNoi(a, a.months);
  const exitValueKrw = Math.max(0, exitNoiKrw / a.exitCapRate);
  const sellingCostsKrw = exitValueKrw * a.sellingCostRate;
  const unleveredExitKrw = exitValueKrw - sellingCostsKrw - depositBalance;
  const netExitKrw = unleveredExitKrw - balance;
  levered[a.months] += netExitKrw; unlevered[a.months] += unleveredExitKrw;
  const firstYear = rows.slice(0, 12);
  const firstYearNoiKrw = sum(firstYear.map((r) => r.noiKrw));
  const firstYearDebtServiceKrw = sum(firstYear.map((r) => r.debtServiceKrw));
  const firstYearCapexKrw = sum(firstYear.map((r) => r.capexKrw));
  const annualDscrs = [];
  for (let start = 0; start < rows.length; start += 12) {
    const period = rows.slice(start, start + 12), debt = sum(period.map((r) => r.debtServiceKrw));
    if (debt > 0) annualDscrs.push(sum(period.map((r) => r.noiKrw)) / debt);
  }
  return { rows, levered, unlevered, loanKrw, acquisitionCostsKrw, loanFeeKrw,
    equityKrw, unleveredEquityKrw, paymentKrw, firstYearNoiKrw,
    firstYearDebtServiceKrw, firstYearCapexKrw, annualDscrs,
    exitNoiKrw, exitValueKrw, sellingCostsKrw, depositBalanceKrw: depositBalance,
    loanBalanceKrw: balance, netExitKrw, unleveredExitKrw };
}

const ROW_FORMULAS = {
  potentialRentKrw: 'basePotentialRent * (1 + annualRentGrowth)^yearIndex * interventionUplift',
  vacancyLossKrw: 'potentialRent * [1 - (1 - vacancy) * (1 - downtimeShare)]',
  creditLossKrw: '(potentialRent - vacancyLoss) * creditLossRate',
  rentKrw: 'potentialRent - vacancyLoss - creditLoss',
  mgmtIncomeKrw: 'potentialMgmtIncome * rentGrowth * occupiedShare * (1 - creditLossRate)',
  opexKrw: 'monthlyOpex * (1 + annualOpexGrowth)^yearIndex',
  noiKrw: 'rent + mgmtIncome - opex',
  depositBalanceKrw: 'inheritedDeposits - shutdownRefunds + completedNewDeposits',
  capexKrw: 'annualCapex / 12 + interventionCapexAtStart',
  interestKrw: 'openingLoanBalance * annualInterestRate / 12',
  principalKrw: 'min(openingLoanBalance, payment - interest); zero for interest-only',
  debtServiceKrw: 'interest + principal',
  loanBalanceKrw: 'openingLoanBalance - principal',
  depositChangeKrw: 'closingDeposits - openingDeposits',
  operatingCashflowKrw: 'NOI - capex + depositChange - debtService',
  unleveredOperatingCashflowKrw: 'NOI - capex + depositChange',
};

export function calculate(input) {
  const a = normalizeInput(input), p = project(a);
  const source = { assumptions: a, sourceInputs: a.provenance };
  const e = (value, formula, inputs = {}) => evidence(value, formula, { ...source, ...inputs });
  const validEquity = p.equityKrw > 0;
  const returnIrr = (flows, valid) => {
    if (!valid) return { ...e(null, 'IRR requires positive initial equity'), status: 'invalid_equity', periodicRate: null };
    const result = irr(flows, { periodsPerYear: 12 });
    return { ...result, inputs: { ...result.inputs, ...source } };
  };
  const firstYearMonths = Math.min(12, a.months);
  const annualNoiKrw = p.firstYearNoiKrw * 12 / firstYearMonths;
  const invested = -p.levered[0] + sum(p.levered.slice(1).map((v) => Math.max(0, -v)));
  const distributions = sum(p.levered.slice(1).map((v) => Math.max(0, v)));
  let cumulative = p.levered[0], paybackMonth = null;
  if (validEquity) {
    for (let month = 1; month < p.levered.length; month++) {
      cumulative += p.levered[month];
      if (cumulative >= 0) { paybackMonth = month; break; }
    }
  }
  const dscr = p.firstYearDebtServiceKrw > 0 ? p.firstYearNoiKrw / p.firstYearDebtServiceKrw : null;
  const metrics = {
    noi: e(annualNoiKrw, 'sum(firstYearMonthlyNOI) * 12 / firstYearMonths', { firstYearNoiKrw: p.firstYearNoiKrw, firstYearMonths }),
    capRate: e(annualNoiKrw / a.purchasePriceKrw, 'annualizedFirstYearNOI / purchasePrice', { annualNoiKrw, purchasePriceKrw: a.purchasePriceKrw }),
    equityRequired: e(p.equityKrw, 'price + acquisitionCosts + loanFee + initialCapex - loan - inheritedDeposits', {
      purchasePriceKrw: a.purchasePriceKrw, acquisitionCostsKrw: p.acquisitionCostsKrw,
      loanFeeKrw: p.loanFeeKrw, initialCapexKrw: a.initialCapexKrw, loanKrw: p.loanKrw, inheritedDepositsKrw: a.depositsKrw,
    }),
    cashOnCash: e(validEquity ? (p.firstYearNoiKrw - p.firstYearDebtServiceKrw - p.firstYearCapexKrw) * 12 / firstYearMonths / p.equityKrw : null,
      '(firstYearNOI - firstYearDebtService - firstYearCapex) * 12 / firstYearMonths / equityRequired', {
        firstYearNoiKrw: p.firstYearNoiKrw, firstYearDebtServiceKrw: p.firstYearDebtServiceKrw,
        firstYearCapexKrw: p.firstYearCapexKrw, firstYearMonths, equityRequiredKrw: p.equityKrw,
      }),
    dscr: { ...e(dscr, 'firstYearNOI / firstYearDebtService', { firstYearNoiKrw: p.firstYearNoiKrw,
      firstYearDebtServiceKrw: p.firstYearDebtServiceKrw }), status: dscr === null ? 'not_applicable' : 'ok' },
    minDscr: { ...e(p.annualDscrs.length ? Math.min(...p.annualDscrs) : null,
      'min(sum(NOI) / sum(debtService)) across 12-month holding buckets; final partial bucket included', { annualDscrs: p.annualDscrs }),
      status: p.annualDscrs.length ? 'ok' : 'not_applicable' },
    leveredIrr: returnIrr(p.levered, validEquity),
    unleveredIrr: returnIrr(p.unlevered, p.unleveredEquityKrw > 0),
    equityMultiple: e(validEquity ? distributions / invested : null, 'sum(positive future cashflows) / (initialEquity + sum(future capital calls))', { distributions, invested }),
    paybackYears: { ...e(paybackMonth === null ? null : paybackMonth / 12, 'first month-end cumulative levered cashflow >= 0, divided by 12; includes sale'),
      status: !validEquity ? 'invalid_equity' : paybackMonth === null ? 'not_reached' : 'ok' },
  };
  const initial = {
    loan: e(p.loanKrw, 'purchasePrice * LTV'),
    acquisitionTax: e(a.purchasePriceKrw * a.acquisitionTaxRate, 'purchasePrice * demoAcquisitionTaxRate'),
    acquisitionBrokerage: e(a.purchasePriceKrw * a.acquisitionBrokerageRate, 'purchasePrice * acquisitionBrokerageRate'),
    acquisitionMisc: e(a.purchasePriceKrw * a.acquisitionMiscRate, 'purchasePrice * acquisitionMiscRate'),
    acquisitionCosts: e(p.acquisitionCostsKrw, 'acquisitionTax + acquisitionBrokerage + acquisitionMisc'),
    loanFee: e(p.loanFeeKrw, 'initialLoan * loanFeeRate'),
    unleveredEquity: e(p.unleveredEquityKrw, 'price + acquisitionCosts + initialCapex - inheritedDeposits'),
  };
  const exit = {
    forwardNoi: e(p.exitNoiKrw, 'sum(projected monthly NOI in months holdMonths + 1 through holdMonths + 12)'),
    value: e(p.exitValueKrw, 'max(0, forward12MonthNOI / exitCapRate)', { forwardNoiKrw: p.exitNoiKrw, exitCapRate: a.exitCapRate }),
    sellingCosts: e(p.sellingCostsKrw, 'exitValue * sellingCostRate', { exitValueKrw: p.exitValueKrw, sellingCostRate: a.sellingCostRate }),
    depositSettlement: e(p.depositBalanceKrw, 'refund or buyer assumption of closing refundable deposit liability'),
    loanRepayment: e(p.loanBalanceKrw, 'remaining principal after final scheduled debt service'),
    netProceeds: e(p.netExitKrw, 'exitValue - sellingCosts - closingDeposits - remainingLoan', {
      exitValueKrw: p.exitValueKrw, sellingCostsKrw: p.sellingCostsKrw, closingDepositsKrw: p.depositBalanceKrw,
      remainingLoanKrw: p.loanBalanceKrw,
    }),
  };
  const cashflow = p.rows.map(({ month, ...row }) => {
    const out = { month };
    for (const [key, value] of Object.entries(row)) {
      out[key] = e(value, ROW_FORMULAS[key], { month, operatingInputs: row });
    }
    out.leveredCashflowKrw = e(p.levered[month], 'operatingCashflow + finalMonthNetExit', { month });
    out.unleveredCashflowKrw = e(p.unlevered[month], 'unleveredOperatingCashflow + finalMonthUnleveredExit', { month });
    return out;
  });
  const warnings = [
    '예시 데이터 · 실제 매물 아님. 모든 입력은 검증 필요 가정입니다.',
    'VAT, income/capital-gains taxes, prepayment penalties, refinancing, lease renewal and lender-specific deposit deductions are not modeled.',
    'Acquisition tax is a demo budget allowance, not transaction-specific tax advice.',
  ];
  if (!validEquity) warnings.push('Non-positive initial equity: financing exceeds initial uses; equity return metrics are unavailable.');
  if (p.exitNoiKrw <= 0) warnings.push('Non-positive forward NOI: income-based exit value is floored at zero; not a land valuation.');
  if (a.intervention && a.intervention.startMonth + a.intervention.downtimeMonths > a.months) warnings.push('Intervention is incomplete at sale; forward exit NOI assumes its modeled completion.');
  return {
    engineVersion: ENGINE_VERSION, labelKo: LABEL_KO, status: validEquity ? 'ok' : 'invalid_equity',
    assumptions: a, defaultsUsed: Object.keys(DEFAULTS).filter((key) => !Object.hasOwn(input, key)),
    metrics, initial, exit, cashflow,
    leveredCashflows: e(p.levered, '[-initialEquity, ...monthly operating cashflows including final net exit]'),
    unleveredCashflows: e(p.unlevered, '[-unleveredEquity, ...monthly property cashflows including final exit; tenant deposits retained]'),
    warnings,
  };
}
