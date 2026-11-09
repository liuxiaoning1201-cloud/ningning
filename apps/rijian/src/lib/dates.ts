const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

let nowImpl: () => Date = () => new Date();

/** Current instant. Tests may replace this; production always uses the real clock. */
export function nowDate(): Date {
  return nowImpl();
}

/** Test-only. Pass null to restore the real clock. Never used in production. */
export function setNowForTests(now: Date | (() => Date) | null): void {
  if (now == null) {
    nowImpl = () => new Date();
    return;
  }
  nowImpl = typeof now === "function" ? now : () => new Date(now.getTime());
}

export function todayStr(d = nowDate()): string {
  return formatDate(d);
}

/**
 * Local calendar date (the user's machine timezone), not UTC.
 * `toISOString().slice(0, 10)` is the UTC date and is wrong near midnight
 * for timezones east of UTC (including Asia/Hong_Kong).
 */
export function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function msUntilNextLocalMidnight(from = nowDate()): number {
  const next = new Date(from.getTime());
  next.setHours(24, 0, 0, 0);
  const ms = next.getTime() - from.getTime();
  return ms > 0 ? ms : 1;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function startOfMonth(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(1);
  return formatDate(d);
}

export function endOfMonth(iso: string): string {
  const d = parseISODate(iso);
  d.setMonth(d.getMonth() + 1, 0);
  return formatDate(d);
}

export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${Number(y)}年${Number(m)}月`;
}

export function formatLongDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日　星期${WEEKDAYS[d.getDay()]}`;
}

export function formatShortDate(iso: string): string {
  const d = parseISODate(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function isSameMonth(a: string, b: string): boolean {
  return monthKey(a) === monthKey(b);
}
