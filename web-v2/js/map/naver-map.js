import { h, button } from '../ui/components.js';
import { buildingPhoto } from '../ui/photo.js';
import { eok, percent } from '../ui/format.js';
import { radarGeoJSON, buildingCoordinates } from './radar-geo.js';
import { clusterFeatures } from './marker-clustering.js';

export function createNaverMap({ buildings, naver, onSelect = () => {}, onHover = () => {}, onOpen = () => {}, onFailure = () => {} }) {
  const byId = new Map(buildings.map((b) => [b.id, b]));
  const canvas = h('div', { className: 'radar-map-canvas', 'aria-label': '서울 예시 건물 지도' });
  const element = h('div', { className: 'radar-map-shell' },
    h('div', { className: 'radar-map-heading' }, h('strong', {}, '서울 건물 지도'), h('span', {}, '예시 위치 · 실제 매물 아님')),
    canvas, h('div', { className: 'radar-map-legend' }, '숫자: 조건 일치 건수 · 점수: 80–100 / 60–79 / 0–59 · 빈 원: 조건 밖 · —: 산출 불가'));
  let map, popup, selected = null, hovered = null, destroyed = false, resizeObserver;
  let data = radarGeoJSON(buildings), markers = [], markerListeners = [], listeners = [], focusMarkers = [];
  const position = ([lng, lat]) => new naver.LatLng(lat, lng);
  const listen = (target, event, callback, bucket = listeners) => bucket.push(naver.Event.addListener(target, event, callback));
  function clearMarkers() {
    markerListeners.forEach((listener) => naver.Event.removeListener(listener)); markerListeners = [];
    markers.forEach((marker) => marker.setMap(null)); markers = [];
  }
  function icon(feature, context = false, focused = false) {
    const p = feature.properties;
    return { content: h('div', { className: `naver-marker ${context ? 'naver-context' : `naver-${p.scoreBand}`} ${focused ? 'naver-focus' : ''}` },
      !context && h('span', {}, p.scoreLabel), !context && h('small', {}, p.priceLabel)), anchor: new naver.Point(context ? 6 : 18, context ? 6 : 18) };
  }
  function focus() {
    focusMarkers.forEach((marker) => marker.setMap(null)); focusMarkers = [];
    if (!map || destroyed) return;
    for (const id of new Set([selected, hovered])) {
      const feature = [...data.matching.features, ...data.context.features].find((f) => f.id === id);
      if (feature) focusMarkers.push(new naver.Marker({ map, position: position(feature.geometry.coordinates), icon: icon(feature, false, true), zIndex: 1000, clickable: false }));
    }
  }
  function popupFor(id) {
    popup?.close(); popup = null;
    const b = byId.get(id), coordinates = b && buildingCoordinates(b);
    if (!map || !coordinates || destroyed) return;
    const score = [...data.matching.features, ...data.context.features].find((f) => f.id === id)?.properties.score;
    const content = h('article', { className: 'radar-map-popup naver-popup' },
      button('닫기 ×', () => { popup?.close(); }, 'small naver-popup-close'),
      buildingPhoto(b, { compact: true }), h('h3', {}, b.nameKo),
      h('p', { className: 'muted' }, `${b.neighborhood} · 예시 위치`),
      h('strong', { className: 'radar-popup-price' }, `${eok(b.askingPriceKrw)}억`),
      h('p', {}, `Cap rate ${percent(b.capRate)} · 적합도 ${Number.isFinite(score) ? `${score}점` : '산출 불가'}`),
      h('a', { className: 'button button-primary', href: `#/building/${b.id}`, onClick: () => onOpen(b.id) }, '상세 보기 →'));
    popup = new naver.InfoWindow({ content, borderWidth: 0, backgroundColor: '#fff', maxWidth: 280 });
    popup.open(map, position(coordinates));
  }
  function highlight(id) {
    if (destroyed) return;
    hovered = byId.has(id) ? id : null; focus(); onHover(hovered);
  }
  function select(id, { fly = true, notify = true } = {}) {
    if (destroyed) return;
    selected = byId.has(id) ? id : null;
    if (notify) onSelect(selected);
    focus(); popupFor(selected);
    const coordinates = selected && buildingCoordinates(byId.get(selected));
    if (map && coordinates && fly) { map.setZoom(Math.max(map.getZoom(), 16)); map.panTo(position(coordinates)); }
  }
  function addPoint(feature, context = false) {
    const marker = new naver.Marker({ map, position: position(feature.geometry.coordinates), icon: icon(feature, context), title: byId.get(feature.id)?.nameKo, zIndex: context ? 1 : 10 });
    markers.push(marker);
    listen(marker, 'click', () => select(feature.id), markerListeners);
    listen(marker, 'mouseover', () => highlight(feature.id), markerListeners);
    listen(marker, 'mouseout', () => highlight(null), markerListeners);
  }
  function render() {
    if (!map || destroyed) return;
    clearMarkers(); data.context.features.forEach((feature) => addPoint(feature, true));
    for (const group of clusterFeatures(data.matching.features, map.getZoom())) {
      if (group.length === 1) { addPoint(group[0]); continue; }
      const center = [0, 0];
      for (const feature of group) feature.geometry.coordinates.forEach((value, index) => { center[index] += value / group.length; });
      const marker = new naver.Marker({ map, position: position(center), icon: { content: h('div', { className: 'naver-marker naver-cluster', 'aria-label': `조건 일치 ${group.length}건` }, group.length), anchor: new naver.Point(20, 20) }, zIndex: 20 });
      markers.push(marker);
      listen(marker, 'click', () => { map.setCenter(position(center)); map.setZoom(Math.min(18, map.getZoom() + 2)); }, markerListeners);
    }
    focus();
  }
  function resize() {
    if (!map || destroyed) return;
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) map.setSize(new naver.Size(canvas.clientWidth, canvas.clientHeight));
  }
  function mount() {
    if (destroyed || map || !element.isConnected) return;
    try {
      map = new naver.Map(canvas, { center: new naver.LatLng(37.55, 126.98), zoom: 11, minZoom: 9, maxZoom: 18,
        zoomControl: true, logoControl: true, mapDataControl: true, scaleControl: true });
      listen(map, 'idle', render);
      if (globalThis.ResizeObserver) { resizeObserver = new ResizeObserver(resize); resizeObserver.observe(canvas); }
      render(); resize(); if (selected) popupFor(selected);
    } catch { onFailure(); }
  }
  return { element, mount, select, highlight, resize,
    update(options = {}) { if (destroyed) return; data = radarGeoJSON(buildings, options); if (Object.hasOwn(options, 'selected')) selected = options.selected; render(); popupFor(selected); },
    destroy() {
      if (destroyed) return; destroyed = true;
      resizeObserver?.disconnect(); popup?.close(); clearMarkers();
      focusMarkers.forEach((marker) => marker.setMap(null)); focusMarkers = [];
      listeners.forEach((listener) => naver.Event.removeListener(listener)); listeners = [];
      map?.destroy(); map = null;
    },
  };
}
