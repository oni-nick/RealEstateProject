import { h, table } from './components.js';
import { bidAmount, eok, number, percent } from './format.js';
import { exactPrice, priceRulerDomain } from '../bid.js';

const NS = 'http://www.w3.org/2000/svg';
let sequence = 0;
const svgNode = (tag, attributes = {}, text) => {
  const node = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
};
function chart(title, description, height) {
  const id = `bid-chart-${++sequence}`;
  const svg = svgNode('svg', { viewBox: `0 0 850 ${height}`, class: 'bid-chart', role: 'img', 'aria-labelledby': `${id}-title ${id}-desc` });
  svg.append(svgNode('title', { id: `${id}-title` }, title), svgNode('desc', { id: `${id}-desc` }, description));
  return svg;
}
const scroll = (svg) => h('div', { className: 'bid-chart-scroll', tabindex: '0', 'aria-label': '차트 가로 스크롤' }, svg);

export function priceRuler(analysis, askingPriceKrw) {
  const buy = exactPrice(analysis.buy), walk = exactPrice(analysis.walk), price = analysis.result.assumptions.purchasePriceKrw;
  const domain = priceRulerDomain([askingPriceKrw, price, buy, walk]);
  const x = (value) => 240 + (value - domain.min) / (domain.max - domain.min) * 570;
  const svg = chart('호가·검토가·BUY·WALK-AWAY 가격 눈금자', `단위 억원. 호가 ${eok(askingPriceKrw)}, 현재 검토가 ${eok(price)}, BUY ${bidAmount(buy)}, WALK-AWAY ${bidAmount(walk)}. 한도가 숫자는 0.1억 단위 내림. 미산출 선은 표시하지 않습니다.`, 270);
  if (buy !== null) svg.append(svgNode('rect', { x: 240, y: 36, width: Math.max(0, x(buy) - 240), height: 180, class: 'bid-ruler-zone' }));
  if (buy !== null && walk !== null) svg.append(svgNode('rect', { x: x(buy), y: 36, width: Math.max(0, x(walk) - x(buy)), height: 180, class: 'bid-ruler-zone-negotiation' }));
  [['매도 호가', askingPriceKrw, 'ask'], ['현재 검토가', price, 'current'], ['BUY', buy, 'buy'], ['WALK-AWAY', walk, 'walk']].forEach(([label, value, tone], i) => {
    const y = 60 + i * 45;
    svg.append(svgNode('text', { x: 15, y: y + 5, class: 'bid-chart-label' }, label),
      svgNode('text', { x: 217, y: y + 5, 'text-anchor': 'end', class: 'bid-chart-value' }, ['buy', 'walk'].includes(tone) ? bidAmount(value) : `${eok(value)}억`));
    if (value === null) return;
    svg.append(svgNode('line', { x1: 240, x2: 810, y1: y, y2: y, class: 'bid-chart-grid' }),
      svgNode('line', { x1: x(value), x2: x(value), y1: y, y2: 226, class: `bid-ruler-guide bid-${tone}` }),
      svgNode('circle', { cx: x(value), cy: y, r: 6, class: `bid-${tone}` }));
  });
  svg.append(svgNode('line', { x1: 240, x2: 810, y1: 226, y2: 226, class: 'bid-chart-axis' }));
  for (let i = 0; i <= 4; i++) {
    const value = domain.min + (domain.max - domain.min) * i / 4;
    svg.append(svgNode('text', { x: x(value), y: 249, 'text-anchor': 'middle', class: 'bid-chart-label' }, `${eok(value)}억`));
  }
  return scroll(svg);
}

export function cashflowChart(analysis) {
  const { years, result } = analysis;
  const positive = (row) => Math.max(0, row.initialKrw) + Math.max(0, row.operatingKrw) + Math.max(0, row.exitKrw);
  const negative = (row) => Math.min(0, row.initialKrw) + Math.min(0, row.operatingKrw) + Math.min(0, row.exitKrw);
  const max = Math.max(1, ...years.map(positive)), min = Math.min(0, ...years.map(negative));
  const y = (v) => 32 + (max - v) / (max - min) * 202;
  const svg = chart('연도별 자기자본 현금흐름', `월별 계산을 연도별로 합산한 억원 단위 현금흐름. 0년 초기 투자 ${eok(years[0].totalKrw)}억, 마지막 해 매각 정산 ${eok(years.at(-1).exitKrw)}억. 운영과 매각 현금흐름을 분리합니다.`, 292);
  for (const value of [min, 0, max]) {
    svg.append(svgNode('line', { x1: 70, x2: 830, y1: y(value), y2: y(value), class: value === 0 ? 'bid-chart-axis' : 'bid-chart-grid' }),
      svgNode('text', { x: 61, y: y(value) + 4, 'text-anchor': 'end', class: 'bid-chart-label' }, eok(value)));
  }
  const step = 750 / years.length, width = Math.min(40, step * .6);
  years.forEach((row, i) => {
    const x = 80 + step * (i + .5), group = svgNode('g');
    group.append(svgNode('title', {}, `${row.year}년: 초기 ${eok(row.initialKrw)}억 / 운영 ${eok(row.operatingKrw)}억 / 매각 정산 ${eok(row.exitKrw)}억 / 합계 ${eok(row.totalKrw)}억`));
    let pos = 0, neg = 0;
    for (const [key, tone] of [['initialKrw', 'funding'], ['operatingKrw', 'operating'], ['exitKrw', 'exit']]) {
      const value = row[key]; if (!value) continue;
      const start = value > 0 ? pos : neg, end = start + value;
      group.append(svgNode('rect', { x: x - width / 2, y: Math.min(y(start), y(end)), width,
        height: Math.max(.5, Math.abs(y(end) - y(start))), class: `bid-cf-${tone}` }));
      if (value > 0) pos = end; else neg = end;
    }
    group.append(svgNode('text', { x, y: 257, 'text-anchor': 'middle', class: 'bid-chart-label' }, `${row.year}년`));
    svg.append(group);
  });
  const rows = years.map((row) => ({ ...row, label: row.year === 0 ? '0년 · 취득' : `${row.year}년 · ${row.months}개월` }));
  return h('div', { className: 'stack' }, scroll(svg),
    h('div', { className: 'bid-chart-legend' }, h('span', { className: 'legend-funding' }, '■ 초기 자본'), h('span', { className: 'legend-operating' }, '■ 운영 현금흐름'), h('span', { className: 'legend-exit' }, '■ 매각 정산')),
    h('p', { className: 'hint' }, `보유 ${number(result.assumptions.holdYears)}년 · 보증금 반환·잔존 대출·매각 비용을 차감한 순매각 현금흐름입니다. 마지막 연도의 운영 수익은 별도 표시합니다.`),
    h('details', { className: 'bid-detail' }, h('summary', {}, '연도별 현금흐름 표 (억원)'), table({ caption: '연도별 초기 자본, 운영, 매각 및 총 현금흐름 — 단위 억원', rows, columns: [
      { label: '시점', key: 'label' }, ...[['initialKrw', '초기 자본'], ['operatingKrw', '운영'], ['exitKrw', '매각 정산'], ['totalKrw', '합계']].map(([key, label]) => ({ label, numeric: true, render: (row) => eok(row[key]) })),
    ] })));
}

export const sensitivityLabels = { annualInterestRate: '대출 금리', vacancyRate: '공실·임대료 손실', annualRentGrowth: '임대료 상승률', exitCapRate: '매각 Cap', initialCapexKrw: '초기 공사비' };
export const sensitivityValue = (field, value) => field === 'initialCapexKrw' ? `${eok(value)}억` : percent(value);
const pp = (v) => Number.isFinite(v) ? `${v > 0 ? '+' : ''}${number(v * 100)}%p` : '산출 불가';

export function tornadoChart(tornado) {
  const rows = tornado.rows;
  const limit = Math.max(.01, ...rows.flatMap((row) => [row.lowIrrDelta.value, row.highIrrDelta.value]).filter(Number.isFinite).map(Math.abs)) * 1.12;
  const x = (value) => 525 + value / limit * 245;
  const svg = chart('IRR 민감도 토네이도', `한 번에 한 가정만 변경한 기준 IRR 대비 변화. 기준 IRR ${percent(tornado.base.irr.value)}. 각 행의 실제 입력과 결과는 아래 표에서 확인할 수 있습니다.`, 344);
  for (const value of [-limit, 0, limit]) svg.append(svgNode('line', { x1: x(value), x2: x(value), y1: 42, y2: 300, class: value ? 'bid-chart-grid' : 'bid-chart-axis' }),
    svgNode('text', { x: x(value), y: 25, 'text-anchor': 'middle', class: 'bid-chart-label' }, pp(value)));
  rows.forEach((row, i) => {
    const y = 66 + i * 49, low = row.lowIrrDelta.value, high = row.highIrrDelta.value;
    svg.append(svgNode('text', { x: 15, y: y + 2, class: 'bid-chart-value' }, sensitivityLabels[row.field]),
      svgNode('text', { x: 15, y: y + 20, class: 'bid-chart-label' }, `${sensitivityValue(row.field, row.lowInput)} → ${sensitivityValue(row.field, row.highInput)}`));
    for (const [value, offset, tone] of [[low, -10, 'low'], [high, 6, 'high']]) {
      if (value === null) continue;
      const bar = svgNode('rect', { x: Math.min(x(0), x(value)), y: y + offset, width: Math.max(1, Math.abs(x(value) - x(0))), height: 12, rx: 2, class: `bid-tornado-${tone}` });
      bar.append(svgNode('title', {}, `${sensitivityLabels[row.field]} ${tone === 'low' ? '하단' : '상단'} 입력: IRR 변화 ${pp(value)}`)); svg.append(bar);
    }
    if (low === null || high === null) svg.append(svgNode('text', { x: 800, y: y + 2, 'text-anchor': 'end', class: 'bid-chart-label' }, '일부 산출 불가'));
  });
  return h('div', {}, scroll(svg), h('div', { className: 'bid-chart-legend' }, h('span', { className: 'legend-low' }, '■ 하단 입력'), h('span', { className: 'legend-high' }, '■ 상단 입력'), h('span', {}, '가로축: 기준 대비 IRR 변화 (%p)')));
}
