import { createDataLoader } from './data.js';
import { createRouter } from './router.js';
import { store } from './store.js';
import { h, button, linkButton, toast } from './ui/components.js';
import { homeView, radarView, listingsView, buildingView, proposalView } from './views.js';
import { bidView } from './ui/bid-view.js';
import { valueUpView } from './ui/valueup-view.js';

const loader = createDataLoader();
export { openEvidence } from './ui/evidence-panel.js';
import { closeEvidence, createEvidenceControls, bindEvidenceMode } from './ui/evidence-panel.js';

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
  const context = { data, loader, store, ...createEvidenceControls(data, loader) };
  let currentView, renderId = 0;
  const titles = { home: '딜의 다음 한 수', radar: '딜 레이더', listings: '매물 탐색', building: '건물 개요', bid: '매수 한도가', valueup: '밸류업 시뮬레이터', proposal: '제안서', 'not-found': '페이지를 찾을 수 없습니다' };
  createRouter(async (route) => {
    const requestId = ++renderId;
    closeEvidence();
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
  bindEvidenceMode(store, document, (enabled) => toast(enabled ? '근거 모드 ON · 강조된 낮은 신뢰도 수치를 눌러 근거를 확인하세요.' : '근거 모드 OFF'));
}

if (typeof document !== 'undefined') start();
