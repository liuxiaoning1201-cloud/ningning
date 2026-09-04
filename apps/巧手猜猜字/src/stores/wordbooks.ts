import { defineStore } from 'pinia';
import { computed, ref, watch } from 'vue';

import { verifiedChars } from '@/lib/charData';
import type { Wordbook } from '@/types';

const STORAGE_KEY = 'caicaizi_books_v1';
const ACTIVE_KEY = 'caicaizi_active_book_v1';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** 第一次開啟時給老師三本現成的字簿，照筆畫難度分。 */
function seedBooks(): Wordbook[] {
  const ready = new Set(verifiedChars());
  const pick = (chars: string[]) => chars.filter((c) => ready.has(c));
  const now = Date.now();

  return [
    {
      id: uid(),
      name: '第一課 · 橫直撇捺',
      chars: pick(['一', '二', '三', '十', '人', '入', '八', '大', '天', '木', '本', '工', '土']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      name: '第二課 · 折與鈎',
      chars: pick(['口', '日', '目', '山', '中', '小', '了', '子', '刀', '力', '又', '也', '月', '手']),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uid(),
      name: '第三課 · 難筆畫',
      chars: pick(['女', '去', '公', '心', '必', '戈', '孔', '衣', '好', '水', '火']),
      createdAt: now,
      updatedAt: now,
    },
  ].filter((b) => b.chars.length > 0);
}

function load(): Wordbook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Wordbook[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // 壞掉就重新給預設字簿，不要讓課堂卡在白畫面
  }
  return seedBooks();
}

export const useWordbooks = defineStore('wordbooks', () => {
  const books = ref<Wordbook[]>(load());
  const activeId = ref<string>(localStorage.getItem(ACTIVE_KEY) ?? books.value[0]?.id ?? '');

  watch(
    books,
    (val) => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    },
    { deep: true }
  );

  watch(activeId, (val) => {
    localStorage.setItem(ACTIVE_KEY, val);
  });

  const active = computed(() => books.value.find((b) => b.id === activeId.value) ?? books.value[0]);

  const activeChars = computed(() => active.value?.chars ?? []);

  function create(name: string): Wordbook {
    const now = Date.now();
    const book: Wordbook = { id: uid(), name: name.trim() || '新字簿', chars: [], createdAt: now, updatedAt: now };
    books.value.push(book);
    activeId.value = book.id;
    return book;
  }

  function rename(id: string, name: string): void {
    const book = books.value.find((b) => b.id === id);
    if (!book) return;
    book.name = name.trim() || book.name;
    book.updatedAt = Date.now();
  }

  function remove(id: string): void {
    books.value = books.value.filter((b) => b.id !== id);
    if (activeId.value === id) activeId.value = books.value[0]?.id ?? '';
  }

  function addChars(id: string, chars: string[]): number {
    const book = books.value.find((b) => b.id === id);
    if (!book) return 0;
    let added = 0;
    for (const ch of chars) {
      if (!book.chars.includes(ch)) {
        book.chars.push(ch);
        added += 1;
      }
    }
    if (added) book.updatedAt = Date.now();
    return added;
  }

  function removeChar(id: string, ch: string): void {
    const book = books.value.find((b) => b.id === id);
    if (!book) return;
    book.chars = book.chars.filter((c) => c !== ch);
    book.updatedAt = Date.now();
  }

  function select(id: string): void {
    activeId.value = id;
  }

  function exportJson(): string {
    return JSON.stringify({ app: '巧手猜猜字', version: 1, books: books.value }, null, 2);
  }

  /** 匯入時合併同名字簿，不覆蓋老師手上已有的內容。 */
  function importJson(text: string): { books: number; chars: number } {
    const parsed = JSON.parse(text) as { books?: Wordbook[] };
    if (!Array.isArray(parsed.books)) throw new Error('檔案裡找不到 books');

    let bookCount = 0;
    let charCount = 0;
    for (const incoming of parsed.books) {
      if (typeof incoming?.name !== 'string' || !Array.isArray(incoming.chars)) continue;
      const chars = incoming.chars.filter((c) => typeof c === 'string' && c.length === 1);
      const existing = books.value.find((b) => b.name === incoming.name);
      if (existing) {
        charCount += addChars(existing.id, chars);
      } else {
        const now = Date.now();
        books.value.push({ id: uid(), name: incoming.name, chars, createdAt: now, updatedAt: now });
        bookCount += 1;
        charCount += chars.length;
      }
    }
    return { books: bookCount, chars: charCount };
  }

  function resetToSeed(): void {
    books.value = seedBooks();
    activeId.value = books.value[0]?.id ?? '';
  }

  return {
    books,
    activeId,
    active,
    activeChars,
    create,
    rename,
    remove,
    addChars,
    removeChar,
    select,
    exportJson,
    importJson,
    resetToSeed,
  };
});
