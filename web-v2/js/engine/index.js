/** Pure, zero-dependency browser/Node ES module public API. See docs/context/step03-engine-contract.md. */
export { ENGINE_VERSION, LABEL_KO } from './evidence.js';
export { irr, npv } from './irr.js';
export { DEFAULTS, calculate, normalizeInput } from './model.js';
export { inputFromBuilding } from './adapters.js';
export { maxPurchasePrice } from './pricing.js';
export { tornado, sensitivityGrid } from './sensitivity.js';
export { valueUpScenario } from './scenarios.js';
