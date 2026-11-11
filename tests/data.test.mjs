import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { generateData, serializeData } from '../scripts/generate-data.mjs';

const at = (path) => new URL(`../${path}`, import.meta.url);
const refs = JSON.parse(readFileSync(at('web-v2/data/market_refs.json'), 'utf8'));
const data = generateData(refs);
const files = serializeData(data);
const buildings = data.buildings.buildings;
const comps = data.comps.comps;
const districts = data.districts.districts;
const deep = data.deep;
const refRows = [...refs.districts.flatMap((d) => Object.values(d.metrics)), ...Object.values(refs.citywide), ...refs.unknowns];
const refById = new Map(refRows.map((r) => [r.id, r]));
const byBuilding = new Map(buildings.map((b) => [b.id, b]));
const byComp = new Map(comps.map((c) => [c.id, c]));
const byDistrict = new Map(districts.map((d) => [d.id, d]));
const sum = (rows, key) => rows.reduce((s, r) => s + r[key], 0);
const near = (a, b, tolerance = 1e-6) => assert.ok(Math.abs(a - b) <= tolerance, `${a} != ${b}`);
const inRange = (n, low, high) => assert.ok(Number.isFinite(n) && n >= low && n <= high, `${n} outside ${low}..${high}`);
const hash = (s) => createHash('sha256').update(s).digest('hex');

// Independent ray-crossing implementation; generator geometry helpers are not reused.
function inside(point, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat) &&
      point.lng < (b.lng - a.lng) * (point.lat - a.lat) / (b.lat - a.lat) + a.lng) hit = !hit;
  }
  return hit;
}

function numericEvidence(value, path = '') {
  if (Array.isArray(value)) return value.forEach((v, i) => numericEvidence(v, `${path}[${i}]`));
  if (!value || typeof value !== 'object') return;
  const numericKeys = Object.entries(value).filter(([, v]) => typeof v === 'number').map(([k]) => k);
  assert.deepEqual(Object.keys(value.provenance ?? {}).sort(), numericKeys.sort(), `${path}: exact numeric provenance coverage`);
  for (const key of numericKeys) {
    const p = value.provenance[key];
    assert.ok(Number.isFinite(value[key]), `${path}.${key}`);
    assert.ok(data.generation.fieldUnits[key], `${path}.${key}: missing unit definition`);
    assert.ok(['ref', 'derived', 'assumption'].includes(p.kind), `${path}.${key}`);
    assert.equal(p.confidence, 'low', `${path}.${key}: synthetic confidence`);
    const idKey = { ref: 'refId', derived: 'formulaId', assumption: 'assumptionId' }[p.kind];
    assert.deepEqual(Object.keys(p).sort(), ['kind', idKey, 'confidence'].sort());
    if (p.kind === 'ref') {
      assert.ok(refById.has(p.refId), p.refId);
      assert.notEqual(refById.get(p.refId).value, 'UNKNOWN');
    } else {
      const registry = p.kind === 'derived' ? data.generation.formulas : data.generation.assumptions;
      assert.ok(registry[p[idKey]]?.description, `${path}.${key}: unresolved ${p[idKey]}`);
    }
  }
  for (const [key, child] of Object.entries(value)) if (key !== 'provenance') numericEvidence(child, `${path}.${key}`);
}

test('generated data has the requested counts, ten districts, stable ids and complete deep coverage', () => {
  assert.equal(buildings.length, 400);
  assert.equal(comps.length, 150);
  assert.equal(deep.length, 25);
  assert.equal(districts.length, 10);
  assert.equal(byBuilding.size, 400);
  assert.equal(byComp.size, 150);
  assert.equal(new Set(deep.map((d) => d.buildingId)).size, 25);
  assert.equal(new Set(buildings.map((b) => b.nameKo)).size, 400);
  assert.deepEqual([...byDistrict.keys()].sort(), refs.districts.map((d) => d.id).sort());
  for (const d of districts) {
    assert.equal(buildings.filter((b) => b.districtId === d.id).length, 40);
    assert.equal(comps.filter((c) => c.districtId === d.id).length, 15);
    assert.ok(deep.some((detail) => byBuilding.get(detail.buildingId).districtId === d.id));
  }
  assert.deepEqual(buildings.filter((b) => b.deepPath).map((b) => b.id).sort(), deep.map((d) => d.buildingId).sort());
});

test('all files are labeled mock, numeric provenance resolves recursively, UNKNOWNs remain explicit', () => {
  for (const [path, text] of files) {
    const doc = JSON.parse(text);
    assert.equal(doc.schemaVersion, '1.0.0', path);
    assert.equal(doc.metadata.labelKo, '예시 데이터 · 실제 매물 아님', path);
    assert.equal(doc.metadata.verificationStatus, 'not_verified', path);
    assert.equal(doc.metadata.sourcesConsulted, false, path);
    numericEvidence(doc, path);
    assert.ok(!/(?:ownerName|tenantName|phone|email|https?:\/\/)/i.test(text), path);
  }
  assert.deepEqual(data.generation.unknownRefIds.sort(), refs.unknowns.map((r) => r.id).sort());
  assert.ok(data.generation.assumptions['a.basement']);
  assert.ok(data.generation.assumptions['a.exclusive']);
  assert.ok(data.generation.assumptions['a.opex']);
});

test('building summaries have complete schema, legal demo bounds and consistent operating accounts', () => {
  const statuses = new Set(), motivations = new Set(), neighborhoods = new Set();
  for (const b of buildings) {
    const ref = refs.districts.find((d) => d.id === b.districtId);
    assert.ok(ref && byDistrict.has(b.districtId));
    assert.ok(b.nameKo.includes('가상'));
    assert.ok(b.addressKo.startsWith(ref.nameKo), b.addressKo);
    assert.match(b.addressKo, /[1-9]xx 일대 \(가상 블록\)$/);
    assert.ok(ref.neighborhoods.includes(b.neighborhood));
    assert.ok(!/\d{2,}/.test(b.addressKo));
    for (const key of ['stationNameKo', 'zoningKo', 'sellerMotivationKo']) assert.ok(b[key]?.length > 0, `${b.id}.${key}`);
    assert.ok(['근린생활시설', '업무시설', '근린생활시설 / 업무시설'].includes(b.useKo));
    assert.ok(['매물', '협의중', '거래완료 참고'].includes(b.statusKo));
    inRange(b.askingPriceKrw, 3e9, 15e9);
    inRange(b.landAreaM2, 100, 500);
    inRange(b.floorsAbove, 2, 8);
    inRange(b.floorsBelow, 0, 1);
    inRange(b.builtYear, 1985, 2022);
    inRange(b.walkMinutes, 2, 18);
    inRange(b.daysOnMarket, 0, 540);
    inRange(b.occupancy, 0, 1);
    assert.ok(b.gfaM2 > b.landAreaM2 && b.exclusiveAreaM2 < b.gfaM2);
    assert.equal(b.gfaM2, Number(b.gfaM2.toFixed(2)), `${b.id}: stored GFA precision`);
    assert.equal(b.lat, Number(b.lat.toFixed(6)), `${b.id}: latitude precision`);
    assert.equal(b.lng, Number(b.lng.toFixed(6)), `${b.id}: longitude precision`);
    assert.ok(b.estimatedValueLowKrw > 0 && b.estimatedValueHighKrw > b.estimatedValueLowKrw);
    assert.ok(b.depositKrw > 0 && b.noiAnnualKrw > 0);
    assert.ok(b.potentialAnnualRentKrw >= b.annualRentKrw);
    near(b.noiAnnualKrw, b.annualRentKrw + b.annualMgmtKrw - b.annualOpexKrw);
    near(b.capRate, b.noiAnnualKrw / b.askingPriceKrw);
    assert.ok(inside(b, byDistrict.get(b.districtId).polygon), `${b.id}: outside gu`);
    statuses.add(b.statusKo); motivations.add(b.sellerMotivationKo); neighborhoods.add(b.neighborhood);
  }
  assert.equal(statuses.size, 3);
  assert.ok(motivations.size >= 4);
  for (const d of refs.districts) for (const n of d.neighborhoods) assert.ok(neighborhoods.has(n), n);
  assert.ok(buildings.some((b) => b.floorsAbove === 8));
  assert.ok(buildings.some((b) => b.floorsBelow === 1));
});

test('deep rent rolls reconcile areas, occupied income, expenses, deposits and summary NOI', () => {
  let vacancies = 0;
  for (const d of deep) {
    const b = byBuilding.get(d.buildingId);
    assert.ok(b && b.deepPath === `deep/${b.id}.json`);
    assert.equal(d.snapshotDate, '2026-11-12');
    assert.equal(b.useKo, [...new Set(d.rentRoll.map((u) => u.useKo))].sort().join(' / '), 'summary use agrees with detailed floor mix');
    assert.ok(d.rentRoll.length >= b.floorsAbove + b.floorsBelow);
    assert.equal(new Set(d.rentRoll.map((u) => u.unit)).size, d.rentRoll.length);
    const occupied = d.rentRoll.filter((u) => u.status === 'occupied');
    const vacant = d.rentRoll.filter((u) => u.status === 'vacant');
    vacancies += vacant.length;
    for (const u of d.rentRoll) {
      assert.ok(u.floor === 'B1' || /^[1-8]F$/.test(u.floor));
      assert.ok(u.useKo && u.tenantCategoryKo && ['low', 'medium', 'high'].includes(u.renewalRisk));
      assert.ok(u.areaM2 > 0);
      near(u.areaPyeong, u.areaM2 * 121 / 400);
      assert.ok(u.potentialMonthlyRentKrw > 0 && u.rentPerPyeongMonth > 0);
      near(u.potentialMonthlyRentKrw, Math.round(u.areaPyeong * u.rentPerPyeongMonth / 1000) * 1000);
      if (u.status === 'vacant') {
        assert.equal(u.depositKrw, 0); assert.equal(u.monthlyRentKrw, 0); assert.equal(u.mgmtFeeKrw, 0);
        assert.equal(u.leaseStart, null); assert.equal(u.leaseEnd, null);
      } else {
        assert.equal(u.status, 'occupied');
        assert.ok(u.leaseStart <= d.snapshotDate && u.leaseEnd > d.snapshotDate);
        assert.match(u.leaseStart, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(u.monthlyRentKrw, u.potentialMonthlyRentKrw);
        near(u.depositKrw, u.monthlyRentKrw * refs.citywide.depositToMonthlyRentMonths.demoDefault);
      }
    }
    near(sum(d.rentRoll, 'areaM2'), b.exclusiveAreaM2);
    near(sum(occupied, 'areaM2') / sum(d.rentRoll, 'areaM2'), b.occupancy);
    near(sum(d.rentRoll, 'monthlyRentKrw') * 12, b.annualRentKrw);
    near(sum(d.rentRoll, 'potentialMonthlyRentKrw') * 12, b.potentialAnnualRentKrw);
    near(sum(d.rentRoll, 'mgmtFeeKrw') * 12, b.annualMgmtKrw);
    near(sum(d.rentRoll, 'depositKrw'), b.depositKrw);
    assert.ok(d.opex.length >= 4);
    for (const cost of d.opex) assert.ok(cost.annualKrw > 0 && cost.labelKo);
    near(sum(d.opex, 'annualKrw'), b.annualOpexKrw);
    assert.ok(d.capexHistory.length >= 2);
    for (const c of d.capexHistory) {
      assert.ok(c.date >= `${b.builtYear}-01-01` && c.date < d.snapshotDate);
      assert.ok(c.costKrw > 0 && c.descriptionKo);
    }
    assert.ok(d.valueUpNotes.length >= 3);
    for (const note of d.valueUpNotes) {
      assert.ok(note.titleKo && note.descriptionKo && note.riskKo);
      assert.ok(note.budgetKrw > 0); inRange(note.downtimeMonths, 0, 12); inRange(note.rentUpliftRate, 0, 0.5);
    }
  }
  assert.ok(vacancies > 0, 'deep dataset includes vacancy scenes');
});

test('comps are fake district transactions with coherent unit prices and 5–8 nearby links per detail', () => {
  for (const c of comps) {
    inRange(c.priceKrw, 3e9, 15e9); inRange(c.landAreaM2, 100, 500);
    assert.ok(c.gfaM2 > c.landAreaM2);
    assert.ok(c.nameKo.includes('가상') && /[1-9]xx 일대 \(가상 블록\)$/.test(c.addressKo));
    assert.ok(c.transactionDate >= '2024-01-01' && c.transactionDate <= '2026-11-12');
    near(c.landPricePerPyeong, c.priceKrw / (c.landAreaM2 * 121 / 400));
    near(c.gfaPricePerPyeong, c.priceKrw / (c.gfaM2 * 121 / 400));
    assert.ok(inside(c, byDistrict.get(c.districtId).polygon));
  }
  for (const d of deep) {
    const b = byBuilding.get(d.buildingId);
    inRange(d.comps.length, 5, 8);
    assert.equal(new Set(d.comps.map((c) => c.compId)).size, d.comps.length);
    for (const link of d.comps) {
      const c = byComp.get(link.compId);
      assert.ok(c && c.districtId === b.districtId);
      // Independent equirectangular approximation is sufficient to catch wrong units/links.
      const dy = (b.lat - c.lat) * 111_195;
      const dx = (b.lng - c.lng) * 111_195 * Math.cos((b.lat + c.lat) / 2 * Math.PI / 180);
      near(link.distanceM, Math.round(Math.hypot(dx, dy)), 3);
      inRange(link.distanceM, 0, 5_000);
    }
  }
});

test('schematic geometry is SVG-ready, closed, varied and explicitly approximate', () => {
  for (const d of districts) {
    assert.ok(d.polygon.length >= 5);
    assert.deepEqual(d.polygon[0], d.polygon.at(-1));
    assert.equal(d.geometryKind, 'schematic_approximate_not_official');
    for (const point of d.polygon) { inRange(point.lat, 37.4, 37.7); inRange(point.lng, 126.8, 127.3); }
    assert.ok(new Set(buildings.filter((b) => b.districtId === d.id).map((b) => `${b.lat},${b.lng}`)).size >= 35);
  }
  assert.equal(data.districts.river.nameKo, '한강 (개략선)');
  assert.ok(data.districts.river.points.length >= 8);
  assert.ok(data.districts.projection.formula.includes('lng') && data.districts.projection.formula.includes('lat'));
});

test('fixed seed produces byte-identical, small UTF-8 files matching committed/generated disk output', () => {
  const again = serializeData(generateData(refs));
  const changed = serializeData(generateData(refs, { seed: 'another-demo-seed' }));
  assert.deepEqual([...files.keys()], [...again.keys()]);
  assert.notEqual(hash(files.get('buildings.json')), hash(changed.get('buildings.json')));
  for (const [path, text] of files) {
    assert.equal(text, again.get(path), `${path}: nondeterministic`);
    const bytes = Buffer.from(text, 'utf8');
    assert.ok(bytes.length < 1_000_000, `${path}: ${bytes.length} bytes`);
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(new TextDecoder('utf-8', { fatal: true }).decode(bytes), text);
    assert.ok(!text.includes('\ufffd'));
    assert.ok(existsSync(at(`web-v2/data/${path}`)), `${path}: generator CLI output missing`);
    assert.equal(readFileSync(at(`web-v2/data/${path}`), 'utf8'), text, `${path}: stale generated file`);
  }
});

test('generator rejects unusable references and preserves input objects', () => {
  const before = JSON.stringify(refs);
  generateData(refs, { seed: 'input-immutability-check' });
  assert.equal(JSON.stringify(refs), before);
  assert.throws(() => generateData(refs, { seed: '' }), /Seed/);
  const bad = structuredClone(refs);
  bad.districts[0].metrics.landPricePerPyeong.range.min = 'UNKNOWN';
  assert.throws(() => generateData(bad), /Invalid reference/);
  const impossible = structuredClone(refs);
  impossible.districts[0].metrics.landPricePerPyeong.range = { min: 1, max: 2 };
  assert.throws(() => generateData(impossible), /no feasible demo building/);
});
