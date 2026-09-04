import type { Item, Reminder, ReminderKind } from "../types";
import { addDays, todayStr } from "./dates";
import { uid } from "./id";

const OFFSETS: { kind: ReminderKind; days: number }[] = [
  { kind: "minus_30d", days: 30 },
  { kind: "minus_7d", days: 7 },
  { kind: "minus_1d", days: 1 },
];

export function remindersForItem(item: Item): Reminder[] {
  if (!item.important || !item.dueOn || item.type !== "task") return [];
  const out: Reminder[] = [];
  for (const { kind, days } of OFFSETS) {
    const fireOn = addDays(item.dueOn, -days);
    if (fireOn >= item.dueOn) continue;
    if (fireOn <= todayStr()) continue;
    out.push({
      id: uid(),
      itemId: item.id,
      fireOn,
      kind,
      firedAt: null,
    });
  }
  return out;
}

export function reminderLabel(kind: ReminderKind): string {
  if (kind === "minus_30d") return "三十日前";
  if (kind === "minus_7d") return "七日前";
  return "一日前";
}
