import { createBidInput, bidAnalysis, bidSensitivity, bidGuidance, bidPolicy, exactPrice } from '../bid.js';
import { h, badge, button, emptyState, evidenceNumber, kpiCard, linkButton, slider, table } from './components.js';
import { bidAmount, eok, number, percent } from './format.js';
import { priceRuler, cashflowChart, tornadoChart, sensitivityLabels, sensitivityValue } from './bid-charts.js';

const constraintLabel = (value, floor = false) => ({ target_irr: floor ? '최소 IRR' : '목표 IRR', min_dscr: '최소 DSCR', both: 'IRR + DSCR',
  infeasible: '충족 가능한 가격 없음', unavailable: '판단 불가' }[value] ?? '판단 불가');
const times = (v) => Number.isFinite(v) ? `${number(v)}배` : '산출 불가';
const section = (title, body, note = '') => h('section', { className: 'card section-card' }, h('div', { className: 'section-heading' }, h('h2', {}, title), note && h('small', {}, note)), body);
const signedPercent = (v) => `${v > 0 ? '+' : ''}${number(v * 100)}%`;
let sequence = 0;

export async function bidView(context, route) {
  const building = context.data.buildings.find((b) => b.id === route.id);
  if (!building) return { element: emptyState('가상 건물을 찾을 수 없습니다', '다른 예시 건물을 선택해 주세요.', linkButton('매물 목록', '#/listings')) };
  const deep = await context.loader.loadDeep(building);
  const initialOverrides = { ltv: context.store.getState().filters.ltvPct / 100 };
  const initialPolicy = bidPolicy({ targetIrr: context.store.getState().filters.targetIrrPct / 100 });
  let overrides = { ...initialOverrides }, policy = { ...initialPolicy }, currentInput = createBidInput(building, deep, overrides);
  let analysis, sensitivityTimer, disposed = false;
  const controls = new Map();
  const kpis = h('div', { className: 'kpi-strip bid-kpis', 'data-bid-kpis': '' });
  const rulerSlot = h('div', { 'data-bid-ruler': '' }), ceilingSlot = h('div'), guidanceSlot = h('div');
  const cashSlot = h('div'), fundingSlot = h('div');
  const sensitivitySlot = h('div', { className: 'bid-sensitivity-grid' });
  const sensitivityStatus = h('p', { className: 'hint', role: 'status', 'aria-live': 'polite' });
  const metricsStatus = h('p', { className: 'sr-only', role: 'status', 'aria-live': 'polite' });
  const policyStatus = h('p', { className: 'hint', role: 'status', 'aria-live': 'polite' });

  const inspectNumber = (evidence, label, format, source = '') => evidenceNumber({ text: format(evidence.value), label, evidence,
    onClick: () => context.inspect({ label, text: format(evidence.value), evidence, building, deep,
      source: `${deep ? `data/${building.deepPath} · 상세 임대차` : 'data/buildings.json · 요약 수익 데이터'} · ${building.id} · ${source || '월별 엔진 계산'}` }) });

  function policyFields() {
    return h('div', { className: 'bid-policy-fields' }, [
      ['targetIrr', '목표 IRR (%)', -99, 100, .5, 100], ['floorIrr', '최소 IRR (%)', -99, 100, .5, 100], ['minDscr', '최소 DSCR (배)', 1, 5, .05, 1],
    ].map(([key, label, min, max, step, scale]) => {
      const id = `bid-policy-${++sequence}`;
      const input = h('input', { id, type: 'number', min, max, step, value: policy[key] * scale, className: 'select-field', 'aria-label': label, 'data-bid-control': key,
        onChange(event) {
          if (disposed) return;
          const text = event.target.value.trim(), value = Number(text);
          if (!text || !Number.isFinite(value) || value < min || value > max) {
            event.target.value = policy[key] * scale;
            policyStatus.textContent = `${label}: ${min}–${max} 범위의 숫자를 입력해 주세요. 이전 값을 유지합니다.`;
            return;
          }
          policy = { ...policy, [key]: value / scale };
          policyStatus.textContent = '';
          if (policy.floorIrr > policy.targetIrr) {
            if (key === 'floorIrr') policy.targetIrr = policy.floorIrr; else policy.floorIrr = policy.targetIrr;
            policyStatus.textContent = '최소 IRR이 목표를 넘지 않도록 두 조건을 같은 값으로 맞췄습니다.';
          }
          for (const name of ['targetIrr', 'floorIrr', 'minDscr']) controls.get(name).input.value = policy[name] * (name === 'minDscr' ? 1 : 100);
          refresh();
        } });
      controls.set(key, { input, scale });
      return h('label', { className: 'bid-policy-label', for: id }, label, input);
    }));
  }

  function range(key, label, min, max, step, scale, format) {
    const control = slider({ label, min, max, step, value: currentInput[key] * scale, format,
      onInput(value) { if (disposed) return; overrides = { ...overrides, [key]: value / scale }; refresh(); } });
    const input = control.querySelector('input'), output = control.querySelector('output');
    input.setAttribute('data-bid-control', key); input.setAttribute('aria-label', label);
    controls.set(key, { input, output, scale, format });
    return control;
  }

  function ceilings() {
    return h('div', { className: 'bid-ceilings' }, [[analysis.buy, 'BUY', false], [analysis.walk, 'WALK-AWAY', true]].map(([pricing, label, floor]) => {
      const amount = { ...pricing.maxPrice, value: exactPrice(pricing) };
      return h('div', { className: `bid-ceiling ${floor ? 'bid-ceiling-walk' : ''}` },
        h('div', { className: 'actions' }, h('strong', {}, label), badge(`제약: ${constraintLabel(pricing.bindingConstraint, floor)}`)),
        h('div', { className: 'bid-ceiling-value' }, inspectNumber(amount, `${label} 한도가`, bidAmount, `고정 LTV 가격 역산 · ${pricing.maxPrice.status}`)),
        h('p', { className: 'hint' }, `${floor ? '최소' : '목표'} IRR ${percent(floor ? policy.floorIrr : policy.targetIrr)} · 최소 DSCR ${times(policy.minDscr)}`),
        h('p', { className: 'hint' }, `IRR 단독 한도 ${bidAmount(pricing.atTargetIrr.status === 'ok' ? pricing.atTargetIrr.value : null)} / DSCR 한도 ${pricing.atMinDscr.status === 'not_applicable' ? '해당 없음' : bidAmount(pricing.atMinDscr.status === 'ok' ? pricing.atMinDscr.value : null)}`),
        pricing.maxPrice.status !== 'ok' && h('p', { className: 'hint' }, pricing.maxPrice.lowerBoundOnly ? '탐색 상한 도달 · 정확한 한도가로 제시하지 않습니다.' : '유효한 가격 한도 산출 불가 · 현금흐름과 입력을 확인하세요.'));
    }));
  }

  function guidance() {
    const guide = bidGuidance(analysis, building.askingPriceKrw);
    const hasBid = guide.tone !== 'unavailable';
    return h('div', { className: `bid-guidance bid-guidance-${guide.tone}` }, h('h3', {}, guide.title), h('p', {}, guide.detail),
      hasBid && h('p', { className: 'bid-negotiation' }, guide.buyVsAsk < 0
        ? `목표 조건에 맞춘 BUY 제안 상한 ${bidAmount(guide.buyPriceKrw)} · 호가 대비 ${signedPercent(guide.buyVsAsk)} 가격 조정을 협의하세요.`
        : `호가가 BUY 한도 ${bidAmount(guide.buyPriceKrw)} 이내입니다. 추가 인상 여력으로 해석하지 말고 실사 조건을 먼저 협의하세요.`),
      hasBid && h('p', { className: 'hint' }, `WALK-AWAY ${bidAmount(guide.walkPriceKrw)} · 호가 대비 ${signedPercent(guide.walkVsAsk)}. 최종 합의가가 이 한도를 넘으면 재검토하세요.`),
      h('p', { className: 'hint' }, `매도 동기 (가상): ${building.sellerMotivationKo} · 등록 ${building.daysOnMarket}일. 협상 수용 가능성은 UNKNOWN입니다.`),
      building.statusKo === '거래완료 참고' && h('p', { className: 'notice' }, '거래완료 참고 예시입니다. 현재 매수 가능한 매물이 아니며, 협상 문구는 가상 연습용입니다.'));
  }

  function funding() {
    const { result } = analysis;
    const items = [
      ['초기 대출', result.initial.loan, eok], ['취득 비용 합계', result.initial.acquisitionCosts, eok], ['대출 실행 비용', result.initial.loanFee, eok],
      ['반환할 임차 보증금', result.exit.depositSettlement, eok], ['매각 시점 순정산', result.exit.netProceeds, eok], ['첫해 NOI', result.metrics.noi, eok],
    ];
    return h('div', { className: 'stack' }, h('dl', { className: 'info-grid' }, items.map(([label, value, format]) => h('div', {}, h('dt', {}, `${label} (억)`), h('dd', {}, inspectNumber(value, label, format))))),
      h('p', { className: 'notice' }, '대출은 이자만 매월 납부하며 매각 시 원금을 상환합니다. 가격 역산 시 LTV를 고정하고 대출액·취득 비용을 함께 조정합니다. 보증금은 초기 자기자본을 줄이고 매각 시 반환 부채로 차감합니다.'),
      h('p', { className: 'hint' }, '취득세 예산 4.6% + 중개 0.5% + 기타 0.3%, 대출 비용 0.5% (대출액 기준), 매각 비용 0.5% (매각가 기준). 모두 검증 전 예시 가정입니다.'));
  }

  function sensitivity() {
    if (disposed) return;
    try {
      const model = bidSensitivity(currentInput, policy), grid = model.grid;
      const gridTable = h('div', { className: 'table-wrap' }, h('table', { className: 'data-table bid-grid' },
        h('caption', { className: 'sr-only' }, '금리(열) × 매각 Cap(행) — IRR 및 BUY 한도가'),
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, '매각 Cap ↓ / 금리 →'), grid.xValues.map((x) => h('th', { scope: 'col' }, percent(x))))),
        h('tbody', {}, grid.yValues.map((y, yi) => h('tr', {}, h('th', { scope: 'row' }, percent(y)), grid.xValues.map((_, xi) => {
          const cell = grid.cells[yi][xi], passes = cell.irr.value !== null && cell.irr.value >= policy.targetIrr;
          return h('td', { className: `bid-grid-cell${passes ? ' bid-grid-pass' : ''}${yi === 1 && xi === 1 ? ' bid-grid-current' : ''}` },
            inspectNumber(cell.irr, `금리 ${percent(grid.xValues[xi])} 매각 Cap ${percent(y)} IRR`, percent),
            h('div', { className: 'subtext' }, 'BUY ', inspectNumber({ ...cell.maxPrice, value: cell.maxPrice.status === 'ok' ? cell.maxPrice.value : null }, '민감도 BUY 한도가', bidAmount)),
            h('span', { className: 'subtext' }, yi === 1 && xi === 1 ? '현재 가정' : passes ? 'IRR 목표 충족' : 'IRR 미달·산출 불가'));
        }))))));
      sensitivitySlot.replaceChildren(
        section('어떤 가정에 민감한가', h('div', { className: 'stack' }, tornadoChart(model.tornado),
          h('p', { className: 'hint' }, '금리 ±1%p · 공실 ±5%p · 임대료 상승 ±1%p · 매각 Cap ±0.5%p · 초기 공사비 ±검토가의 2% (0원 하한). 한 번에 하나만 변경하며, IRR 변화폭 순으로 표시합니다.'),
          h('details', { className: 'bid-detail' }, h('summary', {}, '민감도 입력·IRR·BUY 한도가 표'), table({ caption: '토네이도 하단/상단 입력 및 계산 결과', rows: model.tornado.rows, columns: [
            { label: '변수', render: (r) => sensitivityLabels[r.field] },
            { label: '하단 → 상단 입력', render: (r) => `${sensitivityValue(r.field, r.lowInput)} → ${sensitivityValue(r.field, r.highInput)}` },
            ...[['low', '하단'], ['high', '상단']].map(([key, label]) => ({ label: `${label} IRR / BUY`, numeric: true, render: (r) => h('div', {}, inspectNumber(r[key].irr, `${label} IRR`, percent), h('span', { className: 'subtext' }, inspectNumber({ ...r[key].maxPrice, value: r[key].maxPrice.status === 'ok' ? r[key].maxPrice.value : null }, `${label} BUY 한도가`, bidAmount))) })),
          ] }))), '기준 대비 IRR 변화 · %p'),
        section('금리 × 매각 Cap', h('div', { className: 'stack' }, gridTable,
          h('p', { className: 'hint' }, `열: 대출 금리 ±1%p / 행: 매각 Cap ±0.5%p. 가운데가 현재 가정입니다. 각 셀은 IRR과 목표 IRR ${percent(policy.targetIrr)}·최소 DSCR ${times(policy.minDscr)}을 함께 적용한 BUY 한도입니다. 녹색은 IRR 목표 충족만 의미하며 대출 승인이 아닙니다.`)), '각 셀 전체 모델 재계산'));
      sensitivityStatus.textContent = '민감도 계산 완료 · 현재 가정 기준';
      sensitivitySlot.setAttribute('aria-busy', 'false');
    } catch {
      sensitivityStatus.textContent = '민감도를 산출하지 못했습니다. 가정을 변경하거나 초기화해 주세요.';
      sensitivitySlot.replaceChildren(); sensitivitySlot.setAttribute('aria-busy', 'false');
    }
  }

  function refresh(initial = false) {
    if (disposed) return;
    clearTimeout(sensitivityTimer);
    currentInput = createBidInput(building, deep, overrides);
    analysis = bidAnalysis(currentInput, policy);
    const dscr = analysis.result.metrics.minDscr;
    kpis.replaceChildren(
      kpiCard({ label: '레버리지 IRR', value: context.metricNumber(analysis.result, 'leveredIrr', '레버리지 IRR', percent), note: `${currentInput.holdYears}년 · 월별 현금흐름 연율화`, accent: true }),
      kpiCard({ label: '최저 DSCR', value: context.metricNumber(analysis.result, 'minDscr', '최저 DSCR', (v) => dscr.status === 'not_applicable' ? '해당 없음' : times(v)), note: `보유기간 연간 구간 최저 · 첫해 ${analysis.result.metrics.dscr.status === 'not_applicable' ? '해당 없음' : times(analysis.result.metrics.dscr.value)}` }),
      kpiCard({ label: '초기 필요 자기자본', value: context.metricNumber(analysis.result, 'equityRequired', '초기 필요 자기자본', eok), unit: '억', note: '취득 비용·대출·반환 보증금 반영' }),
      kpiCard({ label: '자기자본 배수', value: context.metricNumber(analysis.result, 'equityMultiple', '자기자본 배수', times), note: '분배금 / (초기 자본 + 추가 납입)' }));
    rulerSlot.replaceChildren(priceRuler(analysis, building.askingPriceKrw));
    ceilingSlot.replaceChildren(ceilings()); guidanceSlot.replaceChildren(guidance());
    cashSlot.replaceChildren(cashflowChart(analysis)); fundingSlot.replaceChildren(funding());
    metricsStatus.textContent = `IRR ${percent(analysis.result.metrics.leveredIrr.value)}, 최저 DSCR ${dscr.status === 'not_applicable' ? '해당 없음' : times(dscr.value)}, 초기 자기자본 ${eok(analysis.result.metrics.equityRequired.value)}억.`;
    if (initial) sensitivity(); else {
      sensitivitySlot.replaceChildren(); sensitivitySlot.setAttribute('aria-busy', 'true');
      sensitivityStatus.textContent = '민감도 다시 계산 중…';
      sensitivityTimer = setTimeout(sensitivity, 180);
    }
  }

  function reset() {
    if (disposed) return;
    overrides = { ...initialOverrides }; policy = { ...initialPolicy };
    currentInput = createBidInput(building, deep, overrides);
    for (const [key, control] of controls) {
      const value = (key in policy ? policy[key] : currentInput[key]) * control.scale;
      control.input.value = value;
      if (control.output) { control.output.textContent = control.format(value); control.input.setAttribute('aria-valuetext', control.format(value)); }
    }
    policyStatus.textContent = '처음 불러온 예시 가정으로 초기화했습니다.';
    refresh();
  }

  const ranges = h('div', { className: 'bid-ranges' },
    range('purchasePriceKrw', '현재 검토가', 1, Math.max(200, Math.ceil(building.askingPriceKrw / 1e8 * 1.5)), .01, 1e-8, (v) => `${number(v)}억`),
    range('annualInterestRate', '대출 금리', 0, 12, .1, 100, (v) => `${number(v)}%`),
    range('ltv', 'LTV', 0, 90, 1, 100, (v) => `${number(v)}%`),
    range('vacancyRate', '공실·임대료 손실률', 0, 100, .1, 100, (v) => `${number(v)}%`),
    range('annualRentGrowth', '연 임대료 상승률', -5, 10, .1, 100, (v) => `${number(v)}%`),
    range('exitCapRate', '매각 Cap rate', 1, 10, .1, 100, (v) => `${number(v)}%`),
    range('holdYears', '보유기간', 1, 20, 1, 1, (v) => `${v}년`));
  const policies = policyFields();
  const controlsPanel = h('aside', { className: 'card bid-controls', 'aria-label': '매수 검토 가정' },
    h('div', { className: 'section-heading' }, h('h2', {}, '딜의 조건'), button('가정 초기화', reset, 'ghost')), ranges,
    h('div', { className: 'bid-policy' }, h('h3', {}, 'BUY / WALK-AWAY 기준'), policies, policyStatus,
      h('p', { className: 'hint' }, '목표 IRR은 레이더에서 가져옵니다. 최초 최소 IRR은 목표보다 3%p 낮게 (양수 목표는 0% 하한), 최소 DSCR은 1.20배로 가정합니다. 음수 목표의 최소 IRR도 3%p 낮게 설정합니다 (−99% 하한). 모두 편집 가능한 예시 투자 기준입니다.')),
    h('p', { className: 'notice' }, '공실은 잠재 임대료 대비 미수취 비율입니다. 면적 공실률과 다르며, 기존 수취 임대료에 공실을 중복 차감하지 않습니다. 보증금은 손실률 변경 시 자동 조정하지 않습니다.'));
  refresh(true);
  const href = `#/building/${building.id}`;
  const element = h('div', { className: 'page bid-page' },
    h('div', { className: 'breadcrumb' }, h('a', { href: '#/radar' }, '딜 레이더'), ' / ', h('a', { href }, building.nameKo), ' / 매수 한도가'),
    h('div', { className: 'page-heading' }, h('div', {}, h('div', { className: 'eyebrow' }, 'DEAL ROOM / MAX BID'), h('h1', {}, '얼마까지 제안할 수 있을까'),
      h('p', {}, `${building.nameKo} · ${deep ? `상세 임대차 ${deep.rentRoll.length}개 호실·운영비` : '요약 수익 데이터'} 기반 · ${building.statusKo}`)),
      h('div', { className: 'actions' }, badge('예시 데이터 · 실제 매물 아님', 'accent'), linkButton('건물 개요', href), linkButton('밸류업', `${href}/valueup`))),
    h('div', { className: 'bid-layout' }, controlsPanel, h('div', { className: 'stack bid-results' }, kpis, metricsStatus,
      section('호가에서 합의 가능한 가격으로', h('div', { className: 'stack' }, rulerSlot, ceilingSlot, guidanceSlot,
        h('p', { className: 'hint' }, 'BUY = 목표 IRR과 최소 DSCR을 함께 충족하는 최대 가격. WALK-AWAY = 최소 IRR과 동일 DSCR을 함께 충족하는 최대 가격. 같은 제약이 적용되면 두 선이 겹칩니다. 한도가 숫자는 0.1억 단위 내림, 차트 위치·비교율은 원 계산값 기준입니다.'))),
      section('보유부터 매각까지의 현금흐름', cashSlot, '월별 모델 → 연도별 합계'),
      section('자금 조달과 정산', fundingSlot, '핵심 수치를 눌러 근거 확인'))),
    h('div', { className: 'bid-sensitivity-heading' }, h('h2', {}, '가정이 바뀌면, 한도도 바뀝니다'), sensitivityStatus), sensitivitySlot,
    h('p', { className: 'notice' }, '예시 데이터 · 실제 매물 아님. 모든 계산은 검증 전 가정이며 매수 권고·감정평가·대출 승인이 아닙니다. VAT·소득세·양도세·재융자·중도상환 수수료·실제 만기별 갱신을 모델링하지 않습니다. 실제 임대차·비용·금융 조건·세무 검토가 필요합니다.'));
  return { element, selectId: building.id, destroy() { disposed = true; clearTimeout(sensitivityTimer); } };
}
