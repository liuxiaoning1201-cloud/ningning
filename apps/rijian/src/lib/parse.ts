import type { ItemType } from "../types";
import { addDays, formatDate, todayStr } from "./dates";

export interface ParsedCapture {
  title: string;
  type: ItemType;
  important: boolean;
  dueOn: string | null;
}

const WEEKDAY_MAP: Record<string, number> = {
  日: 0,
  天: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
};

function nextWeekday(target: number, from = new Date()): Date {
  const d = new Date(from);
  const diff = (target + 7 - d.getDay()) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export function parseCapture(raw: string): ParsedCapture {
  let text = raw.trim();
  let type: ItemType = "idea";
  let important = false;
  let dueOn: string | null = null;

  if (/^(todo|待辦)\s+/i.test(text)) {
    type = "task";
    text = text.replace(/^(todo|待辦)\s+/i, "");
  }

  if (/(^|\s)(重要|[＊*★])(\s|$)/.test(text)) {
    important = true;
    text = text.replace(/(^|\s)(重要|[＊*★])(\s|$)/g, " ").trim();
  }

  const today = todayStr();

  const iso = text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})(?:\s|$)/);
  if (iso) {
    dueOn = iso[1];
    text = text.replace(iso[1], " ");
  }

  const ymd = text.match(/(?:^|\s)(\d{4})年(\d{1,2})月(\d{1,2})日?(?:\s|$)/);
  if (!dueOn && ymd) {
    dueOn = `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
    text = text.replace(ymd[0], " ");
  }

  const md = text.match(/(?:^|\s)(\d{1,2})月(\d{1,2})日?(?:\s|$)/);
  if (!dueOn && md) {
    const year = new Date().getFullYear();
    dueOn = `${year}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    if (dueOn < today) {
      dueOn = `${year + 1}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    }
    text = text.replace(md[0], " ");
  }

  const slash = text.match(/(?:^|\s)(\d{1,2})\/(\d{1,2})(?:\s|$)/);
  if (!dueOn && slash) {
    const year = new Date().getFullYear();
    dueOn = `${year}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
    if (dueOn < today) {
      dueOn = `${year + 1}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
    }
    text = text.replace(slash[0], " ");
  }

  if (!dueOn && /(^|\s)今天(\s|$)/.test(text)) {
    dueOn = today;
    text = text.replace(/今天/g, " ");
  } else if (!dueOn && /(^|\s)明天(\s|$)/.test(text)) {
    dueOn = addDays(today, 1);
    text = text.replace(/明天/g, " ");
  } else if (!dueOn && /(^|\s)後天(\s|$)/.test(text)) {
    dueOn = addDays(today, 2);
    text = text.replace(/後天/g, " ");
  } else if (!dueOn && /(^|\s)年底(\s|$)/.test(text)) {
    dueOn = `${new Date().getFullYear()}-12-31`;
    text = text.replace(/年底/g, " ");
  } else if (!dueOn && /(^|\s)下個月(\s|$)/.test(text)) {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    dueOn = formatDate(d);
    text = text.replace(/下個月/g, " ");
  }

  const nextWd = text.match(/(?:^|\s)下週([日天一二三四五六])(?:\s|$)/);
  if (!dueOn && nextWd) {
    const target = WEEKDAY_MAP[nextWd[1]];
    const d = nextWeekday(target);
    d.setDate(d.getDate() + 7);
    dueOn = formatDate(d);
    text = text.replace(nextWd[0], " ");
  }

  const wd = text.match(/(?:^|\s)週([日天一二三四五六])(?:\s|$)/);
  if (!dueOn && wd) {
    dueOn = formatDate(nextWeekday(WEEKDAY_MAP[wd[1]]));
    text = text.replace(wd[0], " ");
  }

  const title = text.replace(/\s+/g, " ").trim();
  if (dueOn) type = "task";

  return { title, type, important, dueOn };
}
