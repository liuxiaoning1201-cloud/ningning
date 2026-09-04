/**
 * 客戶端內容字典（離線/本地對戰用）。
 * 與 workers/zizi-zhuji/src/content/* 對齊。
 *
 * 說明：為避免 monorepo 編譯耦合，這裡是手動同步的副本；
 * 如要更新，請同步修改 worker 端對應檔案。
 */

import type { ContentType } from "@/lib/types";

import { BUILTIN_IDIOMS } from "./content/idioms";
import { POEMS_5, POEMS_7 } from "./content/poems";
import { SENTENCES } from "./content/sentences";
import { HIGH_FREQ_CHARS } from "./content/highFreq";

export { BUILTIN_IDIOMS, POEMS_5, POEMS_7, SENTENCES, HIGH_FREQ_CHARS };

export function getContentDictionary(type: ContentType, custom?: string[]): Set<string> {
  if (custom && custom.length > 0) return new Set(custom);
  switch (type) {
    case "idiom":   return new Set(BUILTIN_IDIOMS.map((i) => i.text));
    case "poem-5":  return new Set(POEMS_5.map((p) => p.text));
    case "poem-7":  return new Set(POEMS_7.map((p) => p.text));
    case "sentence": return new Set(SENTENCES.map((s) => s.text));
    default: return new Set();
  }
}

export function getContentSeeds(type: ContentType, custom?: string[]): string[] {
  if (custom && custom.length > 0) return custom.slice();
  switch (type) {
    case "idiom":   return BUILTIN_IDIOMS.map((i) => i.text);
    case "poem-5":  return POEMS_5.map((p) => p.text);
    case "poem-7":  return POEMS_7.map((p) => p.text);
    case "sentence": return SENTENCES.map((s) => s.text);
    case "char":
    case "word":    return BUILTIN_IDIOMS.map((i) => i.text);
    default:        return [];
  }
}

/** 給 RuleHUD 顯示「此模板的字典示例」用 */
export function sampleSeeds(type: ContentType, n = 5): string[] {
  const arr = getContentSeeds(type);
  return arr.slice(0, n);
}
