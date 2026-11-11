import { number, sum } from './evidence.js';
import { normalizeInput } from './model.js';

/**
 * Convert the Step 2 mock schema. Vacancy is RENT-weighted, not area-weighted:
 * 1 - contractedRent / potentialRent. Collected rent is never reduced twice.
 * Management fees are grossed up by the same rent collection share, explicitly
 * an assumption for projecting unoccupied space, not a new verified rent roll.
 */
export function inputFromBuilding(building, deep = null, overrides = {}) {
  if (!building || typeof building !== 'object') throw new TypeError('A mock building summary is required');
  if (deep && deep.buildingId !== building.id) throw new RangeError('Deep record does not match building id');
  const read = (object, field) => number(object[field], field, 0);
  let potential, collected, mgmt, opex, deposits;
  if (deep) {
    if (!Array.isArray(deep.rentRoll) || !deep.rentRoll.length || !Array.isArray(deep.opex)) throw new TypeError('Deep rent roll and opex arrays are required');
    potential = sum(deep.rentRoll.map((u) => read(u, 'potentialMonthlyRentKrw')));
    collected = sum(deep.rentRoll.map((u) => read(u, 'monthlyRentKrw')));
    mgmt = sum(deep.rentRoll.map((u) => read(u, 'mgmtFeeKrw')));
    deposits = sum(deep.rentRoll.map((u) => read(u, 'depositKrw')));
    opex = sum(deep.opex.map((item) => read(item, 'annualKrw'))) / 12;
  } else {
    potential = read(building, 'potentialAnnualRentKrw') / 12;
    collected = read(building, 'annualRentKrw') / 12;
    mgmt = read(building, 'annualMgmtKrw') / 12;
    opex = read(building, 'annualOpexKrw') / 12;
    deposits = read(building, 'depositKrw');
  }
  if (collected > potential) throw new RangeError('Collected rent exceeds potential rent; cannot infer vacancy');
  if (!collected && mgmt) throw new RangeError('Management income with zero collected rent requires an explicit potential management-income assumption');
  const collectionShare = potential ? collected / potential : 0;
  const source = {
    buildingId: building.id, summary: building.provenance,
    rentRoll: deep?.rentRoll.map((unit) => unit.provenance) ?? null,
    opex: deep?.opex.map((item) => item.provenance) ?? null,
  };
  return normalizeInput({
    purchasePriceKrw: read(building, 'askingPriceKrw'),
    monthlyPotentialRentKrw: potential, monthlyOpexKrw: opex,
    monthlyPotentialMgmtIncomeKrw: collectionShare ? mgmt / collectionShare : 0,
    vacancyRate: 1 - collectionShare, depositsKrw: deposits,
    ...overrides,
    provenance: { source, vacancyRate: { kind: 'derived', formulaId: '1 - contractedRent / potentialRent', confidence: 'low' },
      monthlyPotentialMgmtIncomeKrw: { kind: 'assumption', assumptionId: 'engine.mgmt_uses_rent_weighted_occupancy', confidence: 'low' },
      overrides: Object.keys(overrides), ...overrides.provenance },
  });
}
