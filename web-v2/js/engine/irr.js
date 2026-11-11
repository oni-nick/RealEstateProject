import { evidence, number } from './evidence.js';

export function signChanges(cashflows) {
  let previous = 0, changes = 0;
  for (const value of cashflows) {
    const sign = Math.sign(value);
    if (sign && previous && sign !== previous) changes++;
    if (sign) previous = sign;
  }
  return changes;
}

function validateFlows(cashflows) {
  if (!Array.isArray(cashflows) || cashflows.length < 2 || cashflows.length > 1201) {
    throw new RangeError('cashflows must contain 2..1201 equally spaced finite amounts, starting at t=0');
  }
  cashflows.forEach((v, i) => number(v, `cashflows[${i}]`));
}

/** Ordinary equally spaced NPV; rate is per period, strictly greater than -1. */
export function npv(rate, cashflows) {
  number(rate, 'rate', -1 + Number.EPSILON);
  validateFlows(cashflows);
  // Horner evaluation avoids repeated powers and preserves t=0 cashflow timing.
  let result = 0;
  for (let i = cashflows.length - 1; i >= 0; i--) result = result / (1 + rate) + cashflows[i];
  return result;
}

/**
 * Newton in x=log(1+r), followed by bracketed bisection. A single sign change
 * guarantees at most one positive discount-factor root. Multiple sign changes
 * are conservatively withheld: a selected numerical root is not a unique IRR.
 */
export function irr(cashflows, options = {}) {
  validateFlows(cashflows);
  const periodsPerYear = number(options.periodsPerYear ?? 1, 'periodsPerYear', 1, 365);
  const minRate = number(options.minRate ?? -0.999999, 'minRate', -1 + Number.EPSILON);
  const maxRate = number(options.maxRate ?? 1_000_000, 'maxRate', minRate + Number.EPSILON);
  if (maxRate <= minRate) throw new RangeError('maxRate must be greater than minRate');
  const guess = number(options.guess ?? 0.01, 'guess', -1 + Number.EPSILON);
  const tolerance = number(options.tolerance ?? 1e-12, 'tolerance', 1e-15, 1e-4);
  const newtonLimit = number(options.maxNewtonIterations ?? 30, 'maxNewtonIterations', 0, 100);
  const bisectLimit = number(options.maxBisectionIterations ?? 200, 'maxBisectionIterations', 1, 500);
  if (!Number.isInteger(newtonLimit) || !Number.isInteger(bisectLimit)) throw new RangeError('iteration limits must be integers');
  const inputs = { cashflows: [...cashflows], periodsPerYear, minRate, maxRate, tolerance };
  const result = (value, status, details = {}) => ({
    ...evidence(value, '(1 + periodicIRR)^periodsPerYear - 1; NPV(periodicIRR) = 0', inputs),
    status, periodicRate: value === null ? null : details.periodicRate, ...details,
  });
  if (cashflows.every((v) => v === 0)) return result(null, 'indeterminate', { reason: 'Every rate has zero NPV.' });
  const changes = signChanges(cashflows);
  if (!changes) return result(null, 'no_solution', { reason: 'Cashflows do not change sign.' });

  // Initial/trailing zero periods do not change roots. Removing them avoids
  // underflow of every nonzero term when the series has a long zero tail.
  const first = cashflows.findIndex((v) => v !== 0);
  const last = cashflows.findLastIndex((v) => v !== 0);
  const nonzeroSpan = cashflows.slice(first, last + 1);
  const scale = Math.max(...nonzeroSpan.map(Math.abs));
  const flows = nonzeroSpan.map((v) => v / scale);
  // Common exponential scaling keeps evaluations finite even near r=-1.
  const evaluate = (x) => {
    const offset = x < 0 ? -(flows.length - 1) * x : 0;
    let value = 0, derivative = 0, absolute = 0;
    for (let t = 0; t < flows.length; t++) {
      const term = flows[t] * Math.exp(-t * x - offset);
      value += term; derivative -= t * term; absolute += Math.abs(term);
    }
    return { value, derivative, residual: absolute ? Math.abs(value) / absolute : Infinity };
  };
  let lo = Math.log1p(minRate), hi = Math.log1p(maxRate);
  if (changes > 1) {
    // Diagnostics only. This scan cannot prove all roots (e.g. repeated roots),
    // so even one candidate never becomes a supposedly unique return.
    const brackets = [];
    let lastX = lo, last = evaluate(lo).value;
    for (let i = 1; i <= 1024; i++) {
      const x = lo + (hi - lo) * i / 1024, current = evaluate(x).value;
      if (last * current < 0) brackets.push([Math.expm1(lastX), Math.expm1(x)]);
      lastX = x; last = current;
    }
    return result(null, 'ambiguous', { signChanges: changes, candidateBrackets: brackets,
      reason: 'Multiple cashflow sign changes: uniqueness is not established; use target-rate NPV.' });
  }
  const finish = (x, method, iterations) => {
    const periodicRate = Math.expm1(x), annual = Math.expm1(x * periodsPerYear);
    if (!Number.isFinite(annual)) return result(null, 'out_of_range');
    return result(annual, 'ok', { periodicRate, method, iterations, residual: evaluate(x).residual });
  };
  const low = evaluate(lo), high = evaluate(hi);
  if (low.residual <= tolerance) return finish(lo, 'boundary', 0);
  if (high.residual <= tolerance) return finish(hi, 'boundary', 0);
  if (Math.sign(low.value) === Math.sign(high.value)) return result(null, 'no_root_in_bounds');
  let x = Math.max(lo, Math.min(hi, Math.log1p(guess)));
  for (let i = 0; i < newtonLimit; i++) {
    const current = evaluate(x);
    if (current.residual <= tolerance) return finish(x, 'newton', i);
    if (!current.derivative) break;
    const next = x - current.value / current.derivative;
    if (!Number.isFinite(next) || next <= lo || next >= hi || next === x) break;
    x = next;
  }
  let lowSign = Math.sign(low.value);
  for (let i = 1; i <= bisectLimit; i++) {
    x = (lo + hi) / 2;
    const current = evaluate(x);
    if (current.residual <= tolerance) return finish(x, 'bisection', i);
    if (Math.sign(current.value) === lowSign) lo = x;
    else hi = x;
  }
  return result(null, 'not_converged', { method: 'bisection', iterations: bisectLimit });
}
