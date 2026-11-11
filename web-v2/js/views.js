import { DEFAULT_FILTERS, filterBuildings, updateFilters } from './store.js';
import { calculate, inputFromBuilding } from './engine/index.js';
import { h, badge, button, emptyState, evidenceNumber, kpiCard, linkButton, table, toast } from './ui/components.js';
import { createSeoulMap } from './ui/map.js';
import { eok, manwon, number, percent } from './ui/format.js';
import { selectComps } from './building-analysis.js';
import { leaseWaterfall } from './ui/lease-waterfall.js';

const buildingHref = (b) => `#/building/${b.id}`;
const heading = (eyebrow, title, description, actions) => h('div', { className: 'page-heading' }, h('div', {}, h('div', { className: 'eyebrow' }, eyebrow), h('h1', {}, title), h('p', {}, description)), actions);
const section = (title, body, detail) => h('section', { className: 'card section-card' }, h('div', { className: 'section-heading' }, h('h2', {}, title), detail && h('small', {}, detail)), body);
const resetFilters = () => updateFilters(DEFAULT_FILTERS);
const sortedBuildings = (buildings) => buildings.toSorted((a, b) => Number(Boolean(b.deepPath)) - Number(Boolean(a.deepPath)) || a.askingPriceKrw - b.askingPriceKrw);

function buildingCard(b, { href = buildingHref(b), selected = false } = {}) {
  return h('a', { className: `card building-card${selected ? ' is-selected' : ''}`, href, 'data-card-id': b.id },
    h('div', { className: 'building-card-top' }, badge(b.deepPath ? '상세 임대차' : '요약 데이터', b.deepPath ? 'accent' : ''), badge(b.statusKo, 'outline')),
    h('h3', {}, b.nameKo), h('p', { className: 'location' }, `${b.neighborhood} · ${b.stationNameKo} 도보 ${b.walkMinutes}분`),
    h('div', { className: 'price-row' }, h('span', { className: 'price numeric' }, eok(b.askingPriceKrw), h('small', {}, '억')), h('span', {}, `Cap ${percent(b.capRate)}`)),
    h('div', { className: 'building-facts' }, h('span', {}, `대지 ${number(b.landAreaM2 * 121 / 400)}평`), h('span', {}, `임대율 ${percent(b.occupancy)}`), h('span', {}, `${b.builtYear}년`)),
  );
}

export function homeView(context) {
  const { data } = context;
  const map = createSeoulMap({ geography: data.geography, buildings: data.buildings, compact: true, onOpen: (id) => { location.hash = `#/building/${id}`; } });
  map.update({ matchingIds: new Set(filterBuildings(data.buildings, DEFAULT_FILTERS).map((b) => b.id)) });
  const deepCount = data.buildings.filter((b) => b.deepPath).length;
  const values = [
    ['01', '가능성이 있는 딜부터', '지역·가격·접근성을 좁혀 후보를 찾으세요. 지도와 매물 목록이 같은 조건으로 움직입니다.', '후보 탐색하기', '#/radar'],
    ['02', '숫자의 이유까지', '호가와 NOI, 수익률을 하나의 흐름으로 살펴보세요. 점선 수치를 누르면 계산과 가정을 확인할 수 있습니다.', '가상 건물 살펴보기', buildingHref(data.buildings.find((b) => b.deepPath))],
    ['03', '고객과 같은 화면에서', '선택한 건물의 핵심 수치와 검증할 항목을 요약해, 다음 대화의 출발점으로 사용하세요.', '요약 제안서 보기', '#/proposal'],
  ];
  const element = h('div', { className: 'landing' }, h('section', { className: 'hero' },
    h('div', { className: 'hero-copy' }, h('div', { className: 'eyebrow' }, 'THE NEXT MOVE IN EVERY DEAL'),
      h('h1', {}, '좋은 위치를 넘어,', h('br'), h('em', {}, '성사되는 가격으로.')),
      h('p', { className: 'tagline' }, '지도를 보는 도구가 아니라, 딜을 성사시키는 도구'),
      h('p', { className: 'hero-description' }, '후보 탐색부터 수익 구조와 근거 확인까지.', h('br'), '중개사의 판단을 고객이 이해할 수 있는 숫자로 연결합니다.'),
      h('div', { className: 'actions' }, linkButton('딜 레이더 시작하기  ↗', '#/radar', 'primary button-large'), linkButton('매물 둘러보기', '#/listings', 'large')),
      h('div', { className: 'hero-meta' }, h('span', {}, h('b', {}, data.buildings.length), '가상 건물'), h('span', {}, h('b', {}, data.geography.districts.length), '개 구 개략도'), h('span', {}, h('b', {}, deepCount), '개 상세 임대차')),
    ),
    h('div', { className: 'hero-visual' }, h('div', { className: 'visual-heading' }, h('span', {}, 'PLOT OS / DEAL RADAR'), h('span', {}, '● EXAMPLE DATA')), map.element,
      h('div', { className: 'visual-insight' }, h('div', {}, '탐색', h('strong', {}, '지역에서 후보로')), h('div', {}, '판단', h('strong', {}, '숫자에서 근거로')), h('div', {}, '대화', h('strong', {}, '고객과 다음 단계로')))),
    ),
    h('section', { className: 'value-section', 'aria-label': '세 가지 핵심 가치' }, h('div', { className: 'value-heading' }, h('h2', {}, '발견에서 설득까지, 한 흐름으로'), h('p', {}, 'BROKER WORKSPACE / 예시 데이터 기반 데모')),
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
      { label: '건물 / 위치', render: (b) => h('div', {}, h('a', { className: 'text-link', href: buildingHref(b) }, b.nameKo), h('span', { className: 'subtext' }, b.addressKo)) },
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
  return { element: h('div', { className: 'page' }, heading('WORKSPACE / LISTINGS', '매물 탐색', '가상 매물의 수익 구조를 비교하고, 검토할 건물을 선택하세요.', linkButton('지도로 보기  ↗', '#/radar')),
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
  const element = h('div', { className: 'page' }, h('div', { className: 'breadcrumb' }, h('a', { href: '#/radar' }, '딜 레이더'), ' / ', h('a', { href: '#/listings' }, '매물 탐색'), ' / ', building.nameKo),
    heading('PROPERTY / OVERVIEW', building.nameKo, `${building.addressKo} · ${building.statusKo}`, h('div', { className: 'actions' }, badge('예시 데이터 · 실제 매물 아님', 'accent'), linkButton('매수 한도가', `#/building/${proposalId}/bid`), linkButton('밸류업', `#/building/${proposalId}/valueup`), linkButton('요약 제안서  ↗', `#/building/${proposalId}/proposal?for=buyer`, 'primary'))),
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

export async function proposalView(context, route) {
  const id = route.id || context.store.getState().selectedId;
  if (!id) return { element: h('div', { className: 'page' }, heading('WORKSPACE / PROPOSAL', '고객과 함께 볼 한 장', '가상 건물을 선택하면 핵심 수치와 확인할 가정을 요약합니다.', linkButton('전체 매물에서 선택', '#/listings')),
    h('div', { className: 'notice', style: 'margin-bottom:24px' }, '현재는 건물 요약 제안서입니다. 매수 제안가·매도 호가 근거·시나리오 비교는 후속 단계에서 추가합니다.'),
    h('div', { className: 'value-grid' }, sortedBuildings(context.data.buildings.filter((b) => b.deepPath && b.statusKo !== '거래완료 참고')).slice(0, 3).map((b) => buildingCard(b, { href: `#/building/${b.id}/proposal?for=buyer` })))) };
  const building = context.data.buildings.find((b) => b.id === id);
  if (!building) return { element: emptyState('가상 건물을 찾을 수 없습니다', '다른 예시를 선택해 주세요.', linkButton('매물 목록', '#/listings')) };
  const result = calculate(inputFromBuilding(building));
  const seller = route.params.get('for') === 'seller';
  const element = h('div', { className: 'page proposal-page' }, heading('WORKSPACE / PROPOSAL', '건물 요약 제안서', '검토할 숫자와 가정을 한 화면에 정리합니다.', h('div', { className: 'actions' }, linkButton('건물 개요', buildingHref(building)), linkButton(seller ? '매수자용' : '매도자용', `#/building/${id}/proposal?for=${seller ? 'buyer' : 'seller'}`), button('인쇄', () => { toast('인쇄 대화상자에서 A4와 배경 그래픽 설정을 확인하세요.'); window.print(); }, 'primary'))),
    h('article', { className: 'card proposal-sheet' }, h('div', { className: 'proposal-title' }, h('p', { className: 'eyebrow' }, `PLOT OS / ${seller ? 'SELLER' : 'BUYER'} BRIEF`), h('h2', {}, building.nameKo), h('p', { className: 'muted' }, building.addressKo), h('div', { className: 'actions', style: 'margin-top:16px' }, badge('예시 데이터 · 실제 매물 아님', 'accent'), badge(`예시 스냅샷 ${context.data.metadata.snapshotDate}`))),
      buildingKpis(context, building, result),
      h('section', {}, h('h3', {}, '01 / 건물의 기본 조건'), buildingFacts(building, context)),
      h('section', {}, h('h3', {}, '02 / 숫자를 읽는 조건'), h('p', { className: 'notice' }, `호가 기준 레버리지 IRR ${percent(result.metrics.leveredIrr.value)}. 보유 10년, LTV 50%, 금리 연 5%, 임대료 상승 연 2%, 매각 Cap rate 4.5%의 가정입니다. 취득 비용과 반환할 보증금을 반영합니다. 이는 매수 권고나 매도 적정가가 아닙니다.`)),
      h('section', {}, h('h3', {}, '03 / 다음 대화에서 확인할 것'), h('p', { className: 'hint' }, '임대차·보증금 및 만기 / 실증 운영비 / 건물 상태와 공사비 / 대출 조건 / 거래별 세금·VAT / 실제 비교 거래'), h('p', { className: 'notice', style: 'margin-top:16px' }, '건물 요약 단계입니다. 매수 제안가·매도 호가 근거·시나리오 비교 및 상세 근거 부록은 아직 포함하지 않습니다.')),
      h('p', { className: 'proposal-disclaimer' }, `예시 데이터 · 실제 매물 아님. 모든 건물·임대차·위치는 가상이며 신뢰도는 낮음, 검증 필요입니다. 시장 출처는 조회하지 않았습니다. VAT·소득세·양도세·재융자 등은 모델에서 제외합니다. 실제 매매·대출·세무 판단에 사용할 수 없습니다. / ${result.engineVersion}`)),
  );
  return { element, selectId: building.id };
}
