import { proposalAnalysis } from '../proposal.js';
import { h, badge, button, emptyState, evidenceNumber, linkButton, table } from './components.js';
import { eok, manwon, number, percent } from './format.js';
import { proposalNoiChart, proposalCashflowChart } from './proposal-charts.js';
import { buildingPhoto } from './photo.js';
import { EXAMPLE_DATA_LABEL } from './disclosure.js';
import { sceneNav } from './scene-nav.js';

const EXAMPLE = EXAMPLE_DATA_LABEL;
const DEFAULT_BROKER = '예시 중개사';
const money = (v) => Number.isFinite(v) ? `${eok(v)}억` : '산출 불가';
const times = (v) => Number.isFinite(v) ? `${number(v)}배` : '해당 없음';
// Round DOWN price ceilings; presentation must never increase a solved maximum.
const bidMoney = (v) => Number.isFinite(v) ? `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(Math.floor(v / 1e6) / 100)}억` : '산출 불가';
const rangeText = (v) => v ? `${bidMoney(v[0])} ~ ${bidMoney(v[1])}` : '제안가 판단 보류';
const signedPercent = (v) => Number.isFinite(v) ? `${v >= 0 ? '+' : ''}${percent(v)}` : '산출 불가';
const constraint = (v) => ({ target_irr: '목표 IRR', min_dscr: '최소 DSCR', both: 'IRR·DSCR', infeasible: '충족 불가', unavailable: '판단 불가' }[v] ?? '판단 불가');
const block = (title, ...children) => h('section', { className: 'proposal-block' }, h('h3', {}, title), children);
const facts = (rows) => h('dl', { className: 'proposal-facts' }, rows.map(([key, value]) => h('div', {}, h('dt', {}, key), h('dd', {}, value))));

function picker(context) {
  const candidates = context.data.buildings.filter((b) => b.deepPath && b.statusKo !== '거래완료 참고')
    .toSorted((a, b) => a.askingPriceKrw - b.askingPriceKrw).slice(0, 3);
  return { element: h('div', { className: 'page' }, h('div', { className: 'page-heading' }, h('div', {}, h('p', { className: 'eyebrow' }, 'WORKSPACE / PROPOSAL'),
    h('h1', {}, '고객 제안서'), h('p', {}, '검토할 건물을 선택해 매수자·매도자용 제안서를 작성하세요.')), linkButton('전체 매물에서 선택', '#/listings')),
    h('p', { className: 'notice' }, EXAMPLE), h('div', { className: 'value-grid' }, candidates.map((b) => h('a', {
      className: 'card building-card', href: `#/building/${b.id}/proposal?for=buyer`, 'data-card-id': b.id },
    buildingPhoto(b), badge('상세 임대차', 'accent'), h('h3', {}, b.nameKo), h('p', { className: 'location' }, b.addressKo), h('p', { className: 'price-row' }, `호가 ${money(b.askingPriceKrw)} · 제안서 보기 →`))))) };
}

export async function proposalView(context, route) {
  const id = route.id || context.store.getState().selectedId;
  if (!id) return picker(context);
  const building = context.data.buildings.find((b) => b.id === id);
  if (!building) return { element: emptyState('가상 건물을 찾을 수 없습니다', '다른 예시를 선택해 주세요.', linkButton('매물 목록', '#/listings')) };
  const [deep, inventory] = await Promise.all([context.loader.loadDeep(building), context.loader.load('comps.json')]);
  const filters = context.store.getState().filters;
  const p = proposalAnalysis(building, deep, inventory.comps, { ltv: filters.ltvPct / 100, targetIrr: filters.targetIrrPct / 100 });
  const seller = route.params.get('for') === 'seller';
  const { base, policy, comparison } = p, a = base.assumptions;
  const source = deep ? `data/${building.deepPath} · rentRoll / opex` : `data/buildings.json · ${id} · 요약 수익`;
  let disposed = false;
  let brokerName = context.store.getState().proposalBrokerName ?? DEFAULT_BROKER;
  const brokerLabels = [];
  const brokerText = () => { const node = h('span', { 'data-proposal-broker': '' }, brokerName.trim() || DEFAULT_BROKER); brokerLabels.push(node); return node; };
  const snapshot = context.data.metadata.snapshotDate;

  const inspect = (evidence, label, format = money, evidenceSource = source, result = base) => evidenceNumber({
    text: format(evidence.value), label, evidence,
    onClick: () => { if (!disposed) context.inspect({ label, text: format(evidence.value), evidence, building, deep, result,
      source: `${evidenceSource} · ${base.engineVersion}` }); },
  });
  const metric = (key, label, format = money, result = base) => inspect(result.metrics[key], label, format, source, result);
  const sheet = (index, title, className, ...children) => h('section', { className: `card proposal-sheet ${className}`, 'data-proposal-sheet': index,
    'aria-label': `${index} / ${title}` },
  h('header', { className: 'proposal-sheet-header' }, h('span', {}, 'PLOT OS / PROPOSAL'), h('span', {}, `${seller ? '매도자용' : '매수자용'} · ${snapshot}`)),
  h('div', { className: 'proposal-sheet-body' }, children),
  h('footer', { className: 'proposal-sheet-footer' }, h('span', {}, EXAMPLE), h('span', {}, brokerText(), ` · 섹션 ${index} / 5`)));

  const buyerDecision = () => h('div', { className: 'proposal-decision' }, h('p', { className: 'eyebrow' }, '추천 매수 제안 범위'),
    h('div', { className: 'proposal-decision-value' }, inspect(p.bidRange, '추천 매수 제안 범위', rangeText)),
    h('p', {}, p.bidRange.value ? '보수적 조건의 한도부터 기준 운영의 한도까지 · 상단은 호가 이내' : '정확한 가격 한도를 구하지 못했습니다. IRR·상환 여력·보증금을 먼저 검증하세요.'),
    h('p', { className: 'hint' }, `목표 IRR ${percent(policy.targetIrr)} · 보유기간 최소 DSCR ${times(policy.minDscr)} · 고정 LTV ${percent(a.ltv)}`));
  const sellerDecision = () => h('div', { className: 'proposal-decision' }, h('p', { className: 'eyebrow' }, '호가 설명'),
    h('div', { className: 'proposal-decision-value' }, money(building.askingPriceKrw)),
    h('p', {}, '호가 기준 매수자 IRR ', metric('leveredIrr', '호가 기준 매수자 IRR', percent)),
    h('p', { className: 'hint' }, `대지 평당가의 비교 중앙값 대비 ${signedPercent(comparison.premium.value)} · 미보정 가상 거래 기준`));
  const decision = seller ? sellerDecision : buyerDecision;

  const cover = sheet(1, '표지', 'proposal-cover',
    h('div', { className: 'proposal-cover-brand' }, 'PLOT', h('span', {}, ' OS')),
    h('p', { className: 'eyebrow' }, `PLOT OS / ${seller ? 'SELLER' : 'BUYER'} BRIEF`),
    h('h2', { className: 'proposal-cover-title' }, seller ? '매도 전략 제안서' : '매수 검토 제안서'),
    h('div', { className: 'proposal-cover-photo' }, buildingPhoto(building), h('p', { className: 'hint' }, '해당 건물의 실제 사진 아님 · 생성된 건축 일러스트')),
    h('p', { className: 'proposal-cover-name' }, building.nameKo), h('p', { className: 'muted' }, building.addressKo),
    h('div', { className: 'actions' }, badge(EXAMPLE, 'accent'), badge('신뢰도 낮음 · 검증 필요')),
    decision(), facts([['작성 중개사', brokerText()], ['예시 스냅샷', snapshot], ['자료 기준', deep ? '합성 상세 임대차·운영비' : '요약 데이터 · 상세 임대차 없음'], ['문서 식별', `${id} / ${base.engineVersion}`]]),
    h('p', { className: 'proposal-cover-note' }, '검토 조건과 산출 근거를 공유하기 위한 예시 자료입니다. 실제 임대차·권리·현장 확인 후 판단하세요.'));

  const kpis = [
    ['매도 호가', money(building.askingPriceKrw), '합성 예시 호가'],
    ['연간 NOI', metric('noi', '연간 NOI', (v) => `${manwon(v)}만원`), '첫 12개월 · 차입 전'],
    ['Cap rate', metric('capRate', 'Cap rate', percent), '연간 NOI ÷ 호가'],
    ['초기 필요 자기자본', metric('equityRequired', '초기 필요 자기자본'), '취득 비용·대출 비용·보증금 반영'],
    ['호가 기준 매수자 IRR', metric('leveredIrr', '호가 기준 매수자 IRR', percent), `${a.holdYears}년 월별 현금흐름 연율화`],
    ['보유기간 최소 DSCR', metric('minDscr', '보유기간 최소 DSCR', times), '연도별 NOI ÷ 원리금 상환액의 최솟값'],
  ];
  const summary = sheet(2, '핵심 요약', '', h('p', { className: 'eyebrow' }, '01 / EXECUTIVE SUMMARY'), h('h2', {}, '핵심 요약'),
    seller ? h('p', {}, `대지 평당 호가 ${manwon(comparison.askPerPyeong.value)}만원/평. `,
      comparison.count ? `가상 비교 중앙값 ${manwon(comparison.medianPerPyeong.value)}만원/평 대비 ${signedPercent(comparison.premium.value)}입니다. 이 차이는 실제 입지·임대차·상태 검증으로 설명해야 합니다.` : '호가를 뒷받침할 비교 근거가 없습니다.')
      : h('p', {}, '매수 협상은 목표 수익률과 상환 여력을 함께 충족하는 가격에서 시작합니다. 아래 한도는 검증 전 가정에 따른 협상 참고선입니다.'),
    block('핵심 수치', h('div', { className: 'proposal-kpis' }, kpis.map(([label, value, note]) => h('div', {}, h('p', {}, label), h('strong', {}, value), h('small', {}, note))))),
    block(seller ? '매도 협상 포인트' : '매수 협상 포인트',
      h('p', {}, `기준 매수 한도 ${bidMoney(p.basePricing.maxPrice.status === 'ok' ? p.basePricing.maxPrice.value : null)} · 제약 ${constraint(p.basePricing.bindingConstraint)}. `,
        `보수적 매수 한도 ${bidMoney(p.conservativePricing.maxPrice.status === 'ok' ? p.conservativePricing.maxPrice.value : null)}.`),
      h('p', {}, seller ? '호가에서의 매수자 수익률과 최소 DSCR을 함께 제시하고, 프리미엄을 설명할 실제 증빙을 확보하세요. 합성 비교 거래만으로 호가의 적정성을 확정할 수 없습니다.' : '범위 하단은 보수적 가정, 상단은 기준 가정의 한도와 호가 중 낮은 금액입니다. 실제 수용 가격이나 시장 가치의 신뢰구간이 아닙니다.'),
      h('p', { className: 'hint' }, '보수적 가정: 금리 +1%p · 임대료 손실률 +5%p · 임대료 상승률 0% · 매각 Cap +0.5%p. 최소 DSCR은 보유기간 전체의 연도별 최솟값입니다.')),
    block('주요 위험 · 계약 전 확인', h('ol', { className: 'proposal-risks' }, p.risks.map((risk) => h('li', {}, risk)))),
    h('p', { className: 'notice' }, '제안서는 Radar의 현재 LTV·목표 IRR과 아래 기본 가정을 사용합니다. 매수 한도가·밸류업 화면의 개별 수정값은 가져오지 않습니다.'));

  const scenarios = sheet(3, '시나리오와 차트', '', h('p', { className: 'eyebrow' }, '02 / SCENARIOS & CASH FLOW'), h('h2', {}, '시나리오와 현금흐름'),
    h('p', {}, '모든 시나리오는 동일 호가·보유기간에서 각각 독립 비교합니다. 실행안을 합산하지 않습니다.'),
    table({ caption: '호가 기준 시나리오 비교', rows: p.scenarios, columns: [
      { label: '시나리오', key: 'label' },
      { label: '첫해 NOI (만원)', numeric: true, render: (s) => metric('noi', `${s.label} 연간 NOI`, manwon, s.result) },
      { label: '매수자 IRR', numeric: true, render: (s) => metric('leveredIrr', `${s.label} IRR`, percent, s.result) },
      { label: '실행비 (억)', numeric: true, render: (s) => eok(s.capexKrw) },
      { label: '모집·중단', render: (s) => `${s.downtimeMonths}개월` },
    ] }),
    h('p', { className: 'hint' }, '산출 불가: 유일한 IRR 미확인·해 없음·자기자본 조건 불충족 등. 첫해 NOI는 모집·중단을 포함하며 실행비와 금융비는 별도입니다. 공사 시 잠재 임대료의 50%에 해당하는 부분이 중단됩니다.'),
    block('시나리오별 첫해 NOI (억원/년)', proposalNoiChart(p.scenarios)),
    h('p', { className: 'hint' }, p.scenarios.slice(2).map((s) => { const i = s.result.assumptions.intervention; return `${s.label}: ${i.startMonth}개월 차 비용 지급 · ${i.downtimeMonths}개월 ${s.id === 'lease-up' ? '모집 후 공실 전부 해소, 신규 보증금 0' : `중단 후 영향 임대료 ${percent(i.rentUpliftRate)} 인상`}`; }).join(' / ')),
    block('기준 운영의 연도별 현금흐름 (억원)', proposalCashflowChart(p.years), h('p', { className: 'hint' }, '회색: 초기 자본 · 청록: 운영 · 남색: 순매각 정산. 매각 비용·잔존 대출·반환 보증금 차감. 마지막 해 운영과 매각 정산을 분리합니다.')),
    h('p', { className: 'notice' }, '실행비·중단·보증금 반환과 복구를 현금흐름에 반영합니다. 공사 견적·인허가·임차인 동의·추가 대출은 검증하지 않았습니다.'));

  const compEvidence = (c, key, label, format) => inspect({ value: c[key], provenance: c.provenance?.[key],
    formula: key === 'priceKrw' ? '가상 거래 생성 규칙 f.ask' : 'priceKrw / (landAreaM2 * 121 / 400)',
    inputs: { compId: c.id, priceKrw: c.priceKrw, landAreaM2: c.landAreaM2 } }, label, format, `data/comps.json · ${c.id}`);
  const comps = sheet(4, '가상 비교 거래와 호가 설명', '', h('p', { className: 'eyebrow' }, '03 / COMPARABLES'), h('h2', {}, '가상 비교 거래와 호가 설명'),
    h('p', { className: 'notice' }, '모두 합성 예시이며 공적 실거래 기록이 아닙니다. 시점·위치·용도·규모·건물 상태를 보정하지 않았습니다.'),
    facts([['대상 대지 평당 호가', inspect(comparison.askPerPyeong, '대지 평당 호가', (v) => `${manwon(v)}만원/평`)],
      ['비교 중앙값', inspect(comparison.medianPerPyeong, '비교 중앙값', (v) => Number.isFinite(v) ? `${manwon(v)}만원/평` : '비교 거래 없음', 'data/comps.json · 연결된 합성 거래')],
      ['중앙값 대비 호가', inspect(comparison.premium, '중앙값 대비 호가', signedPercent)],
      ['미보정 환산 범위', inspect(comparison.impliedPriceRange, '미보정 대지 면적 환산 범위', (v) => v ? `${money(v[0])} ~ ${money(v[1])}` : '산출 불가')]]),
    p.comps.length ? table({ caption: '가상 비교 거래 — 대지 기준, 실제 거래 아님', rows: p.comps, columns: [
      { label: '가상 거래 / 블록', render: (c) => h('div', {}, c.nameKo, h('small', { className: 'subtext' }, c.addressKo), h('small', { className: 'subtext' }, c.id)) },
      { label: '거래일', key: 'transactionDate' },
      { label: '거래가 (억)', numeric: true, render: (c) => compEvidence(c, 'priceKrw', '가상 비교 거래가', eok) },
      { label: '대지 (평)', numeric: true, render: (c) => number(c.landAreaM2 * 121 / 400) },
      { label: '대지 평당 (만원)', numeric: true, render: (c) => compEvidence(c, 'landPricePerPyeong', '가상 비교 대지 평당가', manwon) },
    ] }) : h('p', { className: 'notice' }, '비교 거래 없음 · 호가를 뒷받침할 비교 근거가 없습니다.'),
    block('호가 설명 · 검증할 논리',
      h('p', {}, comparison.count ? `대상 호가는 비교 중앙값 대비 ${signedPercent(comparison.premium.value)}입니다. ` : '비교 자료가 없어 프리미엄 판단을 보류합니다. ',
        '프리미엄·할인이 있다면 역 접근성, 실제 임대차와 공실, 건물 상태, 토지·용도 조건의 차이로 설명하고 증빙해야 합니다.'),
      h('p', {}, '호가 기준 매수자 IRR ', metric('leveredIrr', '호가 기준 매수자 IRR', percent), ' · 최소 DSCR ', metric('minDscr', '호가 기준 최소 DSCR', times),
        ` · 목표 ${percent(policy.targetIrr)} / ${times(policy.minDscr)}와 함께 비교하세요.`),
      h('p', { className: 'hint' }, '환산 범위 = 비교 대지 평당가의 최저·최고 × 대상 대지 평수. 감정평가·적정가·매도 확약이 아닙니다.')));

  const appendixRows = [
    ['연간 NOI', `${manwon(base.metrics.noi.value)}만원`, '첫해 월별 (임대료 + 관리수입 − 소유자 운영비)의 합', source],
    ['초기 자기자본', money(base.metrics.equityRequired.value), '호가 + 취득비 + 대출비 + 초기 공사비 − 대출 − 승계 보증금', 'engine/model.js · equityRequired'],
    ['매수자 IRR', percent(base.metrics.leveredIrr.value), '월별 현금흐름 NPV = 0 → (1 + 월 IRR)^12 − 1; 유일한 해만 표시', `engine/irr.js · ${base.metrics.leveredIrr.status}`],
    ['최소 DSCR', times(base.metrics.minDscr.value), '보유기간 각 12개월 NOI / 원리금 상환액의 최솟값', 'engine/model.js · minDscr'],
    ['매수 제안 범위', rangeText(p.bidRange.value), '하단: min(보수 한도, 기준 한도, 호가) / 상단: min(기준 한도, 호가)', 'engine/pricing.js · 고정 LTV 역산'],
    ['호가 비교', signedPercent(comparison.premium.value), '호가 / 대상 대지 평수 / 비교 대지 평당가 중앙값 − 1', `data/comps.json · ${p.comps.length}개 합성 거래`],
  ];
  const unknowns = context.data.references.unknowns ?? [];
  const relevantRefs = [...new Set(Object.values(a.provenance).map((row) => row?.refId).filter(Boolean))];
  const appendix = sheet(5, '근거 부록과 면책 고지', 'proposal-appendix', h('p', { className: 'eyebrow' }, '04 / EVIDENCE & DISCLAIMER'), h('h2', {}, '근거 부록'),
    h('p', {}, '모든 수치: 신뢰도 낮음 · 검증 필요. 화면의 점선 수치를 누르면 원 계산식·입력값·출처 계보를 확인할 수 있습니다. 인쇄본의 가정은 아래와 같습니다.'),
    table({ caption: '핵심 수치의 계산식과 출처', rows: appendixRows, columns: [
      { label: '수치 / 결과', render: (r) => h('div', {}, r[0], h('small', { className: 'subtext' }, r[1])) },
      { label: '계산식', render: (r) => r[2] }, { label: '출처 · 검증 필요', render: (r) => r[3] },
    ] }),
    block('공통 입력 · 호가 기준', facts([
      ['보유 / 차입', `${a.holdYears}년 · LTV ${percent(a.ltv)} · 금리 ${percent(a.annualInterestRate)} · 이자만 납부`],
      ['운영 입력 (월)', `잠재 월세 ${manwon(a.monthlyPotentialRentKrw)}만원 · 잠재 관리수입 ${manwon(a.monthlyPotentialMgmtIncomeKrw)}만원 · 운영비 ${manwon(a.monthlyOpexKrw)}만원`],
      ['공실·성장', `임대료 손실 ${percent(a.vacancyRate)} · 신용손실 ${percent(a.creditLossRate)} · 월세 상승 ${percent(a.annualRentGrowth)}/년 · 운영비 상승 ${percent(a.annualOpexGrowth)}/년`],
      ['보증금 / 대출', `${money(a.depositsKrw)} (반환 부채) / ${money(base.initial.loan.value)}`],
      ['취득·금융 비용', `취득세 예산 ${percent(a.acquisitionTaxRate)} + 중개 ${percent(a.acquisitionBrokerageRate)} + 기타 ${percent(a.acquisitionMiscRate)} / 대출금의 ${percent(a.loanFeeRate)}`],
      ['기본 공사비', `초기 ${money(a.initialCapexKrw)} · 매년 ${money(a.annualCapexKrw)} · 실행비는 시나리오 표 참조`],
      ['매각·정산', `Cap ${percent(a.exitCapRate)} · 매각비 ${percent(a.sellingCostRate)} · 순매각 ${money(base.exit.netProceeds.value)} (비용·대출·보증금 차감)`],
    ])),
    block('자료 식별 · UNKNOWN', h('p', {}, `${source} · data/buildings.json / ${id} · data/generation.json · ${base.engineVersion} · 스냅샷 ${snapshot}. 합성 임대료에는 공실을 중복 차감하지 않습니다.`),
      h('p', {}, `data/market_refs.json: ${relevantRefs.join(', ')}. 모두 reference/approximate - verify. 기관명은 향후 검증 후보이며 조회·인용한 근거가 아닙니다. 시장 관측일 UNKNOWN.`),
      h('p', {}, '미확인: ', unknowns.map((row) => `${row.id} = ${row.value}`).join(' / ')),
      h('a', { href: './data/data-sources.md', className: 'text-link' }, '오프라인 자료·단위·검증 정책 보기')),
    block('면책 고지', h('p', { className: 'proposal-disclaimer' }, `${EXAMPLE}. 건물·임대차·거래·위치는 모두 가상입니다. 본 자료는 시연용이며 실제 매수·매도 권고, 감정평가, 대출 승인 또는 세무 자문이 아닙니다. 실제 계약·등기·운영비·현장·비교 거래·대출 심사와 거래별 세금을 확인해야 합니다. 취득세 4.6%는 예시 예산입니다. VAT·소득세·법인세·양도세·중도상환수수료·재융자·계약 갱신·대출기관별 보증금 공제는 모델에서 제외됩니다. 수익과 매각가는 보장되지 않습니다.`)));

  const brokerInput = h('input', { type: 'text', className: 'select-field', 'aria-label': '중개사명', maxlength: 60, value: brokerName,
    onInput(event) {
      if (disposed) return;
      brokerName = event.target.value.slice(0, 60);
      context.store.setState({ proposalBrokerName: brokerName });
      for (const node of brokerLabels) node.textContent = brokerName.trim() || DEFAULT_BROKER;
    } });
  const audienceLink = (label, audience) => h('a', { className: 'button', href: `#/building/${id}/proposal?for=${audience}`,
    'aria-current': (seller ? 'seller' : 'buyer') === audience ? 'page' : null }, label);
  const element = h('div', { className: 'page proposal-page' },
    h('div', { className: 'breadcrumb no-print' }, h('a', { href: '#/radar' }, '딜 레이더'), ' / ', h('a', { href: `#/building/${id}` }, building.nameKo), ' / 제안서'),
    h('div', { className: 'page-heading no-print' }, h('div', {}, h('p', { className: 'eyebrow' }, building.nameKo), h('h1', {}, '고객 제안서'),
      h('p', {}, '고객별 관점으로 전환하고, A4 제안서를 인쇄하세요.')), linkButton('건물 개요', `#/building/${id}`)),
    sceneNav(building, 'proposal'),
    h('div', { className: 'card proposal-toolbar no-print' }, h('div', { className: 'actions', 'aria-label': '제안서 대상' }, audienceLink('매수자용', 'buyer'), audienceLink('매도자용', 'seller')),
      h('label', {}, '중개사명', brokerInput), button('인쇄', () => { if (!disposed) window.print(); }, 'primary')),
    h('p', { className: 'proposal-print-hint no-print' }, 'A4 세로 · 배율 100% · 브라우저 머리글/바닥글 끄기 권장. 문서에 예시 데이터·가정·면책 고지를 함께 인쇄합니다. 입력은 현재 세션에서만 유지됩니다.'),
    h('article', { className: 'proposal-document', 'aria-label': `${seller ? '매도자용' : '매수자용'} 예시 제안서` }, cover, summary, scenarios, comps, appendix));
  return { element, selectId: id, destroy() { disposed = true; } };
}
