import { describe, expect, it } from "vitest";
import { parseSlashBank } from "./bank";
import {
  computeDepartTranslateX,
  DEPART_EXIT_PADDING_PX,
  isCorrectOrder,
  nextAfterDepart,
  type OrderToken,
} from "./gameLogic";

function tokens(words: string[], level = "L0"): OrderToken[] {
  return words.map((text, i) => ({ id: `${level}-${i}-${text}`, text }));
}

describe("parseSlashBank", () => {
  it("parses short demo sentences", () => {
    const levels = parseSlashBank("春天來了/花兒/開了\n小青蛙/跳進/池塘裡");
    expect(levels).toEqual([
      ["春天來了", "花兒", "開了"],
      ["小青蛙", "跳進", "池塘裡"],
    ]);
  });

  it("parses a 16-token sentence as one level", () => {
    const line =
      "在/這個/美麗/的/春天/早晨/我/和/我的/好朋友/小明/一起/到/公園/裡面/賞花";
    const levels = parseSlashBank(line);
    expect(levels).toHaveLength(1);
    expect(levels[0]).toHaveLength(16);
    expect(levels[0][0]).toBe("在");
    expect(levels[0][15]).toBe("賞花");
  });
});

describe("isCorrectOrder", () => {
  const answer = tokens(["春天來了", "花兒", "開了"]);

  it("rejects empty or incomplete slots", () => {
    expect(isCorrectOrder([], answer)).toBe(false);
    expect(isCorrectOrder([answer[0], answer[1], null], answer)).toBe(false);
  });

  it("rejects a filled but incorrect order", () => {
    const wrong = [answer[1], answer[0], answer[2]];
    expect(isCorrectOrder(wrong, answer)).toBe(false);
  });

  it("accepts the matching short-sentence order", () => {
    expect(isCorrectOrder([...answer], answer)).toBe(true);
  });

  it("accepts a long sentence when every token text matches", () => {
    const words = [
      "在",
      "這個",
      "美麗",
      "的",
      "春天",
      "早晨",
      "我",
      "和",
      "我的",
      "好朋友",
      "小明",
      "一起",
      "到",
      "公園",
      "裡面",
      "賞花",
    ];
    const ans = tokens(words);
    expect(isCorrectOrder([...ans], ans)).toBe(true);
    const swapped = [...ans];
    const tmp = swapped[0];
    swapped[0] = swapped[1];
    swapped[1] = tmp;
    expect(isCorrectOrder(swapped, ans)).toBe(false);
  });

  it("treats duplicate words as interchangeable by text, not id", () => {
    const ans = tokens(["我們", "的", "貓", "的", "尾巴"]);
    const swappedParticles = [ans[0], ans[3], ans[2], ans[1], ans[4]];
    expect(swappedParticles[1].id).not.toBe(ans[1].id);
    expect(isCorrectOrder(swappedParticles, ans)).toBe(true);
  });
});

describe("computeDepartTranslateX", () => {
  it("moves a short centered train fully past the left edge", () => {
    const x = computeDepartTranslateX({ left: 200, width: 400 });
    expect(x).toBe(-(200 + 400 + DEPART_EXIT_PADDING_PX));
    expect(200 + 400 + x).toBe(-DEPART_EXIT_PADDING_PX);
  });

  it("clears a wide train that already overflows the viewport", () => {
    const x = computeDepartTranslateX({ left: -400, width: 2200 });
    expect(x).toBeLessThan(0);
    expect(-400 + 2200 + x).toBe(-DEPART_EXIT_PADDING_PX);
  });
});

describe("nextAfterDepart", () => {
  it("advances to the next round when more levels remain", () => {
    expect(nextAfterDepart(0, 4)).toEqual({ kind: "next", index: 1 });
  });

  it("returns home after the last round, including a single long-sentence level", () => {
    expect(nextAfterDepart(0, 1)).toEqual({ kind: "home" });
    expect(nextAfterDepart(3, 4)).toEqual({ kind: "home" });
  });
});
