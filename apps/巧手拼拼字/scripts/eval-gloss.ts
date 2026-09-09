/**
 * 抽驗萌典字義卡的解析結果。只在開發時跑，會真的打萌典。
 * 用法：npx vite-node scripts/eval-gloss.ts
 *
 * node 環境沒有 IndexedDB，也沒有同源的 /api/dict/words，
 * 兩者都會被 moedict.ts 靜默跳過，所以這裡驗的是「純萌典 + 例詞抽取」那條路。
 */
import { loadGloss, rankWords } from '../src/lib/moedict';

const SAMPLE = ['進', '難', '水', '之', '花', '雲', '道', '學', '飯', '路'];

/** 文言引例不該出現在給小學生看的卡片裡。 */
const CLASSICAL = /[《》]/;

let failed = 0;

for (const ch of SAMPLE) {
  const gloss = await loadGloss(ch);
  if (!gloss) {
    process.stdout.write(`${ch} 取不到字義 FAIL\n`);
    failed += 1;
    continue;
  }

  const words = rankWords(gloss.words, ch, new Set(SAMPLE));
  const texts = [
    ...gloss.senses.map((s) => s.def),
    ...gloss.senses.flatMap((s) => s.examples),
  ];
  const leaked = texts.filter((t) => CLASSICAL.test(t));

  process.stdout.write(
    `${ch} ${gloss.bopomofo.join('／') || '無注音'} ${gloss.strokeCount ?? '?'} 畫 · ` +
      `釋義 ${gloss.senses.length} 條 · 組詞 ${words.length} 個 · 英文 ${gloss.english.length} 條` +
      `${words.length ? ` · ${words.slice(0, 6).join('、')}` : ''}\n`
  );

  if (!gloss.senses.length) {
    process.stdout.write(`  ${ch} 沒有任何白話釋義 FAIL\n`);
    failed += 1;
  }
  if (leaked.length) {
    process.stdout.write(`  ${ch} 混進文言引例 FAIL ${leaked[0]}\n`);
    failed += 1;
  }
  if (gloss.senses.some((s) => s.def.length > 43)) {
    process.stdout.write(`  ${ch} 釋義沒有截斷 FAIL\n`);
    failed += 1;
  }
  if (words.some((w) => !w.includes(ch) || w.length < 2)) {
    process.stdout.write(`  ${ch} 組詞不含本字 FAIL\n`);
    failed += 1;
  }
}

process.stdout.write(failed ? `\n${failed} 項 FAIL\n` : '\n全部 OK\n');
if (failed) process.exitCode = 1;
