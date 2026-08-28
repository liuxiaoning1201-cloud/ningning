<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useJournal } from "../stores/journal";

const INKS = [
  { id: "ink", label: "淡墨", color: "#5c4e3c" },
  { id: "cinnabar", label: "朱砂", color: "#9c3d2f" },
  { id: "azurite", label: "石青", color: "#3d5c6e" },
  { id: "pine", label: "松綠", color: "#4a6b52" },
] as const;

const HIGHLIGHTS = [
  { id: "gamboge", label: "藤黃", color: "#f0d878" },
  { id: "cinnabar", label: "朱砂", color: "#f0c4b8" },
  { id: "pine", label: "松綠", color: "#c5d4c4" },
] as const;

const journal = useJournal();
const editor = ref<HTMLElement | null>(null);
const bar = ref({ show: false, x: 0, y: 0 });
let filling = false;

const nameMode = ref<"create" | "rename" | null>(null);
const nameDraft = ref("");
const nameInput = ref<HTMLInputElement | null>(null);

function htmlOf() {
  return editor.value?.innerHTML ?? "";
}

function save() {
  if (filling) return;
  const nb = journal.activeNotebook;
  if (nb) journal.setNotebookHtml(nb.id, htmlOf());
}

function restore() {
  filling = true;
  if (editor.value) editor.value.innerHTML = journal.activeNotebook?.html || "";
  filling = false;
}

watch(
  () => journal.activeNotebook?.id,
  () => restore(),
);

function onPick(event: Event) {
  journal.selectNotebook((event.target as HTMLSelectElement).value);
}

function openName(mode: "create" | "rename") {
  nameMode.value = mode;
  nameDraft.value = mode === "rename" ? (journal.activeNotebook?.name ?? "") : "";
  void nextTick(() => nameInput.value?.focus());
}

function confirmName() {
  const mode = nameMode.value;
  nameMode.value = null;
  const name = nameDraft.value.trim();
  if (!mode || !name) return;
  if (mode === "create") {
    journal.addNotebook(name);
  } else if (journal.activeNotebook) {
    journal.renameNotebook(journal.activeNotebook.id, name);
  }
}

function cancelName() {
  nameMode.value = null;
}

function removeBook() {
  const nb = journal.activeNotebook;
  if (!nb || journal.notebooks.length <= 1) return;
  if (window.confirm(`確定刪除筆記本「${nb.name}」？裡面的文字會一併刪除。`)) {
    journal.removeNotebook(nb.id);
  }
}

function selectionInEditor(): Selection | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !editor.value) return null;
  if (!editor.value.contains(sel.anchorNode) || !editor.value.contains(sel.focusNode)) return null;
  return sel;
}

function paint(color: string) {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("foreColor", false, color);
  save();
}

function highlight(color: string) {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("hiliteColor", false, color);
  save();
}

function bold() {
  document.execCommand("bold");
  save();
}

function underline() {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("underline");
  save();
}

function wavy() {
  const sel = selectionInEditor();
  if (!sel) return;
  const range = sel.getRangeAt(0);
  const span = document.createElement("span");
  span.className = "ink-wave";
  try {
    range.surroundContents(span);
  } catch {
    // 選取跨越了多個節點時 surroundContents 會失敗，改為取出內容再包裹。
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  sel.removeAllRanges();
  save();
}

// 層級：把當前行變成「○ 開頭、縮進兩字元」的層級行；按 Enter 自動延續，再按一次退回普通段落。
function level() {
  editor.value?.focus();
  document.execCommand("insertUnorderedList");
  save();
}

function placeBar() {
  const sel = selectionInEditor();
  if (!sel) {
    bar.value.show = false;
    return;
  }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  bar.value = {
    show: true,
    x: Math.max(24, rect.left + rect.width / 2),
    y: Math.max(10, rect.top - 8),
  };
}

function makeToday() {
  const sel = selectionInEditor();
  const text = sel?.toString().replace(/\s+/g, " ").trim();
  if (!text) return;
  journal.capture(text, { type: "task", dueOn: journal.today });
  sel?.removeAllRanges();
  bar.value.show = false;
}

function undo() {
  editor.value?.focus();
  document.execCommand("undo");
  save();
}

function redo() {
  editor.value?.focus();
  document.execCommand("redo");
  save();
}

onMounted(() => {
  restore();
  document.addEventListener("selectionchange", placeBar);
});

onBeforeUnmount(() => {
  document.removeEventListener("selectionchange", placeBar);
});
</script>

<template>
  <div class="inbox-paper">
    <div class="journal-head">
      <div class="book-bar">
        <select
          class="book-select"
          :value="journal.activeNotebook?.id ?? ''"
          title="選擇筆記本"
          @change="onPick"
        >
          <option v-for="nb in journal.notebooks" :key="nb.id" :value="nb.id">
            {{ nb.name }}
          </option>
        </select>
        <input
          v-if="nameMode"
          ref="nameInput"
          v-model="nameDraft"
          class="book-name"
          :placeholder="nameMode === 'create' ? '新筆記本名字' : '筆記本改名'"
          @keydown.enter.prevent="confirmName"
          @keydown.esc="cancelName"
          @blur="confirmName"
        />
        <template v-else>
          <button class="tool-btn" type="button" title="新增筆記本" @click="openName('create')">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M8 3v10M3 8h10" />
            </svg>
          </button>
          <button class="tool-btn" type="button" title="筆記本改名" @click="openName('rename')">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m10.2 2.8 3 3L6 13l-3.6.6L3 10z" />
            </svg>
          </button>
          <button
            v-if="journal.notebooks.length > 1"
            class="tool-btn"
            type="button"
            title="刪除筆記本"
            @click="removeBook"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 4.5h10M6.5 2.5h3M5 4.5l.6 9h4.8l.6-9M6.8 7v4.5M9.2 7v4.5" />
            </svg>
          </button>
        </template>
      </div>
      <div class="ink-tools" @mousedown.prevent>
        <button
          v-for="ink in INKS"
          :key="ink.id"
          class="ink-dot"
          type="button"
          :title="ink.label"
          :style="{ background: ink.color }"
          @click="paint(ink.color)"
        />
        <span class="ink-gap" />
        <button
          v-for="mark in HIGHLIGHTS"
          :key="mark.id"
          class="ink-chip"
          type="button"
          :title="`${mark.label}螢光`"
          :style="{ background: mark.color }"
          @click="highlight(mark.color)"
        />
        <span class="ink-gap" />
        <button class="tool-btn" type="button" title="粗體" @click="bold">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 2.5h4a2.75 2.75 0 0 1 0 5.5h-4zm0 5.5h4.8a2.75 2.75 0 0 1 0 5.5H4.5z" />
          </svg>
        </button>
        <button class="tool-btn" type="button" title="底線" @click="underline">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4.5 2v5a3.5 3.5 0 0 0 7 0V2M3.5 14h9" />
          </svg>
        </button>
        <button class="tool-btn" type="button" title="波浪線" @click="wavy">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M1 8q1.75-3 3.5 0t3.5 0 3.5 0 3.5 0" />
          </svg>
        </button>
        <button class="tool-btn" type="button" title="層級（○ 圓圈縮進行）" @click="level">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="4" cy="8" r="1.6" />
            <path d="M7.5 8H14M2 3h12M2 13h12" />
          </svg>
        </button>
        <span class="ink-gap" />
        <button class="tool-btn" type="button" title="返回（恢復上一步）" @click="undo">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3.5 2.5 7 6 10.5M2.5 7h7a4 4 0 0 1 0 8h-2" />
          </svg>
        </button>
        <button class="tool-btn" type="button" title="前進（重做）" @click="redo">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="m10 3.5 3.5 3.5L10 10.5M13.5 7h-7a4 4 0 0 0 0 8h2" />
          </svg>
        </button>
      </div>
    </div>
    <div class="paper-sheet">
      <div
        ref="editor"
        class="note-paper"
        contenteditable="true"
        role="textbox"
        aria-label="筆記薄紙面"
        data-placeholder="在這本筆記上寫。選中文字可換筆色、畫重點，或點「今日」變成待辦。"
        @input="save"
      />
    </div>
    <div
      v-if="bar.show"
      class="ink-bar"
      :style="{ left: `${bar.x}px`, top: `${bar.y}px` }"
      @mousedown.prevent
    >
      <button class="today-btn" type="button" @click="makeToday">今日</button>
    </div>
  </div>
</template>
