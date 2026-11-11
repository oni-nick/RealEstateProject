import { DEFAULT_FILTERS, filterBuildings, updateFilters } from './store.js';
import { calculate, inputFromBuilding } from './engine/index.js';
import { h, badge, button, chip, emptyState, kpiCard, linkButton, slider, table, toast } from './ui/components.js';
import { createSeoulMap } from './ui/map.js';
import { eok, manwon, median, number, percent } from './ui/format.js';

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

function filtersPanel(context, onReset) {
  const filters = context.store.getState().filters;
  const districtList = h('div', { className: 'chip-list' });
  const districtButtons = new Map();
  districtButtons.set('all', chip('전체', { onClick: () => updateFilters({ districts: [] }) }));
  for (const d of context.data.geography.districts) districtButtons.set(d.id, chip(d.nameKo, { onClick: () => {
    const current = context.store.getState().filters.districts;
    updateFilters({ districts: current.includes(d.id) ? current.filter((id) => id !== d.id) : [...current, d.id] });
  } }));
  districtList.append(...districtButtons.values());
  const refreshDistricts = () => {
    const selected = context.store.getState().filters.districts;
    for (const [id, control] of districtButtons) control.setAttribute('aria-pressed', String(id === 'all' ? !selected.length : selected.includes(id)));
  };
  refreshDistricts();
  const queryInput = h('input', { type: 'search', className: 'search-field', placeholder: '동·역·가상 건물 검색', 'aria-label': '가상 건물 검색', value: filters.query, onInput: (e) => updateFilters({ query: e.target.value }) });
  const deepInput = h('input', { type: 'checkbox', checked: filters.deepOnly, onChange: (e) => updateFilters({ deepOnly: e.target.checked }) });
  const priceSlot = h('div'), walkSlot = h('div');
  function updateRanges() {
    const f = context.store.getState().filters;
    priceSlot.replaceChildren(slider({ label: '최대 호가', min: 30, max: 150, value: f.maxPriceEok, format: (v) => `${v}억`, onChange: (maxPriceEok) => updateFilters({ maxPriceEok }) }));
    walkSlot.replaceChildren(slider({ label: '역 도보 이내', min: 2, max: 18, value: f.maxWalk, format: (v) => `${v}분`, onChange: (maxWalk) => updateFilters({ maxWalk }) }));
  }
  updateRanges();
  const element = h('aside', { className: 'card filter-panel', 'aria-label': '탐색 조건' },
    h('div', { className: 'section-heading' }, h('h2', {}, '탐색 조건'), button('초기화', onReset, 'ghost button-small')),
    h('div', { className: 'filter-group' }, h('label', { className: 'filter-title' }, '검색', queryInput)),
    h('div', { className: 'filter-group' }, h('p', { className: 'filter-title' }, '관심 지역', h('span', { className: 'hint' }, ' · 복수 선택')), districtList),
    h('div', { className: 'filter-group' }, priceSlot, h('div', { style: 'height:20px', 'aria-hidden': 'true' }), walkSlot,
      h('label', { className: 'check-label' }, deepInput, '상세 임대차 보유만')),
    h('p', { className: 'filter-summary' }, '지도에는 전체 건물을 표시하며 조건 외·거래완료는 흐리게 표시합니다.'),
  );
  let previous = filters;
  const unsubscribe = context.store.subscribe(({ filters: next }) => {
    if (next === previous) return;
    refreshDistricts();
    if (next.query !== queryInput.value) queryInput.value = next.query;
    deepInput.checked = next.deepOnly;
    // Keep native slider focus/drag intact unless values were changed elsewhere.
    const inputs = [priceSlot.querySelector('input'), walkSlot.querySelector('input')];
    if (Number(inputs[0].value) !== next.maxPriceEok || Number(inputs[1].value) !== next.maxWalk) updateRanges();
    previous = next;
  });
  return { element, destroy: unsubscribe };
}

function radarKpis(context, matches) {
  const { data, inspect } = context;
  const cap = median(matches.map((b) => b.capRate));
  const landUnit = median(matches.map((b) => b.askingPriceKrw / (b.landAreaM2 * 121 / 400)));
  const stat = (label, text, formula, values) => contextNumber(label, text, { value: values, formula, inputs: { matchingBuildingIds: matches.map((b) => b.id) }, provenance: { kind: 'derived', confidence: 'low', formulaId: formula } });
  const contextNumber = (label, text, evidence) => {
    const b = button(text, () => inspect({ label, text, evidence, source: '가상 건물 요약 · 현재 탐색 조건' }));
    b.className = 'evidence-number'; b.setAttribute('aria-label', `${label} ${text} · 근거 보기`); return b;
  };
  return [
    kpiCard({ label: '조건에 맞는 후보', value: number(matches.length, 0), unit: '개', note: `전체 ${data.buildings.length}개 · 거래완료 제외`, accent: true }),
    kpiCard({ label: '중앙값 Cap rate', value: stat('중앙값 Cap rate', percent(cap), 'median(연 NOI / 호가)', cap), note: '차입 전 · 호가 기준 · IRR과 다름' }),
    kpiCard({ label: '중앙값 대지 평당가', value: stat('중앙값 대지 평당가', manwon(landUnit), 'median(호가 / (대지 m² × 121 / 400))', landUnit), unit: '만원/평', note: '건물별 호가를 대지 면적으로 나눈 값' }),
    kpiCard({ label: '상세 임대차 보유', value: number(matches.filter((b) => b.deepPath).length, 0), unit: '개', note: '가상 임대차·운영비 확인 가능' }),
  ];
}

export function radarView(context) {
  const { data, store } = context;
  let filters = store.getState().filters;
  const kpis = h('div', { className: 'kpi-strip' });
  const resultList = h('div', { className: 'result-list' });
  const count = h('small', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const map = createSeoulMap({ geography: data.geography, buildings: data.buildings,
    onOpen: (id) => { location.hash = `#/building/${id}`; },
    onHover: (id) => { for (const card of resultList.querySelectorAll('[data-card-id]')) card.classList.toggle('is-hovered', card.dataset.cardId === id); },
  });
  const panel = filtersPanel(context, resetFilters);
  function refresh() {
    const matches = sortedBuildings(filterBuildings(data.buildings, store.getState().filters));
    kpis.replaceChildren(...radarKpis(context, matches));
    count.textContent = `${matches.length}개 · 상세 우선`;
    resultList.replaceChildren(...(matches.length ? matches.slice(0, 24).map((b) => {
      const card = buildingCard(b, { selected: b.id === store.getState().selectedId });
      card.addEventListener('pointerenter', () => map.highlight(b.id));
      card.addEventListener('pointerleave', () => map.highlight(null));
      card.addEventListener('focus', () => map.highlight(b.id));
      card.addEventListener('blur', () => map.highlight(null));
      return card;
    }) : [emptyState('일치하는 후보가 없습니다', '지역·호가·도보 조건을 넓혀 보세요.', button('조건 초기화', resetFilters))]));
    map.update({ matchingIds: new Set(matches.map((b) => b.id)), activeDistricts: store.getState().filters.districts });
  }
  refresh();
  const unsubscribe = store.subscribe((state) => { if (state.filters !== filters) { filters = state.filters; refresh(); } });
  const element = h('div', { className: 'page' }, heading('WORKSPACE / DEAL RADAR', '딜 레이더', '가능성이 있는 딜을 찾고, 숫자와 근거로 다음 대화를 시작하세요.', h('div', { className: 'actions' }, linkButton('전체 매물 목록  ↗', '#/listings'))), kpis,
    h('div', { className: 'radar-workspace' }, panel.element,
      h('section', { className: 'radar-map-column', 'aria-label': '서울 가상 건물 지도' }, map.element, h('div', { className: 'map-footnote' }, h('span', {}, '점을 눌러 건물의 수익 구조를 확인하세요.'), h('span', {}, `예시 스냅샷 ${data.metadata.snapshotDate}`))),
      h('section', { className: 'radar-results', 'aria-label': '조건에 맞는 후보 목록' }, h('div', { className: 'section-heading results-heading' }, h('h2', {}, '발견한 후보'), count), resultList, h('p', { className: 'results-footer' }, h('a', { className: 'text-link', href: '#/listings' }, '전체 결과를 목록에서 보기 →'), h('span', { className: 'subtext hint' }, ' · 최대 24개 미리보기')))),
  );
  return { element, destroy() { unsubscribe(); panel.destroy(); map.destroy(); } };
}

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
    resultCount.textContent = `현재 조건 ${matches.length}개 / 전체 ${data.buildings.length}개 · 거래완료 제외 · 레이더 조건 유지`;
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
  return h('div', { className: 'kpi-strip' },
    kpiCard({ label: '매도 호가', value: context.summaryNumber(building, 'askingPriceKrw', '매도 호가', eok), unit: '억', note: '가상 호가 · 감정평가 아님', accent: true }),
    kpiCard({ label: '연간 NOI', value: context.metricNumber(result, 'noi', '연간 NOI', manwon), unit: '만원/년', note: '임대료 + 관리수입 − 소유자 운영비' }),
    kpiCard({ label: 'Cap rate', value: context.metricNumber(result, 'capRate', 'Cap rate', percent), note: '차입 전 · 연간 NOI / 호가' }),
    kpiCard({ label: '초기 필요 자기자본', value: context.metricNumber(result, 'equityRequired', '초기 필요 자기자본', eok), unit: '억', note: 'LTV 50% · 취득 비용·보증금 반영' }),
  );
}

function buildingFacts(building) {
  return h('dl', { className: 'info-grid' }, [
    ['가상 블록', building.addressKo], ['용도', building.useKo], ['대지 면적', `${number(building.landAreaM2)} m² · ${number(building.landAreaM2 * 121 / 400)}평`], ['연면적', `${number(building.gfaM2)} m²`],
    ['규모 / 준공', `지하 ${building.floorsBelow}층 · 지상 ${building.floorsAbove}층 / ${building.builtYear}년`], ['용도지역', building.zoningKo], ['역 접근성 (가정)', `${building.stationNameKo} · 도보 ${building.walkMinutes}분`], ['임대율 (면적 기준)', percent(building.occupancy)],
  ].map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value))));
}

export async function buildingView(context, route) {
  const building = context.data.buildings.find((b) => b.id === route.id);
  if (!building) return { element: emptyState('가상 건물을 찾을 수 없습니다', '목록에서 다른 예시를 선택해 주세요.', linkButton('매물 목록', '#/listings')) };
  const deep = await context.loader.loadDeep(building);
  const result = calculate(inputFromBuilding(building, deep));
  const proposalId = route.id;
  const rentRoll = deep ? table({ caption: `${building.nameKo} — 가상 임대차 내역`, rows: deep.rentRoll, columns: [
    { label: '층 / 호실', render: (u) => h('div', {}, u.floor, h('span', { className: 'subtext' }, u.unit)) },
    { label: '임차 업종', render: (u) => u.status === 'vacant' ? '공실' : u.tenantCategoryKo },
    { label: '면적 (평)', numeric: true, render: (u) => number(u.areaPyeong) },
    { label: '보증금 (만원)', numeric: true, render: (u) => manwon(u.depositKrw) },
    { label: '월 임대료 (만원)', numeric: true, render: (u) => manwon(u.monthlyRentKrw) },
    { label: '만기', render: (u) => u.status === 'vacant' ? '—' : u.leaseEnd },
  ] }) : h('p', { className: 'notice' }, '이 건물은 요약 데이터만 보유합니다. 상세 임대차는 25개 가상 건물에서 확인할 수 있습니다.');
  const assumptions = h('div', { className: 'stack' }, h('dl', { className: 'info-grid' }, [
    ['보유기간', '10년'], ['LTV / 금리', '50% / 연 5%'], ['임대료 상승', '연 2%'], ['매각 Cap rate', '4.5%'],
    ['월별 현금흐름 IRR', context.metricNumber(result, 'leveredIrr', '레버리지 IRR', percent)], ['첫해 DSCR', context.metricNumber(result, 'dscr', 'DSCR', (v) => Number.isFinite(v) ? `${number(v)}배` : '해당 없음')],
  ].map(([label, value]) => h('div', {}, h('dt', {}, label), h('dd', {}, value)))), h('p', { className: 'notice' }, '검증 전 예시 가정입니다. 보증금은 부채로 반영하며, 임대료에 공실을 중복 차감하지 않습니다. VAT·양도소득세·법인세·재융자 등은 제외됩니다.'));
  const element = h('div', { className: 'page' }, h('div', { className: 'breadcrumb' }, h('a', { href: '#/radar' }, '딜 레이더'), ' / ', h('a', { href: '#/listings' }, '매물 탐색'), ' / ', building.nameKo),
    heading('PROPERTY / OVERVIEW', building.nameKo, `${building.addressKo} · ${building.statusKo}`, h('div', { className: 'actions' }, badge('예시 데이터 · 실제 매물 아님', 'accent'), linkButton('요약 제안서  ↗', `#/building/${proposalId}/proposal?for=buyer`, 'primary'))),
    buildingKpis(context, building, result),
    h('div', { className: 'content-grid' }, h('div', { className: 'stack' }, section('건물 개요', buildingFacts(building), building.id), section('임대차 현황', rentRoll, deep ? `${deep.rentRoll.length}개 가상 호실 · 금액 만원` : '요약만 보유')),
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
      h('section', {}, h('h3', {}, '01 / 건물의 기본 조건'), buildingFacts(building)),
      h('section', {}, h('h3', {}, '02 / 숫자를 읽는 조건'), h('p', { className: 'notice' }, `호가 기준 레버리지 IRR ${percent(result.metrics.leveredIrr.value)}. 보유 10년, LTV 50%, 금리 연 5%, 임대료 상승 연 2%, 매각 Cap rate 4.5%의 가정입니다. 취득 비용과 반환할 보증금을 반영합니다. 이는 매수 권고나 매도 적정가가 아닙니다.`)),
      h('section', {}, h('h3', {}, '03 / 다음 대화에서 확인할 것'), h('p', { className: 'hint' }, '임대차·보증금 및 만기 / 실증 운영비 / 건물 상태와 공사비 / 대출 조건 / 거래별 세금·VAT / 실제 비교 거래'), h('p', { className: 'notice', style: 'margin-top:16px' }, '건물 요약 단계입니다. 매수 제안가·매도 호가 근거·시나리오 비교 및 상세 근거 부록은 아직 포함하지 않습니다.')),
      h('p', { className: 'proposal-disclaimer' }, `예시 데이터 · 실제 매물 아님. 모든 건물·임대차·위치는 가상이며 신뢰도는 낮음, 검증 필요입니다. 시장 출처는 조회하지 않았습니다. VAT·소득세·양도세·재융자 등은 모델에서 제외합니다. 실제 매매·대출·세무 판단에 사용할 수 없습니다. / ${result.engineVersion}`)),
  );
  return { element, selectId: building.id };
}
