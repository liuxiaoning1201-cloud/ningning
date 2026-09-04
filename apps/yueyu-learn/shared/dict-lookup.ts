/**
 * 離線詞表查詢工具：
 * 1. 整句精確匹配（命中→零延遲返回）
 * 2. 對未命中的句子，做最長字串貪婪匹配，產出 token 級的字級對照初步結果，
 *    用於前端在 LLM 回應到達之前先給用戶看到部分高亮。
 */
import dict from './offline-dict.json';
import type { TokenMapping, TranslateResult } from './types';

interface DictEntry {
  cantonese: string;
  jyutping: string;
  note?: string;
}

const ENTRIES = (dict as { entries: Record<string, DictEntry> }).entries;
const KEYS_BY_LEN = Object.keys(ENTRIES).sort((a, b) => b.length - a.length);

/** 整句精確匹配 */
export function lookupSentence(written: string): TranslateResult | null {
  const trimmed = written.trim();
  const hit = ENTRIES[trimmed];
  if (!hit) return null;
  return {
    written: trimmed,
    cantonese: hit.cantonese,
    jyutping: hit.jyutping,
    tokens: [
      {
        written: trimmed,
        cantonese: hit.cantonese,
        jyutping: hit.jyutping,
        note: hit.note,
      },
    ],
    explanation: hit.note,
    source: 'dict',
  };
}

/**
 * 字級貪婪匹配：把句子拆成「命中片段」與「未命中片段」，未命中片段的 cantonese 暫時等於 written。
 * 主要用於 UI 占位 / 部分高亮，後端 LLM 會給出最終結果並覆蓋。
 */
export function tokenizeByDict(written: string): TokenMapping[] {
  const tokens: TokenMapping[] = [];
  let i = 0;
  while (i < written.length) {
    let matched = false;
    for (const key of KEYS_BY_LEN) {
      if (key.length === 0) continue;
      if (written.startsWith(key, i)) {
        const entry = ENTRIES[key];
        tokens.push({
          written: key,
          cantonese: entry.cantonese,
          jyutping: entry.jyutping,
          note: entry.note,
        });
        i += key.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // 把未命中的單字累積到上一段（如為純未命中），減少碎片
      const last = tokens[tokens.length - 1];
      if (last && !last.jyutping) {
        last.written += written[i];
        last.cantonese += written[i];
      } else {
        tokens.push({
          written: written[i],
          cantonese: written[i],
        });
      }
      i += 1;
    }
  }
  return tokens;
}

/** 把 token 列表組合成完整粵語口語句（簡單拼接） */
export function tokensToCantonese(tokens: TokenMapping[]): string {
  return tokens.map((t) => t.cantonese).join('');
}

/** 把 token 列表組合粵拼（用空格分隔） */
export function tokensToJyutping(tokens: TokenMapping[]): string {
  return tokens
    .filter((t) => t.jyutping)
    .map((t) => t.jyutping)
    .join(' ');
}
