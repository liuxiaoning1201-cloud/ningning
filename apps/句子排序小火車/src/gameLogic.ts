export const DEPART_DURATION_MS = 1350;
export const DEPART_EXIT_PADDING_PX = 80;

export interface OrderToken {
  id: string;
  text: string;
}

/** 依詞語文字比對順序；相同詞可互換車廂，避免長句裡重複的「的／了」判錯。 */
export function isCorrectOrder(
  slots: (OrderToken | null)[],
  answer: OrderToken[]
): boolean {
  if (!answer.length || slots.length !== answer.length) return false;
  if (slots.some((s) => s === null)) return false;
  return slots.every((s, i) => s!.text === answer[i].text);
}

/** 把整列火車（含已橫向捲出畫面的部分）移到視窗左側以外。 */
export function computeDepartTranslateX(trainRect: {
  left: number;
  width: number;
}): number {
  return -(trainRect.left + trainRect.width + DEPART_EXIT_PADDING_PX);
}

export function nextAfterDepart(
  currentIdx: number,
  levelCount: number
): { kind: "next"; index: number } | { kind: "home" } {
  if (currentIdx < levelCount - 1) {
    return { kind: "next", index: currentIdx + 1 };
  }
  return { kind: "home" };
}
