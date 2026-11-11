import { comparisonDomain } from '../valueup.js';
import { h } from './components.js';
import { eok, number } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
let sequence = 0;
function svgNode(tag, attributes = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function chart(title, description, height) {
  const id = `valueup-chart-${++sequence}`;
  const svg = svgNode('svg', { viewBox: `0 0 700 ${height}`, class: 'valueup-chart', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
  svg.append(svgNode('title', { id: `${id}-title` }, title), svgNode('desc', { id: `${id}-desc` }, description));
  return svg;
}
const scroll = (svg) => h('div', { className: 'valueup-chart-scroll', tabindex: '0', 'aria-label': '차트 가로 스크롤' }, svg);

export function comparisonBars(result, key, title) {
  const before = result.before[key].value, after = result.after[key].value;
  const domain = comparisonDomain([before, after]);
  const x = (v) => 100 + (v - domain.min) / (domain.max - domain.min) * 460;
  const svg = chart(title, `같은 안정화 시점의 12개월 수익 기준. 개선 전 ${eok(before)}억원, 개선 후 ${eok(after)}억원.`, 150);
  svg.append(svgNode('line', { x1: x(0), x2: x(0), y1: 12, y2: 112, class: 'bid-chart-axis' }));
  [[before, '개선 전', 'before'], [after, '개선 후', 'after']].forEach(([value, label, tone], i) => {
    const y = 26 + i * 49;
    svg.append(svgNode('text', { x: 12, y: y + 19, class: 'bid-chart-label' }, label),
      svgNode('rect', { x: Math.min(x(value), x(0)), y, width: Math.abs(x(value) - x(0)), height: 29, rx: 3, class: `valueup-bar-${tone}` }),
      svgNode('text', { x: 684, y: y + 20, 'text-anchor': 'end', class: 'bid-chart-value' }, `${eok(value)}억`));
  });
  svg.append(svgNode('text', { x: x(0), y: 138, 'text-anchor': 'middle', class: 'bid-chart-label' }, '0'));
  return scroll(svg);
}

export function downtimeTimeline(result) {
  if (!result.timeline) return h('p', { className: 'hint' }, '실행안 꺼짐 · 기존 운영을 유지합니다.');
  const { startMonth, completionMonth, downtimeMonths, affectedShare } = result.timeline;
  const leasing = result.type === 'lease-up';
  const horizon = Math.max(24, completionMonth + 6);
  const x = (month) => 35 + (month - 1) / horizon * 625;
  const description = leasing ? `모집 기간에도 기존 임대료는 유지합니다. ${completionMonth}개월 차부터 공실 해소를 반영합니다.`
    : `${startMonth}개월 차부터 ${downtimeMonths}개월 동안 잠재 임대료의 ${number(affectedShare * 100)}%에 해당하는 부분의 임대 수입이 중단됩니다. ${completionMonth}개월 차부터 인상 임대료를 반영합니다.`;
  const svg = chart('실행 일정과 임대 중단 기간', description, 152);
  const phases = [[1, startMonth, '기존 운영', 'before'], [startMonth, completionMonth, leasing ? '임차인 모집' : '임대 중단', 'downtime'],
    [completionMonth, horizon + 1, '개선 운영', 'after']];
  for (const [from, to, label, tone] of phases) {
    if (to <= from) continue;
    const width = x(to) - x(from);
    const rect = svgNode('rect', { x: x(from), y: 35, width, height: 33, rx: 3, class: `valueup-phase-${tone}` });
    rect.append(svgNode('title', {}, `${label}: ${from}개월 차부터 ${to - 1}개월 차까지`)); svg.append(rect);
    if (width > 82) svg.append(svgNode('text', { x: x(from) + width / 2, y: 56, 'text-anchor': 'middle', class: 'valueup-phase-label' }, label));
  }
  for (let month = 1; month <= horizon; month += 6) svg.append(svgNode('text', { x: x(month), y: 91, 'text-anchor': 'middle', class: 'bid-chart-label' }, `${month}개월`));
  svg.append(svgNode('text', { x: 35, y: 121, class: 'bid-chart-value' }, `비용 지급 ${startMonth}개월 차 · 안정화 ${completionMonth}개월 차`),
    svgNode('text', { x: 35, y: 142, class: 'bid-chart-label' }, downtimeMonths === 0 ? '대기·중단 없이 시작 월부터 개선 운영' : `${downtimeMonths}개월 ${leasing ? '모집 · 기존 수입 유지' : '부분 임대 중단 · 운영비와 이자 계속 발생'}`));
  return h('div', {}, scroll(svg), h('p', { className: 'hint' }, description));
}
