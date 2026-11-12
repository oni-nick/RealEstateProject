import { DEFAULT_FILTERS, filterBuildings, updateFilters } from './store.js';
import { calculate, inputFromBuilding } from './engine/index.js';
import { h, badge, button, emptyState, evidenceNumber, kpiCard, linkButton, table } from './ui/components.js';
import { createRadarMap } from './map/radar-map.js';
import { eok, manwon, number, percent } from './ui/format.js';
import { selectComps } from './building-analysis.js';
import { leaseWaterfall } from './ui/lease-waterfall.js';
import { buildingPhoto, buildingGallery } from './ui/photo.js';
import { sceneNav } from './ui/scene-nav.js';

const buildingHref = (b) => `#/building/${b.id}`;
const heading = (eyebrow, title, description, actions) => h('div', { className: 'page-heading' }, h('div', {}, h('div', { className: 'eyebrow' }, eyebrow), h('h1', {}, title), h('p', {}, description)), actions);
const section = (title, body, detail) => h('section', { className: 'card section-card' }, h('div', { className: 'section-heading' }, h('h2', {}, title), detail && h('small', {}, detail)), body);
const resetFilters = () => updateFilters(DEFAULT_FILTERS);
export function homeView(context) {
  const { data } = context;
  const map = createRadarMap({ geography: data.geography, buildings: data.buildings, onOpen: (id) => { location.hash = `#/building/${id}`; } });
  map.update({ matchingIds: new Set(filterBuildings(data.buildings, DEFAULT_FILTERS).map((b) => b.id)) });
  const deepCount = data.buildings.filter((b) => b.deepPath).length;
  const values = [
    ['01', '가능성이 있는 딜부터', '지역·가격·접근성을 좁혀 후보를 찾으세요. 지도와 매물 목록이 같은 조건으로 움직입니다.', '후보 탐색하기', '#/radar'],
    ['02', '숫자의 이유까지', '호가와 NOI, 수익률을 하나의 흐름으로 살펴보세요. 점선 수치를 누르면 계산과 가정을 확인할 수 있습니다.', '가상 건물 살펴보기', buildingHref(data.buildings.find((b) => b.deepPath))],
    ['03', '고객과 같은 화면에서', '선택한 건물의 핵심 수치와 검증할 항목을 요약해, 다음 대화의 출발점으로 사용하세요.', '요약 제안서 보기', '#/proposal'],
  ];
  const element = h('div', { className: 'landing' }, h('section', { className: 'hero' },
    h('div', { className: 'hero-copy' }, h('div', { className: 'eyebrow' }, '워크스페이스 / 서울 상업용 부동산'),
      h('h1', {}, '상업용 빌딩 검토', h('br'), h('em', {}, '후보 탐색부터 고객 제안까지')),
      h('p', { className: 'tagline' }, '중개사·중개법인·매수자를 위한 분석 작업공간'),
      h('p', { className: 'hero-description' }, '투자 조건으로 후보를 찾고 최대 매입가와 운영 개선 효과를 비교하세요. 수치의 근거를 확인하고 고객별 검토 자료로 정리할 수 있습니다.'),
      h('div', { className: 'actions' }, linkButton('딜 레이더 열기', '#/radar', 'primary button-large'), linkButton('매물 목록', '#/listings', 'large')),
      h('div', { className: 'hero-meta' }, h('span', {}, h('b', {}, data.buildings.length), '개 예시 건물'), h('span', {}, h('b', {}, data.geography.districts.length), '개 구'), h('span', {}, h('b', {}, deepCount), '개 상세 임대차')),
    ),
    h('div', { className: 'hero-visual' }, h('div', { className: 'visual-heading' }, h('span', {}, '딜 레이더'), h('span', {}, '예시 건물 분포')), map.element,
      h('div', { className: 'visual-insight' }, h('div', {}, '탐색', h('strong', {}, '지역에서 후보로')), h('div', {}, '판단', h('strong', {}, '숫자에서 근거로')), h('div', {}, '대화', h('strong', {}, '고객과 다음 단계로')))),
    ),
    h('section', { className: 'value-section', 'aria-label': '분석 작업' }, h('div', { className: 'value-heading' }, h('h2', {}, '검토 작업'), h('p', {}, '예시 데이터 기반 · 실제 매물 아님')),
      h('div', { className: 'value-grid' }, values.map(([index, title, description, cta, href]) => h('article', { className: 'card value-card' }, h('div', { className: 'value-number' }, index, h('span', {}, '↗')), h('h3', {}, title), h('p', {}, description), h('a', { className: 'value-link', href }, cta, h('span', { 'aria-hidden': 'true' }, '→'))))),
    ));
  return { element, destroy: map.destroy };
}

export { radarView } from './ui/radar-view.js';

export function listingsView(context) {
  const { data, store } = context;
  let page = 0, sort = 'deep', filters = store.getState().filters;
  const size = 20;
  const rowsSlot = h('div'), pagination = h('div', { className: 'pagination' }), resultCount = h('p', { className: 'hint', role: 'status', 'aria-live': 'polite' });
  const search = h('input', { className: 'search-field', type: 'search', placeholder: '동·역·가상 건물 검색', 'aria-label': '목록 검색', value: filters.query, onInput: (event) => updateFilters({ query: event.target.value }) });
  const select = h('select', { className: 'select-field', 'aria-label': '매물 정렬', onChange: (e) => { sort = e.target.value; page = 0; refresh(); } }, h('option', { value: 'deep' }, '상세 임대차 우선'), h('option', { value: 'price' }, '호가 낮은 순'), h('option', { value: 'cap' }, 'Cap rate 높은 순'));
  function refresh() {
    const matches = filterBuildings(data.buildings, store.getState().filters).toSorted((a, b) => sort === 'price' ? a.askingPriceKrw - b.askingPriceKrw : sort === 'cap' ? b.capRate - a.capRate : Number(Boolean(b.deepPath)) - Number(Boolean(a.deepPath)) || a.askingPriceKrw - b.askingPriceKrw);
    page = Math.max(0, Math.min(page, Math.ceil(matches.length / size) - 1));
    resultCount.textContent = `현재 조건 ${matches.length}개 / 전체 ${data.buildings.length}개 · 거래완료 제외 · 레이더 지역·가격·용도·도보 조건 (IRR·자본 미적용)`;
    const visible = matches.slice(page * size, (page + 1) * size);
    rowsSlot.replaceChildren(matches.length ? table({ caption: '가상 매물 목록 — 레이더 조건 적용', rows: visible, columns: [
      { label: '건물 / 위치', render: (b) => h('div', { className: 'listing-identity' }, buildingPhoto(b, { compact: true }), h('div', {}, h('a', { className: 'text-link', href: buildingHref(b) }, b.nameKo), h('span', { className: 'subtext' }, b.addressKo))) },
      { label: '호가 (억)', numeric: true, render: (b) => context.summaryNumber(b, 'askingPriceKrw', '호가', eok) },
      { label: 'Cap rate', numeric: true, render: (b) => context.summaryNumber(b, 'capRate', 'Cap rate', percent) },
      { label: '대지 / 연면적 (m²)', numeric: true, render: (b) => `${number(b.landAreaM2)} / ${number(b.gfaM2)}` },
      { label: '임대율', numeric: true, render: (b) => percent(b.occupancy) },
      { label: '역 도보', render: (b) => `${b.stationNameKo} · ${b.walkMinutes}분` },
      { label: '상태 / 자료', render: (b) => h('div', {}, badge(b.statusKo), b.deepPath && h('span', { className: 'subtext' }, '상세 임대차 보유')) },
    ] }) : emptyState('검색 결과가 없습니다', '레이더의 지역·가격 조건 또는 검색어를 변경해 보세요.', button('조건 초기화', resetFilters)));
    const previous = button('← 이전', () => { page--; refresh(); }); previous.disabled = page === 0;
    const next = button('다음 →', () => { page++; refresh(); }); next.disabled = (page + 1) * size >= matches.length;
    pagination.replaceChildren(h('span', {}, matches.length ? `${page * size + 1}–${Math.min((page + 1) * size, matches.length)} / ${matches.length}개` : '0개'), h('div', { className: 'actions' }, previous, h('span', {}, `${page + 1} / ${Math.max(1, Math.ceil(matches.length / size))}`), next));
  }
  refresh();
  const unsubscribe = store.subscribe((state) => { if (state.filters !== filters) { filters = state.filters; page = 0; search.value = filters.query; refresh(); } });
  return { element: h('div', { className: 'page listings-page' }, h('div', { className: 'breadcrumb' }, h('a', { href: '#/' }, '워크스페이스'), ' / 매물 탐색'), heading('서울 상업용 빌딩', '매물 탐색', '예시 건물의 수익 구조를 비교하고 검토할 후보를 선택하세요.', linkButton('지도로 보기', '#/radar')),
    h('div', { className: 'listing-toolbar' }, search, h('div', { className: 'actions' }, resultCount, button('모든 조건 초기화', resetFilters, 'ghost'), select)), rowsSlot, pagination), destroy: unsubscribe };
}

function buildingKpis(context, building, result) {
  return h('div', { className: 'kpi-strip building-kpis' },
    kpiCard({ label: '매도 호가', value: context.summaryNumber(building, 'askingPriceKrw', '매도 호가', eok), unit: '억', note: '가상 호가 · 감정평가 아님', accent: true }),
    kpiCard({ label: '연간 NOI', value: context.metricNumber(result, 'noi', '연간 NOI', manwon), unit: '만원/년', note: '임대료 + 관리수입 − 소유자 운영비' }),
    kpiCard({ label: 'Cap rate', value: context.metricNumber(result, 'capRate', 'Cap rate', percent), note: '차입 전 · 연간 NOI / 호가' }),
    kpiCard({ label: '초기 필요 자기자본', value: context.metricNumber(result, 'equityRequired', '초기 필요 자기자본', eok), unit: '억', note: `LTV ${number(result.assumptions.ltv * 100)}% · 취득 비용·보증금 반영` }),
    kpiCard({ label: '레버리지 IRR', value: context.metricNumber(result, 'leveredIrr', '레버리지 IRR', percent), note: '10년 보유 · 월별 현금흐름 연율화' }),
    kpiCard({ label: '첫해 DSCR', value: context.metricNumber(result, 'dscr', '첫해 DSCR', (v) => Number.isFinite(v) ? `${number(v)}배` : '해당 없음'), note: '첫해 NOI / 원리금 상환액' }),
  );
}

function buildingFacts(building, context) {
  return h('dl', { className: 'info-grid' }, [
    ['가상 블록', building.addressKo], ['용도', building.useKo], ['대지 면적', context.summaryNumber(building, 'landAreaM2', '대지 면적', (v) => `${number(v)} m² · ${number(v * 121 / 400)}평`)], ['연면적', context.summaryNumber(building, 'gfaM2', '연면적', (v) => `${number(v)} m²`)],
    ['규모 / 준공', `지하 ${building.floorsBelow}층 · 지상 ${building.floorsAbove}층 / ${building.builtYear}년`], ['용도지역', building.zoningKo], ['역 접근성 (가정)', `${building.stationNameKo} · 도보 ${building.walkMinutes}분`], ['임대율 (면적 기준)', context.summaryNumber(building, 'occupancy', '면적 기준 임대율', percent)],
  ].map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))));
}

function compNumber(context, comp, key, label, format) {
  const text = format(comp[key]);
  const control = evidenceNumber({ label, text, evidence: { provenance: comp.provenance[key] }, onClick: () => context.inspect({ label, text,
    evidence: { value: comp[key], provenance: comp.provenance[key],
      inputs: { compId: comp.id, transactionDate: comp.transactionDate, priceKrw: comp.priceKrw, landAreaM2: comp.landAreaM2, gfaM2: comp.gfaM2 },
      formula: key === 'priceKrw' ? '합성 거래가: 가상 데이터 생성 규칙 f.ask' : `${key === 'landPricePerPyeong' ? '대지' : '연면적'} 평당가 = 가상 거래가 / (면적 m² × 121 / 400)` },
    source: `data/comps.json · ${comp.id} · ${key} · 공적 실거래 기록 아님`,
  }) });
  control.className = 'evidence-number'; control.setAttribute('aria-label', `${label} ${text} · 근거 보기`);
  return control;
}

export async function buildingView(context, route) {
  const building = context.data.buildings.find((b) => b.id === route.id);
  if (!building) return { element: emptyState('가상 건물을 찾을 수 없습니다', '목록에서 다른 예시를 선택해 주세요.', linkButton('매물 목록', '#/listings')) };
  const [deep, inventory] = await Promise.all([context.loader.loadDeep(building), context.loader.load('comps.json')]);
  const ltvPct = context.store.getState().filters.ltvPct;
  const result = calculate(inputFromBuilding(building, deep, { ltv: ltvPct / 100 }));
  const comps = selectComps(building, deep, inventory.comps);
  const proposalId = route.id;
  const unitNumber = (unit, key, label, format) => evidenceNumber({ label, text: format(unit[key]), evidence: { provenance: unit.provenance[key] },
    onClick: () => context.inspect({ label: `${unit.unit} · ${label}`, text: format(unit[key]), building, deep,
      evidence: { value: unit[key], provenance: unit.provenance[key], inputs: { ...unit } },
      source: `data/${building.deepPath} · rentRoll · ${unit.unit} · ${key}` }) });
  const rentRoll = deep ? table({ caption: `${building.nameKo} — 가상 임대차 내역`, rows: deep.rentRoll, columns: [
    { label: '층 / 호실', render: (u) => h('div', {}, u.floor, h('span', { className: 'subtext' }, u.unit)) },
    { label: '임차 업종', render: (u) => u.status === 'vacant' ? '공실' : u.tenantCategoryKo },
    { label: '용도 / 상태', render: (u) => h('div', {}, u.useKo, h('span', { className: 'subtext' }, u.status === 'vacant' ? '공실' : '임대 중')) },
    { label: '면적 (평)', numeric: true, render: (u) => unitNumber(u, 'areaPyeong', '전용 면적', number) },
    { label: '보증금 (만원)', numeric: true, render: (u) => unitNumber(u, 'depositKrw', '보증금', manwon) },
    { label: '월 임대료 (만원)', numeric: true, render: (u) => unitNumber(u, 'monthlyRentKrw', '월 임대료', manwon) },
    { label: '월 관리비 (만원)', numeric: true, render: (u) => unitNumber(u, 'mgmtFeeKrw', '월 관리비', manwon) },
    { label: '계약 시작', render: (u) => u.status === 'vacant' ? '—' : u.leaseStart },
    { label: '만기', render: (u) => u.status === 'vacant' ? '—' : u.leaseEnd },
    { label: '갱신 위험 (가정)', render: (u) => u.status === 'vacant' ? '해당 없음' : ({ low: '낮음', medium: '보통', high: '높음' }[u.renewalRisk] ?? 'UNKNOWN') },
  ] }) : h('p', { className: 'notice' }, '이 건물은 요약 데이터만 보유합니다. 상세 임대차는 25개 가상 건물에서 확인할 수 있습니다.');
  const assumptions = h('div', { className: 'stack' }, h('dl', { className: 'info-grid' }, [
    ['보유기간', '10년'], ['LTV / 금리', `${ltvPct}% / 연 5%`], ['임대료 상승', '연 2%'], ['매각 Cap rate', '4.5%'],
    ['월별 현금흐름 IRR', context.metricNumber(result, 'leveredIrr', '레버리지 IRR', percent)], ['첫해 DSCR', context.metricNumber(result, 'dscr', 'DSCR', (v) => Number.isFinite(v) ? `${number(v)}배` : '해당 없음')],
  ].map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value)))), h('p', { className: 'notice' }, '검증 전 예시 가정입니다. 보증금은 부채로 반영하며, 임대료에 공실을 중복 차감하지 않습니다. VAT·양도소득세·법인세·재융자 등은 제외됩니다.'));
  const element = h('div', { className: 'page building-page' }, h('div', { className: 'breadcrumb' }, h('a', { href: '#/radar' }, '딜 레이더'), ' / ', h('a', { href: '#/listings' }, '매물 탐색'), ' / ', building.nameKo),
    heading('PROPERTY / OVERVIEW', building.nameKo, `${building.addressKo} · ${building.statusKo}`, h('div', { className: 'actions' }, badge('예시 데이터 · 실제 매물 아님', 'accent'), linkButton('매수 한도가', `#/building/${proposalId}/bid`), linkButton('밸류업', `#/building/${proposalId}/valueup`), linkButton('요약 제안서  ↗', `#/building/${proposalId}/proposal?for=buyer`, 'primary'))),
    sceneNav(building, 'building'), buildingGallery(building),
    buildingKpis(context, building, result),
    h('div', { className: 'content-grid' }, h('div', { className: 'stack' }, section('건물 개요', buildingFacts(building, context), building.id), section('임대차 현황', rentRoll, deep ? `${deep.rentRoll.length}개 가상 호실 · 금액 만원` : '요약만 보유'),
      section('임대차 만기 워터폴', deep ? leaseWaterfall(deep) : h('p', { className: 'notice' }, '요약 데이터에는 호실별 만기가 없습니다. 만기 노출은 상세 임대차 보유 건물에서만 확인할 수 있습니다.'), '월세 노출 · 확정 공실 예측 아님'),
      section('가상 비교 거래', h('div', {}, h('p', { className: 'notice' }, '예시 데이터 · 실제 매물 아님. 아래 거래는 모두 합성 예시이며 공적 실거래 기록이 아닙니다. 가격의 시점·면적·용도 차이를 보정하지 않았습니다.'),
        comps.length ? table({ caption: `${building.nameKo} — 가상 비교 거래`, rows: comps, columns: [
          { label: '가상 거래 / 블록', render: (c) => h('div', {}, c.nameKo, h('span', { className: 'subtext' }, c.addressKo), h('span', { className: 'subtext' }, c.id)) },
          { label: '가상 거래일', render: (c) => c.transactionDate },
          { label: '거리 (가정)', numeric: true, render: (c) => `${number(c.distanceM, 0)}m` },
          { label: '거래가 (억)', numeric: true, render: (c) => compNumber(context, c, 'priceKrw', '가상 비교 거래가', eok) },
          { label: '대지 평당가 (만원/평)', numeric: true, render: (c) => compNumber(context, c, 'landPricePerPyeong', '대지 평당가', manwon) },
          { label: '연면적 평당가 (만원/평)', numeric: true, render: (c) => compNumber(context, c, 'gfaPricePerPyeong', '연면적 평당가', manwon) },
        ] }) : h('p', { className: 'hint' }, '연결된 가상 비교 거래가 없습니다.')),
        deep ? `${comps.length}개 연결 예시 · 가상 좌표 거리` : '동일 구 내 가상 좌표 근접 6개 · 도보 거리 아님')),
      h('div', { className: 'stack' }, section('수익 구조의 기본 가정', assumptions, '월별 계산 엔진'), section('검토 메모', h('div', { className: 'stack' }, h('p', { className: 'hint' }, `매도 동기 (가상): ${building.sellerMotivationKo}`), h('p', { className: 'hint' }, `등록 경과 (가상): ${building.daysOnMarket}일`), h('p', { className: 'notice' }, '실제 임대차 계약, 운영비 증빙, 대출 심사와 건물 상태를 확인해야 합니다. 위치·도보 시간은 측정값이 아닙니다.'))))),
  );
  // Stale asynchronous views must not overwrite the current selection.
  return { element, selectId: building.id };
}

export { proposalView } from './ui/proposal-view.js';
