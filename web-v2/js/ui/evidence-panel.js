import { createEvidenceTrace, DATA_SOURCES_NOTE, summaryEvidence } from '../evidence-trace.js';
import { h, badge, button, sidePanel, evidenceNumber } from './components.js';

let activePanel;
export function closeEvidence() { activePanel?.close(); }

export function createEvidenceControls(data, loader) {
  const inspect = (details) => openEvidence(details, data, loader);
  return {
    inspect,
    summaryNumber(building, key, label, format) {
      const text = format(building[key]), evidence = summaryEvidence(building, key);
      return evidenceNumber({ label, text, evidence, onClick: () => inspect({ label, text, evidence, building,
        source: `data/buildings.json · ${building.id} · ${key}` }) });
    },
    metricNumber(result, key, label, format) {
      const evidence = result.metrics[key], text = format(evidence.value);
      return evidenceNumber({ label, text, evidence, onClick: () => inspect({ label, text, evidence,
        source: `계산 엔진 ${result.engineVersion} · ${key}` }) });
    },
  };
}

/** Navigate inputs inside one modal so Escape, focus return and Back stay native. */
export function openEvidence(details, data, loader) {
  closeEvidence();
  const trace = createEvidenceTrace(details, data), history = [trace.root];
  const content = h('div'), bodyHeading = h('h3', { className: 'evidence-current', tabindex: '-1' });
  let closed = false, loadState = trace.building?.deepPath && !details.deep ? 'loading' : '';
  const section = (title, ...children) => h('section', { className: 'evidence-field' }, h('h3', {}, title), ...children);
  function navigate(node) { history.push(node); render(true); }
  function rows(nodes, type) {
    return h('div', { className: 'evidence-links' }, nodes.map((node) => {
      const d = trace.describe(node);
      return h('button', { type: 'button', className: 'evidence-input', 'data-trace-link': type,
        'aria-label': `${d.label} · ${d.text} · 근거 열기`, onClick: () => navigate(node) },
      h('span', {}, d.label), h('strong', {}, d.text), h('span', { 'aria-hidden': 'true' }, '→'));
    }));
  }
  function render(focus = false) {
    if (closed) return;
    const node = history.at(-1), d = trace.describe(node), inputs = trace.inputs(node), sources = trace.sources(node);
    bodyHeading.textContent = d.label;
    content.replaceChildren(
      h('div', { className: 'evidence-navigation' }, history.length > 1 && button('← 이전 근거', () => { history.pop(); render(true); }, 'ghost'),
        h('span', { className: 'hint', 'data-trace-path': '' }, history.map((entry) => entry.label).join(' › '))),
      bodyHeading, h('div', { className: 'evidence-value', 'data-trace-value': '' }, d.text),
      badge(`신뢰도 ${{ low: '낮음', medium: '보통', high: '높음' }[d.confidence]}`), d.needsVerification && badge('검증 필요', 'accent'),
      h('p', { className: 'notice' }, '예시 데이터 · 실제 매물 아님. 계산의 정확성과 입력 근거의 신뢰도는 다릅니다. 실제 계약·시세를 확인하지 않았습니다.'),
      section('산식 / 생성 규칙', h('p', { className: 'evidence-formula' }, d.formula)),
      section('입력 / 가정 · 눌러서 추적', inputs.length ? rows(inputs, 'input') : h('p', {}, '추가 입력 없음 · 원본 값 또는 직접 지정한 가정입니다.')),
      section('출처 및 계보', d.registryId && h('p', {}, `${{ assumption: '입력 가정', ref: '참고 행', derived: '파생 산식' }[d.evidence.provenance?.kind] || '계보 식별자'} · ${d.registryId}`),
        h('p', {}, d.source || '계산 입력 가정 · 별도 원본 위치 UNKNOWN'), sources.length ? rows(sources, 'source') : null,
        node === trace.root && loadState && h('p', { role: 'status' }, loadState === 'loading' ? '상세 임대차 원본을 불러오는 중…' : '상세 임대차 원본을 불러오지 못했습니다. 원본 위치는 위 경로를 확인하세요.')),
      h('details', { className: 'evidence-field' }, h('summary', {}, '원시 값 · 단위 · 계보'),
        h('pre', { className: 'evidence-code' }, JSON.stringify({ value: d.rawValue ?? null, provenance: d.evidence.provenance || {}, status: d.evidence.status }, null, 2))),
      section('data-sources.md 안내', h('p', {}, DATA_SOURCES_NOTE), h('a', { className: 'text-link', href: './data/data-sources.md', target: '_blank', rel: 'noopener' }, '데이터 출처·단위·한계 노트 열기 ↗')),
    );
    if (focus) { panel.element.querySelector('.panel-body').scrollTop = 0; bodyHeading.focus({ preventScroll: true }); }
  }
  const panel = sidePanel({ title: `${details.label} · 근거`, content, onClose() { closed = true; if (activePanel === panel) activePanel = null; } });
  activePanel = panel;
  render();
  if (loadState) {
    Promise.resolve().then(() => loader?.loadDeep(trace.building)).then((deep) => {
      if (closed) return;
      trace.setDeep(deep); loadState = deep ? '' : 'error'; render();
    }).catch(() => { if (!closed) { loadState = 'error'; render(); } });
  }
  return panel;
}

export function bindEvidenceMode(store, doc = document, onChange = () => {}) {
  const toggle = doc.getElementById('evidence-toggle');
  const sync = ({ evidenceMode }) => {
    doc.body.classList.toggle('evidence-mode', evidenceMode);
    toggle.setAttribute('aria-pressed', String(evidenceMode));
    doc.getElementById('evidence-status').textContent = evidenceMode ? 'ON' : 'OFF';
  };
  const click = () => {
    const enabled = !store.getState().evidenceMode;
    store.setState({ evidenceMode: enabled }); onChange(enabled);
  };
  toggle.addEventListener('click', click);
  const unsubscribe = store.subscribe(sync); sync(store.getState());
  return () => { toggle.removeEventListener('click', click); unsubscribe(); };
}
