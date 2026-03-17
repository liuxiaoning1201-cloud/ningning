<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play" class="btn btn-secondary">← 題目列表</RouterLink>
      <span class="timer">⏱ {{ timerDisplay }}</span>
    </nav>

    <template v-if="!set || !puzzle">
      <p>找不到該題組。</p>
    </template>
    <template v-else>
      <h1 class="page-title">{{ set.title }}</h1>
      <p class="muted">難度 {{ puzzle.difficulty }} 星 · {{ puzzle.levelTitle }}　共 {{ puzzle.words.length }} 題</p>

      <!-- 方形畫布：格子自動適應填滿 -->
      <div class="grid-canvas">
        <div
          ref="gridContainerRef"
          class="crossword-grid"
          tabindex="0"
          :style="gridStyle"
        >
          <template v-for="(row, r) in puzzle.grid" :key="r">
            <template v-for="(cell, c) in row" :key="`${r}-${c}`">
              <span
                v-if="cell.type === 'block'"
                class="cell block"
              ></span>
              <span
                v-else-if="cell.type === 'given'"
                class="cell given"
                :class="cellResultClass(r, c)"
              >
                <span v-if="cellIndicators[cellKey(r, c)]" class="cell-indicator-wrap">
                  <span v-if="cellIndicators[cellKey(r, c)].hLabel" class="cell-indicator ind-h">{{ cellIndicators[cellKey(r, c)].hLabel }}<span class="ind-arrow">→</span></span>
                  <span v-if="cellIndicators[cellKey(r, c)].vLabel" class="cell-indicator ind-v">{{ cellIndicators[cellKey(r, c)].vLabel }}<span class="ind-arrow">↓</span></span>
                </span>
                {{ cell.value }}
              </span>
              <span
                v-else
                class="cell blank"
                :class="cellResultClass(r, c)"
              >
                <span v-if="cellIndicators[cellKey(r, c)]" class="cell-indicator-wrap">
                  <span v-if="cellIndicators[cellKey(r, c)].hLabel" class="cell-indicator ind-h">{{ cellIndicators[cellKey(r, c)].hLabel }}<span class="ind-arrow">→</span></span>
                  <span v-if="cellIndicators[cellKey(r, c)].vLabel" class="cell-indicator ind-v">{{ cellIndicators[cellKey(r, c)].vLabel }}<span class="ind-arrow">↓</span></span>
                </span>
                <input
                  :ref="(el) => setInputRef(r, c, el)"
                  type="text"
                  maxlength="10"
                  class="cell-input"
                  :class="{ focused: focusedCell && focusedCell.r === r && focusedCell.c === c }"
                  @compositionstart="onCompositionStart(r, c)"
                  @compositionend="onCompositionEnd(r, c, $event)"
                  @compositionupdate="onCompositionUpdate(r, c, $event)"
                  @input="onCellInput(r, c, $event)"
                  @focus="focusedCell = { r, c }"
                  @keydown="onCellKeydown(r, c, $event)"
                />
              </span>
            </template>
          </template>
        </div>
      </div>

      <!-- 按鈕 -->
      <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem">
        <button type="button" class="btn btn-primary" @click="checkAnswer">
          對答案
        </button>
        <span v-if="gameSession.showResult" class="muted">
          答對 {{ correctCount }} / {{ totalBlanks }} 格
          <span v-if="!allFilled">（尚有 {{ totalBlanks - filledCount }} 格未填）</span>
        </span>
      </div>

      <!-- 提示在下方 -->
      <div v-if="gameSession.settings.showHints" class="card clues-card">
        <div class="clues-columns">
          <div class="clue-section">
            <strong class="clue-heading clue-h"><span class="clue-arrow">→</span> 橫向提示</strong>
            <ul class="clue-list">
              <li v-for="h in puzzle.horizontalClues" :key="h.id">
                <span class="clue-label clue-h">{{ h.label }}.</span> {{ h.clue }}
                <span v-if="gameSession.showResult" :class="resultClass(h.id, 'h')">
                  {{ resultText(h.id, 'h') }}
                </span>
              </li>
            </ul>
          </div>
          <div class="clue-section">
            <strong class="clue-heading clue-v"><span class="clue-arrow">↓</span> 豎向提示</strong>
            <ul class="clue-list">
              <li v-for="v in puzzle.verticalClues" :key="v.id">
                <span class="clue-label clue-v">{{ v.label }}.</span> {{ v.clue }}
                <span v-if="gameSession.showResult" :class="resultClass(v.id, 'v')">
                  {{ resultText(v.id, 'v') }}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import type { CrosswordCell } from "@/lib/types";

const route = useRoute();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();

const gridContainerRef = ref<HTMLElement | null>(null);
const inputRefs = ref(new Map<string, HTMLInputElement>());
const focusedCell = ref<{ r: number; c: number } | null>(null);
const isComposing = ref(false);
const composingCellKey = ref<string | null>(null);
const composingText = ref("");

// Timer
const elapsedSeconds = ref(0);
let timerInterval: ReturnType<typeof setInterval> | null = null;

const timerDisplay = computed(() => {
  const m = Math.floor(elapsedSeconds.value / 60);
  const s = elapsedSeconds.value % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
});

function startTimer() {
  stopTimer();
  elapsedSeconds.value = 0;
  timerInterval = setInterval(() => elapsedSeconds.value++, 1000);
}

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Puzzle data
const setId = computed(() => route.params.setId as string);
const set = computed(() =>
  puzzleSets.sets.find((s) => s.id === setId.value && s.type === "crossword")
);
const puzzle = computed(() => set.value?.crossword ?? null);

const gridRows = computed(() => puzzle.value?.grid.length ?? 0);
const gridCols = computed(() => puzzle.value?.grid[0]?.length ?? 0);

// 動態計算 grid style：填滿畫布
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${gridCols.value}, 1fr)`,
  gridTemplateRows: `repeat(${gridRows.value}, 1fr)`,
}));

// Cell indicator：橫向藍色大寫數字+→，豎向紅色小寫數字+↓；交叉格兩者都標
const cellIndicators = computed(() => {
  const p = puzzle.value;
  if (!p) return {} as Record<string, { hLabel?: string; vLabel?: string }>;
  const map: Record<string, { hLabel?: string; vLabel?: string }> = {};
  const hClueMap = new Map<string, string>();
  for (const h of p.horizontalClues) hClueMap.set(h.id, h.label);
  const vClueMap = new Map<string, string>();
  for (const v of p.verticalClues) vClueMap.set(v.id, v.label);

  for (const w of p.words) {
    const key = cellKey(w.startRow, w.startCol);
    const cur = map[key] ?? {};
    if (w.direction === "horizontal") {
      map[key] = { ...cur, hLabel: hClueMap.get(w.id) ?? cur.hLabel };
    } else {
      map[key] = { ...cur, vLabel: vClueMap.get(w.id) ?? cur.vLabel };
    }
  }
  return map;
});

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

// Blank cells
const blankCells = computed(() => {
  const p = puzzle.value;
  if (!p) return [];
  const out: { r: number; c: number; clueId: string }[] = [];
  p.grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.type === "blank") out.push({ r, c, clueId: cell.clueId });
    });
  });
  return out;
});

const blankCellsOrdered = computed(() =>
  [...blankCells.value].sort((a, b) => (a.r !== b.r ? a.r - b.r : a.c - b.c))
);

const totalBlanks = computed(() => blankCells.value.length);

function getCorrectChar(r: number, c: number): string | null {
  const p = puzzle.value;
  if (!p) return null;
  for (const w of p.words) {
    if (w.direction === "horizontal") {
      if (r === w.startRow && c >= w.startCol && c < w.startCol + w.text.length)
        return w.text[c - w.startCol] ?? null;
    } else {
      if (c === w.startCol && r >= w.startRow && r < w.startRow + w.text.length)
        return w.text[r - w.startRow] ?? null;
    }
  }
  return null;
}

const allFilled = computed(() =>
  blankCells.value.every(
    ({ r, c }) => (gameSession.userAnswers[cellKey(r, c)] ?? "").trim().length > 0
  )
);

const filledCount = computed(() =>
  blankCells.value.filter(
    ({ r, c }) => (gameSession.userAnswers[cellKey(r, c)] ?? "").trim().length > 0
  ).length
);

const correctCount = computed(() => {
  let n = 0;
  for (const { r, c } of blankCells.value) {
    const correct = getCorrectChar(r, c);
    const u = (gameSession.userAnswers[cellKey(r, c)] ?? "").trim();
    if (correct !== null && u === correct) n++;
  }
  return n;
});

// Result animation
const animatingCells = ref(new Map<string, "correct" | "wrong">());

function cellResultClass(r: number, c: number): Record<string, boolean> {
  const key = cellKey(r, c);
  const anim = animatingCells.value.get(key);
  return {
    "animate-correct": anim === "correct",
    "animate-wrong": anim === "wrong",
  };
}

function resultClass(clueId: string, _dir: "h" | "v"): string {
  const p = puzzle.value;
  if (!p) return "";
  let allCorrect = true;
  for (const { r, c } of blankCells.value) {
    const cell = p.grid[r]?.[c];
    if (cell?.type === "blank" && cell.clueId === clueId) {
      const correct = getCorrectChar(r, c);
      const u = (gameSession.userAnswers[cellKey(r, c)] ?? "").trim();
      if (correct !== null && u !== correct) allCorrect = false;
    }
  }
  return allCorrect ? "correct" : "wrong";
}

function resultText(clueId: string, _dir: "h" | "v"): string {
  const p = puzzle.value;
  if (!p) return "";
  const cells = blankCells.value.filter(
    ({ r, c }) =>
      (p.grid[r]?.[c] as CrosswordCell & { clueId?: string })?.clueId === clueId
  );
  const correctChars = cells.map(({ r, c }) => getCorrectChar(r, c)).join("");
  const userChars = cells
    .map(({ r, c }) => gameSession.userAnswers[cellKey(r, c)] ?? "")
    .join("");
  if (userChars === correctChars) return " ✓";
  return ` （答案：${correctChars}）`;
}

function checkAnswer() {
  stopTimer();
  gameSession.setShowResult(true);
  const newMap = new Map<string, "correct" | "wrong">();
  for (const { r, c } of blankCells.value) {
    const correct = getCorrectChar(r, c);
    const u = (gameSession.userAnswers[cellKey(r, c)] ?? "").trim();
    const key = cellKey(r, c);
    newMap.set(key, correct !== null && u === correct ? "correct" : "wrong");
  }
  animatingCells.value = newMap;
  setTimeout(() => {
    animatingCells.value = new Map();
  }, 600);
}

// IME — 拼音穩定顯示在方框中，直到選字完成才消失
function onCompositionStart(r: number, c: number) {
  isComposing.value = true;
  composingCellKey.value = cellKey(r, c);
  composingText.value = "";
  // 清空 input 讓拼音獨占顯示
  const el = inputRefs.value.get(cellKey(r, c));
  if (el) el.value = "";
}

function onCompositionUpdate(_r: number, _c: number, e: CompositionEvent) {
  isComposing.value = true;
  composingText.value = e.data ?? "";
  // 不做任何 stopPropagation / preventDefault，讓瀏覽器自然渲染拼音在 input 中
}

function onCellKeydown(r: number, c: number, e: KeyboardEvent) {
  if (isComposing.value) {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
      e.stopPropagation();
      return;
    }
  }
  if (e.key === "Delete" || e.key === "Backspace") {
    if (!isComposing.value) onCellDelete(r, c);
    return;
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    onGridKeydown(e);
  }
}

function onCompositionEnd(r: number, c: number, e: CompositionEvent) {
  isComposing.value = false;
  composingCellKey.value = null;
  composingText.value = "";
  const composed = e.data ?? "";
  const lastChar = composed.slice(-1);
  if (lastChar) {
    gameSession.setAnswer(cellKey(r, c), lastChar);
    // 確保 input 顯示最終選中的字
    nextTick(() => {
      const el = inputRefs.value.get(cellKey(r, c));
      if (el) el.value = lastChar;
    });
    setTimeout(() => advanceToNext(r, c), 80);
  }
}

function onCellInput(r: number, c: number, e: Event) {
  if (isComposing.value) {
    // 組字中不攔截 input 事件，讓瀏覽器自然處理拼音顯示
    return;
  }
  const target = e.target as HTMLInputElement;
  const val = target.value.slice(-1);
  if (!val) return;
  gameSession.setAnswer(cellKey(r, c), val);
  target.value = val;
  setTimeout(() => advanceToNext(r, c), 50);
}

function onCellDelete(r: number, c: number) {
  const current = gameSession.userAnswers[cellKey(r, c)] ?? "";
  if (!current) {
    const list = blankCellsOrdered.value;
    const idx = list.findIndex((x) => x.r === r && x.c === c);
    if (idx > 0) focusCell(list[idx - 1].r, list[idx - 1].c);
  }
}

function advanceToNext(r: number, c: number) {
  const p = puzzle.value;
  if (!p) return;
  const wordForCell = p.words.find((w) => {
    if (w.direction === "horizontal")
      return r === w.startRow && c >= w.startCol && c < w.startCol + w.text.length;
    return c === w.startCol && r >= w.startRow && r < w.startRow + w.text.length;
  });
  if (wordForCell) {
    let nr = r, nc = c;
    if (wordForCell.direction === "horizontal") nc++; else nr++;
    while (nr < p.grid.length && nc < (p.grid[0]?.length ?? 0) && nr >= 0 && nc >= 0) {
      const cell = p.grid[nr]?.[nc];
      if (!cell || cell.type === "block") break;
      if (cell.type === "blank") { focusCell(nr, nc); return; }
      if (wordForCell.direction === "horizontal") nc++; else nr++;
    }
  }
  const list = blankCellsOrdered.value;
  const idx = list.findIndex((x) => x.r === r && x.c === c);
  if (idx >= 0 && idx < list.length - 1) focusCell(list[idx + 1].r, list[idx + 1].c);
}

function setInputRef(r: number, c: number, el: unknown) {
  if (el instanceof HTMLInputElement) inputRefs.value.set(cellKey(r, c), el);
}

function focusCell(r: number, c: number) {
  const el = inputRefs.value.get(cellKey(r, c));
  if (el) { el.focus(); focusedCell.value = { r, c }; }
}

function onGridKeydown(e: KeyboardEvent) {
  const p = puzzle.value;
  if (!p || blankCellsOrdered.value.length === 0) return;
  if (isComposing.value) return;
  const current = focusedCell.value;
  e.preventDefault();
  const list = blankCellsOrdered.value;
  let next: { r: number; c: number } | null = null;
  if (e.key === "ArrowRight") {
    if (current) next = list.find((x) => x.r === current.r && x.c > current.c) ?? list.find((x) => x.r > current.r) ?? null;
    if (!next && list.length > 0) next = list[0];
  } else if (e.key === "ArrowLeft") {
    if (current) next = [...list].reverse().find((x) => x.r === current.r && x.c < current.c) ?? [...list].reverse().find((x) => x.r < current.r) ?? null;
    if (!next && list.length > 0) next = list[list.length - 1];
  } else if (e.key === "ArrowDown") {
    if (current) { const col = list.filter((x) => x.c === current.c); next = col.find((x) => x.r > current.r) ?? col[0] ?? null; }
    if (!next && list.length > 0) next = list[0];
  } else if (e.key === "ArrowUp") {
    if (current) { const col = list.filter((x) => x.c === current.c); next = [...col].reverse().find((x) => x.r < current.r) ?? col[col.length - 1] ?? null; }
    if (!next && list.length > 0) next = list[list.length - 1];
  }
  if (next) focusCell(next.r, next.c);
}

// Lifecycle
watch(
  puzzle,
  (p) => {
    if (p) {
      gameSession.setCurrentPuzzle(p);
      inputRefs.value.clear();
      focusedCell.value = null;
      composingCellKey.value = null;
      composingText.value = "";
      animatingCells.value = new Map();
      startTimer();
      nextTick(() => {
        const first = blankCellsOrdered.value[0];
        if (first) focusCell(first.r, first.c);
      });
    }
  },
  { immediate: true }
);

onMounted(() => gridContainerRef.value?.focus());
onUnmounted(() => { inputRefs.value.clear(); stopTimer(); });
</script>

<style scoped>
.muted {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 0.5rem;
}

.timer {
  margin-left: auto;
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}

/* 畫布：格子適應填滿 */
.grid-canvas {
  width: 100%;
  max-width: min(92vw, 82vh);
  margin: 0.5rem auto 0;
  border: 2px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  box-sizing: border-box;
  overflow: hidden;
  background: #f8f4ee;
}

.crossword-grid {
  display: grid;
  gap: 1px;
  width: 100%;
}

.cell {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  font-weight: 800;
  border-radius: 2px;
  border: 1px solid var(--border);
  overflow: hidden;
  font-size: clamp(0.7rem, 2.2vmin, 1.3rem);
  line-height: 1;
  padding-bottom: 1px;
}

.cell.block {
  background: #E8DDD0;
  background-image: repeating-linear-gradient(
    45deg, transparent, transparent 3px,
    rgba(0, 0, 0, 0.03) 3px, rgba(0, 0, 0, 0.03) 4px
  );
  border-color: #DDD2C4;
}

.cell.given {
  background: #DBEAFE;
  color: #1a1a1a;
}

.cell.blank {
  background: #FFFFFF;
  border: 1px dashed #ccc;
}

.cell-indicator-wrap {
  position: absolute;
  top: 0;
  left: 1px;
  display: flex;
  flex-wrap: nowrap;
  gap: 0 1px;
  line-height: 1;
  pointer-events: none;
  z-index: 2;
}
.cell-indicator {
  font-size: clamp(0.28rem, 0.7vmin, 0.42rem);
  font-weight: 600;
  white-space: nowrap;
  opacity: 0.85;
}
.cell-indicator.ind-h {
  color: #3b82f6;
}
.cell-indicator.ind-v {
  color: #ef4444;
}
.ind-arrow {
  font-size: 0.85em;
}

.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  text-align: center;
  font-weight: 700;
  background: transparent;
  color: var(--text);
  caret-color: var(--primary);
  font-size: inherit;
  padding: 0;
}

.cell-input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.cell-input.focused {
  background: #FEF3C7;
}

/* 提示在下方，橫豎兩欄並排 */
.clues-card {
  margin-top: 0.75rem;
}

.clues-columns {
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.clue-section {
  flex: 1;
  min-width: 12rem;
}

.clue-list {
  padding-left: 1.25rem;
  margin-top: 0.35rem;
  font-size: 0.9rem;
}

.clue-list li {
  margin-bottom: 0.2rem;
}

.clue-heading.clue-h,
.clue-label.clue-h {
  color: #2563eb;
}
.clue-heading.clue-v,
.clue-label.clue-v {
  color: #dc2626;
}
.clue-arrow {
  font-weight: 700;
}

/* Result */
.animate-correct {
  animation: bounceCorrect 0.6s ease both;
  background: #D1FAE5 !important;
}

.animate-wrong {
  animation: shakeWrong 0.6s ease both;
  background: #FEE2E2 !important;
}

@keyframes bounceCorrect {
  0% { transform: scale(1); }
  30% { transform: scale(1.15); }
  50% { transform: scale(0.95); }
  70% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes shakeWrong {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
  90% { transform: translateX(2px); }
}

.correct {
  color: #15803d;
  margin-left: 0.5rem;
}

.wrong {
  color: #b91c1c;
  margin-left: 0.5rem;
}
</style>
