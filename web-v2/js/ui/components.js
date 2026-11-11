import { evidenceConfidence } from '../evidence-trace.js';

let sequence = 0;
export function h(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') node.className = value;
    else if (key === 'checked' || key === 'disabled' || key === 'value') node[key] = value;
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children.flat(Infinity)) if (child !== null && child !== undefined && child !== false) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  return node;
}
export const badge = (text, tone = '') => h('span', { className: `badge ${tone ? `badge-${tone}` : ''}` }, text);
export function chip(text, { selected = false, onClick } = {}) {
  return h('button', { type: 'button', className: 'chip', 'aria-pressed': String(selected), onClick }, text);
}
export const button = (text, onClick, variant = '') => h('button', { type: 'button', className: `button ${variant ? `button-${variant}` : ''}`, onClick }, text);
export const linkButton = (text, href, variant = '') => h('a', { href, className: `button ${variant ? `button-${variant}` : ''}` }, text);
export function kpiCard({ label, value, unit = '', note = '', accent = false }) {
  return h('article', { className: `card kpi-card${accent ? ' kpi-accent' : ''}` }, h('p', { className: 'kpi-label' }, label), h('div', { className: 'kpi-value' }, value, unit && h('small', {}, unit)), h('p', { className: 'kpi-note' }, note));
}
export function slider({ label, value, min, max, step = 1, format = String, onInput, onChange }) {
  const id = `range-${++sequence}`;
  const output = h('output', { for: id }, format(value));
  const input = h('input', { id, type: 'range', min, max, step, value, 'aria-valuetext': format(value),
    onInput(event) { const next = Number(event.target.value); output.textContent = format(next); input.setAttribute('aria-valuetext', format(next)); onInput?.(next); },
    onChange(event) { onChange?.(Number(event.target.value)); },
  });
  return h('div', { className: 'range-control' }, h('label', { className: 'range-label', for: id }, label, output), input, h('div', { className: 'range-bounds', 'aria-hidden': 'true' }, h('span', {}, format(min)), h('span', {}, format(max))));
}
export function table({ columns, rows, caption }) {
  return h('div', { className: 'table-wrap' }, h('table', { className: 'data-table' },
    h('caption', { className: 'sr-only' }, caption),
    h('thead', {}, h('tr', {}, columns.map((column) => h('th', { scope: 'col', className: column.numeric ? 'align-right' : '' }, column.label)))),
    h('tbody', {}, rows.map((row) => h('tr', {}, columns.map((column) => h('td', { className: column.numeric ? 'align-right' : '' }, column.render ? column.render(row) : row[column.key]))))),
  ));
}
export function emptyState(title, detail, action) {
  return h('div', { className: 'card empty-state' }, h('h3', {}, title), h('p', {}, detail), action);
}
export function sidePanel({ title, content, onClose }) {
  const titleId = `panel-title-${++sequence}`;
  const dialog = h('dialog', { className: 'panel-dialog', 'aria-labelledby': titleId },
    h('div', { className: 'panel-header' }, h('h2', { id: titleId }, title), button('닫기 ×', () => dialog.close(), 'ghost')),
    h('div', { className: 'panel-body' }, content),
  );
  const opener = document.activeElement;
  dialog.addEventListener('click', (event) => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close(); });
  dialog.addEventListener('close', () => { dialog.remove(); if (opener?.isConnected) opener.focus({ preventScroll: true }); onClose?.(); }, { once: true });
  document.body.append(dialog);
  dialog.showModal();
  return { close: () => dialog.close(), element: dialog };
}
let toastTimer;
export function toast(message) {
  const region = document.getElementById('toast-region');
  if (!region) return;
  clearTimeout(toastTimer);
  region.replaceChildren(h('div', { className: 'toast' }, message));
  toastTimer = setTimeout(() => region.replaceChildren(), 4200);
}
export function evidenceNumber({ text, label, onClick, evidence }) {
  return h('button', { type: 'button', className: 'evidence-number', 'data-confidence': evidenceConfidence(evidence),
    'aria-haspopup': 'dialog', 'aria-label': `${label} ${text} · 근거 보기`, onClick }, text);
}
