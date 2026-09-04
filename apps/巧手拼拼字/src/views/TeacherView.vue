<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import StrokePicker from '@/components/StrokePicker.vue';
import { STROKE_BY_ID, strokeImage, strokeName } from '@/data/strokes';
import { loadChar } from '@/lib/charData';
import { extractHan, keepHkChars, parseImportFile } from '@/lib/importChars';
import { useSettings } from '@/stores/settings';
import { useStrokeLayouts } from '@/stores/strokeLayouts';
import { useStrokeLocks } from '@/stores/strokeLocks';
import { useWordbooks } from '@/stores/wordbooks';
import type { CharData, StrokeId } from '@/types';

const router = useRouter();
const books = useWordbooks();
const settings = useSettings();
const locks = useStrokeLocks();
const layouts = useStrokeLayouts();

const openId = ref(books.active?.id ?? '');
const newBookName = ref('');
const newBookChars = ref('');
const addToOpen = ref('');
const message = ref('');
const fileInput = ref<HTMLInputElement | null>(null);
const exportOpen = ref(false);
const exportIds = ref<string[]>([]);
const reviewChar = ref('');
const reviewData = ref<CharData | null>(null);
const reviewError = ref('');
const reviewLoading = ref(false);

type PickerState = { kind: 'revise'; index: number } | { kind: 'insert'; after: number };
const picker = ref<PickerState | null>(null);

const reviewLayout = computed(() => (reviewChar.value ? layouts.layoutFor(reviewChar.value) : null));

const reviewLocked = computed(() =>
  reviewChar.value ? Object.keys(locks.locksFor(reviewChar.value)).map((i) => Number(i)) : []
);

const reviewDirty = computed(
  () => Boolean(reviewLayout.value) || reviewLocked.value.length > 0
);

const pickerCurrent = computed(() => {
  if (picker.value?.kind !== 'revise' || !reviewData.value) return null;
  return reviewData.value.strokeTypes[picker.value.index] ?? null;
});

const pickerTitle = computed(() => {
  if (!picker.value) return '改成哪一件物品？';
  if (picker.value.kind === 'insert') {
    return picker.value.after < 0
      ? `在「${reviewChar.value}」最前面加一筆`
      : `在「${reviewChar.value}」第 ${picker.value.after + 1} 筆後面加一筆`;
  }
  return `改「${reviewChar.value}」第 ${picker.value.index + 1} 筆`;
});

const pickerHint = computed(() =>
  picker.value?.kind === 'insert'
    ? '選一件物品加進練習題。這一筆沒有墨跡，格子裡要靠物品本身來拼。'
    : '改這一筆用哪一件物品。加一筆、刪一筆用旁邊的＋－。'
);

const pickerClearable = computed(() => {
  if (picker.value?.kind !== 'revise') return false;
  const item = reviewLayout.value?.items[picker.value.index];
  if (item) return item.from != null && Boolean(item.auto);
  return true;
});

function rowAdded(index: number): boolean {
  return reviewLayout.value?.items[index]?.from == null;
}

function rowEdited(index: number): boolean {
  const item = reviewLayout.value?.items[index];
  if (item) {
    if (item.from == null) return false;
    if (item.auto && item.type !== item.auto) return true;
    return reviewLocked.value.includes(item.from);
  }
  return reviewLocked.value.includes(index);
}

async function loadReview(ch: string) {
  const one = [...ch].find((c) => c.length === 1) ?? '';
  const switching = one !== reviewChar.value;
  reviewChar.value = one;
  reviewError.value = '';
  if (switching) {
    reviewData.value = null;
    picker.value = null;
  }
  if (!one) return;
  if (!reviewData.value) reviewLoading.value = true;
  try {
    const loaded = await loadChar(one);
    if (!loaded) {
      reviewError.value = `找不到「${one}」的筆順資料`;
      if (switching) reviewData.value = null;
    } else {
      reviewData.value = loaded;
    }
  } finally {
    reviewLoading.value = false;
  }
}

watch(
  () => openId.value,
  (id) => {
    const book = books.books.find((b) => b.id === id);
    if (!book?.chars.includes(reviewChar.value)) {
      reviewChar.value = '';
      reviewData.value = null;
      reviewError.value = '';
      picker.value = null;
    }
  }
);

async function applyPick(id: StrokeId) {
  const ch = reviewChar.value;
  const data = reviewData.value;
  const state = picker.value;
  if (!ch || !data || !state) return;
  if (state.kind === 'insert') {
    layouts.insert(ch, state.after, id, data.strokeTypes);
  } else if (layouts.has(ch)) {
    layouts.setType(ch, state.index, id, data.strokeTypes);
  } else {
    locks.lock(ch, state.index, id);
  }
  picker.value = null;
  await loadReview(ch);
}

async function clearPick() {
  const ch = reviewChar.value;
  const state = picker.value;
  if (!ch || state?.kind !== 'revise') return;
  if (layouts.has(ch)) layouts.restoreType(ch, state.index);
  else locks.unlock(ch, state.index);
  picker.value = null;
  await loadReview(ch);
}

async function removeStroke(index: number) {
  const ch = reviewChar.value;
  const data = reviewData.value;
  if (!ch || !data) return;
  if (!layouts.remove(ch, index, data.strokeTypes)) {
    toast('至少留一筆');
    return;
  }
  await loadReview(ch);
}

async function resetReviewChar() {
  if (!reviewChar.value) return;
  locks.unlockChar(reviewChar.value);
  layouts.clearChar(reviewChar.value);
  await loadReview(reviewChar.value);
  toast(`已還原「${reviewChar.value}」的自動判斷`);
}

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

function openExport() {
  exportIds.value = books.books.map((b) => b.id);
  exportOpen.value = true;
}

function toggleExportId(id: string) {
  exportIds.value = exportIds.value.includes(id)
    ? exportIds.value.filter((x) => x !== id)
    : [...exportIds.value, id];
}

function confirmExport() {
  if (!exportIds.value.length) {
    toast('請先勾選要匯出的字簿');
    return;
  }
  const blob = new Blob([books.exportJson(exportIds.value)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `巧手拼拼字-字簿-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  exportOpen.value = false;
  toast(`已匯出 ${exportIds.value.length} 本`);
}

async function onPickFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseImportFile(file);
    if (parsed.books?.length) {
      const packed = JSON.stringify({
        books: parsed.books,
        strokeLocks: parsed.strokeLocks,
        strokeLayouts: parsed.strokeLayouts,
      });
      const { books: n, chars } = books.importJson(packed);
      toast(`匯入 ${n} 本新字簿、共 ${chars} 字`);
    } else {
      const name = newBookName.value.trim() || parsed.suggestedName || file.name.replace(/\.[^.]+$/, '');
      newBookName.value = name;
      newBookChars.value = [
        ...new Set([...(newBookChars.value ? extractHan(newBookChars.value) : []), ...parsed.chars]),
      ].join('');
      toast(`從檔案讀到 ${parsed.chars.length} 字，按「建立」寫進新字簿`);
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
          <p class="hint" style="margin-bottom: 10px">
            點一本就用這本上課。要改筆畫就點那個字；種類不對可以改，少了或多了用＋－。
          </p>

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
                  <button class="btn btn-ghost btn-sm" @click="renameBook(b.id, b.name)">改名</button>
                  <button class="btn btn-ghost btn-sm" @click="removeBook(b.id, b.name)">刪除字簿</button>
                </div>

                <div v-if="b.chars.length" class="char-chips">
                  <span
                    v-for="ch in b.chars"
                    :key="ch"
                    class="char-chip"
                    :class="{ 'is-on': ch === reviewChar }"
                  >
                    <button
                      class="char-chip-hit"
                      type="button"
                      :title="`查看並改「${ch}」的筆畫`"
                      @click="loadReview(ch)"
                    >
                      {{ ch }}
                    </button>
                    <button class="char-chip-x" type="button" title="從這本拿走" @click="books.removeChar(b.id, ch)">
                      ×
                    </button>
                  </span>
                </div>
                <p v-else class="hint">還沒有字，在下面貼生字。</p>

                <p v-if="reviewLoading && reviewChar" class="hint" style="margin-top: 12px">
                  正在取「{{ reviewChar }}」的筆順…
                </p>
                <p v-else-if="reviewError" class="hint" style="margin-top: 12px">{{ reviewError }}</p>
                <div v-else-if="reviewData && b.chars.includes(reviewChar)" class="stroke-editor">
                  <div class="stroke-editor-head">
                    <span class="stroke-editor-glyph">{{ reviewChar }}</span>
                    <div>
                      <div class="card-title" style="margin: 0">修改筆畫</div>
                      <p class="hint">
                        點一筆改種類。＋在後面加一筆、－刪掉。練習會照這裡的筆數出題。
                      </p>
                    </div>
                  </div>
                  <div v-if="reviewDirty" class="row" style="margin-bottom: 8px">
                    <button class="btn btn-ghost btn-sm" type="button" @click="resetReviewChar">
                      還原「{{ reviewChar }}」的自動判斷
                    </button>
                  </div>
                  <button class="btn btn-ghost btn-sm stroke-editor-prepend" type="button" @click="picker = { kind: 'insert', after: -1 }">
                    ＋ 在最前面加一筆
                  </button>
                  <ol class="stroke-list">
                    <li
                      v-for="(id, i) in reviewData.strokeTypes"
                      :key="i"
                      class="is-edit stroke-editor-row"
                      :class="{ 'is-locked': rowEdited(i) || rowAdded(i) }"
                    >
                      <button
                        class="stroke-list-btn"
                        type="button"
                        :title="`改第 ${i + 1} 筆`"
                        @click="picker = { kind: 'revise', index: i }"
                      >
                        <span class="idx">{{ i + 1 }}</span>
                        <img v-if="id" :src="strokeImage(id)" :alt="STROKE_BY_ID[id].objectName" />
                        <span>{{ strokeName(id) }}</span>
                        <span v-if="id" style="color: var(--ink-faint)">{{ STROKE_BY_ID[id].objectName }}</span>
                        <span v-if="rowAdded(i)" class="pill pill-ready">加的</span>
                        <span v-else-if="rowEdited(i)" class="pill pill-ready">已改</span>
                      </button>
                      <div class="stroke-editor-ops">
                        <button
                          type="button"
                          title="在這筆後面加一筆"
                          @click="picker = { kind: 'insert', after: i }"
                        >
                          ＋
                        </button>
                        <button
                          class="is-del"
                          type="button"
                          title="刪掉這一筆"
                          :disabled="reviewData.strokeTypes.length <= 1"
                          @click="removeStroke(i)"
                        >
                          －
                        </button>
                      </div>
                    </li>
                  </ol>
                </div>

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
            <button class="btn btn-ghost btn-sm" @click="openExport">匯出…</button>
            <button class="btn btn-ghost btn-sm" @click="books.resetToSeed()">還原預設三本</button>
          </div>
        </div>

        <div class="stack">
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

          <div class="card">
            <div class="card-title">顯示</div>
            <label class="row" style="cursor: pointer">
              <input v-model="settings.state.ghost" type="checkbox" />
              <span class="hint">格子裡顯示淡淡的字影</span>
            </label>
            <label class="row" style="cursor: pointer; margin-top: 8px">
              <input v-model="settings.state.mascot" type="checkbox" />
              <span class="hint">顯示奶茶小精靈</span>
            </label>
          </div>
        </div>
      </div>
    </div>

    <div v-if="exportOpen" class="overlay" @click.self="exportOpen = false">
      <div class="overlay-card" style="max-width: 420px">
        <div class="overlay-head">
          <h2>選擇要匯出的字簿</h2>
          <button class="btn btn-ghost btn-sm" @click="exportOpen = false">取消</button>
        </div>
        <label v-for="b in books.books" :key="b.id" class="export-row">
          <input type="checkbox" :checked="exportIds.includes(b.id)" @change="toggleExportId(b.id)" />
          <span class="book-name">{{ b.name }}</span>
          <span class="pill">{{ b.chars.length }} 字</span>
        </label>
        <button class="btn btn-mint" style="width: 100%; margin-top: 14px" @click="confirmExport">匯出已選</button>
      </div>
    </div>

    <StrokePicker
      v-if="picker"
      :current="pickerCurrent"
      :title="pickerTitle"
      :hint="pickerHint"
      :allow-clear="pickerClearable"
      @pick="applyPick"
      @clear="clearPick"
      @close="picker = null"
    />

    <div v-if="message" class="toast">{{ message }}</div>
  </div>
</template>
