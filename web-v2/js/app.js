import { createDataLoader } from './data.js';
import { createRouter } from './router.js';
import { store } from './store.js';
import { h, button, linkButton, badge, sidePanel, toast, evidenceNumber } from './ui/components.js';
import { homeView, radarView, listingsView, buildingView, proposalView } from './views.js';
import { bidView } from './ui/bid-view.js';
import { valueUpView } from './ui/valueup-view.js';

const loader = createDataLoader();
let activePanel;

/** Evidence panels accept both summary provenance and engine evidence wrappers. */
export function openEvidence({ label, text, evidence, explanation = '', source = '' }, data) {
  activePanel?.close();
  const provenance = evidence?.provenance || {};
  const registryId = provenance.formulaId || provenance.assumptionId || provenance.refId;
  const definition = data.generation.formulas?.[registryId] || data.generation.assumptions?.[registryId];
  const reference = data.references.districts.flatMap((d) => Object.values(d.metrics)).concat(Object.values(data.references.citywide), data.references.unknowns).find((row) => row.id === registryId);
  const field = (title, content, code = false) => h('section', { className: 'evidence-field' }, h('h3', {}, title), code ? h('pre', { className: 'evidence-code' }, content) : h('p', {}, content));
  const panel = sidePanel({ title: `${label} · 근거`, content: [
    h('p', { className: 'eyebrow' }, 'EVIDENCE / EXAMPLE ONLY'), h('div', { className: 'evidence-value' }, text),
    badge('신뢰도 낮음'), badge('검증 필요', 'accent'),
    h('p', { className: 'notice' }, '예시 데이터 · 실제 매물 아님. 계산 결과는 입력 가정에 따른 예시이며, 실제 매물·거래·대출 조건을 검증하지 않았습니다.'),
    field('산식 / 생성 규칙', evidence?.formula || definition?.description || explanation || '가상 데이터 생성 가정'),
    field('입력 / 가정', evidence?.inputs ? JSON.stringify(evidence.inputs, null, 2) : explanation || '선택한 가상 건물의 요약 데이터입니다.', Boolean(evidence?.inputs)),
    field('출처 및 계보', [source, registryId, definition?.description, reference?.notes, reference?.sourceNames?.join(' · ')].filter(Boolean).join('\n') || '계산 엔진의 검증 전 예시 가정'),
    field('Provenance', JSON.stringify(provenance, null, 2), true),
    field('확인할 사항', '실제 임대차·운영비·대출 조건·현재 시장 수준·거래별 세금 및 VAT는 UNKNOWN입니다. 참고 기관명은 검증 후보이며 조회한 출처가 아닙니다.'),
  ], onClose: () => { if (activePanel === panel) activePanel = null; } });
  activePanel = panel;
}

async function start() {
  const main = document.getElementById('main');
  document.querySelector('.skip-link').onclick = (event) => {
    event.preventDefault();
    main.focus();
    main.scrollIntoView();
  };
  if (location.protocol === 'file:') {
    main.setAttribute('aria-busy', 'false');
    main.replaceChildren(h('div', { className: 'state-screen' }, h('h1', {}, '로컬 HTTP 주소로 열어 주세요'), h('p', {}, '이 데모는 상대 경로의 JSON을 읽습니다. 정적 HTTP 서버로 web-v2 폴더를 제공하면 외부 인터넷 없이 사용할 수 있습니다. file:// 직접 열기는 지원하지 않습니다.')));
    return;
  }
  let data;
  try {
    data = await loader.loadCore();
  } catch {
    main.setAttribute('aria-busy', 'false');
    main.replaceChildren(h('div', { className: 'state-screen', role: 'alert' }, h('h1', {}, '예시 데이터를 불러오지 못했습니다'), h('p', {}, '정적 서버의 data 폴더와 연결 상태를 확인한 뒤 다시 시도해 주세요.'), button('다시 시도', () => { main.setAttribute('aria-busy', 'true'); start(); }, 'primary')));
    return;
  }
  const context = {
    data, loader, store,
    inspect(details) { openEvidence(details, data); },
    summaryNumber(building, key, label, format) {
      const text = format(building[key]);
      return evidenceNumber({ label, text, onClick: () => openEvidence({ label, text, evidence: { value: building[key], provenance: building.provenance[key] }, source: `data/buildings.json · ${building.id} · ${key}`, explanation: `가상 건물 ${building.nameKo}. 호가 ${building.askingPriceKrw} KRW, 연 NOI ${building.noiAnnualKrw} KRW, 대지 ${building.landAreaM2} m², 임대율 ${building.occupancy}.` }, data) });
    },
    metricNumber(result, key, label, format) {
      const evidence = result.metrics[key];
      const text = format(evidence.value);
      return evidenceNumber({ label, text, onClick: () => openEvidence({ label, text, evidence, source: `계산 엔진 ${result.engineVersion} · ${key}` }, data) });
    },
  };
  let currentView, renderId = 0;
  const titles = { home: '딜의 다음 한 수', radar: '딜 레이더', listings: '매물 탐색', building: '건물 개요', bid: '매수 한도가', valueup: '밸류업 시뮬레이터', proposal: '제안서', 'not-found': '페이지를 찾을 수 없습니다' };
  createRouter(async (route) => {
    const requestId = ++renderId;
    activePanel?.close();
    currentView?.destroy?.();
    currentView = null;
    for (const nav of document.querySelectorAll('[data-nav]')) {
      const active = nav.dataset.nav === route.name || (['building', 'bid', 'valueup'].includes(route.name) && nav.dataset.nav === 'listings');
      if (active) nav.setAttribute('aria-current', 'page'); else nav.removeAttribute('aria-current');
    }
    document.title = `PLOT OS · ${titles[route.name] || '데모'}`;
    main.setAttribute('aria-busy', 'true');
    try {
      let view;
      if (route.name === 'home') view = homeView(context);
      else if (route.name === 'radar') view = radarView(context);
      else if (route.name === 'listings') view = listingsView(context);
      else if (route.name === 'building') {
        main.replaceChildren(h('div', { className: 'state-screen', role: 'status' }, h('span', { className: 'loading-mark', 'aria-hidden': 'true' }), h('p', {}, '건물 상세를 불러오고 있습니다.')));
        view = await buildingView(context, route);
      } else if (route.name === 'bid') {
        main.replaceChildren(h('div', { className: 'state-screen', role: 'status' }, h('p', {}, '임대차와 매수 한도를 계산하고 있습니다.')));
        view = await bidView(context, route);
      } else if (route.name === 'valueup') {
        main.replaceChildren(h('div', { className: 'state-screen', role: 'status' }, h('p', {}, '실행안별 수익과 비용을 계산하고 있습니다.')));
        view = await valueUpView(context, route);
      } else if (route.name === 'proposal') view = await proposalView(context, route);
      else view = { element: h('div', { className: 'state-screen' }, h('p', { className: 'eyebrow' }, 'PLOT OS / 404'), h('h1', {}, '아직 준비되지 않은 페이지입니다'), h('p', {}, '딜 레이더에서 가상 건물을 선택해 살펴보세요.'), linkButton('딜 레이더로 이동', '#/radar', 'primary')) };
      if (requestId !== renderId) { view.destroy?.(); return; }
      currentView = view;
      if (view.selectId) store.setState({ selectedId: view.selectId });
      main.replaceChildren(view.element);
      main.setAttribute('aria-busy', 'false');
      main.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    } catch {
      if (requestId !== renderId) return;
      main.setAttribute('aria-busy', 'false');
      main.replaceChildren(h('div', { className: 'state-screen', role: 'alert' }, h('h1', {}, '화면을 불러오지 못했습니다'), h('p', {}, '건물의 상세 예시 데이터 경로와 형식을 확인해 주세요.'), button('다시 시도', () => window.dispatchEvent(new HashChangeEvent('hashchange')), 'primary'), linkButton('매물 목록으로', '#/listings')));
    }
  });
  const toggle = document.getElementById('evidence-toggle');
  toggle.addEventListener('click', () => {
    const enabled = !store.getState().evidenceMode;
    store.setState({ evidenceMode: enabled });
    toast(enabled ? '근거 모드 ON · 점선 수치를 눌러 가정과 산식을 확인하세요.' : '근거 모드 OFF');
  });
  store.subscribe(({ evidenceMode }) => {
    document.body.classList.toggle('evidence-mode', evidenceMode);
    toggle.setAttribute('aria-pressed', String(evidenceMode));
    document.getElementById('evidence-status').textContent = evidenceMode ? 'ON' : 'OFF';
  });
}

if (typeof document !== 'undefined') start();
