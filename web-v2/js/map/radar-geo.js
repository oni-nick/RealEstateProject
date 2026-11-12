import { eok } from '../ui/format.js';

// Approximate illustrative centers, not verified parcel/district boundaries.
const CENTERS = Object.freeze({
  gangnam: [127.047, 37.505], seocho: [127.005, 37.49], songpa: [127.115, 37.505],
  mapo: [126.925, 37.555], seongdong: [127.04, 37.55], yongsan: [126.985, 37.535],
  jongno: [126.99, 37.585], jung: [126.998, 37.565],
  yeongdeungpo: [126.915, 37.525], gwangjin: [127.095, 37.55],
});

function hash(text) {
  let value = 2166136261;
  for (const char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return (value >>> 0) / 4294967296;
}

export function buildingCoordinates(building) {
  const { lng, lat } = building;
  // Reject malformed/global coordinates rather than placing them outside Seoul.
  if (Number.isFinite(lng) && Number.isFinite(lat) && lng >= 126.6 && lng <= 127.4 && lat >= 37.3 && lat <= 37.8) return [lng, lat];
  const center = CENTERS[building.districtId];
  if (!center || !building.id) return null;
  return [
    Number((center[0] + (hash(`${building.id}:lng`) - .5) * .024).toFixed(6)),
    Number((center[1] + (hash(`${building.id}:lat`) - .5) * .018).toFixed(6)),
  ];
}

export function scoreBand(score) {
  return !Number.isFinite(score) ? 'unknown' : score >= 80 ? 'high' : score >= 60 ? 'mid' : 'low';
}

/** Only matches enter the clustered source; context never changes its counts. */
export function radarGeoJSON(buildings, { matchingIds = new Set(buildings.map((b) => b.id)), rows = [] } = {}) {
  const scores = new Map(rows.map((r) => [r.building.id, r.score]));
  const matching = { type: 'FeatureCollection', features: [] };
  const context = { type: 'FeatureCollection', features: [] };
  for (const b of buildings) {
    const coordinates = buildingCoordinates(b);
    if (!coordinates) continue;
    const score = Number.isFinite(scores.get(b.id)) ? scores.get(b.id) : null;
    (matchingIds.has(b.id) ? matching : context).features.push({
      type: 'Feature', id: b.id, geometry: { type: 'Point', coordinates },
      properties: { buildingId: b.id, score, scoreLabel: score === null ? '—' : String(score),
        scoreBand: scoreBand(score), priceLabel: `${eok(b.askingPriceKrw)}억`, locationKind: 'synthetic' },
    });
  }
  return { matching, context };
}
