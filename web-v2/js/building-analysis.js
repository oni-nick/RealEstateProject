/** Snapshot dates, not the computer clock, anchor every lease-expiry bucket. */
function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
}
function anniversary(time, years) {
  const d = new Date(time), year = d.getUTCFullYear() + years, month = d.getUTCMonth();
  const day = Math.min(d.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return Date.UTC(year, month, day);
}

/** Exposure waterfall: remove expiring contracted monthly rent without renewal.
 * Unknown expiries stay in the remaining balance and are explicitly disclosed.
 * Vacant units carry no contracted rent and do not enter the waterfall. */
export function leaseExpiry(rentRoll, snapshotDate) {
  const snapshot = parseDate(snapshotDate);
  if (snapshot === null) throw new TypeError('A valid synthetic snapshot date is required');
  const boundaries = [snapshot, ...Array.from({ length: 5 }, (_, i) => anniversary(snapshot, i + 1))];
  const buckets = boundaries.map((end, i) => ({ label: i ? `${i}년 이내` : '기경과', through: new Date(end).toISOString().slice(0, 10), amountKrw: 0, count: 0 }));
  let totalKrw = 0, unknownKrw = 0;
  for (const unit of rentRoll) {
    if (unit.status !== 'occupied') continue;
    const rent = unit.monthlyRentKrw;
    if (!Number.isFinite(rent) || rent < 0) throw new TypeError('Occupied rent must be finite and non-negative');
    totalKrw += rent;
    const expiry = parseDate(unit.leaseEnd);
    if (expiry === null) { unknownKrw += rent; continue; }
    const index = boundaries.findIndex((end) => expiry <= end);
    if (index !== -1) { buckets[index].amountKrw += rent; buckets[index].count++; }
  }
  let remainingKrw = totalKrw;
  for (const bucket of buckets) {
    bucket.startKrw = remainingKrw;
    remainingKrw -= bucket.amountKrw;
    bucket.endKrw = remainingKrw;
  }
  return { totalKrw, buckets, remainingKrw, unknownKrw, snapshotDate };
}

function distanceM(a, b) {
  const rad = Math.PI / 180;
  const lat = (a.lat + b.lat) / 2 * rad;
  return Math.round(6371000 * Math.hypot((a.lat - b.lat) * rad, (a.lng - b.lng) * rad * Math.cos(lat)));
}
/** Deep records use the curated fictional links; summary-only records use six
 * nearest same-district synthetic records, with explicitly schematic distance. */
export function selectComps(building, deep, comps) {
  if (deep) {
    const byId = new Map(comps.map((c) => [c.id, c]));
    return (deep.comps ?? []).filter((link) => byId.has(link.compId))
      .map((link) => ({ ...byId.get(link.compId), distanceM: link.distanceM }));
  }
  return comps.filter((c) => c.districtId === building.districtId)
    .map((c) => ({ ...c, distanceM: distanceM(building, c) }))
    .sort((a, b) => a.distanceM - b.distanceM || a.id.localeCompare(b.id)).slice(0, 6);
}
