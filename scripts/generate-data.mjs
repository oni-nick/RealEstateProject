/** PLOT OS v2: deterministic, offline, fictional data. No observed property records. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DEFAULT_SEED = 'plot-os-v2-step02-20261112';
const SNAPSHOT = '2026-11-12';
const PYEONG = 121 / 400;
const LABEL = '예시 데이터 · 실제 매물 아님';

// Each number has an adjacent, exact per-field evidence map. Do not promote demo confidence.
const evidence = (kind, id) => ({ kind, [{ ref: 'refId', derived: 'formulaId', assumption: 'assumptionId' }[kind]]: id, confidence: 'low' });
const a = (id) => evidence('assumption', `a.${id}`);
const f = (id) => evidence('derived', `f.${id}`);
const ref = (row) => evidence('ref', row.id);
function numeric(text, values) {
  const out = { ...text, provenance: {} };
  for (const [key, [value, provenance]] of Object.entries(values)) {
    if (!Number.isFinite(value)) throw new Error(`Non-finite numeric field: ${key}`);
    out[key] = value;
    out.provenance[key] = provenance;
  }
  return out;
}

// FNV-1a string seed followed by Mulberry32. All arithmetic is explicitly uint32.
function randomFrom(seed) {
  let state = 2166136261;
  for (const char of seed) state = Math.imul(state ^ char.codePointAt(0), 16777619) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Divide by the integer scale for decimal grids: multiplying by 0.01/0.000001
// can serialize tails such as 399.90000000000003 and inflate all summary rows.
const round = (value, quantum = 1) => quantum < 1
  ? Math.round(value / quantum) / (1 / quantum)
  : Math.round(value / quantum) * quantum;
const sum = (rows, key) => rows.reduce((total, row) => total + row[key], 0);
const padded = (n, width = 3) => String(n).padStart(width, '0');
const date = (year, month, day = 1) => `${year}-${padded(month, 2)}-${padded(day, 2)}`;
function monthDate(offset) {
  const month = 2026 * 12 + 10 + offset;
  return date(Math.floor(month / 12), month % 12 + 1);
}

// Hand-drawn lng/lat sketches, not administrative GIS, parcel or neighborhood boundaries.
const OUTLINES = {
  gangnam: [[127.008,37.521],[127.03,37.537],[127.071,37.532],[127.099,37.516],[127.125,37.496],[127.08,37.47],[127.045,37.475],[127.02,37.49]],
  seocho: [[126.98,37.5],[127.008,37.521],[127.02,37.49],[127.045,37.475],[127.08,37.47],[127.06,37.445],[127.015,37.45],[126.985,37.47]],
  songpa: [[127.099,37.516],[127.11,37.53],[127.15,37.54],[127.17,37.51],[127.145,37.48],[127.125,37.496]],
  mapo: [[126.88,37.578],[126.9,37.593],[126.94,37.57],[126.972,37.553],[126.955,37.535],[126.92,37.547],[126.89,37.56]],
  seongdong: [[127.009,37.562],[127.04,37.573],[127.07,37.567],[127.071,37.545],[127.057,37.531],[127.023,37.54]],
  yongsan: [[126.955,37.535],[126.972,37.553],[126.995,37.552],[127.009,37.562],[127.023,37.54],[127.008,37.521],[126.98,37.52]],
  jongno: [[126.955,37.583],[126.97,37.61],[127.02,37.605],[127.023,37.576],[126.995,37.572],[126.97,37.575]],
  jung: [[126.972,37.553],[126.97,37.575],[126.995,37.572],[127.023,37.576],[127.04,37.573],[127.009,37.562],[126.995,37.552]],
  yeongdeungpo: [[126.89,37.56],[126.92,37.547],[126.955,37.535],[126.94,37.51],[126.91,37.49],[126.88,37.5],[126.885,37.53]],
  gwangjin: [[127.07,37.567],[127.1,37.575],[127.12,37.561],[127.11,37.53],[127.071,37.545]],
};
const RIVER = [[126.86,37.555],[126.9,37.545],[126.94,37.527],[126.98,37.512],[127.01,37.528],[127.04,37.533],[127.07,37.538],[127.10,37.521],[127.13,37.548],[127.17,37.56]];
const STATIONS = {
  gangnam: ['역삼역','학동역','신사역','청담역','삼성역'],
  seocho: ['서초역','내방역','양재역'], songpa: ['잠실역','문정역'],
  mapo: ['합정역','홍대입구역','홍대입구역','공덕역'], seongdong: ['성수역'],
  yongsan: ['한강진역','이태원역'], jongno: ['종로3가역'], jung: ['을지로3가역','명동역'],
  yeongdeungpo: ['여의도역','문래역'], gwangjin: ['건대입구역','자양역','구의역'],
};
function contains(lat, lng, polygon) {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i], [xj, yj] = polygon[j];
    if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
function distanceM(first, second) {
  const rad = Math.PI / 180;
  const dy = (second.lat - first.lat) * rad;
  const dx = (second.lng - first.lng) * rad;
  const hav = Math.sin(dy / 2) ** 2 + Math.cos(first.lat * rad) * Math.cos(second.lat * rad) * Math.sin(dx / 2) ** 2;
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(hav)));
}

const assumptions = Object.fromEntries(Object.entries({
  area: 'Synthetic land area, uniform integer 100–500 m². Floor coverage is independently 55–72% of land.',
  floors: 'Synthetic 3–8 above-ground floors; basement count is 0 or 1. Two fictional suites per floor.',
  year: 'Synthetic construction year 1985–2022 inclusive.',
  shape: 'Hand-drawn approximate gu outlines and Han river line; not official GIS or a geographic claim.',
  location: 'Seeded coordinate jitter within the central 30% bounding box of the schematic gu, rejection-tested inside. Does not locate the named neighborhood, station or any parcel.',
  walk: 'Illustrative station association and 2–18 minute walking time; no route measured.',
  dom: 'Illustrative days on market 0–540, including closed reference examples.',
  exclusive: 'Explicit building assumption: exclusive leasable area / GFA is sampled at 70–84%. Does not resolve unknown.exclusive_to_gfa_ratio.',
  basement: 'Explicit synthetic B1 rent = 60% of this building upper-floor rent draw. Not a district basement reference; unknown.basement_rent remains UNKNOWN.',
  vacant: 'Synthetic vacant suite selection from reference vacancy envelope, rounded to whole suites; minimum one vacant suite. Realized occupancy is area-weighted, not the reference draw.',
  mgmt: 'Occupied-suite fee = 6–10% of contracted base rent, rounded to KRW 1,000. Vacant suites collect zero. Recovery cost is included in opex.',
  opex: 'Synthetic owner expenses: 17–28% of potential annual rent plus 90% of collected management fees. Five allocations: property-tax budget 35%, insurance 8%, repairs 20%, operations 25%, other 12%. Not real tax/expense evidence; unknown.itemized_owner_opex remains UNKNOWN.',
  lease: 'Fictional dates: lease began 1–30 months before snapshot month, original term 36–60 months. No actual tenant contracts. Vacant start/end are null.',
  capex: 'Fictional historical work from max(construction year, 2018) through 2025, KRW 20–180 million per event. Excluded from recurring NOI.',
  valueup: 'Illustrative intervention budgets/downtime/rent uplift only, not executed work or quotes. Lease-up 10–30m/0 months/0%; remodel 120–450m/3–6 months/8–22%; use change 60–200m/2–4 months/5–15%. No computed IRR or value promise.',
  transaction: 'Entirely fictional comparable transaction date 2024 through snapshot, not a public transaction record.',
}).map(([key, description]) => [`a.${key}`, { description, confidence: 'low' }]));
const formulas = Object.fromEntries(Object.entries({
  area: 'GFA = landAreaM2 × synthetic floorCoverageRatio × (floorsAbove + floorsBelow); exclusiveAreaM2 = GFA × explicit synthetic exclusiveRatio; unit area = exclusiveArea / suite count.',
  ask: 'Seeded price sampled in intersection [KRW 3bn,15bn], district land-price band × land pyeong, and district GFA-price band × GFA pyeong, rounded to KRW 1m. No actual asking/transaction observation.',
  pyeong: 'areaPyeong = areaM2 × 121 / 400. No rounding before rent calculations.',
  rent: 'Potential monthly base rent = exclusive unit pyeong × floor rent draw, rounded to KRW 1,000; occupied contracted rent equals potential, vacant contracted rent is zero.',
  fee: 'Occupied management fee = monthlyRentKrw × synthetic mgmtRate, rounded to KRW 1,000; vacant fee zero.',
  deposit: 'Refundable deposit liability = contracted monthlyRentKrw × seoul.deposit_to_monthly_rent_months demoDefault. Vacant deposit zero; excluded from NOI.',
  sum: 'Summary aggregates: occupied monthly base rent × 12; potential monthly rent × 12; collected monthly management fee × 12; sum of deposit liabilities; sum of itemized annual opex.',
  occupancy: 'Sum occupied exclusive area / sum all exclusive area. No second vacancy deduction from contracted rent.',
  noi: 'Year-1 static annual NOI = occupied annual base rent + collected annual management fees − itemized owner annual opex. Before debt, income tax, capex; no deposit income.',
  cap: 'capRate = annual NOI / whole-property askingPriceKrw. Not sampled from target cap-rate band.',
  value: 'Illustrative income value low = NOI / district capRate.range.max; high = NOI / district capRate.range.min; rounded to KRW 1m. Reference cap envelope is unverified; not an appraisal.',
  unitprice: 'Same fictional transaction price / corresponding land or GFA area in pyeong (m² × 121 / 400).',
  distance: 'Haversine distance in metres between schematic building and comparable coordinates; Earth radius 6,371,000 m; rounded to nearest metre. Not walking distance.',
}).map(([key, description]) => [`f.${key}`, { description, confidence: 'low' }]));

function validateRefs(refs) {
  if (!refs || refs.schemaVersion !== '1.0.0' || !Array.isArray(refs.districts) || refs.districts.length !== 10) throw new Error('Expected ten step-1 reference districts');
  const seen = new Set();
  for (const d of refs.districts) {
    if (!OUTLINES[d.id] || seen.has(d.id) || !d.neighborhoods?.length) throw new Error(`Unknown/duplicate/empty district: ${d.id}`);
    seen.add(d.id);
    for (const metric of ['landPricePerPyeong','gfaPricePerPyeong','retail1fRentPerPyeongMonth','upperFloorRentPerPyeongMonth','vacancyRate','capRate']) {
      const r = d.metrics?.[metric];
      if (!r?.id || !Number.isFinite(r.range?.min) || !Number.isFinite(r.range?.max) || r.range.min <= 0 || r.range.min > r.range.max) throw new Error(`Invalid reference: ${d.id}.${metric}`);
    }
  }
  if (!Number.isFinite(refs.citywide?.depositToMonthlyRentMonths?.demoDefault) || refs.citywide.depositToMonthlyRentMonths.demoDefault <= 0) throw new Error('Missing explicit deposit-month demo default');
}

/** Pure generation: no clock, IO or input mutation. Seed changes values, not ids/coverage. */
export function generateData(refs, { seed = DEFAULT_SEED } = {}) {
  validateRefs(refs);
  if (typeof seed !== 'string' || !seed.length) throw new Error('Seed must be a non-empty string');
  const random = randomFrom(seed);
  const between = (min, max) => min + (max - min) * random();
  const integer = (min, max) => Math.floor(between(min, max + 1));
  const choose = (rows) => rows[integer(0, rows.length - 1)];
  const draw = (row) => between(row.range.min, row.range.max);
  const metadata = {
    labelKo: LABEL, dataKind: 'synthetic_example_only', seed, snapshotDate: SNAPSHOT,
    verificationStatus: 'not_verified', confidence: 'low', sourcesConsulted: false,
    referenceFile: 'market_refs.json',
    referenceSha256: createHash('sha256').update(JSON.stringify(refs)).digest('hex'),
    warningKo: '모든 건물·계약·거래는 가상 예시입니다. 실거래·감정평가·대출 또는 세무 자문이 아닙니다.',
  };
  const envelope = (body) => ({ schemaVersion: '1.0.0', metadata: { ...metadata }, ...body });
  const point = ([lng, lat]) => numeric({}, { lat: [lat, a('shape')], lng: [lng, a('shape')] });
  function location(districtId) {
    const polygon = OUTLINES[districtId];
    const lngs = polygon.map((p) => p[0]), lats = polygon.map((p) => p[1]);
    const centerLng = sum(polygon.map((p) => ({ value: p[0] })), 'value') / polygon.length;
    const centerLat = sum(polygon.map((p) => ({ value: p[1] })), 'value') / polygon.length;
    const width = Math.max(...lngs) - Math.min(...lngs), height = Math.max(...lats) - Math.min(...lats);
    for (let attempt = 0; attempt < 5000; attempt++) {
      const lat = round(centerLat + between(-0.15, 0.15) * height, 0.000001);
      const lng = round(centerLng + between(-0.15, 0.15) * width, 0.000001);
      if (contains(lat, lng, polygon)) return { lat, lng };
    }
    throw new Error(`Cannot place synthetic point: ${districtId}`);
  }
  function physical(d) {
    for (let attempt = 0; attempt < 5000; attempt++) {
      const landAreaM2 = integer(100, 500), floorsAbove = integer(3, 8), floorsBelow = random() < 0.65 ? 1 : 0;
      const coverageRatio = between(0.55, 0.72), exclusiveRatio = between(0.70, 0.84);
      const gfaM2 = round(landAreaM2 * coverageRatio * (floorsAbove + floorsBelow), 0.01);
      const landBand = d.metrics.landPricePerPyeong.range, gfaBand = d.metrics.gfaPricePerPyeong.range;
      // Whole million endpoints keep rounding inside all three independent bounds.
      const low = Math.ceil(Math.max(3e9, landAreaM2 * PYEONG * landBand.min, gfaM2 * PYEONG * gfaBand.min) / 1e6);
      const high = Math.floor(Math.min(15e9, landAreaM2 * PYEONG * landBand.max, gfaM2 * PYEONG * gfaBand.max) / 1e6);
      if (low <= high) return { landAreaM2, gfaM2, floorsAbove, floorsBelow, coverageRatio, exclusiveRatio, askingPriceKrw: integer(low, high) * 1e6, builtYear: integer(1985, 2022) };
    }
    throw new Error(`Reference bands have no feasible demo building: ${d.id}`);
  }
  const address = (d, n) => `${d.nameKo} ${n.replace(/ 일대$/, '')} ${integer(1, 9)}xx 일대 (가상 블록)`;
  const allBuildings = [], allComps = [], details = [];
  const status = ['매물','매물','매물','매물','협의중','거래완료 참고'];
  const motivations = ['자산 재편','유동성 확보','관리 부담 축소','보유 전략 변경','리모델링 전 매각'];

  for (const [districtIndex, d] of refs.districts.entries()) {
    for (let i = 0; i < 15; i++) {
      const p = physical(d), pos = location(d.id), n = d.neighborhoods[i % d.neighborhoods.length];
      const year = integer(2024, 2026), month = integer(1, year === 2026 ? 10 : 12);
      allComps.push(numeric({
        id: `cmp-${d.id}-${padded(i + 1)}`, districtId: d.id, neighborhood: n,
        nameKo: `가상 거래예시 ${d.nameKo} ${padded(i + 1)}`, addressKo: address(d, n),
        transactionDate: date(year, month, integer(1, 28)), useKo: '근린생활시설 / 업무시설',
        recordKind: 'fictional_transaction_not_public_record',
      }, {
        priceKrw: [p.askingPriceKrw, f('ask')], landAreaM2: [p.landAreaM2, a('area')], gfaM2: [p.gfaM2, f('area')],
        landPricePerPyeong: [p.askingPriceKrw / (p.landAreaM2 * PYEONG), f('unitprice')],
        gfaPricePerPyeong: [p.askingPriceKrw / (p.gfaM2 * PYEONG), f('unitprice')],
        lat: [pos.lat, a('location')], lng: [pos.lng, a('location')],
      }));
    }
    for (let i = 0; i < 40; i++) {
      const id = `bld-${d.id}-${padded(i + 1)}`, p = physical(d), pos = location(d.id);
      const neighborhoodIndex = i % d.neighborhoods.length, neighborhood = d.neighborhoods[neighborhoodIndex];
      const isDeep = i < (districtIndex < 5 ? 3 : 2);
      const exclusiveAreaM2 = p.gfaM2 * p.exclusiveRatio;
      const floors = [...(p.floorsBelow ? ['B1'] : []), ...Array.from({ length: p.floorsAbove }, (_, j) => `${j + 1}F`)];
      const suiteCount = floors.length * 2, suiteAreaM2 = exclusiveAreaM2 / suiteCount;
      const vacancyDraw = draw(d.metrics.vacancyRate), vacancyCount = Math.max(1, Math.round(suiteCount * vacancyDraw));
      // Fisher-Yates keeps vacancy selection deterministic without comparator randomness.
      const shuffled = Array.from({ length: suiteCount }, (_, j) => j);
      for (let j = shuffled.length - 1; j > 0; j--) { const k = integer(0, j); [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]; }
      const vacant = new Set(shuffled.slice(0, vacancyCount));
      const retailRent = draw(d.metrics.retail1fRentPerPyeongMonth), upperRent = draw(d.metrics.upperFloorRentPerPyeongMonth);
      const mgmtRate = between(0.06, 0.10), opexRatio = between(0.17, 0.28);
      const rentRoll = floors.flatMap((floor, floorIndex) => [0, 1].map((suiteIndex) => {
        const isVacant = vacant.has(floorIndex * 2 + suiteIndex), isRetail = floor === '1F', isBasement = floor === 'B1';
        const rentPerPyeongMonth = isRetail ? retailRent : isBasement ? upperRent * 0.6 : upperRent;
        const potentialMonthlyRentKrw = round(suiteAreaM2 * PYEONG * rentPerPyeongMonth, 1000);
        const monthlyRentKrw = isVacant ? 0 : potentialMonthlyRentKrw;
        const leaseAge = integer(1, 30), leaseTerm = integer(36, 60);
        return numeric({
          floor, unit: `${floor}-${suiteIndex ? 'B' : 'A'} (가상)`,
          useKo: isRetail || isBasement ? '근린생활시설' : choose(['근린생활시설','업무시설']),
          tenantCategoryKo: isVacant ? '공실 (예시)' : choose(isRetail ? ['F&B 프랜차이즈','소매 서비스','생활 편의점'] : ['의원','IT 스타트업','디자인 사무실','교육 서비스']),
          leaseStart: isVacant ? null : monthDate(-leaseAge), leaseEnd: isVacant ? null : monthDate(leaseTerm - leaseAge),
          status: isVacant ? 'vacant' : 'occupied', renewalRisk: choose(['low','medium','high']),
        }, {
          areaM2: [suiteAreaM2, f('area')], areaPyeong: [suiteAreaM2 * PYEONG, f('pyeong')],
          rentPerPyeongMonth: [rentPerPyeongMonth, isBasement ? a('basement') : ref(isRetail ? d.metrics.retail1fRentPerPyeongMonth : d.metrics.upperFloorRentPerPyeongMonth)],
          potentialMonthlyRentKrw: [potentialMonthlyRentKrw, f('rent')], monthlyRentKrw: [monthlyRentKrw, f('rent')],
          depositKrw: [monthlyRentKrw * refs.citywide.depositToMonthlyRentMonths.demoDefault, f('deposit')],
          mgmtFeeKrw: [isVacant ? 0 : round(monthlyRentKrw * mgmtRate, 1000), f('fee')],
        });
      }));
      const annualRentKrw = sum(rentRoll, 'monthlyRentKrw') * 12;
      const potentialAnnualRentKrw = sum(rentRoll, 'potentialMonthlyRentKrw') * 12;
      const annualMgmtKrw = sum(rentRoll, 'mgmtFeeKrw') * 12;
      const annualOpexKrw = Math.round(potentialAnnualRentKrw * opexRatio + annualMgmtKrw * 0.9);
      const noiAnnualKrw = annualRentKrw + annualMgmtKrw - annualOpexKrw;
      const occupancy = sum(rentRoll.filter((u) => u.status === 'occupied'), 'areaM2') / sum(rentRoll, 'areaM2');
      allBuildings.push(numeric({
        id, nameKo: `가상 ${d.nameKo} ${padded(i + 1)}`, districtId: d.id, neighborhood,
        addressKo: address(d, neighborhood), useKo: [...new Set(rentRoll.map((u) => u.useKo))].sort().join(' / '),
        zoningKo: choose(['제2종일반주거지역','제3종일반주거지역','준주거지역','일반상업지역']),
        stationNameKo: STATIONS[d.id][neighborhoodIndex], statusKo: choose(status), sellerMotivationKo: choose(motivations),
        deepPath: isDeep ? `deep/${id}.json` : null,
      }, {
        landAreaM2: [p.landAreaM2, a('area')], gfaM2: [p.gfaM2, f('area')], exclusiveAreaM2: [exclusiveAreaM2, f('area')],
        floorsAbove: [p.floorsAbove, a('floors')], floorsBelow: [p.floorsBelow, a('floors')], builtYear: [p.builtYear, a('year')],
        askingPriceKrw: [p.askingPriceKrw, f('ask')],
        estimatedValueLowKrw: [round(noiAnnualKrw / d.metrics.capRate.range.max, 1e6), f('value')],
        estimatedValueHighKrw: [round(noiAnnualKrw / d.metrics.capRate.range.min, 1e6), f('value')],
        capRate: [noiAnnualKrw / p.askingPriceKrw, f('cap')], occupancy: [occupancy, f('occupancy')], noiAnnualKrw: [noiAnnualKrw, f('noi')],
        annualRentKrw: [annualRentKrw, f('sum')], potentialAnnualRentKrw: [potentialAnnualRentKrw, f('sum')],
        annualMgmtKrw: [annualMgmtKrw, f('sum')], annualOpexKrw: [annualOpexKrw, f('sum')], depositKrw: [sum(rentRoll, 'depositKrw'), f('sum')],
        walkMinutes: [integer(2, 18), a('walk')], daysOnMarket: [integer(0, 540), a('dom')], lat: [pos.lat, a('location')], lng: [pos.lng, a('location')],
      }));
      if (isDeep) {
        let allocated = 0;
        const opex = [['재산세 등 보유비 예산',0.35],['보험료',0.08],['경상 수선비',0.20],['관리·운영비',0.25],['기타 소유주 부담',0.12]].map(([labelKo, share], j) => {
          const annualKrw = j === 4 ? annualOpexKrw - allocated : Math.round(annualOpexKrw * share);
          allocated += annualKrw;
          return numeric({ labelKo, treatment: 'owner_expense_in_noi', verificationStatus: 'synthetic_not_verified' }, { annualKrw: [annualKrw, a('opex')] });
        });
        const capexHistory = ['공용부·설비 보수 (가상 이력)','외벽·방수 정비 (가상 이력)'].map((descriptionKo) => numeric({
          date: date(integer(Math.max(p.builtYear, 2018), 2025), integer(1, 12)), descriptionKo, treatment: 'historical_capex_excluded_from_recurring_noi',
        }, { costKrw: [integer(20, 180) * 1e6, a('capex')] })).sort((x, y) => x.date.localeCompare(y.date, 'en'));
        const notes = [
          ['lease-up','공실 임대 정상화','빈 호실의 예시 시장 임대료로 임대하는 시나리오. 기존 임대료를 다시 공실 차감하지 않습니다.','실제 수요·인센티브·임차인 유치 기간 확인 필요',integer(10,30)*1e6,0,0],
          ['remodel','공용부 리모델링','공사비와 임대 중단 기간을 함께 반영할 후속 계산 입력입니다.','공사 견적·퇴거 협의·추가 수선비 확인 필요',integer(120,450)*1e6,integer(3,6),between(0.08,0.22)],
          ['use-change','상층부 용도 전환 검토','임차 수요에 맞춘 공간 재편의 가상 입력입니다.','용도지역·건축·소방·인허가 적합성 미확인',integer(60,200)*1e6,integer(2,4),between(0.05,0.15)],
        ];
        details.push(envelope({
          buildingId: id, snapshotDate: SNAPSHOT, rentRoll, opex, capexHistory,
          assumptions: numeric({ unknownPolicy: 'Reference UNKNOWNs remain unresolved; these are separate explicit building-level demo assumptions.' }, {
            floorCoverageRatio: [p.coverageRatio, a('area')], exclusiveRatio: [p.exclusiveRatio, a('exclusive')],
            managementFeeRate: [mgmtRate, a('mgmt')], opexRatio: [opexRatio, a('opex')], vacancyDraw: [vacancyDraw, ref(d.metrics.vacancyRate)],
            depositMonths: [refs.citywide.depositToMonthlyRentMonths.demoDefault, ref(refs.citywide.depositToMonthlyRentMonths)],
          }),
          comps: [], valueUpNotes: notes.map(([intervention, titleKo, descriptionKo, riskKo, budgetKrw, downtimeMonths, rentUpliftRate]) => numeric({ intervention, titleKo, descriptionKo, riskKo }, {
            budgetKrw: [budgetKrw, a('valueup')], downtimeMonths: [downtimeMonths, a('valueup')], rentUpliftRate: [rentUpliftRate, a('valueup')],
          })),
        }));
      }
    }
  }
  for (const detail of details) {
    const building = allBuildings.find((b) => b.id === detail.buildingId);
    detail.comps = allComps.filter((c) => c.districtId === building.districtId)
      .map((c) => numeric({ compId: c.id }, { distanceM: [distanceM(building, c), f('distance')] }))
      .sort((x, y) => x.distanceM - y.distanceM || x.compId.localeCompare(y.compId, 'en')).slice(0, integer(5, 8));
  }
  return {
    generation: envelope({
      numericConvention: 'Every numeric field is a plain finite number with a same-key provenance entry on its containing object. Arrays contain records, never bare numeric coordinates. All generated confidence is low.',
      refPolicy: 'A ref means a synthetic draw/default from an unverified reference envelope, not a verified observation. Formula reference ids resolve via referenceDependencies; assumption/formula ids resolve here.',
      assumptions, formulas,
      referenceDependencies: Object.fromEntries(refs.districts.map((d) => [d.id, Object.fromEntries(Object.entries(d.metrics).map(([key, row]) => [key, row.id]))])),
      sharedRefIds: Object.fromEntries(Object.entries(refs.citywide).map(([key, row]) => [key, row.id])),
      unknownRefIds: refs.unknowns.map((r) => r.id),
      fieldUnits: {
        landAreaM2: 'm2_land', gfaM2: 'm2_gfa_including_basement', exclusiveAreaM2: 'm2_exclusive', areaM2: 'm2_exclusive', areaPyeong: 'pyeong_exclusive',
        askingPriceKrw: 'KRW', priceKrw: 'KRW', estimatedValueLowKrw: 'KRW', estimatedValueHighKrw: 'KRW',
        depositKrw: 'KRW_refundable_liability', monthlyRentKrw: 'KRW/month', potentialMonthlyRentKrw: 'KRW/month', mgmtFeeKrw: 'KRW/month',
        rentPerPyeongMonth: 'KRW/pyeong_exclusive/month', landPricePerPyeong: 'KRW/pyeong_land', gfaPricePerPyeong: 'KRW/pyeong_gfa',
        annualRentKrw: 'KRW/year', potentialAnnualRentKrw: 'KRW/year', annualMgmtKrw: 'KRW/year', annualOpexKrw: 'KRW/year', noiAnnualKrw: 'KRW/year', annualKrw: 'KRW/year',
        costKrw: 'KRW', budgetKrw: 'KRW', capRate: 'ratio/year', occupancy: 'ratio_area', vacancyDraw: 'ratio_area',
        floorsAbove: 'floors', floorsBelow: 'floors', builtYear: 'year', walkMinutes: 'minutes_assumed', daysOnMarket: 'days_assumed',
        lat: 'degrees_latitude', lng: 'degrees_longitude', distanceM: 'metres_schematic', depositMonths: 'months_of_monthly_base_rent',
        floorCoverageRatio: 'ratio', exclusiveRatio: 'ratio', managementFeeRate: 'ratio', opexRatio: 'ratio', rentUpliftRate: 'ratio', downtimeMonths: 'months',
      },
      files: { buildings: 'buildings.json', comps: 'comps.json', districts: 'districts.json', deep: details.map((d) => `deep/${d.buildingId}.json`) },
      accountingNotes: [
        'Snapshot occupied rent is annualized without further vacancy deductions. Potential rent is separate; physical area vacancy is not revenue loss.',
        'Deposits are refundable liabilities. They reduce funding needs only when inherited and must be settled at exit; never included in NOI.',
        'Management fees are modeled gross with operating recovery expenses in opex. VAT, income/exit taxes, lender underwriting and actual expenses remain unverified.',
        'Historical capex is excluded from recurring NOI. Value-up inputs are unexecuted scenarios; their timing/IRR belongs to the future engine.',
        'Income value bands are unverified cap-envelope illustrations; derived cap rates may lie outside the reference cap envelope.',
      ],
    }),
    buildings: envelope({ buildings: allBuildings }), comps: envelope({ comps: allComps }),
    districts: envelope({
      geometryNoteKo: '선택한 10개 구와 한강의 개략도입니다. 공식 행정경계·동별 위치·필지·도보 경로가 아닙니다.',
      projection: { coordinateOrder: 'named lng/lat properties (no ambiguous numeric tuples)', formula: 'x = (lng - west) / (east - west) * width; y = (north - lat) / (north - south) * height; derive extent from all polygon/river points; use uniform scaling for aspect preservation.' },
      districts: refs.districts.map((d) => ({ id: d.id, nameKo: d.nameKo, geometryKind: 'schematic_approximate_not_official', polygon: [...OUTLINES[d.id], OUTLINES[d.id][0]].map(point) })),
      river: { nameKo: '한강 (개략선)', geometryKind: 'schematic_approximate_not_official', points: RIVER.map(point) },
    }),
    deep: details,
  };
}

/** Validate the entire byte budget before the CLI writes any output. Stable insertion order. */
export function serializeData(data) {
  const files = new Map([
    ['generation.json', data.generation], ['buildings.json', data.buildings],
    ['comps.json', data.comps], ['districts.json', data.districts],
    ...data.deep.map((detail) => [`deep/${detail.buildingId}.json`, detail]),
  ]);
  for (const [path, doc] of files) {
    if (!/^(?:[a-z-]+\.json|deep\/bld-[a-z]+-\d{3}\.json)$/.test(path)) throw new Error(`Unsafe generated path: ${path}`);
    const text = `${JSON.stringify(doc)}\n`;
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes >= 1_000_000) throw new Error(`${path}: ${bytes} bytes exceeds per-file limit; split the data before writing`);
    files.set(path, text);
  }
  return files;
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const root = new URL('../web-v2/data/', import.meta.url);
  const refs = JSON.parse(readFileSync(new URL('market_refs.json', root), 'utf8'));
  const data = generateData(refs), files = serializeData(data);
  mkdirSync(new URL('deep/', root), { recursive: true });
  for (const [path, text] of files) writeFileSync(new URL(path, root), text, 'utf8');
  const prices = data.buildings.buildings.map((b) => b.askingPriceKrw);
  console.log(JSON.stringify({
    seed: DEFAULT_SEED, buildings: prices.length, deep: data.deep.length, comps: data.comps.comps.length,
    districts: data.districts.districts.length, minPriceEok: Math.min(...prices) / 1e8, maxPriceEok: Math.max(...prices) / 1e8,
    files: [...files].map(([path, text]) => ({ path, bytes: Buffer.byteLength(text, 'utf8') })),
  }, null, 2));
}
