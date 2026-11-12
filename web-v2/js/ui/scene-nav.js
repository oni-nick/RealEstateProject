import { h } from './components.js';

export function sceneNav(building, current) {
  const href = `#/building/${building.id}`;
  return h('nav', { className: 'scene-nav no-print', 'aria-label': '건물 분석 화면' },
    [['building', '건물 개요', ''], ['bid', '최대 매입가', '/bid'], ['valueup', '밸류업 시뮬레이터', '/valueup'], ['proposal', '고객 제안서', '/proposal?for=buyer']]
      .map(([name, label, suffix]) => h('a', { href: href + suffix, 'aria-current': current === name ? 'page' : null }, label)));
}
