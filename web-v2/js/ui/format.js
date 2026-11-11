const decimal = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
export const number = (value, digits = 1) => Number.isFinite(value) ? (digits === 0 ? integer : decimal).format(value) : '—';
export const eok = (value) => Number.isFinite(value) ? number(value / 1e8) : '—';
export const manwon = (value) => Number.isFinite(value) ? integer.format(value / 1e4) : '—';
export const percent = (value) => Number.isFinite(value) ? `${number(value * 100)}%` : '산출 불가';
export function median(values) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2) : null;
}
