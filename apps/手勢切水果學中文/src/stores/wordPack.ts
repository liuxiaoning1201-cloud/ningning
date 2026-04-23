import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { WordEntry } from '@/types/word';
import { STORAGE_KEY_WORDS } from '@/types/word';

/** 預設詞包：已標註主題標籤，可搭配內建關卡使用 */
export const DEFAULT_WORDS: WordEntry[] = [
  { word: '老師', pinyin: 'lǎoshī', langRead: 'mandarin', tags: ['人物'], difficulty: 1 },
  { word: '醫生', pinyin: 'yīshēng', langRead: 'mandarin', tags: ['人物'], difficulty: 1 },
  { word: '朋友', pinyin: 'péngyou', langRead: 'cantonese', tags: ['人物'], difficulty: 1 },
  { word: '媽媽', pinyin: 'māma', langRead: 'mandarin', tags: ['人物', '疊字'], difficulty: 1 },
  { word: '司機', pinyin: 'sījī', langRead: 'mandarin', tags: ['人物', '平翹舌'], difficulty: 2 },
  { word: '警察', pinyin: 'jǐngchá', langRead: 'mandarin', tags: ['人物'], difficulty: 2 },

  { word: '熊貓', pinyin: 'xióngmāo', langRead: 'mandarin', tags: ['動物'], difficulty: 1 },
  { word: '老虎', pinyin: 'lǎohǔ', langRead: 'mandarin', tags: ['動物'], difficulty: 1 },
  { word: '兔子', pinyin: 'tùzi', langRead: 'mandarin', tags: ['動物', '輕聲'], difficulty: 1 },
  { word: '蝴蝶', pinyin: 'húdié', langRead: 'mandarin', tags: ['動物'], difficulty: 2 },
  { word: '蜻蜓', pinyin: 'qīngtíng', langRead: 'mandarin', tags: ['動物', '後鼻音'], difficulty: 2 },

  { word: '春天', pinyin: 'chūntiān', langRead: 'mandarin', tags: ['前鼻音', '季節'], difficulty: 1 },
  { word: '森林', pinyin: 'sēnlín', langRead: 'mandarin', tags: ['前鼻音', '自然'], difficulty: 2 },
  { word: '雲朵', pinyin: 'yúnduǒ', langRead: 'mandarin', tags: ['前鼻音', '自然'], difficulty: 2 },
  { word: '陽光', pinyin: 'yángguāng', langRead: 'mandarin', tags: ['後鼻音', '自然'], difficulty: 1 },
  { word: '月亮', pinyin: 'yuèliang', langRead: 'mandarin', tags: ['後鼻音', '自然', '輕聲'], difficulty: 1 },
  { word: '風景', pinyin: 'fēngjǐng', langRead: 'mandarin', tags: ['後鼻音', '自然'], difficulty: 2 },

  { word: '蘋果', pinyin: 'píngguǒ', langRead: 'mandarin', tags: ['食物', '後鼻音'], difficulty: 1 },
  { word: '西瓜', pinyin: 'xīguā', langRead: 'mandarin', tags: ['食物'], difficulty: 1 },
  { word: '學校', pinyin: 'xuéxiào', langRead: 'mandarin', tags: ['日常'], difficulty: 1 },
  { word: '快樂', pinyin: 'kuàilè', langRead: 'mandarin', tags: ['情感'], difficulty: 1 },
  { word: '認真', pinyin: 'rènzhēn', langRead: 'mandarin', tags: ['情感', '前鼻音', '平翹舌'], difficulty: 2 },
  { word: '謝謝', pinyin: 'xièxie', langRead: 'cantonese', tags: ['日常', '疊字'], difficulty: 1 },
];

function loadLocal(): WordEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORDS);
    if (!raw) return [...DEFAULT_WORDS];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_WORDS];
    return parsed.filter(isWordEntry);
  } catch {
    return [...DEFAULT_WORDS];
  }
}

function isWordEntry(x: unknown): x is WordEntry {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.word === 'string' && (o.langRead === 'mandarin' || o.langRead === 'cantonese');
}

export const useWordPackStore = defineStore('wordPack', () => {
  const entries = ref<WordEntry[]>(loadLocal());

  function persist() {
    localStorage.setItem(STORAGE_KEY_WORDS, JSON.stringify(entries.value));
  }

  function setWords(next: WordEntry[]) {
    entries.value = next.length ? next : [...DEFAULT_WORDS];
    persist();
  }

  function resetDemo() {
    entries.value = [...DEFAULT_WORDS];
    persist();
  }

  const count = computed(() => entries.value.length);

  /** 所有出現過的標籤（去重、按詞頻排序） */
  const allTags = computed(() => {
    const freq = new Map<string, number>();
    for (const e of entries.value) {
      for (const t of e.tags || []) {
        freq.set(t, (freq.get(t) ?? 0) + 1);
      }
    }
    return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  });

  /** 以 OR 語意：詞條含 tags 任一則入選；topics 為空則回全部 */
  function byTags(topics: string[]): WordEntry[] {
    if (!topics?.length) return entries.value.slice();
    const set = new Set(topics);
    return entries.value.filter((e) => (e.tags || []).some((t) => set.has(t)));
  }

  /** 補集：不含任何指定 topics 的詞，用於干擾池 */
  function notByTags(topics: string[]): WordEntry[] {
    if (!topics?.length) return [];
    const set = new Set(topics);
    return entries.value.filter((e) => !(e.tags || []).some((t) => set.has(t)));
  }

  function tagCount(tag: string): number {
    return entries.value.reduce((acc, e) => (e.tags?.includes(tag) ? acc + 1 : acc), 0);
  }

  return { entries, setWords, resetDemo, persist, count, allTags, byTags, notByTags, tagCount };
});
