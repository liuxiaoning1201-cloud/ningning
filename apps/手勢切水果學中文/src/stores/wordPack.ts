import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import type { WordEntry } from '@/types/word';
import { STORAGE_KEY_WORDS } from '@/types/word';

/** 預設詞包（可直接開玩） */
export const DEFAULT_WORDS: WordEntry[] = [
  { word: '春天', pinyin: 'chūntiān', langRead: 'mandarin' },
  { word: '謝謝', pinyin: 'xièxie', langRead: 'cantonese' },
  { word: '學校', pinyin: 'xuéxiào', langRead: 'mandarin' },
  { word: '朋友', pinyin: 'péngyou', langRead: 'cantonese' },
  { word: '快樂', pinyin: 'kuàilè', langRead: 'mandarin' },
  { word: '認真', pinyin: 'rènzhēn', langRead: 'mandarin' },
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

  return { entries, setWords, resetDemo, persist, count };
});
