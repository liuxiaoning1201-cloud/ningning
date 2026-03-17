<template>
  <div class="page">
    <nav class="nav-bar">
      <button type="button" class="btn btn-secondary" @click="goBack">← 返回</button>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">{{ isNew ? "✨ 新建填字接龍" : "✏️ 編輯填字接龍" }}</h1>

    <div class="card" style="margin-bottom: 1rem">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500">題組標題</label>
      <input v-model="title" type="text" placeholder="例如：五年級論語填字接龍卡" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius)" />
    </div>

    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">從詞句庫自動生成</h2>
      <p class="muted" style="margin-bottom: 0.5rem">選擇詞句庫與難度檔位，系統將自動排版並產生橫豎交叉填字題。</p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center">
        <label>
          詞句庫
          <select v-model="selectedBankId" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); margin-left: 4px">
            <option value="">— 請選擇 —</option>
            <option v-for="b in wordBanks.banks" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
        <label>
          難度
          <select v-model.number="tier" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); margin-left: 4px">
            <option :value="1">★ 入門</option>
            <option :value="2">★★ 初學</option>
            <option :value="3">★★★ 中等</option>
            <option :value="4">★★★★ 挑戰</option>
            <option :value="5">★★★★★ 大師</option>
          </select>
        </label>
        <label>
          用詞數量
          <input v-model.number="wordCount" type="number" min="0" placeholder="0=全部" style="width: 4rem; padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); margin-left: 4px" />
        </label>
        <button type="button" class="btn btn-primary" :disabled="!selectedBankId" @click="generate">產生填字題</button>
      </div>
      <div v-if="selectedBank && selectedBank.items.length > 0" style="margin-top: 0.75rem; border-top: 1px solid var(--border); padding-top: 0.75rem">
        <p style="font-size: 0.9rem; margin-bottom: 0.5rem"><strong>勾選要使用的詞句</strong>（不勾選則使用全部或按數量隨機）</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
          <label v-for="it in selectedBank.items" :key="it.id" class="word-check-label">
            <input type="checkbox" :checked="selectedItemIds.has(it.id)" @change="toggleItem(it.id)" />
            {{ it.text }}
          </label>
        </div>
      </div>
    </div>

    <template v-if="puzzle">
      <!-- 工具列 -->
      <div class="toolbar card" style="margin-bottom: 0.5rem">
        <span class="toolbar-group">
          <button type="button" class="tbtn" title="上方加行" @click="addRowTop">+行↑</button>
          <button type="button" class="tbtn" title="下方加行" @click="addRowBottom">+行↓</button>
          <button type="button" class="tbtn" title="刪除首行" :disabled="!canRemoveRowTop" @click="removeRowTop">−行↑</button>
          <button type="button" class="tbtn" title="刪除末行" :disabled="!canRemoveRowBottom" @click="removeRowBottom">−行↓</button>
        </span>
        <span class="toolbar-group">
          <button type="button" class="tbtn" title="左側加列" @click="addColLeft">+列←</button>
          <button type="button" class="tbtn" title="右側加列" @click="addColRight">+列→</button>
          <button type="button" class="tbtn" title="刪除首列" :disabled="!canRemoveColLeft" @click="removeColLeft">−列←</button>
          <button type="button" class="tbtn" title="刪除末列" :disabled="!canRemoveColRight" @click="removeColRight">−列→</button>
        </span>
        <span class="toolbar-group">
          <button type="button" class="tbtn" :class="{ active: selectMode }" @click="toggleSelectMode">
            {{ selectMode ? '✕ 取消框選' : '🖨️ 框選列印' }}
          </button>
          <button v-if="selRect" type="button" class="tbtn print-sel" @click="printSelection">
            🖨️ 列印選區 ({{ selRect.r2 - selRect.r1 + 1 }}×{{ selRect.c2 - selRect.c1 + 1 }})
          </button>
        </span>
      </div>

      <!-- 互動格子 -->
      <div class="card" style="margin-bottom: 1rem">
        <p class="hint">{{ selectMode ? '拖曳框選列印範圍' : '點擊格子切換 空白↔提示字' }}</p>
        <div class="grid-scroll">
          <div
            class="grid-editor"
            :style="{ gridTemplateColumns: `repeat(${editCols}, 2.2rem)` }"
            @mouseup="onMouseUp"
          >
            <template v-for="(row, r) in editGrid" :key="r">
              <template v-for="(cell, c) in row" :key="`${r}-${c}`">
                <span
                  class="ecell"
                  :class="ecellClass(cell, r, c)"
                  @mousedown.prevent="onCellMouseDown(r, c)"
                  @mouseenter="onCellMouseEnter(r, c)"
                  @click="onCellClick(r, c)"
                >
                  <template v-if="cell.type === 'given'">{{ cell.value }}</template>
                  <template v-else-if="cell.type === 'blank'">
                    <span class="blank-q">?</span>
                  </template>
                </span>
              </template>
            </template>
          </div>
        </div>
        <p class="muted" style="margin-top: 0.35rem; font-size: 0.8rem">
          {{ editGrid.length }}×{{ editCols }} · {{ editWordCount }} 詞句
        </p>
      </div>

      <!-- 提示區 -->
      <div class="card" style="margin-bottom: 1rem">
        <div style="display: flex; gap: 1rem; flex-wrap: wrap">
          <div style="flex: 1; min-width: 10rem">
            <strong style="color: #2563eb">→ 橫向提示</strong>
            <ul class="clue-list">
              <li v-for="h in puzzle.horizontalClues" :key="h.id"><b style="color: #2563eb">{{ h.label }}.</b> {{ h.clue }}</li>
            </ul>
          </div>
          <div style="flex: 1; min-width: 10rem">
            <strong style="color: #dc2626">↓ 豎向提示</strong>
            <ul class="clue-list">
              <li v-for="v in puzzle.verticalClues" :key="v.id"><b style="color: #dc2626">{{ v.label }}.</b> {{ v.clue }}</li>
            </ul>
          </div>
        </div>
      </div>
    </template>

    <div style="display: flex; gap: 0.5rem">
      <button type="button" class="btn btn-primary" :disabled="!puzzle" @click="savePuzzle">💾 儲存</button>
      <button type="button" class="btn btn-secondary" @click="goBack">取消</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWordBanksStore } from "@/stores/wordBanks";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { generateCrosswordPuzzle } from "@/lib/crosswordGenerator";
import type { CrosswordPuzzle, CrosswordCell, DifficultyTier, PuzzleSet } from "@/lib/types";

const route = useRoute();
const router = useRouter();
const wordBanks = useWordBanksStore();
const puzzleSets = usePuzzleSetsStore();

const setId = computed(() => route.params.setId as string);
const isNew = computed(() => setId.value === "new" || !setId.value);

const title = ref("");
const selectedBankId = ref("");
const tier = ref<DifficultyTier>(1);
const wordCount = ref(0);
const selectedItemIds = ref<Set<string>>(new Set());
const puzzle = ref<CrosswordPuzzle | null>(null);

const editGrid = ref<CrosswordCell[][]>([]);
const selectMode = ref(false);
const selStart = ref<{ r: number; c: number } | null>(null);
const selEnd = ref<{ r: number; c: number } | null>(null);
const isDragging = ref(false);

const selectedBank = computed(() =>
  wordBanks.banks.find((b) => b.id === selectedBankId.value) ?? null
);

const editCols = computed(() => editGrid.value[0]?.length ?? 0);
const editWordCount = computed(() => puzzle.value?.words.length ?? 0);

const answerGrid = computed(() => {
  const p = puzzle.value;
  if (!p) return [];
  const rows = editGrid.value.length;
  const cols = editGrid.value[0]?.length ?? 0;
  const ans: string[][] = Array.from({ length: rows }, () => Array(cols).fill(""));
  for (const w of p.words) {
    for (let k = 0; k < w.text.length; k++) {
      const r = w.direction === "horizontal" ? w.startRow : w.startRow + k;
      const c = w.direction === "horizontal" ? w.startCol + k : w.startCol;
      if (r >= 0 && r < rows && c >= 0 && c < cols) ans[r][c] = w.text[k];
    }
  }
  return ans;
});

const selRect = computed(() => {
  if (!selStart.value || !selEnd.value) return null;
  return {
    r1: Math.min(selStart.value.r, selEnd.value.r),
    c1: Math.min(selStart.value.c, selEnd.value.c),
    r2: Math.max(selStart.value.r, selEnd.value.r),
    c2: Math.max(selStart.value.c, selEnd.value.c),
  };
});

const canRemoveRowTop = computed(() => {
  if (editGrid.value.length <= 1) return false;
  return editGrid.value[0].every((c) => c.type === "block");
});
const canRemoveRowBottom = computed(() => {
  if (editGrid.value.length <= 1) return false;
  return editGrid.value[editGrid.value.length - 1].every((c) => c.type === "block");
});
const canRemoveColLeft = computed(() => {
  if (editCols.value <= 1) return false;
  return editGrid.value.every((row) => row[0]?.type === "block");
});
const canRemoveColRight = computed(() => {
  if (editCols.value <= 1) return false;
  return editGrid.value.every((row) => row[row.length - 1]?.type === "block");
});

function toggleItem(id: string) {
  const s = new Set(selectedItemIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedItemIds.value = s;
}

watch(
  () => route.params.setId,
  (id) => {
    if (id && id !== "new") {
      const set = puzzleSets.sets.find((s) => s.id === id && s.type === "crossword");
      if (set?.crossword) {
        title.value = set.title;
        puzzle.value = set.crossword;
        editGrid.value = JSON.parse(JSON.stringify(set.crossword.grid));
      }
    } else {
      title.value = "";
      puzzle.value = null;
      editGrid.value = [];
      selectedBankId.value = "";
    }
  },
  { immediate: true }
);

function generate() {
  const bank = selectedBank.value;
  if (!bank || bank.items.length === 0) { alert("請選擇有詞條的詞句庫"); return; }
  const itemsToUse = selectedItemIds.value.size > 0
    ? bank.items.filter((it) => selectedItemIds.value.has(it.id))
    : bank.items;
  if (itemsToUse.length === 0) { alert("請至少勾選一個詞句"); return; }
  const result = generateCrosswordPuzzle({
    items: itemsToUse,
    tier: tier.value,
    wordCount: wordCount.value || undefined,
  });
  if (result) {
    puzzle.value = result;
    editGrid.value = JSON.parse(JSON.stringify(result.grid));
  } else {
    alert("無法產生填字題，請確認詞句庫有足夠詞條。");
  }
}

function onCellClick(r: number, c: number) {
  if (selectMode.value) return;
  const cell = editGrid.value[r]?.[c];
  if (!cell || cell.type === "block") return;
  const answer = answerGrid.value[r]?.[c];
  if (!answer) return;

  if (cell.type === "blank") {
    editGrid.value[r][c] = { type: "given", value: answer };
  } else {
    editGrid.value[r][c] = { type: "blank", clueId: "" };
  }
}

function addRowTop() {
  const cols = editCols.value;
  editGrid.value.unshift(Array.from({ length: cols }, (): CrosswordCell => ({ type: "block" })));
  if (puzzle.value) {
    for (const w of puzzle.value.words) w.startRow++;
  }
}
function addRowBottom() {
  const cols = editCols.value;
  editGrid.value.push(Array.from({ length: cols }, (): CrosswordCell => ({ type: "block" })));
}
function removeRowTop() {
  if (!canRemoveRowTop.value) return;
  editGrid.value.shift();
  if (puzzle.value) {
    for (const w of puzzle.value.words) w.startRow--;
  }
}
function removeRowBottom() {
  if (!canRemoveRowBottom.value) return;
  editGrid.value.pop();
}
function addColLeft() {
  for (const row of editGrid.value) row.unshift({ type: "block" });
  if (puzzle.value) {
    for (const w of puzzle.value.words) w.startCol++;
  }
}
function addColRight() {
  for (const row of editGrid.value) row.push({ type: "block" });
}
function removeColLeft() {
  if (!canRemoveColLeft.value) return;
  for (const row of editGrid.value) row.shift();
  if (puzzle.value) {
    for (const w of puzzle.value.words) w.startCol--;
  }
}
function removeColRight() {
  if (!canRemoveColRight.value) return;
  for (const row of editGrid.value) row.pop();
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) { selStart.value = null; selEnd.value = null; }
}
function onCellMouseDown(r: number, c: number) {
  if (!selectMode.value) return;
  isDragging.value = true;
  selStart.value = { r, c };
  selEnd.value = { r, c };
}
function onCellMouseEnter(r: number, c: number) {
  if (!selectMode.value || !isDragging.value) return;
  selEnd.value = { r, c };
}
function onMouseUp() {
  isDragging.value = false;
}

function ecellClass(cell: CrosswordCell, r: number, c: number) {
  const cls: Record<string, boolean> = {
    "ec-block": cell.type === "block",
    "ec-given": cell.type === "given",
    "ec-blank": cell.type === "blank",
  };
  if (selRect.value) {
    const s = selRect.value;
    cls["ec-selected"] = r >= s.r1 && r <= s.r2 && c >= s.c1 && c <= s.c2;
  }
  return cls;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printSelection() {
  const rect = selRect.value;
  const p = puzzle.value;
  if (!rect || !p) return;

  const subGrid: CrosswordCell[][] = [];
  for (let r = rect.r1; r <= rect.r2; r++) {
    const row: CrosswordCell[] = [];
    for (let c = rect.c1; c <= rect.c2; c++) {
      row.push(editGrid.value[r]?.[c] ?? { type: "block" });
    }
    subGrid.push(row);
  }

  const subRows = subGrid.length;
  const subCols = subGrid[0]?.length ?? 0;

  const indicators: Record<string, { hLabel?: string; vLabel?: string }> = {};
  const hClueMap = new Map<string, string>();
  const vClueMap = new Map<string, string>();
  for (const cl of p.horizontalClues) hClueMap.set(cl.id, cl.label);
  for (const cl of p.verticalClues) vClueMap.set(cl.id, cl.label);
  for (const w of p.words) {
    const localR = w.startRow - rect.r1;
    const localC = w.startCol - rect.c1;
    if (localR < 0 || localR >= subRows || localC < 0 || localC >= subCols) continue;
    const key = `${localR},${localC}`;
    const cur = indicators[key] ?? {};
    if (w.direction === "horizontal") cur.hLabel = hClueMap.get(w.id) ?? cur.hLabel;
    else cur.vLabel = vClueMap.get(w.id) ?? cur.vLabel;
    indicators[key] = cur;
  }

  const isTall = subRows > subCols * 1.2;
  const sz = Math.min(32, Math.floor(580 / Math.max(subCols, 1)));
  const szPx = `${sz}px`;
  const charFontPx = Math.max(10, sz - 12);
  const indFontPx = Math.max(6, Math.floor(sz * 0.28));

  let cells = "";
  for (let r = 0; r < subRows; r++) {
    for (let c = 0; c < subCols; c++) {
      const cell = subGrid[r][c];
      const ind = indicators[`${r},${c}`];
      let indHtml = "";
      if (ind) {
        indHtml = `<span class="ind">`;
        if (ind.hLabel) indHtml += `<span class="ih">${esc(ind.hLabel)}→</span>`;
        if (ind.vLabel) indHtml += `<span class="iv">${esc(ind.vLabel)}↓</span>`;
        indHtml += `</span>`;
      }
      if (cell.type === "block") cells += `<span class="c cb"></span>`;
      else if (cell.type === "given") cells += `<span class="c cg">${indHtml}<span class="cv">${esc((cell as { value: string }).value)}</span></span>`;
      else cells += `<span class="c ce">${indHtml}</span>`;
    }
  }

  const inRangeH = p.horizontalClues.filter((cl) => {
    const w = p.words.find((ww) => ww.id === cl.id);
    return w && w.startRow >= rect.r1 && w.startRow <= rect.r2 && w.startCol >= rect.c1;
  });
  const inRangeV = p.verticalClues.filter((cl) => {
    const w = p.words.find((ww) => ww.id === cl.id);
    return w && w.startCol >= rect.c1 && w.startCol <= rect.c2 && w.startRow >= rect.r1;
  });

  let hClues = "";
  for (const h of inRangeH) hClues += `<li><b class="lh">${esc(h.label)}.</b> ${esc(h.clue)}</li>`;
  let vClues = "";
  for (const v of inRangeV) vClues += `<li><b class="lv">${esc(v.label)}.</b> ${esc(v.clue)}</li>`;

  const wrapCss = isTall
    ? "display:flex;flex-direction:row;gap:14px;align-items:flex-start"
    : "display:flex;flex-direction:column;gap:10px;align-items:center";
  const cluesCss = isTall
    ? "flex:1;font-size:11px;line-height:1.55"
    : "width:100%;display:flex;gap:20px;font-size:11px;line-height:1.55";
  const colCss = isTall ? "" : "flex:1";

  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${esc(title.value || "填字接龍")}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;padding:0.8cm;background:#fff;color:#333}
h1{font-size:18px;text-align:center;margin-bottom:3px}
.sub{text-align:center;color:#666;font-size:11px;margin-bottom:10px}
.wrap{${wrapCss}}
.grid{display:grid;gap:0;grid-template-columns:repeat(${subCols},${szPx});grid-template-rows:repeat(${subRows},${szPx});flex-shrink:0}
.c{position:relative;width:${szPx};height:${szPx};display:flex;align-items:flex-end;justify-content:center;font-weight:800;border:1.2px solid #888;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding-bottom:1px}
.cb{background:#eae6df;border-color:#c5bfb3}.cg{background:#e8f4fd;border-color:#90c8f0}.ce{background:#fffbf2;border:1.5px dashed #e0a050}
.cv{font-size:${charFontPx}px;color:#1a1a1a;z-index:1}
.ind{position:absolute;top:0;left:1px;display:flex;gap:1px;line-height:1;font-size:${indFontPx}px;font-weight:600;z-index:2}
.ih{color:#2563eb}.iv{color:#dc2626}
.clues{${cluesCss}}.clue-col{${colCss}}.clues h3{font-size:12px;margin:0 0 3px;font-weight:700}.clues ul{padding-left:16px;margin:0 0 8px}.clues li{margin-bottom:1px}
.lh{color:#1d4ed8;font-weight:700}.lv{color:#b91c1c;font-weight:700}
@media print{@page{size:A4;margin:0.6cm}body{padding:0.5cm}}
</style></head><body>
<h1>${esc(title.value || "填字接龍")}</h1>
<p class="sub">${esc(p.levelTitle)}</p>
<div class="wrap">
<div class="grid">${cells}</div>
<div class="clues">
<div class="clue-col"><h3 style="color:#1d4ed8">→ 橫向提示</h3><ul>${hClues}</ul></div>
<div class="clue-col"><h3 style="color:#b91c1c">↓ 豎向提示</h3><ul>${vClues}</ul></div>
</div></div></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (!w) { alert("無法開啟列印頁面，請允許彈出視窗後重試。"); URL.revokeObjectURL(url); return; }
  w.addEventListener("afterprint", () => { w.close(); URL.revokeObjectURL(url); });
  w.onload = () => { setTimeout(() => w.print(), 300); };
}

function savePuzzle() {
  const t = title.value.trim();
  if (!t) { alert("請輸入題組標題"); return; }
  if (!puzzle.value) { alert("請先產生或載入填字題"); return; }

  const updatedPuzzle: CrosswordPuzzle = {
    ...puzzle.value,
    grid: JSON.parse(JSON.stringify(editGrid.value)),
  };

  const existing = !isNew.value ? puzzleSets.sets.find((s) => s.id === setId.value) : null;
  const set: PuzzleSet = {
    id: isNew.value ? generateId() : setId.value,
    title: t,
    type: "crossword" as const,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    source: (isNew.value ? "manual" : existing?.source) as "manual" | "practice" | undefined,
    crossword: updatedPuzzle,
  };
  if (isNew.value) {
    puzzleSets.addSet(set);
  } else {
    puzzleSets.updateSet(set);
  }
  goBack();
}

function goBack() {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push("/play");
  }
}
</script>

<style scoped>
.muted { color: var(--text-muted); font-size: 0.9rem; }
.hint { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; }

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.5rem;
  align-items: center;
}
.toolbar-group {
  display: flex;
  gap: 0.2rem;
  align-items: center;
  padding-right: 0.5rem;
  margin-right: 0.25rem;
  border-right: 1px solid var(--border);
}
.toolbar-group:last-child { border-right: none; }
.tbtn {
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}
.tbtn:hover:not(:disabled) { background: #f0f0f0; }
.tbtn:disabled { opacity: 0.4; cursor: not-allowed; }
.tbtn.active { background: #dbeafe; border-color: #60a5fa; color: #1d4ed8; }
.tbtn.print-sel { background: #dcfce7; border-color: #4ade80; color: #166534; }

.grid-scroll {
  overflow-x: auto;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #f8f4ee;
}
.grid-editor {
  display: grid;
  gap: 1px;
  width: fit-content;
  user-select: none;
}
.ecell {
  width: 2.2rem;
  height: 2.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  font-weight: 800;
  border-radius: 2px;
  border: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.1s, box-shadow 0.1s;
  position: relative;
}
.ecell:hover { box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4); }
.ec-block { background: #e8ddd0; cursor: default; }
.ec-block:hover { box-shadow: none; }
.ec-given { background: #dbeafe; color: #1a1a1a; }
.ec-blank { background: #fff; border-style: dashed; border-color: #d4a76a; }
.blank-q { color: #ccc; font-size: 0.7rem; }
.ec-selected { box-shadow: inset 0 0 0 2px #3b82f6 !important; }

.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; font-size: 0.85rem; }
.clue-list li { margin-bottom: 0.25rem; }

.word-check-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.6rem;
  background: #FFF8F0;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.word-check-label:hover {
  border-color: var(--primary);
  background: #FFF0F3;
}
</style>
