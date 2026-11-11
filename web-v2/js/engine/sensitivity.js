import { evidence, number } from './evidence.js';
import { normalizeInput, project } from './model.js';
import { irr } from './irr.js';
import { maxPurchasePrice } from './pricing.js';

const FIELDS = new Set(['annualInterestRate', 'vacancyRate', 'annualRentGrowth', 'exitCapRate', 'initialCapexKrw']);
function axis(field, values) {
  if (!FIELDS.has(field)) throw new RangeError(`Unsupported sensitivity field: ${field}`);
  if (!Array.isArray(values) || !values.length || values.length > 21) throw new RangeError('Sensitivity axis requires 1..21 values');
  values.forEach((value) => number(value, field));
}
function point(input, overrides, pricingOptions) {
  const a = normalizeInput({ ...input, ...overrides }), p = project(a);
  const rate = p.equityKrw > 0 ? irr(p.levered, { periodsPerYear: 12 })
    : { ...evidence(null, 'IRR requires positive equity', { assumptions: a }), status: 'invalid_equity' };
  return { irr: { ...rate, inputs: { ...rate.inputs, assumptions: a } }, maxPrice: maxPurchasePrice(a, pricingOptions).maxPrice };
}

/** Each endpoint changes one input; signed changes and absolute swing are explicit. */
export function tornado(input, options = {}) {
  const a = normalizeInput(input), base = point(a, {}, options.pricing);
  const ranges = options.ranges ?? {
    annualInterestRate: [Math.max(0, a.annualInterestRate - 0.01), Math.min(1, a.annualInterestRate + 0.01)],
    vacancyRate: [Math.max(0, a.vacancyRate - 0.05), Math.min(1, a.vacancyRate + 0.05)],
    annualRentGrowth: [Math.max(-0.99, a.annualRentGrowth - 0.01), Math.min(1, a.annualRentGrowth + 0.01)],
    exitCapRate: [Math.max(1e-6, a.exitCapRate - 0.005), Math.min(1, a.exitCapRate + 0.005)],
    initialCapexKrw: [Math.max(0, a.initialCapexKrw - a.purchasePriceKrw * 0.02), a.initialCapexKrw + a.purchasePriceKrw * 0.02],
  };
  const rows = Object.entries(ranges).map(([field, values]) => {
    axis(field, values);
    if (values.length !== 2 || values[0] > values[1]) throw new RangeError('Tornado ranges require ordered [low, high] endpoints');
    const low = point(a, { [field]: values[0] }, options.pricing);
    const high = point(a, { [field]: values[1] }, options.pricing);
    const exact = (entry) => entry.value !== null && entry.status === 'ok';
    const delta = (p, metric) => !exact(p[metric]) || !exact(base[metric]) ? null : p[metric].value - base[metric].value;
    const swing = (metric) => !exact(low[metric]) || !exact(high[metric]) ? null : Math.abs(high[metric].value - low[metric].value);
    return { field, lowInput: values[0], highInput: values[1], low, high,
      lowIrrDelta: evidence(delta(low, 'irr'), 'lowEndpointIRR - baseIRR', { field, base: base.irr, endpoint: low.irr }),
      highIrrDelta: evidence(delta(high, 'irr'), 'highEndpointIRR - baseIRR', { field, base: base.irr, endpoint: high.irr }),
      irrSwing: evidence(swing('irr'), 'abs(highEndpointIRR - lowEndpointIRR)', { field, low: low.irr, high: high.irr }),
      maxPriceSwing: evidence(swing('maxPrice'), 'abs(highEndpointMaxPrice - lowEndpointMaxPrice)', { field, low: low.maxPrice, high: high.maxPrice }),
    };
  });
  rows.sort((left, right) => (right.irrSwing.value ?? -1) - (left.irrSwing.value ?? -1));
  return { base, rows };
}

/** rows correspond to yValues, columns to xValues; no hidden grid interpolation. */
export function sensitivityGrid(input, options = {}) {
  const { xField = 'annualInterestRate', xValues = [0.04, 0.05, 0.06],
    yField = 'exitCapRate', yValues = [0.04, 0.045, 0.05] } = options;
  axis(xField, xValues); axis(yField, yValues);
  if (xField === yField) throw new RangeError('Grid axes must use different fields');
  const a = normalizeInput(input);
  return { xField, xValues: [...xValues], yField, yValues: [...yValues],
    cells: yValues.map((y) => xValues.map((x) => point(a, { [xField]: x, [yField]: y }, options.pricing))) };
}
