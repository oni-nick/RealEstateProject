import { homeView, radarView, listingsView, buildingView, proposalView } from './views.js';
import { bidView } from './ui/bid-view.js';
import { valueUpView } from './ui/valueup-view.js';
import { h, linkButton } from './ui/components.js';

// The browser and route smoke tests use the same dispatch path.
export function sceneView(context, route) {
  const factory = { home: homeView, radar: radarView, listings: listingsView, building: buildingView, bid: bidView, valueup: valueUpView, proposal: proposalView }[route.name];
  if (factory) return factory(context, route);
  return { element: h('div', { className: 'state-screen' }, h('p', { className: 'eyebrow' }, 'PLOT OS / 404'),
    h('h1', {}, '페이지를 찾을 수 없습니다'), h('p', {}, '주소를 확인하거나 매물 탐색에서 건물을 선택해 주세요.'), linkButton('딜 레이더로 이동', '#/radar', 'primary')) };
}
