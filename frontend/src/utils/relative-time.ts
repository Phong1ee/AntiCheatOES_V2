const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Recently';

  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  const ranges: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.34524, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ];
  let amount = seconds;
  for (const [range, unit] of ranges) {
    if (Math.abs(amount) < range) return formatter.format(Math.round(amount), unit);
    amount /= range;
  }
  return 'Recently';
}
