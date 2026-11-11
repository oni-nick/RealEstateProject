/** Lazy evidence navigation. No arithmetic is substituted for engine outputs. */
export const DATA_SOURCES_NOTE = '모든 수치는 검증 전 데모 가정입니다. low는 근거 미검증을 뜻하며 통계적 신뢰도가 아닙니다. 기관명은 나중에 대조할 후보이며 조회한 출처가 아닙니다. 시장 관측일·실제 계약·대출 조건·거래별 세금/VAT는 UNKNOWN입니다.';

const labels = {
  assumptions: '계산 입력 가정', baseAssumptions: '기존 운영 가정', sourceInputs: '입력 계보',
  provenance: '계보', source: '원본 계보', summary: '건물 요약 계보', rentRoll: '호실별 임대차', opex: '소유자 운영비',
  purchasePriceKrw: '검토 매입가', askingPriceKrw: '매도 호가', monthlyPotentialRentKrw: '잠재 월 임대료',
  monthlyPotentialMgmtIncomeKrw: '잠재 월 관리수입', monthlyOpexKrw: '월 소유자 운영비', depositsKrw: '승계 보증금',
  vacancyRate: '임대료 기준 공실·손실률', creditLossRate: '추가 미수 손실률', ltv: 'LTV', annualInterestRate: '연 대출금리',
  annualRentGrowth: '연 임대료 상승률', annualOpexGrowth: '연 운영비 상승률', exitCapRate: '매각 Cap rate',
  holdYears: '보유기간', acquisitionTaxRate: '취득세 예산율', acquisitionBrokerageRate: '취득 중개율',
  acquisitionMiscRate: '기타 취득비율', loanFeeRate: '대출 실행비율', sellingCostRate: '매각 비용률',
  initialCapexKrw: '초기 공사비', annualCapexKrw: '연 공사비', intervention: '실행안 가정',
  capexKrw: '실행 비용', downtimeMonths: '중단 기간', startMonth: '시작 월', affectedShare: '대상 임대료 비중',
  rentUpliftRate: '임대료 인상률', targetVacancyRate: '개선 후 손실률', targetIrr: '목표 IRR', minDscr: '최소 DSCR',
  cashflows: '월별 현금흐름', criteria: '투자자 조건', buildingIds: '대상 가상 건물', checks: '조건별 판정',
  monthlyRentKrw: '계약 월세', potentialMonthlyRentKrw: '잠재 월세', depositKrw: '반환 보증금', mgmtFeeKrw: '월 관리비',
  areaM2: '전용 면적', areaPyeong: '전용 평수', landAreaM2: '대지 면적', gfaM2: '연면적', annualKrw: '연 운영비',
  annualRentKrw: '연 계약 월세', potentialAnnualRentKrw: '연 잠재 임대료', annualMgmtKrw: '연 관리수입',
  annualOpexKrw: '연 소유자 운영비', noiAnnualKrw: '연 NOI', occupancy: '면적 기준 임대율',
};
export const evidenceLabel = (key) => labels[key] || key;
export function evidenceConfidence(evidence) {
  // The weakest known input wins. Missing confidence never implies high confidence.
  const found = [];
  function scan(value) {
    if (!value || typeof value !== 'object') return;
    if (['low', 'medium', 'high'].includes(value.confidence)) found.push(value.confidence);
    for (const item of Object.values(value)) if (item && typeof item === 'object') scan(item);
  }
  scan(evidence);
  return !evidence?.provenance?.confidence || found.includes('low') || !found.length ? 'low' : found.includes('medium') ? 'medium' : 'high';
}
export function traceValue(value, key = '', unit = '') {
  if (value === null || value === undefined || (typeof value === 'number' && !Number.isFinite(value))) return '산출 불가 / UNKNOWN';
  if (Array.isArray(value)) return `${value.length}개 항목`;
  if (typeof value === 'object') return `${Object.keys(value).filter((k) => k !== 'provenance').length}개 항목`;
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  if (typeof value !== 'number') return String(value);
  const num = (v) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 6 }).format(v);
  if (/^ratio/.test(unit) || /Rate$|Growth$|^ltv$|Share$|Fraction$|^occupancy$|^targetIrr$/.test(key)) return `${num(value * 100)}%`;
  if (/Krw$/.test(key) || unit.startsWith('KRW')) return `${num(value)} ${unit || 'KRW'}`;
  if (/M2$/.test(key)) return `${num(value)} m²`;
  if (/Pyeong$/.test(key)) return `${num(value)}평`;
  if (/Years$/.test(key)) return `${num(value)}년`;
  return `${num(value)}${unit ? ` ${unit}` : ''}`;
}

const summaryDependencies = {
  askingPriceKrw: ['landAreaM2', 'gfaM2'], capRate: ['noiAnnualKrw', 'askingPriceKrw'],
  noiAnnualKrw: ['annualRentKrw', 'annualMgmtKrw', 'annualOpexKrw'],
  estimatedValueLowKrw: ['noiAnnualKrw'], estimatedValueHighKrw: ['noiAnnualKrw'],
  occupancy: ['exclusiveAreaM2'], gfaM2: ['landAreaM2', 'floorsAbove', 'floorsBelow'],
};
const fieldDependencies = {
  areaPyeong: ['areaM2'], potentialMonthlyRentKrw: ['areaPyeong', 'rentPerPyeongMonth'],
  monthlyRentKrw: ['potentialMonthlyRentKrw', 'status'], depositKrw: ['monthlyRentKrw'], mgmtFeeKrw: ['monthlyRentKrw'],
};
export function summaryEvidence(building, key) {
  return { value: building[key], provenance: building.provenance?.[key],
    inputs: Object.fromEntries((summaryDependencies[key] || []).map((k) => [k, summaryEvidence(building, k)])) };
}

export function createEvidenceTrace(details, data, initialDeep = details.deep || null) {
  const references = new Map([
    ...(data.references?.districts || []).flatMap((d) => Object.values(d.metrics)),
    ...Object.values(data.references?.citywide || {}), ...(data.references?.unknowns || []),
  ].map((row) => [row.id, row]));
  const definitions = { ...data.generation?.assumptions, ...data.generation?.formulas };
  const input = details.evidence?.inputs;
  const buildingId = details.building?.id || input?.assumptions?.provenance?.source?.buildingId
    || input?.baseAssumptions?.provenance?.source?.buildingId || input?.sourceInputs?.source?.buildingId;
  const building = details.building || data.buildings?.find((b) => b.id === buildingId);
  let deep = initialDeep;
  const root = { ...details, evidence: details.evidence || {}, building, role: 'root' };
  const provenance = (node) => node.evidence?.provenance || {};
  const registryIds = (value) => {
    const ids = new Set();
    function scan(v) {
      if (!v || typeof v !== 'object') return;
      for (const [key, item] of Object.entries(v)) {
        if (['refId', 'assumptionId', 'formulaId'].includes(key) && typeof item === 'string') ids.add(item);
        else if (item && typeof item === 'object') scan(item);
      }
    }
    scan(value); return ids;
  };
  function referenceNode(row) {
    return { label: `참고 행 · ${row.id}`, text: row.range ? `${traceValue(row.range.min, '', row.unit)} – ${traceValue(row.range.max, '', row.unit)}` : traceValue(row.value, '', row.unit),
      source: `data/market_refs.json · ${row.id}`, role: 'reference',
      evidence: { value: row.range || row.value, formula: '검증 전 참고 범위 / 명시적 기본값. 관측 시세가 아닙니다.',
        inputs: row, provenance: { ...row.provenance, confidence: row.confidence } } };
  }
  function recordNode(label, value, source, role = 'record') {
    return { label, source, role, building: value?.id?.startsWith('bld-') ? value : building, evidence: { value, inputs: value,
      formula: '가상 데이터 원본 스냅샷 · 실제 계약·증빙 아님', provenance: { confidence: 'low', verificationStatus: 'not_verified' } } };
  }
  function inputs(node) {
    const values = node.evidence.inputs || (typeof node.evidence.value === 'object' && node.evidence.value) || {};
    const assumptions = values.assumptions || values.baseAssumptions;
    return Object.entries(values).filter(([key]) => key !== 'provenance').map(([key, value]) => {
      const isWrapper = value && typeof value === 'object' && 'value' in value && ('formula' in value || 'provenance' in value);
      const p = values.provenance?.[key] || assumptions?.provenance?.[key]
        || (node.role === 'root' ? building?.provenance?.[key] : null);
      const child = { label: Array.isArray(values) ? `${Number(key) + 1} · ${value?.unit || '항목'}` : evidenceLabel(key), key, building: node.building,
        source: node.source, role: 'input',
        evidence: isWrapper ? value : { value, provenance: p || { kind: 'assumption', confidence: evidenceConfidence(node.evidence), assumptionId: `trace.${key}` } },
      };
      if (value && typeof value === 'object' && !isWrapper) child.evidence.inputs = value;
      else if (!isWrapper && values.provenance?.[key]) {
        const keys = (fieldDependencies[key] || summaryDependencies[key] || []).filter((k) => Object.hasOwn(values, k));
        if (keys.length) child.evidence.inputs = { ...Object.fromEntries(keys.map((k) => [k, values[k]])), provenance: values.provenance };
      }
      if (typeof value === 'string' && references.has(value)) return referenceNode(references.get(value));
      if (typeof value === 'string') {
        const b = data.buildings?.find((item) => item.id === value);
        if (b) return recordNode(b.nameKo, b, `data/buildings.json · ${b.id}`);
      }
      if (key === 'sourceInputs' || key === 'provenance') child.evidence.formula = '계산 입력의 원본·가정 식별자';
      return child;
    });
  }
  function sources(node) {
    const nodes = [], ids = registryIds(provenance(node));
    // A computed output can carry the complete input lineage; expose exact rows.
    if (node.role === 'root') for (const id of registryIds(node.evidence.inputs)) ids.add(id);
    const formulaId = provenance(node).formulaId;
    const metricKeys = formulaId === 'f.ask' ? ['landPricePerPyeong', 'gfaPricePerPyeong']
      : formulaId === 'f.value' ? ['capRate'] : [];
    for (const key of metricKeys) if (node.building || building) ids.add(`${(node.building || building).districtId}.${key}`);
    if (formulaId === 'f.deposit') ids.add('seoul.deposit_to_monthly_rent_months');
    for (const id of ids) {
      if (references.has(id) && node.role !== 'reference') nodes.push(referenceNode(references.get(id)));
      else if (definitions[id] && node.role !== 'definition') nodes.push({ label: `생성 가정 / 산식 · ${id}`, source: `data/generation.json · ${id}`, role: 'definition',
        evidence: { value: id, formula: definitions[id].description, inputs: {}, provenance: { ...definitions[id], assumptionId: id } } });
    }
    if (node.role === 'root' && building) {
      nodes.unshift(recordNode('건물 요약 원본', building, `data/buildings.json · ${building.id}`));
      if (deep) {
        nodes.unshift(recordNode('호실별 임대차 원본', deep.rentRoll, `data/${building.deepPath} · rentRoll`));
        nodes.push(recordNode('소유자 운영비 원본', deep.opex, `data/${building.deepPath} · opex`));
      }
    }
    return nodes;
  }
  function describe(node) {
    const p = provenance(node), id = p.formulaId || p.assumptionId || p.refId;
    const definition = definitions[id];
    return { ...node, text: node.text ?? traceValue(node.evidence.value, node.key),
      confidence: evidenceConfidence(node.evidence),
      formula: node.evidence.formula || definition?.description || node.explanation
        || (p.kind === 'derived' ? `파생 규칙: ${id || 'UNKNOWN'} · 상세 산식 미등록` : '입력 가정 / 원본 값 (계산 없음)'),
      rawValue: node.evidence.value, registryId: id,
      needsVerification: p.needsVerification === true || p.verificationStatus !== 'verified' || evidenceConfidence(node.evidence) === 'low' };
  }
  return { root, building, inputs, sources, describe, setDeep(value) { if (value?.buildingId === building?.id) deep = value; } };
}
