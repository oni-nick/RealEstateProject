import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const at = (path) => new URL(`../${path}`, import.meta.url);
const jsonBytes = readFileSync(at('web-v2/data/market_refs.json'));
const refs = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(jsonBytes));
const docs = readFileSync(at('docs/data-sources.md'), 'utf8');
const districtRows = refs.districts.flatMap((district) => Object.values(district.metrics));
const rows = [...districtRows, ...Object.values(refs.citywide), ...refs.unknowns];
const expectedMetrics = {
  landPricePerPyeong: 'KRW/pyeong_land',
  gfaPricePerPyeong: 'KRW/pyeong_gfa',
  retail1fRentPerPyeongMonth: 'KRW/pyeong_exclusive/month',
  upperFloorRentPerPyeongMonth: 'KRW/pyeong_exclusive/month',
  vacancyRate: 'ratio',
  capRate: 'ratio/year',
};
const sourceById = new Map(refs.sources.map((source) => [source.id, source]));
const rowById = new Map(rows.map((row) => [row.id, row]));

test('reference artifacts are UTF-8 without BOM and remain below size limits', () => {
  assert.ok(jsonBytes.length < 200_000, 'JSON must be <200 KB');
  for (const path of ['web-v2/data/market_refs.json', 'docs/data-sources.md', 'web-v2/index.html']) {
    const bytes = readFileSync(at(path));
    assert.ok(bytes.length < 1_000_000, path);
    assert.notDeepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], path);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    assert.ok(!text.includes('\ufffd'), `${path}: replacement character`);
    assert.ok(!/\?{2,}/.test(text), `${path}: lossy character conversion`);
    assert.ok(text.includes('예시 데이터 · 실제 매물 아님'), `${path}: mock label`);
  }
});

test('all ten requested districts have six complete, dimensioned market bands', () => {
  const required = ['gangnam', 'seocho', 'songpa', 'mapo', 'seongdong', 'yongsan', 'jongno', 'jung', 'yeongdeungpo', 'gwangjin'];
  assert.ok(refs.districts.length >= 9);
  assert.deepEqual(refs.districts.map((district) => district.id).sort(), required.sort());
  assert.equal(new Set(refs.districts.map((district) => district.id)).size, refs.districts.length);
  for (const district of refs.districts) {
    assert.ok(/[가-힣]+구$/.test(district.nameKo));
    assert.ok(district.neighborhoods.length > 0);
    for (const name of district.neighborhoods) assert.ok(/[가-힣]/.test(name), district.id);
    assert.deepEqual(Object.keys(district.metrics).sort(), Object.keys(expectedMetrics).sort());
    for (const [key, unit] of Object.entries(expectedMetrics)) {
      const row = district.metrics[key];
      assert.equal(row.id, `${district.id}.${key}`);
      assert.equal(row.unit, unit);
      assert.equal(refs.metricDefinitions[key].unit, unit);
      assert.ok(row.range, row.id);
      assert.ok(row.range.min > 0, row.id);
      if (unit.startsWith('ratio')) assert.ok(row.range.max < 1, row.id);
    }
  }
});

test('every row has a unique id, bounded value, honest provenance and matching source names', () => {
  assert.equal(rows.length, 75);
  assert.equal(rowById.size, rows.length);
  for (const row of rows) {
    assert.ok(row.id && row.unit && row.notes, row.id);
    assert.equal(row.tag, 'reference/approximate - verify', row.id);
    assert.equal(row.confidence, 'low', row.id);
    assert.equal(row.verificationStatus, 'not_verified', row.id);
    assert.equal(row.sourceRole, 'verification_candidates_only', row.id);
    assert.deepEqual(row.provenance, { kind: 'assumption', assumptionId: row.id, confidence: 'low' });
    assert.ok(row.sourceIds.length > 0, row.id);
    for (const id of row.sourceIds) assert.ok(sourceById.has(id), `${row.id}: ${id}`);
    assert.deepEqual(row.sourceNames, row.sourceIds.map((id) => sourceById.get(id).name));
    assert.notEqual(Object.hasOwn(row, 'value'), Object.hasOwn(row, 'range'), row.id);
    if (row.range) {
      const { min, max } = row.range;
      assert.ok(Number.isFinite(min) && Number.isFinite(max) && min <= max, row.id);
      if (row.demoDefault !== undefined) assert.ok(row.demoDefault >= min && row.demoDefault <= max, row.id);
    } else {
      assert.ok(row.value === 'UNKNOWN' || Number.isFinite(row.value), row.id);
    }
  }
});

test('unknowns and unconsulted source metadata never imply verified or current observations', () => {
  assert.equal(refs.metadata.sourcesConsulted, false);
  assert.equal(refs.metadata.observationsAsOf, 'UNKNOWN');
  assert.equal(refs.metadata.dataKind, 'synthetic_reference_assumptions');
  assert.equal(refs.schemaVersion, '1.0.0');
  assert.equal(sourceById.size, refs.sources.length);
  for (const source of refs.sources) {
    assert.ok(source.name && !source.name.includes('?'));
    assert.ok(docs.includes(source.name), source.id);
    assert.equal(source.status, 'candidate_not_consulted');
    for (const key of ['url', 'reportTitle', 'publicationDate', 'accessedAt']) assert.equal(source[key], 'UNKNOWN');
  }
  assert.equal(refs.unknowns.length, 7);
  for (const row of refs.unknowns) {
    assert.equal(row.value, 'UNKNOWN');
    assert.equal(row.demoDefault, undefined);
  }
  assert.ok(!JSON.stringify(refs).match(/https?:\/\//), 'No invented URLs');
});

test('district shared references resolve to the city financing and deposit assumptions', () => {
  const keys = ['loanInterestRate', 'typicalLtv', 'depositToMonthlyRentMonths'];
  const ids = keys.map((key) => refs.citywide[key].id);
  for (const district of refs.districts) {
    assert.deepEqual(district.sharedRefIds, ids);
    for (const id of district.sharedRefIds) assert.ok(rowById.has(id), id);
  }
  for (const key of ['loanInterestRate', 'typicalLtv', 'acquisitionBrokerageFeeRate', 'acquisitionMiscCostRate', 'loanOriginationFeeRate', 'saleBrokerageFeeRate']) {
    const row = refs.citywide[key];
    assert.ok(row.range.min >= 0 && row.range.max < 1, row.id);
  }
  assert.equal(refs.citywide.acquisitionTaxRate.value, 0.046);
  assert.equal(refs.citywide.loanOriginationFeeRate.unit, 'ratio_of_initial_loan');
  assert.equal(refs.citywide.depositToMonthlyRentMonths.unit, 'months_of_monthly_base_rent');
});

test('human-readable tables agree with every district band and shared assumption', () => {
  const format = (band, scale = 1) => band.map((n) => Number((n / scale).toFixed(4))).join('–');
  for (const district of refs.districts) {
    const bands = Object.keys(expectedMetrics).map((key, i) => {
      const { min, max } = district.metrics[key].range;
      return format([min, max], i < 4 ? 10_000 : 0.01);
    });
    assert.ok(docs.includes(`| ${district.id} · ${district.nameKo} | ${district.neighborhoods.join(', ')} | ${bands.join(' | ')} |`), district.id);
  }
  for (const row of Object.values(refs.citywide)) {
    const value = row.range ? format([row.range.min, row.range.max]) : row.value;
    assert.ok(docs.includes(`| ${row.id} | ${value} | ${row.unit} | ${row.demoDefault ?? row.value} | ${row.sourceIds.join(', ')} |`), row.id);
  }
  for (const row of refs.unknowns) assert.ok(docs.includes(`| ${row.id} | UNKNOWN | ${row.unit} |`), row.id);
});

test('documented funding example applies financing fees to debt and treats deposits as liabilities', () => {
  const purchasePrice = 10_000_000_000;
  const city = refs.citywide;
  const debt = purchasePrice * city.typicalLtv.demoDefault;
  const inheritedDeposit = 20_000_000 * city.depositToMonthlyRentMonths.demoDefault;
  const acquisitionCost = purchasePrice * (city.acquisitionTaxRate.value + city.acquisitionBrokerageFeeRate.demoDefault + city.acquisitionMiscCostRate.demoDefault);
  const loanFee = debt * city.loanOriginationFeeRate.demoDefault;
  const equity = purchasePrice + acquisitionCost + loanFee - debt - inheritedDeposit;
  assert.ok(Math.abs(equity - 5_365_000_000) < 0.01);
  assert.ok(docs.includes('53.65억원'));
  assert.ok(docs.includes('100 + 4.6 + 0.5 + 0.3 + 0.25 − 50 − 2 = 53.65억원'));
});

test('placeholder and tracked folder scaffolding use only local relative resources', () => {
  const html = readFileSync(at('web-v2/index.html'), 'utf8');
  assert.ok(html.includes('lang="ko"'));
  assert.ok(html.includes('href="./data/market_refs.json"'));
  assert.ok(!html.match(/https?:\/\/|<script\b/i));
  for (const path of ['web-v2/css/.gitkeep', 'web-v2/js/engine/.gitkeep', 'scripts/.gitkeep']) assert.ok(existsSync(at(path)), path);
});
