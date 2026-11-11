import { evidence } from './evidence.js';
import { calculate, forwardNoi, normalizeInput } from './model.js';

/** Compare one explicit intervention against the base, at the same price/time/cap. */
export function valueUpScenario(input, intervention) {
  if (input?.intervention) throw new RangeError('Scenario comparison requires a base input without an existing intervention');
  if (!intervention) throw new TypeError('An explicit intervention is required');
  const a = normalizeInput(input);
  const afterAssumptions = normalizeInput({ ...a, intervention });
  const s = afterAssumptions.intervention;
  const stabilizationMonth = s.startMonth + s.downtimeMonths;
  const beforeResult = calculate(a), afterResult = calculate(afterAssumptions);
  const beforeNoi = forwardNoi(a, stabilizationMonth - 1);
  const afterNoi = forwardNoi(afterAssumptions, stabilizationMonth - 1);
  const inputs = { baseAssumptions: a, intervention: s, stabilizationMonth, valuationCapRate: a.exitCapRate };
  const e = (value, formula) => evidence(value, formula, inputs);
  const before = { noi: e(beforeNoi, 'sum(base NOI for 12 months starting at scenario stabilizationMonth)'),
    value: e(Math.max(0, beforeNoi / a.exitCapRate), 'max(0, baseStabilizedNOI / commonValuationCapRate)'),
    irr: beforeResult.metrics.leveredIrr };
  const after = { noi: e(afterNoi, 'sum(scenario NOI for 12 months starting at scenario stabilizationMonth)'),
    value: e(Math.max(0, afterNoi / a.exitCapRate), 'max(0, scenarioStabilizedNOI / commonValuationCapRate)'),
    irr: afterResult.metrics.leveredIrr };
  return { type: s.type, stabilizationMonth, before, after,
    delta: {
      noi: e(after.noi.value - before.noi.value, 'afterStabilizedNOI - beforeStabilizedNOI'),
      value: e(after.value.value - before.value.value, 'afterIncomeValue - beforeIncomeValue; gross before capex'),
      irr: e(before.irr.value === null || after.irr.value === null ? null : after.irr.value - before.irr.value,
        'afterLeveredIRR - beforeLeveredIRR; capex, downtime and deposit changes included'),
    },
    timeline: { startMonth: s.startMonth, downtimeMonths: s.downtimeMonths,
      completionMonth: stabilizationMonth, affectedShare: s.affectedShare,
      capex: e(s.capexKrw, 'intervention capex paid at startMonth') },
    beforeResult, afterResult,
    warning: '예시 데이터 · 실제 매물 아님. Leasing, construction and permitted use feasibility are UNKNOWN.',
  };
}
