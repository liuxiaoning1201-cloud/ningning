<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { extractHan, keepHkChars, parseImportFile } from '@/lib/importChars';
import { useWordbooks } from '@/stores/wordbooks';

const router = useRouter();
const books = useWordbooks();

const openId = ref(books.active?.id ?? '');
const newBookName = ref('');
const newBookChars = ref('');
const addToOpen = ref('');
const message = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

function toast(text: string) {
  message.value = text;
  window.setTimeout(() => {
    if (message.value === text) message.value = '';
  }, 2800);
}

const activeId = computed(() => books.active?.id ?? '');

function toggleBook(id: string) {
  openId.value = openId.value === id ? '' : id;
  books.select(id);
}

function addCharsTo(id: string, raw: string): boolean {
  const { accepted, rejected } = keepHkChars(extractHan(raw));
  if (!accepted.length && !rejected.length) {
    toast('請輸入漢字');
    return false;
  }
  const added = books.addChars(id, accepted);
  const parts = [`加入 ${added} 字`];
  if (rejected.length) parts.push(`${rejected.join('')} 不在香港常用字字形表，已略過`);
  toast(parts.join('；'));
  return true;
}

function addToOpenBook() {
  if (!openId.value) return;
  if (addCharsTo(openId.value, addToOpen.value)) addToOpen.value = '';
}

function createBook() {
  const name = newBookName.value.trim() || '新字簿';
  const book = books.create(name);
  const typed = extractHan(newBookChars.value);
  if (typed.length) addCharsTo(book.id, typed.join(''));
  openId.value = book.id;
  newBookName.value = '';
  newBookChars.value = '';
  toast(`建立「${book.name}」`);
}

function removeBook(id: string, name: string) {
  if (!window.confirm(`刪除字簿「${name}」？`)) return;
  books.remove(id);
  if (openId.value === id) openId.value = books.active?.id ?? '';
}

function renameBook(id: string, currentName: string) {
  const next = window.prompt('改成什麼名字？', currentName);
  if (next === null) return;
  books.rename(id, next);
}

function exportBooks() {
  const blob = new Blob([books.exportJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `巧手猜猜字-字簿-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseImportFile(file);
    if (parsed.books?.length) {
      const packed = JSON.stringify({ books: parsed.books });
      const { books: n, chars } = books.importJson(packed);
      toast(`匯入 ${n} 本新字簿、共 ${chars} 字`);
    } else {
      const name = newBookName.value.trim() || parsed.suggestedName || file.name.replace(/\.[^.]+$/, '');
      newBookName.value = name;
      const extra = parsed.chars.join('');
      newBookChars.value = [...new Set([...(newBookChars.value ? extractHan(newBookChars.value) : []), ...parsed.chars])].join('');
      toast(`從檔案讀到 ${extractHan(extra).length} 字，按「建立」寫進新字簿`);
    }
  } catch (err) {
    toast(`匯入失敗：${(err as Error).message}`);
  }
  input.value = '';
}
</script>

<template>
  <div class="page">
    <header class="page-head wrap">
      <button class="btn btn-ghost btn-sm" @click="router.push('/')">← 回首頁</button>
      <h1>設定</h1>
    </header>

    <div class="page-body wrap">
      <div class="grid-2">
        <div class="card">
          <div class="card-title">字簿</div>
          <p class="hint" style="margin-bottom: 10px">點一本打開，課堂用那本再點「使用」。</p>

          <ul class="book-fold">
            <li v-for="b in books.books" :key="b.id" :class="{ 'is-open': b.id === openId, 'is-on': b.id === activeId }">
              <button class="book-fold-head" @click="toggleBook(b.id)">
                <span class="book-fold-caret">{{ b.id === openId ? '▼' : '▶' }}</span>
                <span class="book-name">{{ b.name }}</span>
                <span class="pill">{{ b.chars.length }} 字</span>
                <span v-if="b.id === activeId" class="pill pill-ready">使用中</span>
              </button>

              <div v-if="b.id === openId" class="book-fold-body">
                <div class="row" style="margin-bottom: 10px">
                  <button class="btn btn-mint btn-sm" @click="books.select(b.id)">用這本上課</button>
                  <button class="btn btn-ghost btn-sm" @click="renameBook(b.id, b.name)">改名</button>
                  <button class="btn btn-ghost btn-sm" @click="removeBook(b.id, b.name)">刪除</button>
                </div>

                <div v-if="b.chars.length" class="char-chips">
                  <button
                    v-for="ch in b.chars"
                    :key="ch"
                    class="char-chip is-on"
                    title="點一下移除"
                    @click="books.removeChar(b.id, ch)"
                  >
                    {{ ch }}
                  </button>
                </div>
                <p v-else class="hint">還沒有字，在下面貼生字。</p>

                <div class="row" style="margin-top: 10px">
                  <input
                    v-model="addToOpen"
                    class="text-input"
                    style="flex: 1"
                    placeholder="貼生字，例：日月水火"
                    @keyup.enter="addToOpenBook"
                  />
                  <button class="btn btn-sky btn-sm" @click="addToOpenBook">加入</button>
                </div>
              </div>
            </li>
          </ul>

          <div class="tool-divider" />
          <div class="row">
            <button class="btn btn-ghost btn-sm" @click="exportBooks">匯出備份</button>
            <button class="btn btn-ghost btn-sm" @click="books.resetToSeed()">還原預設三本</button>
          </div>
        </div>

        <div class="card">
          <div class="card-title">新增字簿</div>
          <label class="field-label" for="new-book">名稱</label>
          <input
            id="new-book"
            v-model="newBookName"
            class="text-input"
            placeholder="例：第四課"
            @keyup.enter="createBook"
          />

          <label class="field-label" for="new-chars" style="margin-top: 12px">手動貼生字</label>
          <textarea
            id="new-chars"
            v-model="newBookChars"
            class="text-input"
            rows="4"
            placeholder="直接貼課文生字，會自動抽出漢字"
          />

          <label class="field-label" style="margin-top: 12px">或匯入檔案</label>
          <button class="btn btn-ghost" style="width: 100%" @click="fileInput?.click()">選擇檔案</button>
          <input
            ref="fileInput"
            type="file"
            hidden
            accept=".txt,.csv,.tsv,.json,.html,.htm,.docx,.xlsx,.xlsm,text/plain,application/json"
            @change="onPickFile"
          />
          <p class="hint" style="margin-top: 8px">
            可用 TXT、CSV、JSON、網頁、Word（.docx）、Excel（.xlsx）。只收香港常用字。
          </p>

          <button class="btn btn-mint" style="width: 100%; margin-top: 14px" @click="createBook">建立字簿</button>
        </div>
      </div>
    </div>

    <div v-if="message" class="toast">{{ message }}</div>
  </div>
</template>
