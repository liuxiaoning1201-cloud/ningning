export interface TimeSpan {
  text: string;
  mark: boolean;
}

const PATTERNS: RegExp[] = [
  /\d{4}-\d{2}-\d{2}/g,
  /\d{4}年\d{1,2}月\d{1,2}日?/g,
  /\d{1,2}月\d{1,2}日?/g,
  /\d{1,2}\/\d{1,2}/g,
  /\d{1,2}:\d{2}/g,
  /下週[日天一二三四五六]/g,
  /週[日天一二三四五六]/g,
  /今天|明天|後天|年底|下個月/g,
  /(凌晨|早上|上午|中午|下午|傍晚|晚上|夜裡)?\d{1,2}點(半|\d{1,2}分)?/g,
  /(凌晨|早上|上午|中午|下午|傍晚|晚上|夜裡)?[一二三四五六七八九十]{1,3}點半?/g,
];

export function highlightTime(title: string): TimeSpan[] {
  const ranges: { start: number; end: number }[] = [];
  for (const source of PATTERNS) {
    const re = new RegExp(source.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(title))) {
      ranges.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  ranges.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r.start <= last.end) {
      last.end = Math.max(last.end, r.end);
    } else {
      merged.push({ ...r });
    }
  }
  if (!merged.length) return [{ text: title, mark: false }];
  const out: TimeSpan[] = [];
  let cursor = 0;
  for (const r of merged) {
    if (r.start > cursor) out.push({ text: title.slice(cursor, r.start), mark: false });
    out.push({ text: title.slice(r.start, r.end), mark: true });
    cursor = r.end;
  }
  if (cursor < title.length) out.push({ text: title.slice(cursor), mark: false });
  return out;
}
