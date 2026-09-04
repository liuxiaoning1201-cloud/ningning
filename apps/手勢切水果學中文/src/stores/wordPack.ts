import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { WordEntry } from '@/types/word';
import { STORAGE_KEY_WORDS } from '@/types/word';

/** 預設詞包：已標註主題標籤，可搭配內建關卡使用 */
export const DEFAULT_WORDS: WordEntry[] = [
  { word: '老師', pinyin: 'lǎoshī', langRead: 'mandarin', tags: ['人物'], difficulty: 1 },
  { word: '醫生', pinyin: 'yīshēng', langRead: 'mandarin', tags: ['人物'], difficulty: 1 },
  { word: '朋友', pinyin: 'péngyou', langRead: 'mandarin', tags: ['人物', '輕聲'], difficulty: 1 },
  { word: '媽媽', pinyin: 'māma', langRead: 'mandarin', tags: ['人物', '疊字'], difficulty: 1 },
  { word: '爸爸', pinyin: 'bàba', langRead: 'mandarin', tags: ['人物', '疊字'], difficulty: 1 },
  { word: '哥哥', pinyin: 'gēge', langRead: 'mandarin', tags: ['人物', '疊字', '輕聲'], difficulty: 1 },
  { word: '妹妹', pinyin: 'mèimei', langRead: 'mandarin', tags: ['人物', '疊字', '輕聲'], difficulty: 1 },
  { word: '司機', pinyin: 'sījī', langRead: 'mandarin', tags: ['人物', '平翹舌'], difficulty: 2 },
  { word: '警察', pinyin: 'jǐngchá', langRead: 'mandarin', tags: ['人物'], difficulty: 2 },
  { word: '農夫', pinyin: 'nóngfū', langRead: 'mandarin', tags: ['人物', '後鼻音'], difficulty: 2 },
  { word: '同學', pinyin: 'tóngxué', langRead: 'mandarin', tags: ['人物', '後鼻音'], difficulty: 1 },

  { word: '熊貓', pinyin: 'xióngmāo', langRead: 'mandarin', tags: ['動物', '後鼻音'], difficulty: 1 },
  { word: '老虎', pinyin: 'lǎohǔ', langRead: 'mandarin', tags: ['動物'], difficulty: 1 },
  { word: '兔子', pinyin: 'tùzi', langRead: 'mandarin', tags: ['動物', '輕聲'], difficulty: 1 },
  { word: '蝴蝶', pinyin: 'húdié', langRead: 'mandarin', tags: ['動物'], difficulty: 2 },
  { word: '蜻蜓', pinyin: 'qīngtíng', langRead: 'mandarin', tags: ['動物', '後鼻音'], difficulty: 2 },
  { word: '小狗', pinyin: 'xiǎogǒu', langRead: 'mandarin', tags: ['動物'], difficulty: 1 },
  { word: '小貓', pinyin: 'xiǎomāo', langRead: 'mandarin', tags: ['動物'], difficulty: 1 },
  { word: '大象', pinyin: 'dàxiàng', langRead: 'mandarin', tags: ['動物', '後鼻音'], difficulty: 1 },
  { word: '長頸鹿', pinyin: 'chángjǐnglù', langRead: 'mandarin', tags: ['動物', '後鼻音', '平翹舌'], difficulty: 2 },
  { word: '獅子', pinyin: 'shīzi', langRead: 'mandarin', tags: ['動物', '輕聲', '平翹舌'], difficulty: 1 },
  { word: '海豚', pinyin: 'hǎitún', langRead: 'mandarin', tags: ['動物', '前鼻音'], difficulty: 2 },
  { word: '青蛙', pinyin: 'qīngwā', langRead: 'mandarin', tags: ['動物', '後鼻音'], difficulty: 1 },

  { word: '春天', pinyin: 'chūntiān', langRead: 'mandarin', tags: ['前鼻音', '季節', '自然'], difficulty: 1 },
  { word: '夏天', pinyin: 'xiàtiān', langRead: 'mandarin', tags: ['前鼻音', '季節', '自然'], difficulty: 1 },
  { word: '秋天', pinyin: 'qiūtiān', langRead: 'mandarin', tags: ['前鼻音', '季節', '自然'], difficulty: 1 },
  { word: '冬天', pinyin: 'dōngtiān', langRead: 'mandarin', tags: ['前鼻音', '後鼻音', '季節', '自然'], difficulty: 1 },
  { word: '森林', pinyin: 'sēnlín', langRead: 'mandarin', tags: ['前鼻音', '自然'], difficulty: 2 },
  { word: '雲朵', pinyin: 'yúnduǒ', langRead: 'mandarin', tags: ['前鼻音', '自然'], difficulty: 2 },
  { word: '陽光', pinyin: 'yángguāng', langRead: 'mandarin', tags: ['後鼻音', '自然'], difficulty: 1 },
  { word: '月亮', pinyin: 'yuèliang', langRead: 'mandarin', tags: ['後鼻音', '自然', '輕聲'], difficulty: 1 },
  { word: '風景', pinyin: 'fēngjǐng', langRead: 'mandarin', tags: ['後鼻音', '自然'], difficulty: 2 },
  { word: '彩虹', pinyin: 'cǎihóng', langRead: 'mandarin', tags: ['後鼻音', '自然'], difficulty: 2 },
  { word: '海洋', pinyin: 'hǎiyáng', langRead: 'mandarin', tags: ['後鼻音', '自然'], difficulty: 1 },
  { word: '高山', pinyin: 'gāoshān', langRead: 'mandarin', tags: ['前鼻音', '自然', '平翹舌'], difficulty: 1 },
  { word: '河流', pinyin: 'héliú', langRead: 'mandarin', tags: ['自然'], difficulty: 2 },
  { word: '星星', pinyin: 'xīngxing', langRead: 'mandarin', tags: ['自然', '後鼻音', '疊字', '輕聲'], difficulty: 1 },

  { word: '蘋果', pinyin: 'píngguǒ', langRead: 'mandarin', tags: ['食物', '後鼻音'], difficulty: 1 },
  { word: '西瓜', pinyin: 'xīguā', langRead: 'mandarin', tags: ['食物'], difficulty: 1 },
  { word: '香蕉', pinyin: 'xiāngjiāo', langRead: 'mandarin', tags: ['食物', '後鼻音'], difficulty: 1 },
  { word: '葡萄', pinyin: 'pútao', langRead: 'mandarin', tags: ['食物', '輕聲'], difficulty: 1 },
  { word: '草莓', pinyin: 'cǎoméi', langRead: 'mandarin', tags: ['食物', '平翹舌'], difficulty: 1 },
  { word: '芒果', pinyin: 'mángguǒ', langRead: 'mandarin', tags: ['食物', '後鼻音'], difficulty: 1 },
  { word: '麵包', pinyin: 'miànbāo', langRead: 'mandarin', tags: ['食物', '前鼻音'], difficulty: 1 },
  { word: '牛奶', pinyin: 'niúnǎi', langRead: 'mandarin', tags: ['食物'], difficulty: 1 },
  { word: '雞蛋', pinyin: 'jīdàn', langRead: 'mandarin', tags: ['食物', '前鼻音'], difficulty: 1 },

  { word: '學校', pinyin: 'xuéxiào', langRead: 'mandarin', tags: ['日常', '學校'], difficulty: 1 },
  { word: '黑板', pinyin: 'hēibǎn', langRead: 'mandarin', tags: ['學校', '前鼻音'], difficulty: 1 },
  { word: '書包', pinyin: 'shūbāo', langRead: 'mandarin', tags: ['學校', '平翹舌'], difficulty: 1 },
  { word: '鉛筆', pinyin: 'qiānbǐ', langRead: 'mandarin', tags: ['學校', '前鼻音'], difficulty: 2 },
  { word: '作業', pinyin: 'zuòyè', langRead: 'mandarin', tags: ['學校', '平翹舌'], difficulty: 2 },
  { word: '上課', pinyin: 'shàngkè', langRead: 'mandarin', tags: ['學校', '後鼻音', '平翹舌'], difficulty: 1 },

  { word: '快樂', pinyin: 'kuàilè', langRead: 'mandarin', tags: ['情感'], difficulty: 1 },
  { word: '勇敢', pinyin: 'yǒnggǎn', langRead: 'mandarin', tags: ['情感', '後鼻音', '前鼻音'], difficulty: 2 },
  { word: '善良', pinyin: 'shànliáng', langRead: 'mandarin', tags: ['情感', '後鼻音', '前鼻音', '平翹舌'], difficulty: 2 },
  { word: '認真', pinyin: 'rènzhēn', langRead: 'mandarin', tags: ['情感', '前鼻音', '平翹舌'], difficulty: 2 },
  { word: '溫柔', pinyin: 'wēnróu', langRead: 'mandarin', tags: ['情感', '前鼻音'], difficulty: 2 },
  { word: '聰明', pinyin: 'cōngmíng', langRead: 'mandarin', tags: ['情感', '後鼻音', '平翹舌'], difficulty: 2 },
  { word: '害怕', pinyin: 'hàipà', langRead: 'mandarin', tags: ['情感'], difficulty: 1 },
  { word: '驚喜', pinyin: 'jīngxǐ', langRead: 'mandarin', tags: ['情感', '後鼻音'], difficulty: 2 },

  { word: '謝謝', pinyin: 'xièxie', langRead: 'cantonese', tags: ['日常', '疊字'], difficulty: 1 },
  { word: '你好', pinyin: 'nǐhǎo', langRead: 'mandarin', tags: ['日常'], difficulty: 1 },
  { word: '再見', pinyin: 'zàijiàn', langRead: 'mandarin', tags: ['日常', '前鼻音', '平翹舌'], difficulty: 1 },
  { word: '對不起', pinyin: 'duìbuqǐ', langRead: 'mandarin', tags: ['日常', '輕聲'], difficulty: 1 },
  { word: '沒關係', pinyin: 'méiguānxi', langRead: 'mandarin', tags: ['日常', '前鼻音', '輕聲'], difficulty: 2 },
  { word: '請問', pinyin: 'qǐngwèn', langRead: 'mandarin', tags: ['日常', '後鼻音', '前鼻音'], difficulty: 1 },
  { word: '加油', pinyin: 'jiāyóu', langRead: 'mandarin', tags: ['日常', '情感'], difficulty: 1 },
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
