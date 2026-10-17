const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 3600],
  ['month', 30 * 24 * 3600],
  ['week', 7 * 24 * 3600],
  ['day', 24 * 3600],
  ['hour', 3600],
  ['minute', 60],
];

/** "3 days ago", "in 2 hours", "now". */
export function relativeTime(date: string | number | Date | null | undefined): string {
  if (!date) return '—';
  const seconds = (new Date(date).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return 'just now';
}

/** "Oct 17, 2026". */
export function shortDate(date: string | number | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Oct 17, 2026, 10:04 PM". */
export function dateTime(date: string | number | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
