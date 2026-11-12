import { inputFromBuilding } from '../engine/index.js';
import { valueUpAnalysis, valueUpDefaults, rentRollHeat, VALUEUP_TYPES } from '../valueup.js';
import { h, badge, button, emptyState, evidenceNumber, kpiCard, linkButton, slider, table } from './components.js';
import { eok, manwon, number, percent } from './format.js';
import { comparisonBars, downtimeTimeline } from './valueup-charts.js';
import { sceneNav } from './scene-nav.js';

const labels = { 'lease-up': '공실 임대', remodel: '리모델링', 'use-change': '용도 변경' };
const descriptions = { 'lease-up': '빈 공간을 임대해 수입 회복', remodel: '공사비·중단 기간과 임대료 인상', 'use-change': '공간 재편 비용과 임대 수요 가정' };
const amount = (v) => `${eok(v)}억`;
const signedAmount = (v) => `${v > 0 ? '+' : ''}${eok(v)}억`;
const pp = (v) => Number.isFinite(v) ? `${v > 0 ? '+' : ''}${number(v * 100)}%p` : '산출 불가';
const section = (title, body, note = '') => h('section', { className: 'card section-card' }, h('div', { className: 'section-heading' }, h('h2', {}, title), note && h('small', {}, note)), body);
const irrReason = (metric) => ({ ok: '월별 현금흐름의 연환산 수익률', ambiguous: '현금흐름 부호가 여러 번 바뀌어 유일한 IRR 확인 불가',
  invalid_equity: '초기 자기자본이 0 이하', no_solution: '현금흐름 부호 변화 없음', no_root_in_bounds: '계산 범위에서 해 없음' }[metric.status] ?? '계산 가능한 단일 수익률 없음');

export async function valueUpView(context, route) {
  const building = context.data.buildings.find((b) => b.id === route.id);
  if (!building) return { element: emptyState('가상 건물을 찾을 수 없습니다', '다른 예시 건물을 선택해 주세요.', linkButton('매물 목록', '#/listings')) };
  const deep = await context.loader.loadDeep(building);
  const input = inputFromBuilding(building, deep, { ltv: context.store.getState().filters.ltvPct / 100 });
  let settings = valueUpDefaults(deep), selected = 'lease-up', disposed = false;
  const controls = new Map(), planButtons = new Map();
  const results = h('div', { className: 'stack', 'data-valueup-results': '' });
  const status = h('p', { className: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const source = `${deep ? `data/${building.deepPath} · 상세 임대차` : 'data/buildings.json · 요약 수익 데이터'} · ${building.id}`;
  const inspect = (evidence, label, format = amount, from = source) => evidenceNumber({ label, text: format(evidence.value), evidence,
    onClick: () => context.inspect({ label, text: format(evidence.value), evidence, building, deep, source: from }) });

  function range(key, label, min, max, step, scale, format, applies = 'all') {
    const wrapper = slider({ label, min, max, step, value: settings[selected][key] * scale, format,
      onInput(value) {
        if (disposed || !selected) return;
        settings[selected] = { ...settings[selected], [key]: value / scale };
        refresh();
      } });
    const control = wrapper.querySelector('input');
    control.setAttribute('data-valueup-control', key); control.setAttribute('aria-label', label);
    controls.set(key, { input: control, output: wrapper.querySelector('output'), wrapper, scale, format, applies });
    return wrapper;
  }

  function refresh() {
    if (disposed) return;
    for (const [type, control] of planButtons) control.setAttribute('aria-pressed', String(type === selected));
    const p = settings[selected ?? 'lease-up'];
    for (const [key, control] of controls) {
      const visible = control.applies === 'all' || (control.applies === 'lease' ? selected === 'lease-up' : selected !== 'lease-up' && selected !== null);
      control.wrapper.hidden = !visible;
      control.input.disabled = selected === null || !visible;
      control.wrapper.setDisabled(selected === null || !visible);
      control.input.value = p[key] * control.scale;
      control.wrapper.setValue(p[key] * control.scale);
      control.output.textContent = control.format(p[key] * control.scale);
      control.input.setAttribute('aria-valuetext', control.format(p[key] * control.scale));
    }
    const result = valueUpAnalysis(input, selected, p);
    const cap = percent(input.exitCapRate), completion = result.stabilizationMonth;
    const active = selected ? labels[selected] : '실행안 꺼짐';
    const kpis = h('div', { className: 'kpi-strip valueup-kpis' },
      kpiCard({ label: '연 NOI 변화', value: inspect(result.delta.noi, '연 NOI 변화', signedAmount), note: `${completion}개월 차부터 12개월 비교`, accent: true }),
      kpiCard({ label: '수익가치 변화 · 비용 차감 전', value: inspect(result.delta.value, '수익가치 변화', signedAmount), note: `동일 Cap ${cap} · 매각가 보장 아님` }),
      kpiCard({ label: '자기자본 IRR 변화', value: inspect(result.delta.irr, 'IRR 변화', pp), note: '비용·수입 중단·보증금 변동 반영' }));
    const comparison = h('div', { className: 'valueup-comparisons' }, [['noi', '안정화 후 연 NOI'], ['value', '안정화 후 수익가치']].map(([key, title]) =>
      section(title, h('div', {}, comparisonBars(result, key, title), h('div', { className: 'valueup-pair' },
        h('span', {}, '개선 전 ', inspect(result.before[key], `개선 전 ${key === 'noi' ? '연 NOI' : '수익가치'}`)),
        h('span', {}, '개선 후 ', inspect(result.after[key], `개선 후 ${key === 'noi' ? '연 NOI' : '수익가치'}`)))), '단위: 억원')));
    const returns = h('div', { className: 'valueup-returns' }, [['before', '기존 운영 IRR'], ['after', '실행 후 IRR']].map(([key, label]) =>
      h('div', {}, h('span', { className: 'muted' }, label), inspect(result[key].irr, label, percent), h('small', {}, irrReason(result[key].irr)))));
    const costRows = [['실행 비용', result.capex], ['보유 중 임대 중단에 따른 NOI 감소', result.downtimeNoiLoss], ['수익가치 증가 − 실행 비용 (단순 차감)', result.netValueAfterCapex]];
    const costTable = table({ caption: '실행안 비용과 수익가치 단순 비교', rows: costRows, columns: [
      { label: '항목', render: (row) => row[0] }, { label: '억원', numeric: true, render: (row) => inspect(row[1], row[0], signedAmount) },
    ] });
    let explanation;
    if (selected === 'lease-up') explanation = `현재 임대료 기준 공실·손실률 ${percent(input.vacancyRate)} 중 ${percent(p.leaseUpFraction)}를 해소해 안정화 후 ${percent(result.afterResult.assumptions.intervention.targetVacancyRate)}로 낮춥니다. 기존 임차인의 임대료는 그대로 두고 빈 공간의 임대료와 관리 수입을 회복합니다. 모집 기간에는 기존 수입을 유지합니다.`;
    else if (selected) explanation = `잠재 임대료의 ${percent(p.affectedShare)}에 해당하는 부분을 ${p.downtimeMonths}개월 중단하고, 완료 후 해당 부분의 임대료가 ${percent(p.rentUpliftRate)} 높아진다고 가정합니다. 공실률은 기존 ${percent(input.vacancyRate)}를 유지하며 운영비·이자는 중단 기간에도 발생합니다. ${selected === 'use-change' ? '용도 변경 인허가·건축·소방 적합성과 추가 운영비는 미확인입니다.' : '퇴거 협의·견적·추가 수선비는 미확인입니다.'}`;
    else explanation = '실행안을 선택하지 않아 기존 운영과 같은 조건으로 계산합니다. 버튼을 다시 누르면 해당 실행안을 켤 수 있습니다.';
    results.replaceChildren(h('div', { className: 'valueup-selection' }, badge(active, 'accent'), h('span', {}, `호가 ${amount(input.purchasePriceKrw)} · 보유 ${input.holdYears}년 · LTV ${percent(input.ltv)}`)), kpis, comparison,
      section('개선 효과와 비용', h('div', { className: 'stack' }, h('p', {}, explanation),
        h('p', {}, `같은 시점의 전후 연 NOI를 각각 동일한 Cap ${cap}로 나눈 뒤 수익가치 차이를 비교합니다. NOI가 0 이하이면 수익가치는 0으로 표시하며 토지 가치를 평가한 결과가 아닙니다. 임대료 상승과 공실 해소가 수입을 늘려도, 실행 비용과 임대 중단이 크면 투자 수익률은 낮아질 수 있습니다.`),
        returns, result.delta.irr.value === null && h('p', { className: 'notice' }, 'IRR 변화 산출 불가 · 전후 중 하나의 IRR을 확정할 수 없습니다. 위 사유와 점선 수치의 현금흐름 근거를 확인해 주세요.'), costTable,
        h('p', { className: 'hint' }, '수익가치는 안정화 시점의 총액이며 실행 비용·매각 비용·세금을 차감하기 전입니다. 단순 차감 금액은 이익·NPV가 아닙니다. IRR은 월별 비용·손실·차입금 상환·매각 비용과 보증금 정산을 반영합니다.'))),
      section('실행 일정 · 다운타임', downtimeTimeline(result), '취득 후 상대 월 · 월말 현금흐름'),
      h('p', { className: 'hint' }, `금리 ${percent(input.annualInterestRate)} · 연 임대료 상승 ${percent(input.annualRentGrowth)} · 비용은 시작 월말에 일시 지급합니다. 추가 차입은 없고, 공사 중 해당 비중의 기존 보증금 반환·완료 후 재유입을 반영합니다. 새 임대 보증금은 0으로 가정합니다. ${deep ? '상세 예시 노트에서 실행 비용·기간·인상률 초기값을 가져왔습니다.' : '실행 비용·기간·인상률은 별도 예시 기본값입니다.'}`));
    status.textContent = `${active}. 연 NOI 변화 ${signedAmount(result.delta.noi.value)}, 수익가치 변화 ${signedAmount(result.delta.value.value)}, IRR 변화 ${pp(result.delta.irr.value)}.`;
  }

  const plans = h('div', { className: 'valueup-plans', role: 'group', 'aria-label': '실행안 선택 · 한 번에 하나' }, VALUEUP_TYPES.map((type) => {
    const control = h('button', { type: 'button', className: 'valueup-plan', 'data-valueup-plan': type, 'aria-pressed': String(selected === type),
      onClick() { if (disposed) return; selected = selected === type ? null : type; refresh(); } }, h('strong', {}, labels[type]), h('span', {}, descriptions[type]));
    planButtons.set(type, control); return control;
  }));
  const ranges = h('div', { className: 'bid-ranges' },
    range('leaseUpFraction', '공실 임대 비율', 0, 100, 5, 100, (v) => `${number(v)}%`, 'lease'),
    range('affectedShare', '대상 비중 · 잠재 임대료 기준', 0, 100, 5, 100, (v) => `${number(v)}%`, 'works'),
    range('capexKrw', '실행 비용 · 공사/임대 유치', 0, 20, .01, 1e-8, (v) => `${number(v)}억`),
    range('downtimeMonths', '모집/임대 중단 기간', 0, 24, 1, 1, (v) => `${v}개월`),
    range('rentUpliftRate', '완료 후 임대료 인상률', 0, 100, 'any', 100, (v) => `${number(v)}%`, 'works'),
    range('startMonth', '실행 시작 월', 1, 24, 1, 1, (v) => `${v}개월 차`));
  const reset = button('실행안 초기화', () => { if (disposed) return; settings = valueUpDefaults(deep); selected = 'lease-up'; refresh(); }, 'ghost');
  const controlsPanel = h('aside', { className: 'card bid-controls valueup-controls', 'aria-label': '밸류업 가정' },
    h('div', { className: 'section-heading' }, h('h2', {}, '실행안 선택'), reset), plans,
    h('p', { className: 'hint' }, '한 번에 한 개의 실행안을 비교합니다. 선택한 버튼을 다시 누르면 꺼집니다. 실행안별 수정값은 이 화면에서 유지됩니다.'), ranges,
    h('p', { className: 'notice' }, '대상 비중은 임대료 수입 기준의 일괄 가정입니다. 아래 층별 호실을 직접 공사 대상으로 지정한 결과가 아닙니다. 실제 갱신·퇴거 일정은 반영하지 않습니다.'));

  function heatStrip() {
    if (!deep) {
      const example = context.data.buildings.find((b) => b.deepPath);
      return emptyState('층별 임대차 없음', '요약 수익 데이터로 전체 건물 실행안만 계산합니다. 공실 호실·저임대료·만기 정보는 UNKNOWN입니다.', example && linkButton('상세 예시에서 층별 보기', `#/building/${example.id}/valueup`));
    }
    const reference = context.data.references.districts.find((d) => d.id === building.districtId);
    const floors = rentRollHeat(deep.rentRoll, context.data.metadata.snapshotDate, reference);
    return h('div', { className: 'stack' }, h('div', { className: 'valueup-heat-legend' }, badge('□ 공실', 'accent'), badge('▼ 참고 대비 저임대료'), badge('◷ 12개월 내 만기 / 기경과')),
      h('div', { className: 'valueup-heat' }, floors.map((floor) => h('div', { className: 'valueup-floor' }, h('strong', {}, floor.floor), h('div', { className: 'valueup-units' }, floor.units.map((unit) => {
        const flags = [unit.vacant ? '□ 공실' : '임대 중', unit.belowMarket === true && '▼ 저임대료', unit.expiring && (unit.overdue ? '◷ 만기 경과' : '◷ 12개월 내 만기'),
          unit.expiryUnknown && '만기 미확인', unit.referenceRentKrw === null && '참고 임대료 미확인', unit.belowMarket === null && '임대료 비교 미확인'].filter(Boolean);
        return h('button', { type: 'button', className: `valueup-unit evidence-number${unit.vacant ? ' is-vacant' : ''}${unit.belowMarket ? ' is-below' : ''}${unit.expiring ? ' is-expiring' : ''}`,
          'data-confidence': 'low', 'aria-haspopup': 'dialog',
          'data-heat-unit': unit.unit, 'aria-label': `${floor.floor} ${unit.unit} · ${flags.join(' · ')} · 월세 ${manwon(unit.monthlyRentKrw)}만원 · 근거 보기`,
          onClick: () => context.inspect({ label: `${unit.unit} · 임대료 참고 비교`, text: unit.referenceRentKrw === null ? '참고 임대료 UNKNOWN' : `현재 ${manwon(unit.rentPerPyeongKrw)}만원/평 · 참고 ${manwon(unit.referenceRentKrw)}만원/평`, evidence: unit.referenceEvidence, building, deep,
            source: `${source} · data/market_refs.json · 기준 ${context.data.metadata.snapshotDate} · 만기 ${unit.leaseEnd ?? 'UNKNOWN'} (공실 제외)` }) },
        h('strong', {}, unit.unit), h('span', {}, flags.join(' · ')), h('span', {}, `월세 ${manwon(unit.monthlyRentKrw)}만원 · ${unit.vacant ? '미임대' : `만기 ${unit.leaseEnd ?? 'UNKNOWN'}`}`));
      }))))),
      h('p', { className: 'hint' }, `기준일 ${context.data.metadata.snapshotDate} · 현재 임대차만 표시합니다. 저임대료는 계약 월세/전용평이 해당 구·층 유형의 참고 범위 중간값보다 10% 초과 낮은 경우입니다. 참고값은 검증 전 예시로 실제 시장가가 아닙니다. 지하층 참고값은 UNKNOWN입니다. 만기는 기준일로부터 12개월 이내 및 기경과를 표시하며 공실 예측이 아닙니다.`));
  }
  refresh();
  const href = `#/building/${building.id}`;
  return { selectId: building.id, element: h('div', { className: 'page valueup-page' },
    h('div', { className: 'breadcrumb' }, h('a', { href: '#/radar' }, '딜 레이더'), ' / ', h('a', { href }, building.nameKo), ' / 밸류업'),
    h('div', { className: 'page-heading' }, h('div', {}, h('div', { className: 'eyebrow' }, building.nameKo), h('h1', {}, '밸류업 시뮬레이터'),
      h('p', {}, `${building.nameKo} · ${deep ? '상세 임대차·운영비' : '요약 수익 데이터'} 기반 · ${building.statusKo}`)),
      h('div', { className: 'actions' }, badge('예시 데이터 · 실제 매물 아님', 'accent'), linkButton('건물 개요', href), linkButton('매수 한도가', `${href}/bid`))),
    sceneNav(building, 'valueup'),
    h('div', { className: 'bid-layout valueup-layout' }, controlsPanel, h('div', { className: 'bid-results stack' }, results, status)),
    section('현재 층별 임대차 · 기회와 리스크', heatStrip(), '실행안 적용 전 · 호실을 눌러 근거 확인'),
    h('p', { className: 'notice' }, '예시 데이터 · 실제 매물 아님. 모든 실행 비용·공사 기간·임대료·금융 조건은 검증 필요 가정입니다. 실제 수요·임대차 동의·건축 및 인허가 가능성·세금/VAT·공사비 증액·추가 운영비는 UNKNOWN입니다. 감정평가·매수 권고·대출 승인이 아닙니다. 수정값은 화면 이동·새로고침 시 초기화되며 제안서에 자동 반영되지 않습니다.')),
    destroy() { disposed = true; } };
}
