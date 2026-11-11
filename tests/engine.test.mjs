import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import {
  calculate, irr, npv, maxPurchasePrice, tornado, sensitivityGrid,
  valueUpScenario, inputFromBuilding, normalizeInput, DEFAULTS,
} from '../web-v2/js/engine/index.js';

const at = (path) => new URL(`../${path}`, import.meta.url);
const near = (actual, expected, tolerance = 1e-8) => {
  assert.ok(Number.isFinite(actual), `Expected finite result, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected} ± ${tolerance}`);
};
const base = (overrides = {}) => ({
  purchasePriceKrw: 10_000_000_000, monthlyPotentialRentKrw: 50_000_000,
  monthlyPotentialMgmtIncomeKrw: 2_000_000, monthlyOpexKrw: 8_000_000,
  depositsKrw: 400_000_000, vacancyRate: 0.1, holdYears: 5,
  annualRentGrowth: 0.02, annualInterestRate: 0.05, ...overrides,
});
const free = (overrides = {}) => base({ ltv: 0, depositsKrw: 0,
  acquisitionTaxRate: 0, acquisitionBrokerageRate: 0, acquisitionMiscRate: 0,
  loanFeeRate: 0, sellingCostRate: 0, ...overrides });
const verifyEvidence = (entry) => {
  assert.ok(Object.hasOwn(entry, 'value'));
  assert.equal(typeof entry.formula, 'string'); assert.ok(entry.formula.length);
  assert.equal(typeof entry.inputs, 'object');
  assert.equal(entry.provenance.kind, 'derived');
  assert.equal(entry.provenance.confidence, 'low');
  assert.equal(entry.provenance.needsVerification, true);
};

test('known annual IRRs, negative IRR, initial zero periods and scale invariance', () => {
  for (const [flows, expected] of [
    [[-100, 110], 0.1], [[-100, 0, 121], 0.1], [[-100, 60, 60], 0.1306623862918075],
    [[-100, 100], 0], [[-100, 90], -0.1], [[0, -100, 110, 0], 0.1],
    [[-100, -10, 121], 0.05113577727726204],
  ]) {
    const result = irr(flows);
    assert.equal(result.status, 'ok'); near(result.value, expected, 1e-9);
    near(npv(result.periodicRate, flows), 0, 1e-7);
    near(irr(flows.map((v) => v * 1e9)).value, expected, 1e-9);
    verifyEvidence(result);
  }
});

test('historical independent annual benchmark: ~0.63005% IRR and 1.03 multiple', () => {
  const flows = [-30, 0.9, 0.9, 0.9, 0.9, 27.3];
  const rate = irr(flows).value;
  near(rate, 0.0063005, 1e-7);
  near(npv(rate, flows), 0, 1e-9);
  near(flows.slice(1).reduce((s, v) => s + v, 0) / 30, 1.03);
});

test('monthly IRR annualizes by compounding, not multiplication', () => {
  const result = irr([-100, 101], { periodsPerYear: 12 });
  near(result.periodicRate, 0.01); near(result.value, 1.01 ** 12 - 1);
  const flows = [-100, ...Array(11).fill(0), 110];
  near(irr(flows, { periodsPerYear: 12 }).value, 0.1);
});

test('Newton and forced bisection agree and expose solver diagnostics', () => {
  const normal = irr([-100, 60, 60]);
  const fallback = irr([-100, 60, 60], { maxNewtonIterations: 0 });
  assert.equal(normal.method, 'newton'); assert.equal(fallback.method, 'bisection');
  near(normal.value, fallback.value, 1e-10);
  assert.ok(fallback.residual <= 1e-12);
  assert.equal(irr([-100, 60, 60], { maxNewtonIterations: 0, maxBisectionIterations: 1 }).status, 'not_converged');
});

test('long zero tails and sparse 50-year monthly series preserve IRR roots', () => {
  const zeroTail = [0, 0, -100, 1, ...Array(600).fill(0)];
  near(irr(zeroTail).value, -0.99, 1e-10);
  const sparse = [-1_000, ...Array(599).fill(0), 1_000 * 1.01 ** 600];
  near(irr(sparse, { periodsPerYear: 12, guess: 1e5 }).value, 1.01 ** 12 - 1, 1e-10);
  const nearZero = [-100, 100.000001];
  near(irr(nearZero).value, 1e-8, 1e-11);
});

test('IRR explicitly handles no solution, indeterminate, multiple and repeated roots', () => {
  for (const flows of [[0, 1, 2], [-1, -2], [-100, 0]]) {
    assert.equal(irr(flows).status, 'no_solution'); assert.equal(irr(flows).value, null);
  }
  assert.equal(irr([0, 0]).status, 'indeterminate');
  const ambiguous = irr([-100, 230, -132]); // 10% and 20% roots
  assert.equal(ambiguous.status, 'ambiguous'); assert.equal(ambiguous.value, null);
  assert.equal(ambiguous.candidateBrackets.length, 2);
  assert.equal(irr([-100, 200, -100]).status, 'ambiguous'); // repeated root at 0
  assert.equal(irr([-100, 0, 1], { minRate: 0 }).status, 'no_root_in_bounds');
});

test('NPV respects period zero; invalid rates, flows and solver options are rejected', () => {
  near(npv(0.1, [-100, 110]), 0);
  near(npv(0, [-100, 10, 20]), -70);
  for (const flows of [[], [1], [-1, NaN], [-1, Infinity], [-1, 'UNKNOWN']]) assert.throws(() => irr(flows));
  assert.throws(() => npv(-1, [-100, 100]));
  assert.throws(() => irr([-1, 2], { periodsPerYear: 0 }));
  assert.throws(() => irr([-1, 2], { maxNewtonIterations: 0.5 }));
});

test('monthly NOI, independent DSCR=1.60, cap rate and cash-on-cash arithmetic', () => {
  const result = calculate(free({ monthlyPotentialRentKrw: 20_000_000,
    monthlyPotentialMgmtIncomeKrw: 0, vacancyRate: 0, monthlyOpexKrw: 4_000_000,
    ltv: 0.4, annualInterestRate: 0.03, annualRentGrowth: 0 }));
  near(result.metrics.noi.value, 192_000_000);
  near(result.metrics.dscr.value, 1.6);
  near(result.metrics.capRate.value, 0.0192);
  near(result.metrics.cashOnCash.value, 72_000_000 / 6_000_000_000);
  near(result.cashflow[0].debtServiceKrw.value, 10_000_000);
  near(result.initial.loan.value, 4_000_000_000);
  assert.equal(result.cashflow.length, 60);
});

test('funding example includes inherited deposits, itemized acquisition costs and loan fee', () => {
  const result = calculate(base({ depositsKrw: 200_000_000 }));
  near(result.initial.acquisitionTax.value, 460_000_000);
  near(result.initial.acquisitionBrokerage.value, 50_000_000);
  near(result.initial.acquisitionMisc.value, 30_000_000);
  near(result.initial.loanFee.value, 25_000_000);
  near(result.metrics.equityRequired.value, 5_365_000_000);
  near(result.leveredCashflows.value[0], -5_365_000_000);
  near(result.initial.unleveredEquity.value, 10_340_000_000);
});

test('inherited deposits affect funding/exit equally and never NOI or sale gross value', () => {
  const noDeposit = calculate(base({ depositsKrw: 0 }));
  const withDeposit = calculate(base({ depositsKrw: 300_000_000 }));
  near(noDeposit.metrics.equityRequired.value - withDeposit.metrics.equityRequired.value, 300_000_000);
  near(noDeposit.exit.netProceeds.value - withDeposit.exit.netProceeds.value, 300_000_000);
  near(noDeposit.metrics.noi.value, withDeposit.metrics.noi.value);
  near(noDeposit.exit.value.value, withDeposit.exit.value.value);
  near(noDeposit.leveredCashflows.value.reduce((s, v) => s + v), withDeposit.leveredCashflows.value.reduce((s, v) => s + v), 0.001);
});

test('exit uses next twelve months NOI, selling costs, debt and closing deposit liability', () => {
  const a = base({ holdYears: 1, annualRentGrowth: 0.1 });
  const result = calculate(a);
  const forward = (52_000_000 * 1.1 * 0.9 - 8_000_000) * 12;
  near(result.exit.forwardNoi.value, forward, 1e-6);
  near(result.exit.value.value, forward / 0.045, 1e-5);
  near(result.exit.netProceeds.value, forward / 0.045 * 0.995 - 5e9 - 4e8, 1e-5);
  near(result.leveredCashflows.value.at(-1), result.cashflow.at(-1).operatingCashflowKrw.value + result.exit.netProceeds.value, 1e-6);
});

test('amortizing loan matches independent payment formula and principal roll-forward', () => {
  const a = free({ ltv: 0.6, loanType: 'amortizing', annualInterestRate: 0.06, amortizationYears: 20 });
  const result = calculate(a), loan = 6e9, rate = 0.06 / 12, n = 240;
  const payment = loan * rate * (1 + rate) ** n / ((1 + rate) ** n - 1);
  let opening = loan, totalPrincipal = 0;
  for (const row of result.cashflow) {
    near(row.debtServiceKrw.value, payment, 0.00001);
    near(row.interestKrw.value, opening * rate, 0.00001);
    near(row.loanBalanceKrw.value, opening - row.principalKrw.value, 0.00001);
    totalPrincipal += row.principalKrw.value; opening = row.loanBalanceKrw.value;
  }
  near(result.exit.loanRepayment.value, loan - totalPrincipal, 0.00001);
  near(result.metrics.dscr.value, result.metrics.noi.value / (payment * 12));
});

test('levered/unlevered cashflow difference is exactly bank funding, service and exit repayment', () => {
  const result = calculate(base({ loanType: 'amortizing', initialCapexKrw: 50e6, annualCapexKrw: 12e6 }));
  const levered = result.leveredCashflows.value, unlevered = result.unleveredCashflows.value;
  near(levered[0] - unlevered[0], result.initial.loan.value - result.initial.loanFee.value, 0.00001);
  for (const row of result.cashflow) {
    const loanRepayment = row.month === result.cashflow.length ? result.exit.loanRepayment.value : 0;
    near(unlevered[row.month] - levered[row.month], row.debtServiceKrw.value + loanRepayment, 0.00001);
  }
});

test('zero-rate amortization repays principal; interest-only zero rate and no debt have null DSCR', () => {
  const amortizing = calculate(free({ ltv: 0.5, annualInterestRate: 0, loanType: 'amortizing', amortizationYears: 1, holdYears: 2 }));
  near(amortizing.cashflow[0].debtServiceKrw.value, 5e9 / 12, 1e-6);
  near(amortizing.exit.loanRepayment.value, 0, 1e-6);
  near(amortizing.cashflow[12].debtServiceKrw.value, 0, 1e-6);
  assert.ok(amortizing.metrics.dscr.value > 0);
  const interestOnly = calculate(free({ ltv: 0.5, annualInterestRate: 0 }));
  assert.equal(interestOnly.metrics.dscr.value, null);
  assert.equal(interestOnly.metrics.dscr.status, 'not_applicable');
  const noDebt = calculate(free());
  assert.equal(noDebt.metrics.dscr.value, null);
  near(noDebt.metrics.leveredIrr.value, noDebt.metrics.unleveredIrr.value);
});

test('vacancy and credit loss are sequential; management income follows occupied collected share', () => {
  const result = calculate(base({ vacancyRate: 0.2, creditLossRate: 0.1 }));
  const row = result.cashflow[0];
  near(row.vacancyLossKrw.value, 10e6); near(row.creditLossKrw.value, 4e6);
  near(row.rentKrw.value, 36e6); near(row.mgmtIncomeKrw.value, 1.44e6);
  near(row.noiKrw.value, 29.44e6);
});

test('growth is stepped annually; opex growth is separate; capex does not reduce NOI', () => {
  const a = base({ annualRentGrowth: 0.1, annualOpexGrowth: 0.2, annualCapexKrw: 12e6 });
  const result = calculate(a);
  near(result.cashflow[11].potentialRentKrw.value, 50e6);
  near(result.cashflow[12].potentialRentKrw.value, 55e6);
  near(result.cashflow[12].opexKrw.value, 9.6e6);
  const noCapex = calculate({ ...a, annualCapexKrw: 0 });
  near(result.metrics.noi.value, noCapex.metrics.noi.value);
  near(noCapex.metrics.cashOnCash.value - result.metrics.cashOnCash.value, 12e6 / result.metrics.equityRequired.value);
});

test('partial-year hold annualizes NOI/cash-on-cash and includes partial DSCR bucket', () => {
  const a = base({ holdYears: 0.5, annualRentGrowth: 0 });
  const short = calculate(a), full = calculate({ ...a, holdYears: 1 });
  assert.equal(short.cashflow.length, 6);
  near(short.metrics.noi.value, full.metrics.noi.value);
  near(short.metrics.cashOnCash.value, full.metrics.cashOnCash.value);
  near(short.metrics.dscr.value, full.metrics.dscr.value);
  near(short.metrics.minDscr.value, full.metrics.minDscr.value);
});

test('zero rent/full vacancy and negative NOI are finite, with explicit zero income exit value', () => {
  const result = calculate(base({ monthlyPotentialRentKrw: 0, monthlyPotentialMgmtIncomeKrw: 0 }));
  assert.ok(result.metrics.noi.value < 0); assert.ok(result.metrics.dscr.value < 0);
  near(result.exit.value.value, 0); assert.equal(result.metrics.leveredIrr.value, null);
  assert.equal(result.metrics.leveredIrr.status, 'no_solution');
  assert.equal(result.metrics.paybackYears.status, 'not_reached');
  const vacant = calculate(base({ vacancyRate: 1 }));
  near(vacant.cashflow[0].rentKrw.value, 0); near(vacant.cashflow[0].mgmtIncomeKrw.value, 0);
});

test('non-positive equity is flagged, never an attractive IRR or infinite return multiple', () => {
  const result = calculate(free({ ltv: 1, depositsKrw: 0 }));
  near(result.metrics.equityRequired.value, 0); assert.equal(result.status, 'invalid_equity');
  for (const metric of ['leveredIrr', 'cashOnCash', 'equityMultiple', 'paybackYears']) assert.equal(result.metrics[metric].value, null);
  const negative = calculate(free({ depositsKrw: 11e9 }));
  assert.equal(negative.metrics.leveredIrr.status, 'invalid_equity');
});

test('equity multiple includes future capital calls and payback is first recovery month-end', () => {
  const result = calculate(free({ monthlyPotentialRentKrw: 100e6, monthlyPotentialMgmtIncomeKrw: 0,
    monthlyOpexKrw: 0, vacancyRate: 0, annualRentGrowth: 0,
    intervention: { type: 'remodel', capexKrw: 200e6, downtimeMonths: 0 } }));
  const flows = result.leveredCashflows.value;
  const positive = flows.slice(1).reduce((s, v) => s + Math.max(0, v), 0);
  const invested = -flows[0] + flows.slice(1).reduce((s, v) => s + Math.max(0, -v), 0);
  near(result.metrics.equityMultiple.value, positive / invested);
  near(result.metrics.paybackYears.value, 5);
  const quick = calculate(free({ purchasePriceKrw: 1_000, monthlyPotentialRentKrw: 100,
    monthlyPotentialMgmtIncomeKrw: 0, monthlyOpexKrw: 0, annualRentGrowth: 0, vacancyRate: 0 }));
  near(quick.metrics.paybackYears.value, 10 / 12);
});

test('higher purchase price and interest reduce IRR; growth raises IRR; capex reduces IRR', () => {
  const a = base(), rate = calculate(a).metrics.leveredIrr.value;
  assert.ok(calculate({ ...a, purchasePriceKrw: 11e9 }).metrics.leveredIrr.value < rate);
  assert.ok(calculate({ ...a, annualInterestRate: 0.06 }).metrics.leveredIrr.value < rate);
  assert.ok(calculate({ ...a, annualRentGrowth: 0.03 }).metrics.leveredIrr.value > rate);
  assert.ok(calculate({ ...a, initialCapexKrw: 100e6 }).metrics.leveredIrr.value < rate);
  assert.ok(calculate({ ...a, vacancyRate: 0.2 }).metrics.leveredIrr.value < rate);
});

test('price bisection meets target IRR within tolerance and higher prices fail target', () => {
  for (const loanType of ['interest-only', 'amortizing']) {
    const a = base({ loanType }), targetIrr = 0.08;
    const prices = maxPurchasePrice(a, { targetIrr });
    assert.equal(prices.atTargetIrr.status, 'ok');
    const price = prices.atTargetIrr.value;
    near(calculate({ ...a, purchasePriceKrw: price }).metrics.leveredIrr.value, targetIrr, 1e-8);
    assert.ok(calculate({ ...a, purchasePriceKrw: price * 1.001 }).metrics.leveredIrr.value < targetIrr);
    assert.ok(prices.atTargetIrr.bracketKrw[1] - price <= 1);
  }
});

test('DSCR max price equals independent interest-only formula and binding constraint is reported', () => {
  const a = base({ annualRentGrowth: 0 }), minDscr = 1.4;
  const prices = maxPurchasePrice(a, { targetIrr: -0.5, minDscr });
  const noi = (52e6 * 0.9 - 8e6) * 12;
  near(prices.atMinDscr.value, noi / (minDscr * 0.5 * 0.05), 1);
  assert.equal(prices.bindingConstraint, 'min_dscr');
  near(prices.maxPrice.value, prices.atMinDscr.value, 1);
  near(prices.achievedDscr.value, minDscr, 1e-8);
  const irrBound = maxPurchasePrice(a, { targetIrr: 0.2, minDscr: 0.1 });
  assert.equal(irrBound.bindingConstraint, 'target_irr');
});

test('higher return/DSCR requirements reduce price; non-applicable DSCR does not block cash buyer', () => {
  const a = base(), low = maxPurchasePrice(a, { targetIrr: 0.08, minDscr: 1.2 });
  assert.ok(maxPurchasePrice(a, { targetIrr: 0.15 }).atTargetIrr.value < low.atTargetIrr.value);
  assert.ok(maxPurchasePrice(a, { minDscr: 1.6 }).atMinDscr.value < low.atMinDscr.value);
  const cash = maxPurchasePrice(free());
  assert.equal(cash.atMinDscr.status, 'not_applicable'); assert.equal(cash.bindingConstraint, 'target_irr');
  assert.equal(maxPurchasePrice(free({ ltv: 0.5, annualInterestRate: 0 })).atMinDscr.status, 'not_applicable');
});

test('price solver reports infeasible financing/NOI and search bounds explicitly', () => {
  const noIncome = maxPurchasePrice(base({ monthlyPotentialRentKrw: 0, monthlyPotentialMgmtIncomeKrw: 0 }));
  assert.equal(noIncome.maxPrice.status, 'infeasible'); assert.equal(noIncome.maxPrice.value, null);
  const excessiveFunding = maxPurchasePrice(free({ ltv: 1, depositsKrw: 1e9 }));
  assert.equal(excessiveFunding.maxPrice.status, 'infeasible');
  const capped = maxPurchasePrice(free(), { searchBoundKrw: 1e9 });
  assert.equal(capped.maxPrice.status, 'above_search_bound'); assert.equal(capped.maxPrice.lowerBoundOnly, true);
});

test('100% LTV with separate capex equity still has a valid price domain', () => {
  const a = free({ ltv: 1, initialCapexKrw: 1e9 });
  const result = maxPurchasePrice(a, { targetIrr: 0.08 });
  assert.equal(result.atTargetIrr.status, 'ok');
  near(calculate({ ...a, purchasePriceKrw: result.atTargetIrr.value }).metrics.leveredIrr.value, 0.08, 1e-8);
});

test('non-conventional project cashflows withhold a unique IRR price and propagate null scenario delta', () => {
  const intervention = { type: 'remodel', startMonth: 24, capexKrw: 500e6 };
  const a = base({ intervention });
  assert.equal(calculate(a).metrics.leveredIrr.status, 'ambiguous');
  const prices = maxPurchasePrice(a);
  assert.equal(prices.atTargetIrr.status, 'unsupported_cashflows');
  assert.equal(prices.maxPrice.value, null); assert.equal(prices.bindingConstraint, 'unavailable');
  assert.equal(prices.achievedDscr.status, 'unavailable');
  const scenario = valueUpScenario(base(), intervention);
  assert.equal(scenario.delta.irr.value, null);
});

test('simultaneous price constraints identify both within price tolerance', () => {
  const a = base({ annualRentGrowth: 0 });
  const irrPrice = maxPurchasePrice(a, { targetIrr: 0.08 }).atTargetIrr.value;
  const minDscr = calculate({ ...a, purchasePriceKrw: irrPrice }).metrics.minDscr.value;
  assert.equal(maxPurchasePrice(a, { targetIrr: 0.08, minDscr }).bindingConstraint, 'both');
});

test('minimum DSCR checks future declining NOI, not just first year', () => {
  const a = base({ annualRentGrowth: -0.03 });
  const result = calculate(a), prices = maxPurchasePrice(a, { minDscr: 1.2 });
  assert.ok(result.metrics.minDscr.value < result.metrics.dscr.value);
  near(calculate({ ...a, purchasePriceKrw: prices.atMinDscr.value }).metrics.minDscr.value, 1.2, 1e-8);
});

test('tornado covers five required levers, sorted swings and endpoint arithmetic', () => {
  const a = base(), result = tornado(a);
  assert.deepEqual(result.rows.map((r) => r.field).sort(), ['annualInterestRate', 'vacancyRate', 'annualRentGrowth', 'exitCapRate', 'initialCapexKrw'].sort());
  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows[i];
    near(row.low.irr.value, calculate({ ...a, [row.field]: row.lowInput }).metrics.leveredIrr.value);
    near(row.high.irr.value, calculate({ ...a, [row.field]: row.highInput }).metrics.leveredIrr.value);
    near(row.lowIrrDelta.value, row.low.irr.value - result.base.irr.value);
    if (i) assert.ok(result.rows[i - 1].irrSwing.value >= row.irrSwing.value);
    assert.ok(row.low.maxPrice.value > 0); verifyEvidence(row.maxPriceSwing);
  }
});

test('2D grid has documented row/column orientation and monotone rate/exit-cap cells', () => {
  const result = sensitivityGrid(base());
  assert.equal(result.cells.length, 3); assert.equal(result.cells[0].length, 3);
  near(result.cells[1][1].irr.value, calculate(base()).metrics.leveredIrr.value);
  for (let y = 0; y < 3; y++) {
    assert.ok(result.cells[y][0].irr.value > result.cells[y][2].irr.value);
    assert.ok(result.cells[y][0].maxPrice.value > result.cells[y][2].maxPrice.value);
  }
  assert.ok(result.cells[0][1].irr.value > result.cells[2][1].irr.value);
  assert.throws(() => sensitivityGrid(base(), { xField: 'unknown' }));
  assert.throws(() => sensitivityGrid(base(), { xField: 'vacancyRate', yField: 'vacancyRate' }));
  assert.throws(() => tornado(base(), { ranges: { vacancyRate: [0.5, 0.1] } }));
});

test('sensitivity does not turn bounded/unavailable price results into exact swings', () => {
  const result = tornado(free(), { ranges: { annualInterestRate: [0.04, 0.06] }, pricing: { searchBoundKrw: 1e9 } });
  assert.equal(result.rows[0].low.maxPrice.status, 'above_search_bound');
  assert.equal(result.rows[0].maxPriceSwing.value, null);
  const empty = tornado(base({ monthlyPotentialRentKrw: 0, monthlyPotentialMgmtIncomeKrw: 0 }), {
    ranges: { vacancyRate: [0.1, 0.2] },
  });
  assert.equal(empty.rows[0].irrSwing.value, null); assert.equal(empty.rows[0].maxPriceSwing.value, null);
});

test('lease-up keeps occupied rent during leasing, then lowers vacancy and adds explicit deposits', () => {
  const result = valueUpScenario(base({ annualRentGrowth: 0 }), { type: 'lease-up',
    downtimeMonths: 3, capexKrw: 10e6, targetVacancyRate: 0, addedDepositsKrw: 50e6 });
  near(result.afterResult.cashflow[0].rentKrw.value, 45e6);
  near(result.afterResult.cashflow[3].rentKrw.value, 50e6);
  near(result.afterResult.cashflow[3].depositChangeKrw.value, 50e6);
  near(result.afterResult.exit.depositSettlement.value, 450e6);
  near(result.delta.noi.value, 52e6 * 0.1 * 12, 1e-6);
  assert.ok(result.delta.irr.value > 0); assert.equal(result.stabilizationMonth, 4);
});

test('remodel and use-change pay capex, lose affected rent/mgmt, refund and restore deposits', () => {
  for (const type of ['remodel', 'use-change']) {
    const result = valueUpScenario(base({ annualRentGrowth: 0 }), {
      type, capexKrw: 100e6, downtimeMonths: 2, rentUpliftRate: 0.2, affectedShare: 0.5,
    });
    const rows = result.afterResult.cashflow;
    near(rows[0].rentKrw.value, 22.5e6); near(rows[0].mgmtIncomeKrw.value, 0.9e6);
    near(rows[0].opexKrw.value, 8e6); near(rows[0].capexKrw.value, 100e6);
    near(rows[1].capexKrw.value, 0); near(rows[2].rentKrw.value, 49.5e6);
    near(rows[0].depositChangeKrw.value, -200e6); near(rows[2].depositChangeKrw.value, 200e6);
    near(result.after.noi.value - result.before.noi.value, 4.5e6 * 12, 1e-6);
    near(result.delta.value.value, result.delta.noi.value / 0.045, 1e-5);
    near(result.delta.irr.value, result.after.irr.value - result.before.irr.value);
  }
});

test('intervention timing, zero downtime/no uplift, and worse outcomes are modeled honestly', () => {
  const a = base({ annualRentGrowth: 0 });
  const neutral = valueUpScenario(a, { type: 'remodel', capexKrw: 0 });
  near(neutral.delta.noi.value, 0); near(neutral.delta.irr.value, 0);
  const costly = valueUpScenario(a, { type: 'remodel', capexKrw: 300e6, downtimeMonths: 3, rentUpliftRate: 0 });
  assert.ok(costly.delta.irr.value < 0);
  const late = valueUpScenario(a, { type: 'remodel', startMonth: 10, capexKrw: 10e6, downtimeMonths: 3 });
  near(late.afterResult.cashflow[8].capexKrw.value, 0); near(late.afterResult.cashflow[9].capexKrw.value, 10e6);
  const unfinished = valueUpScenario(base({ holdYears: 1 }), { type: 'remodel', startMonth: 12, downtimeMonths: 3 });
  assert.ok(unfinished.afterResult.warnings.some((s) => s.includes('incomplete')));
  assert.throws(() => valueUpScenario(a, { type: 'lease-up', targetVacancyRate: 0.5 }));
});

test('all 400 summaries and 25 deep files reproduce original NOI without double vacancy', () => {
  const buildings = JSON.parse(readFileSync(at('web-v2/data/buildings.json'), 'utf8')).buildings;
  for (const building of buildings) {
    const a = inputFromBuilding(building), result = calculate(a);
    near(result.metrics.noi.value, building.noiAnnualKrw, 0.0001);
    near(result.metrics.capRate.value, building.capRate, 1e-12);
    if (building.deepPath) {
      const deep = JSON.parse(readFileSync(at(`web-v2/data/${building.deepPath}`), 'utf8'));
      const detailed = calculate(inputFromBuilding(building, deep));
      near(detailed.metrics.noi.value, result.metrics.noi.value, 0.0001);
      near(detailed.metrics.equityRequired.value, result.metrics.equityRequired.value, 0.0001);
      assert.ok(detailed.assumptions.provenance.source.rentRoll.length);
    }
  }
});

test('building adapter rejects mismatches/UNKNOWN and handles all-vacant, zero-income data', () => {
  const building = { id: 'example', askingPriceKrw: 1e9, potentialAnnualRentKrw: 0,
    annualRentKrw: 0, annualMgmtKrw: 0, annualOpexKrw: 0, depositKrw: 0 };
  near(calculate(inputFromBuilding(building)).metrics.noi.value, 0);
  assert.throws(() => inputFromBuilding(building, { buildingId: 'other' }));
  assert.throws(() => inputFromBuilding({ ...building, annualOpexKrw: 'UNKNOWN' }));
  assert.throws(() => inputFromBuilding({ ...building, annualRentKrw: 1 }));
  assert.throws(() => inputFromBuilding({ ...building, annualMgmtKrw: 1 }));
});

test('metrics, monthly cashflows, price limits and scenarios expose evidence wrappers', () => {
  const result = calculate(base());
  for (const group of [result.metrics, result.initial, result.exit]) Object.values(group).forEach(verifyEvidence);
  for (const row of result.cashflow) for (const [key, value] of Object.entries(row)) if (key !== 'month') verifyEvidence(value);
  verifyEvidence(result.leveredCashflows); verifyEvidence(result.unleveredCashflows);
  const prices = maxPurchasePrice(base());
  [prices.atTargetIrr, prices.atMinDscr, prices.maxPrice, prices.achievedDscr].forEach(verifyEvidence);
  const scenario = valueUpScenario(base(), { type: 'lease-up', targetVacancyRate: 0 });
  for (const group of [scenario.before, scenario.after, scenario.delta]) Object.values(group).forEach(verifyEvidence);
  assert.ok(result.labelKo.includes('예시 데이터'));
  near(result.metrics.dscr.inputs.firstYearNoiKrw / result.metrics.dscr.inputs.firstYearDebtServiceKrw, result.metrics.dscr.value);
  assert.equal(result.assumptions.provenance.acquisitionTaxRate.refId, 'seoul.acquisition_tax_rate');
  assert.ok(result.metrics.leveredIrr.inputs.sourceInputs);
});

test('invalid/UNKNOWN inputs, impossible rates, unsupported loans and fractional months are rejected', () => {
  for (const overrides of [
    { purchasePriceKrw: 0 }, { monthlyOpexKrw: -1 }, { monthlyPotentialRentKrw: 'UNKNOWN' },
    { monthlyOpexKrw: null }, { depositsKrw: NaN }, { exitCapRate: 0 }, { exitCapRate: -0.1 },
    { vacancyRate: 1.1 }, { annualInterestRate: -0.01 }, { annualRentGrowth: -1 },
    { loanType: 'balloon' }, { holdYears: 0 }, { holdYears: 1.01 }, { amortizationYears: 1.01 },
    { intervention: { type: 'remodel', downtimeMonths: 1.5 } },
    { intervention: { type: 'remodel', startMonth: 0 } },
  ]) assert.throws(() => calculate(base(overrides)), JSON.stringify(overrides));
  assert.throws(() => calculate({ purchasePriceKrw: 1e9 }));
  assert.throws(() => maxPurchasePrice(base(), { targetIrr: -1 }));
});

test('all public computations are deterministic and preserve caller input objects', () => {
  const input = base({ provenance: { monthlyOpexKrw: { kind: 'assumption', assumptionId: 'example', confidence: 'low' } } });
  const before = JSON.stringify(input);
  assert.deepEqual(calculate(input), calculate(input));
  const ranges = { vacancyRate: [0.05, 0.15] }, serialized = JSON.stringify(ranges);
  tornado(input, { ranges }); sensitivityGrid(input, { xValues: [0.05], yValues: [0.045] });
  const intervention = { type: 'remodel', capexKrw: 10e6 }, saved = JSON.stringify(intervention);
  valueUpScenario(input, intervention); maxPurchasePrice(input);
  assert.equal(JSON.stringify(input), before); assert.equal(JSON.stringify(ranges), serialized);
  assert.equal(JSON.stringify(intervention), saved); assert.ok(Object.isFrozen(DEFAULTS));
});

test('engine source files are small UTF-8 ES modules, with no DOM, Node or external dependencies', () => {
  for (const file of readdirSync(at('web-v2/js/engine/')).filter((p) => p.endsWith('.js'))) {
    const bytes = readFileSync(at(`web-v2/js/engine/${file}`));
    assert.ok(bytes.length < 1_000_000); assert.notEqual(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
    const source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!/\b(document|window|fetch|XMLHttpRequest|localStorage)\b/.test(source), file);
    assert.ok(!/from\s+['"](?:node:|https?:|[^.])/.test(source), file);
  }
});
