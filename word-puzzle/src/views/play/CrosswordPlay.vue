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
      <p class="muted">難度 {{ puzzle.difficulty }} 星 · {{ puzzle.levelTitle }}</p>

      <div
        ref="gridContainerRef"
        class="crossword-grid"
        tabindex="0"
        :style="{ gridTemplateColumns: `repeat(${cols}, ${cellSize})` }"
        @keydown="onGridKeydown"
      >
        <template v-for="(row, r) in puzzle.grid" :key="r">
          <template v-for="(cell, c) in row" :key="`${r}-${c}`">
            <!-- block -->
            <span
              v-if="cell.type === 'block'"
              class="cell block"
              :style="{ width: cellSize, height: cellSize }"
            ></span>

            <!-- given -->
            <span
              v-else-if="cell.type === 'given'"
              class="cell given"
              :style="{ width: cellSize, height: cellSize }"
              :class="cellResultClass(r, c)"
            >
              <span v-if="cellIndicators[cellKey(r, c)]" class="cell-indicator">
                {{ cellIndicators[cellKey(r, c)].number }}{{ cellIndicators[cellKey(r, c)].arrow }}
              </span>
              {{ cell.value }}
            </span>

            <!-- blank -->
            <span
              v-else
              class="cell blank"
              :style="{ width: cellSize, height: cellSize }"
              :class="cellResultClass(r, c)"
            >
              <span v-if="cellIndicators[cellKey(r, c)]" class="cell-indicator">
                {{ cellIndicators[cellKey(r, c)].number }}{{ cellIndicators[cellKey(r, c)].arrow }}
              </span>
              <input
                :ref="(el) => setInputRef(r, c, el)"
                :value="gameSession.userAnswers[cellKey(r, c)]"
                type="text"
                maxlength="10"
                class="cell-input"
                :class="{ focused: focusedCell && focusedCell.r === r && focusedCell.c === c }"
                :style="{ fontSize: inputFontSize }"
                @compositionstart="onCompositionStart"
                @compositionend="onCompositionEnd(r, c, $event)"
                @input="onCellInput(r, c, $event)"
                @focus="focusedCell = { r, c }"
                @keydown.delete="onCellDelete(r, c)"
              />
            </span>
          </template>
        </template>
      </div>

      <div v-if="gameSession.settings.showHints" class="card" style="margin-top: 1rem">
        <strong>→ 橫向提示</strong>
        <ul class="clue-list">
          <li v-for="h in puzzle.horizontalClues" :key="h.id">
            {{ h.label }}. {{ h.clue }}
            <span v-if="gameSession.showResult" :class="resultClass(h.id, 'h')">
              {{ resultText(h.id, 'h') }}
            </span>
          </li>
        </ul>
        <strong style="display: block; margin-top: 0.75rem">↓ 豎向提示</strong>
        <ul class="clue-list">
          <li v-for="v in puzzle.verticalClues" :key="v.id">
            {{ v.label }}. {{ v.clue }}
            <span v-if="gameSession.showResult" :class="resultClass(v.id, 'v')">
              {{ resultText(v.id, 'v') }}
            </span>
          </li>
        </ul>
      </div>

      <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 1rem">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="!allFilled"
          @click="checkAnswer"
        >
          對答案
        </button>
        <span v-if="gameSession.showResult" class="muted">
          答對 {{ correctCount }} / {{ totalBlanks }} 格
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch, ref, nextTick, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import type { CrosswordPuzzle, CrosswordCell } from "@/lib/types";

const route = useRoute();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();

const gridContainerRef = ref<HTMLElement | null>(null);
const inputRefs = ref(new Map<string, HTMLInputElement>());
const focusedCell = ref<{ r: number; c: number } | null>(null);
const isComposing = ref(false);

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
  timerInterval = setInterval(() => {
    elapsedSeconds.value++;
  }, 1000);
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
const cols = computed(() => puzzle.value?.grid[0]?.length ?? 0);

// Dynamic cell size based on difficulty (1-5 stars)
const cellSize = computed(() => {
  const d = puzzle.value?.difficulty ?? 1;
  if (d >= 5) return "1.6rem";
  if (d >= 4) return "1.8rem";
  if (d >= 3) return "2.0rem";
  if (d >= 2) return "2.4rem";
  return "2.8rem";
});

const inputFontSize = computed(() => {
  const d = puzzle.value?.difficulty ?? 1;
  if (d >= 4) return "0.75rem";
  if (d >= 3) return "0.85rem";
  return "1rem";
});

// Cell indicator map: cellKey -> { number, arrow, direction }
const cellIndicators = computed(() => {
  const p = puzzle.value;
  if (!p) return {} as Record<string, { number: string; arrow: string; direction: "h" | "v" | "both" }>;

  const map: Record<string, { number: string; arrow: string; direction: "h" | "v" | "both" }> = {};

  // Build a list of (word, label) in order
  const hClueMap = new Map<string, string>();
  for (const h of p.horizontalClues) hClueMap.set(h.id, h.label);
  const vClueMap = new Map<string, string>();
  for (const v of p.verticalClues) vClueMap.set(v.id, v.label);

  for (const w of p.words) {
    const key = cellKey(w.startRow, w.startCol);
    const label = w.direction === "horizontal"
      ? hClueMap.get(w.id) ?? ""
      : vClueMap.get(w.id) ?? "";
    const dir = w.direction === "horizontal" ? "h" : "v";

    if (map[key]) {
      // Already has an indicator — merge to 'both'
      map[key] = {
        number: map[key].number,
        arrow: "→↓",
        direction: "both",
      };
    } else {
      map[key] = {
        number: label,
        arrow: dir === "h" ? "→" : "↓",
        direction: dir,
      };
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
      if (cell.type === "blank") {
        out.push({ r, c, clueId: cell.clueId });
      }
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
      if (r === w.startRow && c >= w.startCol && c < w.startCol + w.text.length) {
        return w.text[c - w.startCol] ?? null;
      }
    } else {
      if (c === w.startCol && r >= w.startRow && r < w.startRow + w.text.length) {
        return w.text[r - w.startRow] ?? null;
      }
    }
  }
  return null;
}

const allFilled = computed(() => {
  return blankCells.value.every(
    ({ r, c }) => (gameSession.userAnswers[cellKey(r, c)] ?? "").trim().length > 0
  );
});

const correctCount = computed(() => {
  let n = 0;
  for (const { r, c } of blankCells.value) {
    const correct = getCorrectChar(r, c);
    const u = (gameSession.userAnswers[cellKey(r, c)] ?? "").trim();
    if (correct !== null && u === correct) n++;
  }
  return n;
});

// Result checking animation state
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

  // Trigger cell animations
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

// IME composition handling — critical for Chinese input stability
function onCompositionStart() {
  isComposing.value = true;
}

function onCompositionEnd(r: number, c: number, e: CompositionEvent) {
  isComposing.value = false;
  const composed = e.data ?? "";
  const lastChar = composed.slice(-1);
  if (lastChar) {
    gameSession.setAnswer(cellKey(r, c), lastChar);
    const el = inputRefs.value.get(cellKey(r, c));
    if (el) {
      el.value = lastChar;
    }
    setTimeout(() => advanceToNext(r, c), 50);
  }
}

function onCellInput(r: number, c: number, e: Event) {
  if (isComposing.value) {
    e.stopPropagation();
    return;
  }
  const target = e.target as HTMLInputElement;
  const rawVal = target.value;
  const val = rawVal.slice(-1);
  if (!val) return;
  gameSession.setAnswer(cellKey(r, c), val);
  target.value = val;
  setTimeout(() => advanceToNext(r, c), 50);
}

function onCellDelete(r: number, c: number) {
  const current = gameSession.userAnswers[cellKey(r, c)] ?? "";
  if (!current) {
    // Already empty — move to previous blank
    const list = blankCellsOrdered.value;
    const idx = list.findIndex((x) => x.r === r && x.c === c);
    if (idx > 0) {
      const prev = list[idx - 1];
      focusCell(prev.r, prev.c);
    }
  }
}

function advanceToNext(r: number, c: number) {
  const p = puzzle.value;
  if (!p) return;

  // Find which word(s) this cell belongs to and pick a direction
  const wordForCell = p.words.find((w) => {
    if (w.direction === "horizontal") {
      return r === w.startRow && c >= w.startCol && c < w.startCol + w.text.length;
    } else {
      return c === w.startCol && r >= w.startRow && r < w.startRow + w.text.length;
    }
  });

  if (wordForCell) {
    // Move along the word direction
    let nr = r;
    let nc = c;
    if (wordForCell.direction === "horizontal") nc++;
    else nr++;

    // Look for a blank cell in the same word forward
    while (
      nr < p.grid.length &&
      nc < (p.grid[0]?.length ?? 0) &&
      nr >= 0 &&
      nc >= 0
    ) {
      const cell = p.grid[nr]?.[nc];
      if (!cell || cell.type === "block") break;
      if (cell.type === "blank") {
        focusCell(nr, nc);
        return;
      }
      if (wordForCell.direction === "horizontal") nc++;
      else nr++;
    }
  }

  // Fallback: next blank in reading order
  const list = blankCellsOrdered.value;
  const idx = list.findIndex((x) => x.r === r && x.c === c);
  if (idx >= 0 && idx < list.length - 1) {
    const next = list[idx + 1];
    focusCell(next.r, next.c);
  }
}

// Input ref management
function setInputRef(r: number, c: number, el: unknown) {
  if (el instanceof HTMLInputElement) {
    inputRefs.value.set(cellKey(r, c), el);
  }
}

function focusCell(r: number, c: number) {
  const el = inputRefs.value.get(cellKey(r, c));
  if (el) {
    el.focus();
    focusedCell.value = { r, c };
  }
}

// Keyboard navigation
function onGridKeydown(e: KeyboardEvent) {
  const p = puzzle.value;
  if (!p || blankCellsOrdered.value.length === 0) return;
  const key = e.key;
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(key)) return;
  e.preventDefault();
  const current = focusedCell.value;
  const list = blankCellsOrdered.value;
  const idx = current
    ? list.findIndex((x) => x.r === current.r && x.c === current.c)
    : -1;
  let next: { r: number; c: number } | null = null;

  if (key === "ArrowRight") {
    if (idx >= 0 && idx < list.length - 1) next = list[idx + 1];
    else if (list.length > 0) next = list[0];
  } else if (key === "ArrowLeft") {
    if (idx > 0) next = list[idx - 1];
    else if (list.length > 0) next = list[list.length - 1];
  } else if (key === "ArrowDown") {
    const sameCol = list.filter((x) => x.c === (current?.c ?? -1));
    const nextInCol = current
      ? sameCol.find((x) => x.r > current.r)
      : sameCol[0];
    next = nextInCol ?? sameCol[0] ?? list[0] ?? null;
  } else if (key === "ArrowUp") {
    const sameCol = list.filter((x) => x.c === (current?.c ?? -1));
    const prevInCol = current
      ? [...sameCol].reverse().find((x) => x.r < current.r)
      : sameCol[sameCol.length - 1];
    next = prevInCol ?? sameCol[sameCol.length - 1] ?? list[list.length - 1] ?? null;
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

onMounted(() => {
  gridContainerRef.value?.focus();
  window.addEventListener("keydown", onGridKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onGridKeydown);
  inputRefs.value.clear();
  stopTimer();
});
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

.crossword-grid {
  display: grid;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-top: 0.5rem;
  width: fit-content;
  max-width: 100%;
  overflow: auto;
}

.cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 700;
  border-radius: 4px;
  border: 1px solid var(--border);
  transition: background 0.2s ease;
}

.cell.block {
  background: #E8DDD0;
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 3px,
    rgba(0, 0, 0, 0.03) 3px,
    rgba(0, 0, 0, 0.03) 4px
  );
  border-color: #DDD2C4;
}

.cell.given {
  background: #DBEAFE;
  font-weight: 700;
  color: var(--text);
}

.cell.blank {
  background: #FFFFFF;
  border: 1px dashed #E5D5C3;
}

.cell-indicator {
  position: absolute;
  top: 1px;
  left: 2px;
  font-size: 0.5em;
  font-weight: 600;
  line-height: 1;
  color: var(--primary);
  pointer-events: none;
  white-space: nowrap;
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
}

.cell-input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}

.cell-input.focused {
  background: #FEF3C7;
}

/* Result animation classes */
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

.clue-list {
  padding-left: 1.25rem;
  margin-top: 0.35rem;
}

.clue-list li {
  margin-bottom: 0.25rem;
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
