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

const SIZE_STEPS = [16, 18, 23, 30, 40, 52];
const DEFAULT_SIZE = 18;

const journal = useJournal();
const editor = ref<HTMLElement | null>(null);
const head = ref<HTMLElement | null>(null);
const bar = ref({ show: false, x: 0, y: 0, below: false });
let filling = false;
let savedOffsets: { start: number; end: number } | null = null;

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

function asEl(node: Node | null): HTMLElement | null {
  if (!node) return null;
  return (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement) as HTMLElement | null;
}

function offsetsOfRange(range: Range): { start: number; end: number } | null {
  if (!editor.value) return null;
  const pre = document.createRange();
  pre.selectNodeContents(editor.value);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  const end = start + range.toString().length;
  if (end <= start) return null;
  return { start, end };
}

function rangeFromOffsets(start: number, end: number): Range | null {
  const root = editor.value;
  if (!root || end <= start) return null;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let pos = 0;
  let startNode: Text | null = null;
  let startOff = 0;
  let endNode: Text | null = null;
  let endOff = 0;
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const len = text.data.length;
    if (!startNode && pos + len > start) {
      startNode = text;
      startOff = start - pos;
    }
    if (pos + len >= end) {
      endNode = text;
      endOff = end - pos;
      break;
    }
    pos += len;
  }
  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, Math.min(startOff, startNode.data.length));
  range.setEnd(endNode, Math.min(endOff, endNode.data.length));
  return range.collapsed ? null : range;
}

function rememberRange() {
  const sel = selectionInEditor();
  if (!sel) return;
  const offs = offsetsOfRange(sel.getRangeAt(0));
  if (offs) savedOffsets = offs;
}

function freezeToolRange(event: Event) {
  event.preventDefault();
  rememberRange();
}

function toolOffsets(): { start: number; end: number } | null {
  rememberRange();
  return savedOffsets;
}

function restoreOffsets(offs: { start: number; end: number }) {
  if (!editor.value) return;
  editor.value.focus();
  const range = rangeFromOffsets(offs.start, offs.end);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  if (range) {
    sel?.addRange(range);
    savedOffsets = offs;
  }
}

function elementOffsets(el: HTMLElement): { start: number; end: number } | null {
  const range = document.createRange();
  range.selectNodeContents(el);
  return offsetsOfRange(range);
}

function formatsAround(range: Range, className: string): HTMLElement[] {
  const root = editor.value;
  if (!root) return [];
  const walk = (from: HTMLElement | null) => {
    const found: HTMLElement[] = [];
    let el = from;
    while (el && el !== root) {
      if (el.classList.contains(className)) found.push(el);
      el = el.parentElement;
    }
    return found;
  };
  const startHits = walk(asEl(range.startContainer));
  const endHits = walk(asEl(range.endContainer));
  return startHits.filter((el) => endHits.includes(el));
}

function unwrapElement(el: HTMLElement) {
  if (el === editor.value) return;
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function stripFormat(el: HTMLElement, className: string) {
  if (!el.isConnected) return;
  el.classList.remove(className);
  if (className === "ink-size") {
    el.style.removeProperty("font-size");
    if (!el.getAttribute("style")?.trim()) el.removeAttribute("style");
  }
  if (el.classList.length === 0 && !el.getAttribute("style")) unwrapElement(el);
}

function cleanEmptyFormats() {
  if (!editor.value) return;
  for (const el of [...editor.value.querySelectorAll("span.ink-wave, span.ink-size")]) {
    if (!(el.textContent ?? "").length) unwrapElement(el as HTMLElement);
  }
}

function wrapExact(
  offs: { start: number; end: number },
  className: string,
  decorate?: (span: HTMLSpanElement) => void,
) {
  const range = rangeFromOffsets(offs.start, offs.end);
  if (!range) return;
  const span = document.createElement("span");
  span.className = className;
  decorate?.(span);
  try {
    range.surroundContents(span);
  } catch {
    span.appendChild(range.extractContents());
    range.insertNode(span);
  }
  editor.value?.normalize();
}

function splitUnwrap(el: HTMLElement, offs: { start: number; end: number }, className: string) {
  const mid = rangeFromOffsets(offs.start, offs.end);
  if (!mid) return;
  const after = el.cloneNode(false) as HTMLElement;
  el.after(after);
  const tail = document.createRange();
  tail.selectNodeContents(el);
  tail.setStart(mid.endContainer, mid.endOffset);
  after.appendChild(tail.extractContents());
  const mid2 = rangeFromOffsets(offs.start, offs.end);
  if (mid2) {
    const frag = mid2.extractContents();
    el.after(frag);
  }
  if (!(el.textContent ?? "").length) el.remove();
  if (!(after.textContent ?? "").length) after.remove();
  else if (className === "ink-size" && after.classList.contains("ink-size")) {
    /* suffix keeps original size */
  }
  editor.value?.normalize();
}

function sameSpan(el: HTMLElement, offs: { start: number; end: number }) {
  const full = elementOffsets(el);
  return Boolean(full && full.start === offs.start && full.end === offs.end);
}

function paint(color: string) {
  const offs = toolOffsets();
  if (!offs) return;
  restoreOffsets(offs);
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("foreColor", false, color);
  restoreOffsets(offs);
  save();
}

function highlight(color: string) {
  const offs = toolOffsets();
  if (!offs) return;
  restoreOffsets(offs);
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("hiliteColor", false, color);
  restoreOffsets(offs);
  save();
}

function bold() {
  const offs = toolOffsets();
  if (!offs) return;
  restoreOffsets(offs);
  document.execCommand("bold");
  restoreOffsets(offs);
  save();
}

function underline() {
  const offs = toolOffsets();
  if (!offs) return;
  restoreOffsets(offs);
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand("underline");
  restoreOffsets(offs);
  save();
}

function wavy() {
  const offs = toolOffsets();
  if (!offs) return;
  restoreOffsets(offs);
  const range = rangeFromOffsets(offs.start, offs.end);
  if (!range) return;
  const inner = formatsAround(range, "ink-wave")[0];
  const selected = range.toString();
  if (inner && (sameSpan(inner, offs) || (inner.textContent ?? "") === selected)) {
    stripFormat(inner, "ink-wave");
  } else if (inner) {
    splitUnwrap(inner, offs, "ink-wave");
  } else {
    wrapExact(offs, "ink-wave");
  }
  cleanEmptyFormats();
  restoreOffsets(offs);
  save();
}

function nearestSize(px: number) {
  return SIZE_STEPS.reduce((best, step) => (Math.abs(step - px) < Math.abs(best - px) ? step : best));
}

function nextSize(px: number, dir: 1 | -1) {
  const idx = SIZE_STEPS.indexOf(nearestSize(px));
  return SIZE_STEPS[Math.min(SIZE_STEPS.length - 1, Math.max(0, idx + dir))];
}

function sampleSize(range: Range) {
  const el = asEl(range.startContainer) ?? editor.value;
  const px = parseFloat(getComputedStyle(el!).fontSize);
  return Number.isFinite(px) && px >= 10 ? px : DEFAULT_SIZE;
}

function convertTempFonts(px: number) {
  const root = editor.value;
  if (!root) return 0;
  let n = 0;
  for (const font of [...root.querySelectorAll('font[size="7"], font[size="7"]')]) {
    const span = document.createElement("span");
    span.className = "ink-size";
    span.style.fontSize = `${px}px`;
    while (font.firstChild) span.appendChild(font.firstChild);
    font.replaceWith(span);
    n += 1;
  }
  for (const span of [...root.querySelectorAll("span")]) {
    const fs = span.style.fontSize;
    if (fs === "xxx-large" || fs === "-webkit-xxx-large" || fs === "xx-large") {
      span.classList.add("ink-size");
      span.style.fontSize = `${px}px`;
      n += 1;
    }
  }
  return n;
}

function unwrapDefaultSized() {
  if (!editor.value) return;
  for (const el of [...editor.value.querySelectorAll("span.ink-size")]) {
    const node = el as HTMLElement;
    const px = parseFloat(node.style.fontSize) || parseFloat(getComputedStyle(node).fontSize);
    if (nearestSize(px) === DEFAULT_SIZE) stripFormat(node, "ink-size");
  }
}

function applySizeTo(el: HTMLElement, dir: 1 | -1) {
  const cur = parseFloat(el.style.fontSize) || parseFloat(getComputedStyle(el).fontSize) || DEFAULT_SIZE;
  const next = nextSize(cur, dir);
  if (next === DEFAULT_SIZE) {
    stripFormat(el, "ink-size");
    editor.value?.normalize();
    return;
  }
  el.classList.add("ink-size");
  el.style.fontSize = `${next}px`;
}

function bumpFont(dir: 1 | -1) {
  const offs = toolOffsets();
  if (!offs) return;
  restoreOffsets(offs);
  const range = rangeFromOffsets(offs.start, offs.end);
  if (!range) return;
  const inner = formatsAround(range, "ink-size")[0];
  if (inner && (sameSpan(inner, offs) || (inner.textContent ?? "") === range.toString())) {
    applySizeTo(inner, dir);
    unwrapDefaultSized();
    cleanEmptyFormats();
    restoreOffsets(offs);
    save();
    return;
  }
  const next = nextSize(sampleSize(range), dir);
  document.execCommand("styleWithCSS", false, "false");
  document.execCommand("fontSize", false, "7");
  if (!convertTempFonts(next)) {
    wrapExact(offs, "ink-size", (span) => {
      span.style.fontSize = `${next}px`;
    });
  }
  if (next === DEFAULT_SIZE) unwrapDefaultSized();
  cleanEmptyFormats();
  restoreOffsets(offs);
  save();
}

// 層級：把當前行變成「○ 開頭、縮進兩字元」的層級行；按 Enter 自動延續，再按一次退回普通段落。
function level() {
  editor.value?.focus();
  document.execCommand("insertUnorderedList");
  save();
}

function placeBar() {
  rememberRange();
  const sel = selectionInEditor();
  if (!sel) {
    bar.value.show = false;
    return;
  }
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (!rect.width && !rect.height) {
    bar.value.show = false;
    return;
  }
  const headBottom = head.value?.getBoundingClientRect().bottom ?? 56;
  const estimateH = 42;
  const below = rect.top - estimateH < headBottom + 8;
  bar.value = {
    show: true,
    x: Math.min(window.innerWidth - 36, Math.max(36, rect.left + rect.width / 2)),
    y: below ? rect.bottom : rect.top,
    below,
  };
}

function makeToday() {
  const offs = toolOffsets();
  if (!offs) return;
  const range = rangeFromOffsets(offs.start, offs.end);
  const text = (range?.toString() ?? "").replace(/\s+/g, " ").trim();
  if (!text) return;
  journal.capture(text, { type: "task", dueOn: journal.today });
  window.getSelection()?.removeAllRanges();
  savedOffsets = null;
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
    <div ref="head" class="journal-head">
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
      <div
        class="ink-tools"
        @mousedown.capture.prevent="freezeToolRange"
      >
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
        <button class="tool-btn tool-size" type="button" title="放大字" @click="bumpFont(1)">A＋</button>
        <button class="tool-btn tool-size" type="button" title="縮小字" @click="bumpFont(-1)">A－</button>
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
        @mouseup="rememberRange"
        @keyup="rememberRange"
      />
    </div>
    <div
      v-if="bar.show"
      class="ink-bar"
      :class="{ 'is-below': bar.below }"
      :style="{ left: `${bar.x}px`, top: `${bar.y}px` }"
      @mousedown.prevent
    >
      <button class="today-btn" type="button" @click="makeToday">今日</button>
    </div>
  </div>
</template>
