<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import CharCard from '@/components/CharCard.vue';
import StrokePicker from '@/components/StrokePicker.vue';
import { loadChar } from '@/lib/charData';
import { extractHan, keepHkChars, parseImportFile } from '@/lib/importChars';
import { useSettings } from '@/stores/settings';
import { useStrokeLocks } from '@/stores/strokeLocks';
import { useWordbooks } from '@/stores/wordbooks';
import type { CharData, StrokeId } from '@/types';

const router = useRouter();
const books = useWordbooks();
const settings = useSettings();
const locks = useStrokeLocks();

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
const reviseIndex = ref<number | null>(null);

const reviewLocked = computed(() =>
  reviewChar.value ? Object.keys(locks.locksFor(reviewChar.value)).map((i) => Number(i)) : []
);

const reviseCurrent = computed(() =>
  reviseIndex.value === null ? null : (reviewData.value?.strokeTypes[reviseIndex.value] ?? null)
);

async function loadReview(ch: string) {
  const one = [...ch].find((c) => c.length === 1) ?? '';
  reviewChar.value = one;
  reviewData.value = null;
  reviewError.value = '';
  if (!one) return;
  reviewLoading.value = true;
  try {
    const loaded = await loadChar(one);
    if (!loaded) reviewError.value = `找不到「${one}」的筆順資料`;
    else reviewData.value = loaded;
  } finally {
    reviewLoading.value = false;
  }
}

watch(
  () => openId.value,
  (id) => {
    const book = books.books.find((b) => b.id === id);
    if (book?.chars[0] && !reviewChar.value) loadReview(book.chars[0]);
  },
  { immediate: true }
);

async function applyRevise(id: StrokeId) {
  if (!reviewChar.value || reviseIndex.value === null) return;
  locks.lock(reviewChar.value, reviseIndex.value, id);
  reviseIndex.value = null;
  await loadReview(reviewChar.value);
}

async function clearRevise() {
  if (!reviewChar.value || reviseIndex.value === null) return;
  locks.unlock(reviewChar.value, reviseIndex.value);
  reviseIndex.value = null;
  await loadReview(reviewChar.value);
}

async function resetReviewChar() {
  if (!reviewChar.value) return;
  locks.unlockChar(reviewChar.value);
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
      const packed = JSON.stringify({ books: parsed.books });
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
      <div class="card revise-card" id="revise-strokes">
        <div class="card-title">自訂修改筆畫</div>
        <p class="hint" style="margin-bottom: 10px">
          自動判斷錯了，點那一筆換成正確的物品。只改這個字，下次開啟仍然記得。練習頁的筆順清單也可以改。
        </p>
        <div class="char-chips" style="margin-bottom: 10px">
          <button
            v-for="ch in books.books.find((b) => b.id === openId)?.chars ?? []"
            :key="ch"
            class="char-chip"
            :class="{ 'is-on': ch === reviewChar }"
            type="button"
            @click="loadReview(ch)"
          >
            {{ ch }}
          </button>
        </div>
        <div class="row" style="margin-bottom: 10px">
          <input
            v-model="reviewChar"
            class="text-input"
            style="flex: 1; max-width: 120px"
            maxlength="2"
            placeholder="字"
            @keyup.enter="loadReview(reviewChar)"
          />
          <button class="btn btn-sky btn-sm" type="button" @click="loadReview(reviewChar)">查看</button>
          <button
            v-if="reviewLocked.length"
            class="btn btn-ghost btn-sm"
            type="button"
            @click="resetReviewChar"
          >
            還原這一字
          </button>
        </div>
        <p v-if="reviewLoading" class="hint">正在取筆順…</p>
        <p v-else-if="reviewError" class="hint">{{ reviewError }}</p>
        <CharCard
          v-else-if="reviewData"
          :data="reviewData"
          :show-stroke-list="true"
          :editable="true"
          :locked-indexes="reviewLocked"
          @revise="reviseIndex = $event"
        />
      </div>

      <div class="grid-2" style="margin-top: 14px">
        <div class="card">
          <div class="card-title">字簿</div>
          <p class="hint" style="margin-bottom: 10px">點一本就用這本上課。要拿走某個字，按字旁邊的 ×。</p>

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
                  <span v-for="ch in b.chars" :key="ch" class="char-chip is-on">
                    {{ ch }}
                    <button class="char-chip-x" type="button" title="從這本拿走" @click="books.removeChar(b.id, ch)">
                      ×
                    </button>
                  </span>
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
      v-if="reviseIndex !== null"
      :current="reviseCurrent"
      :title="`改「${reviewChar}」第 ${reviseIndex + 1} 筆`"
      @pick="applyRevise"
      @clear="clearRevise"
      @close="reviseIndex = null"
    />

    <div v-if="message" class="toast">{{ message }}</div>
  </div>
</template>
