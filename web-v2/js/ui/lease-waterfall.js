import { h } from './components.js';
import { manwon, percent } from './format.js';
import { leaseExpiry } from '../building-analysis.js';

const NS = 'http://www.w3.org/2000/svg';
let sequence = 0;
function svgNode(tag, attrs, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}

export function leaseWaterfall(deep) {
  const model = leaseExpiry(deep.rentRoll, deep.snapshotDate);
  const id = `lease-expiry-${++sequence}`;
  const svg = svgNode('svg', { class: 'lease-waterfall', viewBox: '0 0 800 290', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
  svg.append(svgNode('title', { id: `${id}-title` }, '임대차 만기 워터폴 — 만기별 월 임대료 노출'),
    svgNode('desc', { id: `${id}-desc` }, `${deep.snapshotDate} 기준 월 임대료 ${manwon(model.totalKrw)}만원에서 향후 만기 임대료를 차감합니다. 재계약을 가정하지 않은 노출이며 확정 공실 예측이 아닙니다. 5년 후 잔여 ${manwon(model.remainingKrw)}만원, 만기 미상 ${manwon(model.unknownKrw)}만원 포함.`));
  const bars = [{ label: '현재 월세', startKrw: model.totalKrw, endKrw: 0, amountKrw: model.totalKrw, total: true },
    ...model.buckets.map((b, i) => ({ ...b, label: i ? `${i - 1}–${i}년` : '기경과' })),
    { label: '5년 후 잔여', startKrw: model.remainingKrw, endKrw: 0, amountKrw: model.remainingKrw, total: true }];
  const baseline = 222, height = 160, max = Math.max(1, model.totalKrw), y = (value) => baseline - height * value / max;
  svg.append(svgNode('line', { x1: 18, x2: 780, y1: baseline, y2: baseline, class: 'waterfall-axis' }),
    svgNode('text', { x: 18, y: 20, class: 'waterfall-unit' }, '단위: 만원/월'));
  bars.forEach((bar, i) => {
    const x = 25 + i * 94, top = y(bar.startKrw), bottom = y(bar.endKrw);
    const group = svgNode('g', {});
    group.append(svgNode('title', {}, `${bar.label}: ${manwon(bar.amountKrw)}만원/월${bar.through ? `, ${bar.through}까지 ${bar.count}개 계약` : ''}`),
      svgNode('rect', { x, y: top, width: 58, height: Math.max(1, bottom - top), rx: 3, class: bar.total ? 'waterfall-total' : 'waterfall-expiry' }),
      svgNode('text', { x: x + 29, y: Math.max(40, top - 9), 'text-anchor': 'middle', class: 'waterfall-value' }, `${bar.total ? '' : '−'}${manwon(bar.amountKrw)}`),
      svgNode('text', { x: x + 29, y: baseline + 23, 'text-anchor': 'middle', class: 'waterfall-label' }, bar.label));
    if (i < bars.length - 1) {
      const nextBalance = i === 0 ? model.totalKrw : bar.endKrw;
      group.append(svgNode('line', { x1: x + 58, x2: x + 94, y1: y(nextBalance), y2: y(nextBalance), class: 'waterfall-connector' }));
    }
    svg.append(group);
  });
  const nextYear = model.buckets[0].amountKrw + model.buckets[1].amountKrw;
  return h('div', {}, h('div', { className: 'expiry-summary' }, h('strong', {}, `12개월 이내·기경과 월세 ${manwon(nextYear)}만원`), h('span', {}, `현재 월세 대비 ${model.totalKrw ? percent(nextYear / model.totalKrw) : '해당 없음'}`)),
    h('div', { className: 'waterfall-scroll' }, svg),
    h('p', { className: 'hint' }, `예시 기준일 ${deep.snapshotDate} · 월 임대료만 집계, 관리비·보증금 제외. 기경과는 기준일까지 만료한 계약입니다. 구간은 앞 경계 초과·뒤 경계 이하입니다.`),
    h('p', { className: 'notice' }, `만기 시 임대료가 사라지는 경우의 노출 도식입니다. 확정 공실이나 엔진의 미래 임대료 예측이 아닙니다. 5년 후 잔여에는 만기 미상 ${manwon(model.unknownKrw)}만원/월이 포함됩니다. 갱신·퇴거·회수 가능성은 UNKNOWN입니다.`));
}
