/**
 * 把粘貼進來的整段字幕切分成單句。
 * 支援中英文標點 + 換行；忽略空白；單句長度限制 200 字以內，超長按硬切。
 */
const SENTENCE_END = /([。！？!?；;]|\n+)/;

export function splitSentences(text: string, maxLen = 200): string[] {
  if (!text) return [];
  const parts = text.split(SENTENCE_END).filter((s) => s !== undefined && s !== '');

  // 把標點黏回前一句
  const merged: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const cur = parts[i];
    if (SENTENCE_END.test(cur) && merged.length) {
      merged[merged.length - 1] += cur.replace(/\n+/g, '');
    } else {
      merged.push(cur);
    }
  }

  return merged
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .flatMap((s) => (s.length <= maxLen ? [s] : chunkLong(s, maxLen)));
}

function chunkLong(s: string, maxLen: number): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    out.push(s.slice(i, i + maxLen));
    i += maxLen;
  }
  return out;
}
