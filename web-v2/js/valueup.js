import { normalizeInput, valueUpScenario } from './engine/index.js';
import { evidence, number } from './engine/evidence.js';

export const VALUEUP_TYPES = ['lease-up', 'remodel', 'use-change'];

/** Deep notes are synthetic presets, never a construction quotation. */
export function valueUpDefaults(deep = null) {
  return Object.fromEntries(VALUEUP_TYPES.map((type) => {
    const note = deep?.valueUpNotes?.find((row) => row.intervention === type);
    return [type, { startMonth: 1, downtimeMonths: note?.downtimeMonths ?? (type === 'lease-up' ? 3 : 4),
      capexKrw: note?.budgetKrw ?? (type === 'lease-up' ? 30e6 : 150e6),
      rentUpliftRate: note?.rentUpliftRate ?? (type === 'lease-up' ? 0 : .15),
      affectedShare: .5, leaseUpFraction: 1 }];
  }));
}

/** One explicit plan, equal stabilization date/cap/financing, real monthly IRRs.
 * Physical works affect a share of potential rent, not a selected set of tenants.
 * New deposits stay zero; no unverified future funding benefit is invented. */
export function valueUpAnalysis(input, type, settings = {}) {
  if (type !== null && !VALUEUP_TYPES.includes(type)) throw new RangeError('Unknown value-up plan');
  const a = normalizeInput(input);
  const p = { ...valueUpDefaults()[type ?? 'lease-up'], ...settings };
  const fraction = number(p.leaseUpFraction, 'leaseUpFraction', 0, 1);
  const intervention = type === null ? { type: 'lease-up', targetVacancyRate: a.vacancyRate }
    : { type, startMonth: p.startMonth, downtimeMonths: p.downtimeMonths, capexKrw: p.capexKrw,
      rentUpliftRate: type === 'lease-up' ? 0 : p.rentUpliftRate,
      affectedShare: type === 'lease-up' ? 0 : p.affectedShare,
      targetVacancyRate: type === 'lease-up' ? a.vacancyRate * (1 - fraction) : a.vacancyRate,
      addedDepositsKrw: 0 };
  const result = valueUpScenario(a, intervention);
  const s = result.afterResult.assumptions.intervention;
  const cost = result.timeline.capex;
  const inputs = { baseAssumptions: a, intervention: s, sourceInputs: a.provenance };
  const loss = result.beforeResult.cashflow.reduce((sum, row, i) =>
    row.month >= s.startMonth && row.month < result.stabilizationMonth
      ? sum + row.noiKrw.value - result.afterResult.cashflow[i].noiKrw.value : sum, 0);
  return { ...result, type, timeline: type === null ? null : result.timeline,
    capex: cost,
    downtimeNoiLoss: evidence(loss, 'sum(base monthly NOI - scenario monthly NOI during downtime within holding period)', inputs),
    netValueAfterCapex: evidence(result.delta.value.value - cost.value,
      'gross stabilized income value delta - nominal intervention capex; not profit or discounted NPV', inputs),
  };
}

/** Shared zero-centred domain allows negative NOI and avoids all-zero NaNs. */
export function comparisonDomain(values) {
  const finite = values.filter(Number.isFinite);
  const min = Math.min(0, ...finite), max = Math.max(0, ...finite);
  const padding = Math.max(1, max - min) * .12;
  return { min: min - padding, max: max + padding };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
const floorNumber = (floor) => /^B\d+$/.test(floor) ? -Number(floor.slice(1)) : Number(floor.replace('F', ''));

/** Current roll only. Reference midpoint is an unverified screening convention;
 * independent flags retain expiry even when the rent is also below reference. */
export function rentRollHeat(rentRoll, snapshotDate, districtReference = null) {
  const snapshot = validDate(snapshotDate);
  if (snapshot === null) throw new TypeError('A valid synthetic snapshot date is required');
  const date = new Date(snapshot), nextYear = date.getUTCFullYear() + 1;
  const day = Math.min(date.getUTCDate(), new Date(Date.UTC(nextYear, date.getUTCMonth() + 1, 0)).getUTCDate());
  const expiryLimit = Date.UTC(nextYear, date.getUTCMonth(), day);
  const floors = new Map();
  for (const unit of rentRoll) {
    const vacant = unit.status === 'vacant';
    const ref = unit.floor === '1F' ? districtReference?.metrics?.retail1fRentPerPyeongMonth
      : /^\d+F$/.test(unit.floor) && floorNumber(unit.floor) >= 2 ? districtReference?.metrics?.upperFloorRentPerPyeongMonth : null;
    const referenceRentKrw = Number.isFinite(ref?.range?.min) && Number.isFinite(ref?.range?.max)
      && ref.range.min > 0 && ref.range.max >= ref.range.min ? (ref.range.min + ref.range.max) / 2 : null;
    const rentPerPyeongKrw = Number.isFinite(unit.monthlyRentKrw) && unit.monthlyRentKrw >= 0
      && Number.isFinite(unit.areaPyeong) && unit.areaPyeong > 0 ? unit.monthlyRentKrw / unit.areaPyeong : null;
    const expiry = validDate(unit.leaseEnd);
    const flags = { ...unit, vacant, referenceRentKrw, rentPerPyeongKrw,
      belowMarket: vacant ? false : referenceRentKrw === null || rentPerPyeongKrw === null ? null : rentPerPyeongKrw < referenceRentKrw * .9,
      expiring: !vacant && expiry !== null && expiry <= expiryLimit,
      overdue: !vacant && expiry !== null && expiry <= snapshot,
      expiryUnknown: !vacant && expiry === null,
      referenceEvidence: evidence(referenceRentKrw, '(district reference minimum + maximum) / 2; below-reference flag if occupied rent per exclusive pyeong < midpoint * 0.9',
        { unit: unit.unit, snapshotDate, monthlyRentKrw: unit.monthlyRentKrw, areaPyeong: unit.areaPyeong, reference: ref ?? 'UNKNOWN', source: unit.provenance }) };
    if (!floors.has(unit.floor)) floors.set(unit.floor, { floor: unit.floor, units: [] });
    floors.get(unit.floor).units.push(flags);
  }
  return [...floors.values()].sort((a, b) => floorNumber(b.floor) - floorNumber(a.floor));
}
