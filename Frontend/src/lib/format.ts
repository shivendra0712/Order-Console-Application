const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const compactCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export const formatMoney = (cents: number) => currency.format(cents / 100);
export const formatMoneyCompact = (cents: number) =>
  cents >= 1_000_000 ? compactCurrency.format(cents / 100) : currency.format(cents / 100);

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export function formatRelative(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 45) return 'just now';
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
  ];
  let value = diffSec;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(-Math.round(value), unit);
    value /= size;
  }
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export const formatWeekday = (isoDay: string) =>
  new Date(`${isoDay}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
