import { h } from './components.js';
import { eok, percent } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const BASE = Object.freeze({ x: 0, y: 0, width: 900, height: 600 });
let mapSequence = 0;
function svgNode(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
/** Uniform schematic lat/lng projection, derived only from the supplied JSON. */
export function createProjection(geography, width = BASE.width, height = BASE.height, padding = 52) {
  const points = [...geography.districts.flatMap((d) => d.polygon), ...geography.river.points];
  if (!points.length || !points.every((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))) throw new TypeError('지도 좌표를 확인해 주세요.');
  const west = Math.min(...points.map((p) => p.lng));
  const east = Math.max(...points.map((p) => p.lng));
  const north = Math.max(...points.map((p) => p.lat));
  const south = Math.min(...points.map((p) => p.lat));
  const scale = Math.min((width - 2 * padding) / (east - west), (height - 2 * padding) / (north - south));
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError('지도 범위가 올바르지 않습니다.');
  const offsetX = (width - (east - west) * scale) / 2;
  const offsetY = (height - (north - south) * scale) / 2;
  return (point) => ({ x: offsetX + (point.lng - west) * scale, y: offsetY + (north - point.lat) * scale });
}
export function clampViewBox(view, base = BASE) {
  const width = Math.max(base.width / 5, Math.min(base.width, view.width));
  const height = width * base.height / base.width;
  return { x: Math.max(base.x, Math.min(base.x + base.width - width, view.x)), y: Math.max(base.y, Math.min(base.y + base.height - height, view.y)), width, height };
}
export function zoomViewBox(view, factor, anchor = { x: view.x + view.width / 2, y: view.y + view.height / 2 }) {
  const width = Math.max(BASE.width / 5, Math.min(BASE.width, view.width * factor));
  const ratio = width / view.width;
  return clampViewBox({ x: anchor.x - (anchor.x - view.x) * ratio, y: anchor.y - (anchor.y - view.y) * ratio, width });
}

/** One map instance per view; destroy releases listeners through AbortController. */
export function createSeoulMap({ geography, buildings, onOpen = () => {}, onHover = () => {}, compact = false }) {
  const project = createProjection(geography);
  const uid = `seoul-map-${++mapSequence}`;
  const controller = new AbortController();
  const listen = (node, type, handler, options = {}) => node.addEventListener(type, handler, { ...options, signal: controller.signal });
  let view = { ...BASE }, drag = null, hovered = null, selectedId = null;
  const dots = new Map();
  const districtNodes = new Map();
  const tooltip = h('div', { id: `${uid}-tooltip`, className: 'map-tooltip', role: 'tooltip', hidden: true });
  const svg = svgNode('svg', { class: 'map-canvas', viewBox: '0 0 900 600', tabindex: '0', role: 'group', 'aria-labelledby': `${uid}-title`, 'aria-describedby': `${uid}-desc` });
  svg.append(svgNode('title', { id: `${uid}-title` }, '서울 10개 구 가상 건물 지도'), svgNode('desc', { id: `${uid}-desc` }, '공식 경계가 아닌 개략도입니다. 드래그 또는 방향키로 이동, 더하기·빼기 키로 확대·축소, 0으로 초기화합니다. Tab으로 건물에 진입하고 방향키로 건물을 바꾸며 Enter로 상세를 엽니다.'));
  const defs = svgNode('defs');
  const pattern = svgNode('pattern', { id: `${uid}-grid`, width: 32, height: 32, patternUnits: 'userSpaceOnUse' });
  pattern.append(svgNode('path', { d: 'M 32 0 L 0 0 0 32', fill: 'none', class: 'map-grid' }));
  defs.append(pattern);
  svg.append(defs, svgNode('rect', { x: 0, y: 0, width: 900, height: 600, fill: `url(#${uid}-grid)`, 'aria-hidden': 'true' }));
  const districtLayer = svgNode('g', { 'aria-hidden': 'true' });
  const labelLayer = svgNode('g', { 'aria-hidden': 'true' });
  for (const district of geography.districts) {
    const points = district.polygon.map(project);
    const polygon = svgNode('polygon', { class: 'map-district', points: points.map((p) => `${p.x},${p.y}`).join(' ') });
    districtNodes.set(district.id, polygon);
    districtLayer.append(polygon);
    const unique = points.slice(0, -1);
    const x = unique.reduce((sum, p) => sum + p.x, 0) / unique.length;
    const y = Math.min(...points.map((p) => p.y)) + (Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y))) * .23;
    labelLayer.append(svgNode('text', { class: 'map-district-label', x, y }, district.nameKo));
  }
  svg.append(districtLayer);
  const river = geography.river.points.map(project);
  svg.append(svgNode('polyline', { class: 'map-river', points: river.map((p) => `${p.x},${p.y}`).join(' '), 'aria-hidden': 'true' }));
  const dotLayer = svgNode('g', { 'aria-label': '가상 건물' });
  buildings.forEach((building, index) => {
    const p = project(building);
    const dot = svgNode('circle', { class: `map-dot${building.deepPath ? ' is-deep' : ''}`, cx: p.x, cy: p.y, r: building.deepPath ? 5 : 3.8,
      'data-building-id': building.id, tabindex: index === 0 ? 0 : -1, role: 'button',
      'aria-label': `${building.nameKo}, 호가 ${eok(building.askingPriceKrw)}억, ${building.statusKo}, 상세 열기`, 'aria-describedby': `${uid}-tooltip`,
    });
    dots.set(building.id, { dot, building });
    dotLayer.append(dot);
  });
  svg.append(dotLayer, labelLayer);
  const controls = h('div', { className: 'map-controls', role: 'group', 'aria-label': '지도 배율' });
  const control = (label, text, action) => h('button', { type: 'button', 'aria-label': label, title: label, onClick: action }, text);
  const zoomIn = control('지도 확대', '+', () => changeView(zoomViewBox(view, .8)));
  const zoomOut = control('지도 축소', '−', () => changeView(zoomViewBox(view, 1.25)));
  controls.append(zoomIn, zoomOut, control('지도 위치 초기화', '↺', () => changeView({ ...BASE })));
  const shell = h('div', { className: 'map-shell' },
    h('div', { className: 'map-topline', 'aria-hidden': 'true' }, h('strong', {}, 'SEOUL / DEAL LANDSCAPE'), h('small', {}, '10개 구 · 가상 건물 개략도')),
    svg, controls, h('span', { className: 'map-help', 'aria-hidden': 'true' }, '드래그 이동 · 휠 확대'),
    h('p', { className: 'map-caption' }, '공식 행정경계·필지·도보 경로가 아닌 가상 개략도입니다.'),
    h('div', { className: 'map-legend', 'aria-label': '지도 범례' },
      h('span', {}, h('i', { className: 'legend-dot', 'aria-hidden': 'true' }), '조건 일치'),
      h('span', {}, h('i', { className: 'legend-dot dimmed', 'aria-hidden': 'true' }), '조건 외·거래완료'),
      h('span', {}, h('i', { className: 'legend-dot deep', 'aria-hidden': 'true' }), '상세 임대차 보유'),
    ), tooltip,
  );
  if (compact) shell.classList.add('map-compact');
  function hideTooltip() { tooltip.hidden = true; highlight(null); }
  function changeView(next) {
    view = clampViewBox(next);
    svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
    zoomIn.disabled = view.width <= BASE.width / 5 + .01;
    zoomOut.disabled = view.width >= BASE.width - .01;
    hideTooltip();
  }
  function screenPoint(clientX, clientY, matrix = svg.getScreenCTM()?.inverse()) {
    return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix) : { x: 0, y: 0 };
  }
  function highlight(id) {
    if (hovered && dots.has(hovered)) dots.get(hovered).dot.classList.toggle('is-hovered', hovered === selectedId);
    hovered = id;
    if (id && dots.has(id)) dots.get(id).dot.classList.add('is-hovered');
    onHover(id);
  }
  function showTooltip(building, clientX, clientY) {
    highlight(building.id);
    tooltip.replaceChildren(h('strong', {}, building.nameKo), h('p', {}, `${building.neighborhood} · ${building.stationNameKo} 도보 ${building.walkMinutes}분`),
      h('p', { className: 'tooltip-price' }, `${eok(building.askingPriceKrw)}억`), h('p', {}, `Cap rate ${percent(building.capRate)} · ${building.statusKo}`), h('p', { className: 'tooltip-action' }, '클릭 또는 Enter → 건물 상세'));
    tooltip.hidden = false;
    const rect = shell.getBoundingClientRect();
    const left = Math.max(8, Math.min(rect.width - 222, clientX - rect.left + 16));
    const top = Math.max(8, Math.min(rect.height - tooltip.offsetHeight - 8, clientY - rect.top - tooltip.offsetHeight - 10));
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }
  listen(svg, 'pointerover', (event) => {
    const item = dots.get(event.target.dataset.buildingId);
    if (item && !drag?.moved) showTooltip(item.building, event.clientX, event.clientY);
  });
  listen(svg, 'pointerout', (event) => { if (event.target.dataset.buildingId) hideTooltip(); });
  listen(svg, 'focusin', (event) => {
    const item = dots.get(event.target.dataset.buildingId);
    if (item) { const rect = item.dot.getBoundingClientRect(); showTooltip(item.building, rect.left, rect.top); }
  });
  listen(svg, 'focusout', hideTooltip);
  // Assistive technologies can activate a button through a click without a pointer.
  listen(svg, 'click', (event) => { if (event.detail === 0 && event.target.dataset.buildingId) onOpen(event.target.dataset.buildingId); });
  listen(svg, 'pointerdown', (event) => {
    if (event.button !== 0 || drag) return;
    drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, point: screenPoint(event.clientX, event.clientY), matrix: svg.getScreenCTM()?.inverse(), view: { ...view }, buildingId: event.target.dataset.buildingId, moved: false };
  });
  listen(svg, 'pointermove', (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) > 5) drag.moved = true;
    if (!drag.moved) return;
    if (!svg.hasPointerCapture(event.pointerId)) svg.setPointerCapture(event.pointerId);
    svg.classList.add('is-dragging');
    const point = screenPoint(event.clientX, event.clientY, drag.matrix);
    changeView({ ...drag.view, x: drag.view.x - (point.x - drag.point.x), y: drag.view.y - (point.y - drag.point.y) });
  });
  function endDrag(event) {
    if (!drag || drag.id !== event.pointerId) return;
    const completed = drag;
    drag = null;
    svg.classList.remove('is-dragging');
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    if (event.type === 'pointerup' && !completed.moved && completed.buildingId) onOpen(completed.buildingId);
  }
  listen(svg, 'pointerup', endDrag);
  listen(svg, 'pointercancel', endDrag);
  listen(svg, 'lostpointercapture', () => { drag = null; svg.classList.remove('is-dragging'); });
  listen(svg, 'pointerleave', () => { if (drag && !drag.moved) drag = null; hideTooltip(); });
  listen(svg, 'wheel', (event) => {
    event.preventDefault();
    const factor = event.deltaY < 0 ? .9 : 1 / .9;
    changeView(zoomViewBox(view, factor, screenPoint(event.clientX, event.clientY)));
  }, { passive: false });
  listen(svg, 'keydown', (event) => {
    const id = event.target.dataset.buildingId;
    if (id && ['Enter', ' '].includes(event.key)) { event.preventDefault(); onOpen(id); return; }
    if (event.key === 'Escape') { hideTooltip(); return; }
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (direction && id) {
      event.preventDefault();
      const ids = [...dots.keys()];
      const next = ids[(ids.indexOf(id) + (direction[0] || direction[1]) + ids.length) % ids.length];
      dots.get(id).dot.setAttribute('tabindex', '-1');
      dots.get(next).dot.setAttribute('tabindex', '0');
      const dot = dots.get(next).dot;
      const x = Number(dot.getAttribute('cx')), y = Number(dot.getAttribute('cy'));
      if (x < view.x || x > view.x + view.width || y < view.y || y > view.y + view.height) changeView({ ...view, x: x - view.width / 2, y: y - view.height / 2 });
      dot.focus();
    } else if (direction) { event.preventDefault(); changeView({ ...view, x: view.x + direction[0] * view.width * .1, y: view.y + direction[1] * view.height * .1 }); }
    else if (['+', '=', '-', '0'].includes(event.key)) { event.preventDefault(); changeView(event.key === '0' ? { ...BASE } : zoomViewBox(view, event.key === '-' ? 1.25 : .8)); }
  });
  function update({ matchingIds = new Set(buildings.map((b) => b.id)), activeDistricts = [], selected = null } = {}) {
    selectedId = selected;
    for (const [id, { dot }] of dots) {
      dot.classList.toggle('is-dimmed', !matchingIds.has(id));
      dot.classList.toggle('is-hovered', id === selectedId);
    }
    for (const [id, polygon] of districtNodes) polygon.classList.toggle('is-active', activeDistricts.includes(id));
  }
  changeView(view);
  return { element: shell, update, highlight, getViewBox: () => ({ ...view }), destroy() { controller.abort(); drag = null; } };
}
