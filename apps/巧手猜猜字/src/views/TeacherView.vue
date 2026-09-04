<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import { bundledChars, isHkChar, readiness, readinessLabel } from '@/lib/charData';
import { useWordbooks } from '@/stores/wordbooks';

const router = useRouter();
const books = useWordbooks();

const newBookName = ref('');
const addText = ref('');
const message = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

function toast(text: string) {
  message.value = text;
  window.setTimeout(() => {
    if (message.value === text) message.value = '';
  }, 2600);
}

const activeId = computed(() => books.active?.id ?? '');

/** 字庫裡可以直接挑的字，按「已核對」排前面。 */
const library = computed(() => {
  const order = { ready: 0, pending: 1, unknown: 2, missing: 3 } as const;
  return bundledChars()
    .map((ch) => ({ ch, state: readiness(ch) }))
    .sort((a, b) => order[a.state] - order[b.state] || a.ch.localeCompare(b.ch));
});

const activeChars = computed(() =>
  (books.active?.chars ?? []).map((ch) => ({ ch, state: readiness(ch) }))
);

function toggleFromLibrary(ch: string) {
  if (!activeId.value) return;
  if (books.active?.chars.includes(ch)) {
    books.removeChar(activeId.value, ch);
  } else {
    books.addChars(activeId.value, [ch]);
  }
}

/**
 * 手動加字。以香港《常用字字形表》白名單擋掉非港標字，
 * 免得老師加了異體字，學生照著練出不合課程的字形。
 */
function addTyped() {
  if (!activeId.value) return;
  const chars = [...addText.value].filter((c) => /\p{Script=Han}/u.test(c));
  if (!chars.length) {
    toast('請輸入漢字');
    return;
  }

  const rejected: string[] = [];
  const accepted: string[] = [];
  for (const ch of chars) {
    if (!isHkChar(ch)) rejected.push(ch);
    else accepted.push(ch);
  }

  const added = books.addChars(activeId.value, accepted);
  addText.value = '';

  const parts = [`加入 ${added} 字`];
  if (rejected.length) parts.push(`${rejected.join('')} 不在香港常用字字形表，已略過`);
  toast(parts.join('；'));
}

function createBook() {
  const name = newBookName.value.trim();
  if (!name) {
    toast('請先給字簿起個名');
    return;
  }
  books.create(name);
  newBookName.value = '';
  toast(`建立「${name}」`);
}

function removeBook(id: string, name: string) {
  if (!window.confirm(`刪除字簿「${name}」？`)) return;
  books.remove(id);
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

async function importBooks(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const { books: n, chars } = books.importJson(await file.text());
    toast(`匯入 ${n} 本新字簿、共 ${chars} 字`);
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
      <h1>老師設定</h1>
    </header>

    <div class="page-body wrap stack">
      <div class="grid-2">
        <!-- 字簿清單 -->
        <div class="card">
          <div class="card-title">字簿 · 一課一本</div>
          <ul class="book-list">
            <li v-for="b in books.books" :key="b.id" :class="{ 'is-on': b.id === activeId }">
              <button class="btn btn-ghost btn-sm" @click="books.select(b.id)">
                {{ b.id === activeId ? '● 使用中' : '選用' }}
              </button>
              <span class="book-name">{{ b.name }}</span>
              <span class="pill">{{ b.chars.length }} 字</span>
              <button class="btn btn-ghost btn-sm" @click="renameBook(b.id, b.name)">改名</button>
              <button class="btn btn-ghost btn-sm" @click="removeBook(b.id, b.name)">刪除</button>
            </li>
          </ul>

          <div class="tool-divider" />
          <label class="field-label" for="new-book">新增字簿</label>
          <div class="row">
            <input
              id="new-book"
              v-model="newBookName"
              class="text-input"
              style="flex: 1"
              placeholder="例：第四課 · 帶鈎的字"
              @keyup.enter="createBook"
            />
            <button class="btn btn-mint" @click="createBook">建立</button>
          </div>

          <div class="tool-divider" />
          <div class="row">
            <button class="btn btn-ghost btn-sm" @click="exportBooks">匯出 JSON</button>
            <button class="btn btn-ghost btn-sm" @click="fileInput?.click()">匯入 JSON</button>
            <input ref="fileInput" type="file" accept="application/json" hidden @change="importBooks" />
            <button class="btn btn-ghost btn-sm" @click="books.resetToSeed()">還原預設三本</button>
          </div>
          <p class="hint" style="margin-top: 8px">
            字簿存在這台裝置的瀏覽器裡。要帶到別台電腦，用匯出再匯入。
          </p>
        </div>

        <!-- 目前字簿的字 -->
        <div class="card">
          <div class="card-title">
            <span>「{{ books.active?.name ?? '未選擇' }}」的練習字</span>
            <span class="pill">{{ activeChars.length }} 字</span>
          </div>

          <div v-if="activeChars.length" class="char-chips">
            <button
              v-for="item in activeChars"
              :key="item.ch"
              class="char-chip is-on"
              :title="`${readinessLabel(item.state)}，點一下移除`"
              @click="books.removeChar(activeId, item.ch)"
            >
              {{ item.ch }}
              <small>{{ item.state === 'ready' ? '已核對' : '待核' }}</small>
            </button>
          </div>
          <p v-else class="hint">還沒有字。從下面的字庫點選，或直接打字加入。</p>

          <div class="tool-divider" />
          <label class="field-label" for="add-chars">直接打字加入</label>
          <div class="row">
            <input
              id="add-chars"
              v-model="addText"
              class="text-input"
              style="flex: 1"
              placeholder="貼一整課的生字，例：日月水火"
              @keyup.enter="addTyped"
            />
            <button class="btn btn-sky" @click="addTyped">加入</button>
          </div>
          <p class="hint" style="margin-top: 8px">
            只收香港《常用字字形表》裡的字。標「待核」的字筆畫標註還沒人工確認，
            只能玩挑戰模式；練習模式要鎖筆順，只收「已核對」的字。
          </p>
        </div>
      </div>

      <!-- 字庫 -->
      <div class="card">
        <div class="card-title">
          <span>字庫</span>
          <span class="pill">{{ library.length }} 字</span>
        </div>
        <div class="char-chips">
          <button
            v-for="item in library"
            :key="item.ch"
            class="char-chip"
            :class="{ 'is-on': books.active?.chars.includes(item.ch) }"
            :title="readinessLabel(item.state)"
            @click="toggleFromLibrary(item.ch)"
          >
            {{ item.ch }}
            <small>{{ item.state === 'ready' ? '已核對' : '待核' }}</small>
          </button>
        </div>
      </div>
    </div>

    <div v-if="message" class="toast">{{ message }}</div>
  </div>
</template>
