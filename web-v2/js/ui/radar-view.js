import { DEFAULT_FILTERS, filterBuildings, updateFilters } from '../store.js';
import { RADAR_PRESETS, createRadarMatcher, radarStats, sortRadarRows } from '../radar.js';
import { h, badge, button, chip, emptyState, evidenceNumber, kpiCard, linkButton, slider } from './components.js';
import { createSeoulMap } from './map.js';
import { buildingPhoto } from './photo.js';
import { eok, manwon, number, percent } from './format.js';

// Retain a small financial cache across route visits, not just individual renders.
const matcher = createRadarMatcher();
const SCORE_EXPLANATION = '자기자본·IRR 각 30점, 지역·가격·용도·도보 각 10점. 자본은 예산 이내 여유, IRR은 목표 대비 여유로 가점합니다. 금융 기준선은 각 15점이며 목표+10%p·필요자본 0에서 각 30점입니다. 일치는 모든 조건 통과를 뜻합니다. 신뢰도·투자 권고가 아닙니다.';

function criteriaPanel(context) {
  const { store, data } = context;
  const controls = new Map(), districts = new Map(), presets = new Map();
  const presetNote = h('p', { className: 'hint preset-note' });
  const ranges = [
    ['equityEok', '자기자본 예산', 1, 150, 1, (v) => `${v}억`],
    ['targetIrrPct', '목표 IRR', -20, 30, .5, (v) => `${v}%`],
    ['ltvPct', 'LTV', 0, 80, 5, (v) => `${v}%`],
    ['minPriceEok', '최소 호가', 30, 150, 1, (v) => `${v}억`],
    ['maxPriceEok', '최대 호가', 30, 150, 1, (v) => `${v}억`],
    ['maxWalk', '역 도보 이내', 2, 18, 1, (v) => `${v}분`],
  ];
  function patchRange(key, value) {
    const f = store.getState().filters;
    const patch = { [key]: value };
    if (key === 'minPriceEok' && value > f.maxPriceEok) patch.maxPriceEok = value;
    if (key === 'maxPriceEok' && value < f.minPriceEok) patch.minPriceEok = value;
    updateFilters(patch);
  }
  for (const [key, label, min, max, step, format] of ranges) {
    const control = slider({ label, min, max, step, value: store.getState().filters[key], format, onInput: (value) => patchRange(key, value) });
    controls.set(key, { control, input: control.querySelector('input'), output: control.querySelector('output'), format });
  }
  const districtList = h('div', { className: 'chip-list' });
  districts.set('all', chip('전체', { onClick: () => updateFilters({ districts: [] }) }));
  for (const d of data.geography.districts) districts.set(d.id, chip(d.nameKo, { onClick() {
    const ids = store.getState().filters.districts;
    updateFilters({ districts: ids.includes(d.id) ? ids.filter((id) => id !== d.id) : [...ids, d.id] });
  } }));
  districtList.append(...districts.values());
  const presetList = h('div', { className: 'preset-list' });
  for (const preset of RADAR_PRESETS) {
    const control = chip(preset.label, { onClick: () => updateFilters(preset.filters) });
    presets.set(preset.id, control); presetList.append(control);
  }
  const query = h('input', { type: 'search', className: 'search-field', 'aria-label': '가상 건물 검색', placeholder: '동·역·가상 건물 검색', value: store.getState().filters.query, onInput: (e) => updateFilters({ query: e.target.value }) });
  const use = h('select', { className: 'select-field', 'aria-label': '용도', onChange: (e) => updateFilters({ useKo: e.target.value }) },
    h('option', { value: '' }, '전체 용도'), h('option', { value: '근린생활시설' }, '근린생활시설 포함'), h('option', { value: '업무시설' }, '업무시설 포함'));
  const deep = h('input', { type: 'checkbox', onChange: (e) => updateFilters({ deepOnly: e.target.checked }) });
  function sync() {
    const f = store.getState().filters;
    for (const [key, control] of controls) {
      control.input.value = f[key]; control.input.setAttribute('aria-valuetext', control.format(f[key])); control.output.textContent = control.format(f[key]);
    }
    for (const [id, control] of districts) control.setAttribute('aria-pressed', String(id === 'all' ? !f.districts.length : f.districts.includes(id)));
    let active;
    for (const preset of RADAR_PRESETS) {
      const selected = Object.keys(DEFAULT_FILTERS).every((key) => key === 'districts'
        ? [...f.districts].sort().join() === [...preset.filters.districts].sort().join()
        : f[key] === preset.filters[key]);
      presets.get(preset.id).setAttribute('aria-pressed', String(selected));
      if (selected) active = preset;
    }
    presetNote.textContent = active?.note ?? '사용자 지정 조건 · 수익률은 현재 임대수익과 공통 가정 기준';
    if (query.value !== f.query) query.value = f.query;
    use.value = f.useKo; deep.checked = f.deepOnly;
  }
  sync();
  let previous = store.getState().filters;
  const unsubscribe = store.subscribe(({ filters }) => { if (filters !== previous) { previous = filters; sync(); } });
  return { element: h('aside', { className: 'card filter-panel investor-panel', 'aria-label': '투자자 조건' },
    h('div', { className: 'section-heading' }, h('h2', {}, '투자자 조건'), button('초기화', () => updateFilters(DEFAULT_FILTERS), 'ghost button-small')),
    h('div', { className: 'filter-group' }, h('p', { className: 'filter-title' }, '빠른 프리셋'), presetList, presetNote),
    h('div', { className: 'filter-group investor-ranges' }, ...['equityEok', 'targetIrrPct', 'ltvPct'].map((key) => controls.get(key).control)),
    h('div', { className: 'filter-group' }, h('p', { className: 'filter-title' }, '관심 지역 · 복수 선택'), districtList),
    h('div', { className: 'filter-group investor-ranges' }, ...['minPriceEok', 'maxPriceEok'].map((key) => controls.get(key).control), h('label', { className: 'filter-title' }, '용도', use), controls.get('maxWalk').control),
    h('div', { className: 'filter-group' }, query, h('label', { className: 'check-label' }, deep, '상세 임대차 보유만')),
    h('p', { className: 'filter-summary' }, '10년 보유 · 금리 5% · 임대료 상승 2% · 매각 Cap 4.5%. 보증금·취득 비용 반영, 미래 추가 출자 가능. 모든 조건을 통과해야 일치합니다.'),
  ), destroy: unsubscribe };
}

function candidateCard(row, context, map) {
  const b = row.building;
  const score = evidenceNumber({ label: '조건 적합도', text: `${row.score}점`, onClick: () => context.inspect({ label: '조건 적합도', text: `${row.score}점`, building: b, evidence: { value: row.score, formula: SCORE_EXPLANATION, inputs: { checks: row.checks, irr: row.metrics.leveredIrr, equityKrw: row.metrics.equityRequired, criteria: context.store.getState().filters }, provenance: { kind: 'derived', confidence: 'low' } }, source: '가상 후보 · 규칙 기반 점수' }) });
  score.className = 'evidence-number match-score';
  const card = h('article', { className: `card building-card radar-card${row.matches ? '' : ' is-near-miss'}`, 'data-card-id': b.id },
    h('div', { className: 'building-card-top' }, badge(row.matches ? '조건 일치' : '조건 외', row.matches ? 'accent' : 'outline'), score),
    h('div', { className: 'candidate-summary' }, buildingPhoto(b, { compact: true }),
      h('a', { className: 'candidate-link', href: `#/building/${b.id}` }, h('h3', {}, b.nameKo), h('p', { className: 'location' }, `${b.neighborhood} · ${b.stationNameKo} 도보 ${b.walkMinutes}분`))),
    h('div', { className: 'price-row' }, h('span', { className: 'price numeric' }, context.summaryNumber(b, 'askingPriceKrw', '매도 호가', eok), h('small', {}, '억')), badge(b.deepPath ? '상세 임대차' : '요약')),
    h('div', { className: 'radar-financials' }, h('div', {}, h('span', {}, '레버리지 IRR'), context.metricNumber(row, 'leveredIrr', '레버리지 IRR', percent)), h('div', {}, h('span', {}, '필요 자기자본'), context.metricNumber(row, 'equityRequired', '필요 자기자본', (v) => `${eok(v)}억`))),
    h('details', { className: 'match-reasons', open: row.matches }, h('summary', {}, '왜 맞는지', h('span', {}, `${row.checks.filter((c) => c.passed).length}/6 조건`)),
      h('ul', {}, row.checks.map((c) => h('li', { className: c.passed ? 'check-pass' : 'check-fail' }, h('span', { 'aria-hidden': 'true' }, c.passed ? '✓ ' : '× '), c.text))),
      !row.matches && h('p', { className: 'hint' }, '검색·상세자료·거래 상태 조건도 적용됩니다.')),
    h('a', { className: 'value-link', href: `#/building/${b.id}` }, '건물 검토하기 →'));
  for (const [event, id] of [['pointerenter', b.id], ['pointerleave', null], ['focusin', b.id], ['focusout', null]]) card.addEventListener(event, () => map.highlight(id));
  return card;
}

export function radarView(context) {
  const { data, store } = context;
  let filters = store.getState().filters, sort = 'score', page = 0, includeOutside = false, rows;
  let timer;
  const size = 20, kpis = h('div', { className: 'kpi-strip' }), results = h('div', { className: 'result-list' });
  const count = h('small', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }), pagination = h('div', { className: 'radar-pagination' });
  const map = createSeoulMap({ geography: data.geography, buildings: data.buildings,
    onOpen: (id) => { location.hash = `#/building/${id}`; },
    onHover: (id) => { for (const card of results.querySelectorAll('[data-card-id]')) card.classList.toggle('is-hovered', card.dataset.cardId === id); },
  });
  const panel = criteriaPanel(context);
  const select = h('select', { className: 'select-field', 'aria-label': '후보 정렬', onChange(e) { sort = e.target.value; page = 0; renderList(); } },
    ...[['score', '적합도 높은 순'], ['irr', 'IRR 높은 순'], ['price', '호가 낮은 순'], ['equity', '필요 자본 낮은 순']].map(([value, label]) => h('option', { value }, label)));
  const outside = h('input', { type: 'checkbox', onChange(e) { includeOutside = e.target.checked; page = 0; renderList(); } });
  function renderList() {
    const eligible = new Set(filterBuildings(data.buildings, filters).map((b) => b.id));
    const candidates = sortRadarRows(rows.filter((r) => r.matches || (includeOutside && eligible.has(r.building.id))), sort);
    page = Math.max(0, Math.min(page, Math.ceil(candidates.length / size) - 1));
    count.textContent = `${rows.filter((r) => r.matches).length}개 일치 · ${candidates.length}개 표시 대상`;
    results.replaceChildren(...(candidates.length ? candidates.slice(page * size, (page + 1) * size).map((r) => candidateCard(r, context, map)) : [emptyState('일치하는 후보가 없습니다', '자기자본·목표 IRR 또는 지역·호가·도보 조건을 조정해 보세요.', button('조건 초기화', () => updateFilters(DEFAULT_FILTERS)))]));
    const prev = button('← 이전', () => { page--; renderList(); }, 'small'); prev.disabled = page === 0;
    const next = button('다음 →', () => { page++; renderList(); }, 'small'); next.disabled = (page + 1) * size >= candidates.length;
    pagination.replaceChildren(prev, h('span', {}, `${page + 1} / ${Math.max(1, Math.ceil(candidates.length / size))}`), next);
  }
  function refresh() {
    rows = matcher.evaluate(data.buildings, filters);
    const stats = radarStats(rows), matches = rows.filter((r) => r.matches);
    const aggregate = (label, value, text, formula) => {
      return evidenceNumber({ label, text, onClick: () => context.inspect({ label, text, evidence: { value, formula, inputs: { criteria: filters, buildingIds: matches.map((r) => r.building.id) }, provenance: { kind: 'derived', confidence: 'low' } }, source: '가상 후보 · 조건별 집계' }) });
    };
    kpis.replaceChildren(
      kpiCard({ label: '조건 일치', value: aggregate('조건 일치', stats.count, number(stats.count, 0), 'count(buildings passing every physical, equity and IRR gate; closed records excluded)'), unit: '개', note: `전체 ${data.buildings.length}개 · 거래완료 제외`, accent: true }),
      kpiCard({ label: '중앙값 IRR', value: aggregate('중앙값 IRR', stats.medianIrr, percent(stats.medianIrr), 'median(matching buildings: engine monthly levered IRR, annualized)'), note: `호가 · LTV ${filters.ltvPct}% · 10년 보유` }),
      kpiCard({ label: '중앙값 대지 평당가', value: aggregate('중앙값 대지 평당가', stats.medianPricePerPyeong, manwon(stats.medianPricePerPyeong), 'median(askingPrice / (landAreaM2 * 121 / 400))'), unit: '만원/평', note: '대지 기준 · 호가 / 대지 평수' }),
      kpiCard({ label: 'IRR 산출 불가', value: evidenceNumber({ label: 'IRR 산출 불가', text: number(rows.filter((r) => r.irr === null).length, 0),
        onClick: () => context.inspect({ label: 'IRR 산출 불가', text: `${rows.filter((r) => r.irr === null).length}개`,
          evidence: { value: rows.filter((r) => r.irr === null).length, formula: 'count(all inventory rows where engine levered IRR is null)',
            inputs: { criteria: filters, buildingIds: rows.filter((r) => r.irr === null).map((r) => r.building.id) }, provenance: { kind: 'derived', confidence: 'low' } }, source: '전체 가상 건물 · 월별 IRR 계산' }) }), unit: '개', note: '전체 건물 중 · 목표 충족에서 제외' }),
    );
    map.update({ matchingIds: new Set(matches.map((r) => r.building.id)), activeDistricts: filters.districts });
    renderList();
  }
  refresh();
  const unsubscribe = store.subscribe((state) => {
    if (state.filters === filters) return;
    const changedLtv = state.filters.ltvPct !== filters.ltvPct;
    filters = state.filters; page = 0; clearTimeout(timer);
    // LTV changes re-project 400 buildings; coalesce drag events. Other criteria
    // only compare cached metrics, so respond synchronously without losing focus.
    if (changedLtv) timer = setTimeout(refresh, 100); else refresh();
  });
  return { element: h('div', { className: 'page' },
    h('div', { className: 'page-heading' }, h('div', {}, h('div', { className: 'eyebrow' }, 'WORKSPACE / DEAL RADAR'), h('h1', {}, '딜 레이더'), h('p', {}, '고객의 투자 조건에서, 검토할 딜을 찾으세요.')), linkButton('전체 매물 목록 ↗', '#/listings')),
    kpis, h('div', { className: 'radar-workspace' }, panel.element,
      h('section', { className: 'radar-map-column', 'aria-label': '서울 가상 건물 지도' }, map.element,
        h('div', { className: 'map-footnote' }, h('span', {}, '강조된 점은 모든 투자 조건 일치 · 흐린 점도 상세 열기 가능'), h('span', {}, `예시 스냅샷 ${data.metadata.snapshotDate}`)),
        h('details', { className: 'card scoring-guide' }, h('summary', {}, '적합도와 수익률을 읽는 방법'), h('p', {}, SCORE_EXPLANATION), h('p', {}, 'IRR 산출 불가에는 모호한 복수 해와 해 없음이 포함됩니다. 대출심사·세금·실물 상태는 검증 전이며, IRR은 수익을 보장하지 않습니다.'))),
      h('section', { className: 'radar-results', 'aria-label': '조건에 맞는 후보 목록' }, h('div', { className: 'section-heading results-heading' }, h('h2', {}, '발견한 후보'), count),
        h('div', { className: 'radar-list-toolbar' }, select, h('label', { className: 'check-label' }, outside, '조건 외도 보기')), results, pagination))),
    destroy() { clearTimeout(timer); unsubscribe(); panel.destroy(); map.destroy(); },
  };
}
