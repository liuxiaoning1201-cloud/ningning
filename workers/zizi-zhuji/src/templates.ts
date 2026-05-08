/**
 * 內建 6 個課堂模板（M1 出貨 + 老師可基於它們再客製）。
 *
 * 模板是「規則 + 棋盤大小 + 推薦時長」的封裝，
 * 老師也可以完全略過模板自訂 GameRule。
 */

import type { GameTemplate } from "../../../shared/zizizhujiTypes.js";

export const BUILTIN_TEMPLATES: GameTemplate[] = [
  {
    id: "idiom-rush",
    name: "成語搶答",
    description: "棋盤埋有成語，誰先連成 4 字成語誰勝。中年級首選。",
    emoji: "📜",
    rule: {
      content: "idiom",
      lineLength: 4,
      win: { kind: "complete", targetType: "idiom" },
      placement: { kind: "free" },
      challengeable: false,
    },
    boardSize: 11,
    yearLevels: ["g3-4", "g5-6"],
    turnSeconds: 45,
    minBankItems: 12,
    builtIn: true,
  },
  {
    id: "five-qa",
    name: "答題五子",
    description: "答對中文題才能落子，先連 5 子者勝。全年級皆可玩。",
    emoji: "🎯",
    rule: {
      content: "free",
      lineLength: 5,
      win: { kind: "first", n: 5 },
      placement: { kind: "qa", difficulty: 2 },
      challengeable: false,
    },
    boardSize: 11,
    yearLevels: ["g1-2", "g3-4", "g5-6"],
    turnSeconds: 60,
    builtIn: true,
  },
  {
    id: "wuyan-poem",
    name: "五言詩接龍",
    description: "棋盤暗藏唐詩五言句，先連成完整 5 字詩句者勝。",
    emoji: "🌙",
    rule: {
      content: "poem-5",
      lineLength: 5,
      win: { kind: "complete", targetType: "poem-5" },
      placement: { kind: "free" },
      challengeable: false,
    },
    boardSize: 11,
    yearLevels: ["g3-4", "g5-6"],
    turnSeconds: 50,
    minBankItems: 8,
    builtIn: true,
  },
  {
    id: "qiyan-poem",
    name: "七言詩接龍",
    description: "進階版！連 7 子拼出完整七言詩句者勝。考驗對唐詩的熟悉度。",
    emoji: "🍃",
    rule: {
      content: "poem-7",
      lineLength: 7,
      win: { kind: "complete", targetType: "poem-7" },
      placement: { kind: "free" },
      challengeable: false,
    },
    boardSize: 13,
    yearLevels: ["g5-6"],
    turnSeconds: 60,
    minBankItems: 6,
    builtIn: true,
  },
  {
    id: "sentence-relay",
    name: "句子接龍",
    description: "拼出一句完整通順的話即勝（長度 5–10 字動態）。",
    emoji: "💬",
    rule: {
      content: "sentence",
      lineLength: "match-content",
      win: { kind: "complete", targetType: "sentence" },
      placement: { kind: "free" },
      challengeable: true,
    },
    boardSize: 13,
    yearLevels: ["g3-4", "g5-6"],
    turnSeconds: 60,
    minBankItems: 8,
    builtIn: true,
  },
  {
    id: "count-most",
    name: "連得多者勝",
    description: "5 分鐘倒數，誰連成 5 子的次數多誰贏。節奏緊湊。",
    emoji: "⚡",
    rule: {
      content: "free",
      lineLength: 5,
      win: { kind: "count", durationSec: 300, lineLength: 5 },
      placement: { kind: "free" },
      challengeable: false,
    },
    boardSize: 13,
    yearLevels: ["g3-4", "g5-6"],
    turnSeconds: 30,
    builtIn: true,
  },
];

export function getTemplate(id: string): GameTemplate | undefined {
  return BUILTIN_TEMPLATES.find((t) => t.id === id);
}
