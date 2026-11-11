import { eok } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
let sequence = 0;
function node(tag, attributes = {}, text) {
  const result = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) result.setAttribute(key, String(value));
  if (text !== undefined) result.textContent = text;
  return result;
}
function chart(title, description, height) {
  const id = `proposal-chart-${++sequence}`;
  const svg = node('svg', { viewBox: `0 0 680 ${height}`, class: 'proposal-chart', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
  svg.append(node('title', { id: `${id}-title` }, title), node('desc', { id: `${id}-desc` }, description));
  return svg;
}

export function proposalNoiChart(scenarios) {
  const values = scenarios.map((s) => s.result.metrics.noi.value);
  const min = Math.min(0, ...values), max = Math.max(1, ...values), width = 400;
  const x = (value) => 140 + (value - min) / (max - min) * width;
  const svg = chart('시나리오별 첫해 NOI', '금액 단위 억원/년. 안정화 후 수익이 아닌 공사·모집 기간을 포함한 첫 12개월 NOI입니다. 비용은 아래 표에 별도 표시합니다.', 190);
  svg.append(node('line', { x1: x(0), x2: x(0), y1: 8, y2: 178, class: 'proposal-chart-axis' }));
  scenarios.forEach((s, i) => {
    const y = 12 + i * 34, value = values[i];
    svg.append(node('text', { x: 4, y: y + 17 }, s.label),
      node('rect', { x: Math.min(x(0), x(value)), y, width: Math.abs(x(value) - x(0)), height: 24, class: i > 1 ? 'proposal-bar-accent' : 'proposal-bar-base' }),
      node('text', { x: 670, y: y + 17, 'text-anchor': 'end' }, `${eok(value)}억`));
  });
  return svg;
}

export function proposalCashflowChart(years) {
  const limits = years.flatMap((y) => [0, y.initialKrw, y.operatingKrw, y.exitKrw,
    Math.max(0, y.operatingKrw) + Math.max(0, y.exitKrw), Math.min(0, y.operatingKrw) + Math.min(0, y.exitKrw)]);
  const min = Math.min(...limits), max = Math.max(1, ...limits), span = max - min || 1;
  const y = (value) => 172 - (value - min) / span * 145;
  const svg = chart('기준 운영의 연도별 자기자본 현금흐름', '금액 단위 억원. 초기 자본은 회색, 운영은 청록, 매각 정산은 남색. 매각 정산은 매각 비용·잔존 대출·보증금 반환을 차감합니다.', 213);
  for (const value of [min, 0, max]) svg.append(node('line', { x1: 48, x2: 672, y1: y(value), y2: y(value), class: 'proposal-chart-axis' }),
    node('text', { x: 43, y: y(value) + 4, 'text-anchor': 'end' }, eok(value)));
  const step = 620 / years.length, width = Math.min(28, step * .6);
  years.forEach((row, i) => {
    const x = 51 + step * (i + .5);
    let positive = 0, negative = 0;
    const group = node('g');
    group.append(node('title', {}, `${row.year}년: 초기 ${eok(row.initialKrw)}억, 운영 ${eok(row.operatingKrw)}억, 매각 ${eok(row.exitKrw)}억`));
    for (const [key, tone] of [['initialKrw', 'funding'], ['operatingKrw', 'accent'], ['exitKrw', 'base']]) {
      const value = row[key];
      const start = value >= 0 ? positive : negative, end = start + value;
      if (value) group.append(node('rect', { x: x - width / 2, y: Math.min(y(start), y(end)), width,
        height: Math.max(.5, Math.abs(y(end) - y(start))), class: `proposal-bar-${tone}` }));
      if (value >= 0) positive = end; else negative = end;
    }
    group.append(node('text', { x, y: 198, 'text-anchor': 'middle' }, `${row.year}년`));
    svg.append(group);
  });
  return svg;
}
