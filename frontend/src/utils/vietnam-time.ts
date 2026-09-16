export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const OFFSET_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/i;
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:T|\s)(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/**
 * Parse an API datetime. Exam/business values without an offset are Vietnam
 * wall-clock values; UTC-aware telemetry values keep their supplied offset.
 */
export function parseVietnamDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = value.trim();
  if (OFFSET_SUFFIX.test(normalized)) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const match = LOCAL_DATETIME.exec(normalized);
  if (!match) {
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const [, year, month, day, hour, minute, second = '0', milliseconds = '0'] = match;
  const date = new Date(Date.UTC(
    Number(year), Number(month) - 1, Number(day), Number(hour) - 7,
    Number(minute), Number(second), Number(milliseconds.padEnd(3, '0')),
  ));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function vietnamTimestamp(value?: string | null): number | null {
  return parseVietnamDateTime(value)?.getTime() ?? null;
}

export function formatVietnamDateTime(value?: string | null, options: Intl.DateTimeFormatOptions = {}): string {
  const date = parseVietnamDateTime(value);
  if (!date) return '-';
  return date.toLocaleString('en-US', { timeZone: VIETNAM_TIME_ZONE, ...options });
}

export function formatVietnamDate(value?: string | null, options: Intl.DateTimeFormatOptions = {}): string {
  const date = parseVietnamDateTime(value);
  if (!date) return '-';
  return date.toLocaleDateString('en-US', { timeZone: VIETNAM_TIME_ZONE, ...options });
}

export function formatVietnamTime(value?: string | null, options: Intl.DateTimeFormatOptions = {}): string {
  const date = parseVietnamDateTime(value);
  if (!date) return '-';
  return date.toLocaleTimeString('en-US', { timeZone: VIETNAM_TIME_ZONE, ...options });
}
