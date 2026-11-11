/** Calculation evidence is a trace of demo assumptions, never verified market data. */
export const ENGINE_VERSION = 'plot-os-v2-engine-1.0.0';
export const LABEL_KO = '예시 데이터 · 실제 매물 아님';

export function evidence(value, formula, inputs = {}, extra = {}) {
  return {
    value, formula, inputs,
    provenance: {
      kind: 'derived', formulaId: `engine.${formula}`, engineVersion: ENGINE_VERSION,
      confidence: 'low', verificationStatus: 'not_verified', needsVerification: true,
      ...extra,
    },
  };
}

export function number(value, name, min = -Infinity, max = Infinity) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a finite number in [${min}, ${max}]; UNKNOWN is not zero`);
  }
  return value;
}

export const sum = (values) => values.reduce((total, value) => total + value, 0);
