<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play" class="btn btn-secondary">← 題目列表</RouterLink>
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
        :style="{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }"
        @keydown="onGridKeydown"
      >
        <template v-for="(row, r) in puzzle.grid" :key="r">
          <template v-for="(cell, c) in row" :key="`${r}-${c}`">
            <span v-if="cell.type === 'block'" class="cell block"></span>
            <span v-else-if="cell.type === 'given'" class="cell given">{{ cell.value }}</span>
            <span v-else class="cell blank">
              <input
                :ref="(el) => setInputRef(r, c, el)"
                :value="gameSession.userAnswers[cellKey(r, c)]"
                type="text"
                maxlength="1"
                class="cell-input"
                :class="{ focused: focusedCell && focusedCell.r === r && focusedCell.c === c }"
                @input="setUserAnswer(r, c, ($event.target as HTMLInputElement).value)"
                @focus="focusedCell = { r, c }"
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

const setId = computed(() => route.params.setId as string);

const set = computed(() =>
  puzzleSets.sets.find((s) => s.id === setId.value && s.type === "crossword")
);
const puzzle = computed(() => set.value?.crossword ?? null);

const cols = computed(() => puzzle.value?.grid[0]?.length ?? 0);

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

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
  return blankCells.value.every(({ r, c }) => (gameSession.userAnswers[cellKey(r, c)] ?? "").trim().length > 0);
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

function resultClass(clueId: string, _dir: 'h' | 'v'): string {
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

function resultText(clueId: string, _dir: 'h' | 'v'): string {
  const p = puzzle.value;
  if (!p) return "";
  const cells = blankCells.value.filter(({ r, c }) => (p.grid[r]?.[c] as CrosswordCell & { type: string })?.clueId === clueId);
  const correctChars = cells.map(({ r, c }) => getCorrectChar(r, c)).join("");
  const userChars = cells.map(({ r, c }) => gameSession.userAnswers[cellKey(r, c)] ?? "").join("");
  if (userChars === correctChars) return " ✓";
  return ` （答案：${correctChars}）`;
}

function checkAnswer() {
  gameSession.setShowResult(true);
}

function setUserAnswer(r: number, c: number, value: string) {
  gameSession.setAnswer(cellKey(r, c), value.slice(-1) || "");
}

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

function onGridKeydown(e: KeyboardEvent) {
  const p = puzzle.value;
  if (!p || blankCellsOrdered.value.length === 0) return;
  const key = e.key;
  if (key !== "ArrowLeft" && key !== "ArrowRight" && key !== "ArrowUp" && key !== "ArrowDown") return;
  e.preventDefault();
  const current = focusedCell.value;
  const list = blankCellsOrdered.value;
  const idx = current ? list.findIndex((x) => x.r === current.r && x.c === current.c) : -1;
  let next: { r: number; c: number } | null = null;
  if (key === "ArrowRight") {
    if (idx >= 0 && idx < list.length - 1) next = list[idx + 1];
    else if (list.length > 0) next = list[0];
  } else if (key === "ArrowLeft") {
    if (idx > 0) next = list[idx - 1];
    else if (list.length > 0) next = list[list.length - 1];
  } else if (key === "ArrowDown") {
    const sameCol = list.filter((x) => x.c === (current?.c ?? -1));
    const nextInCol = current ? sameCol.find((x) => x.r > current.r) : sameCol[0];
    next = nextInCol ?? (current ? sameCol[0] : list[0]) ?? null;
  } else if (key === "ArrowUp") {
    const sameCol = list.filter((x) => x.c === (current?.c ?? -1));
    const prevInCol = current ? [...sameCol].reverse().find((x) => x.r < current.r) : sameCol[sameCol.length - 1];
    next = prevInCol ?? (current ? sameCol[sameCol.length - 1] : list[list.length - 1]) ?? null;
  }
  if (next) focusCell(next.r, next.c);
}

watch(
  puzzle,
  (p) => {
    if (p) {
      gameSession.setCurrentPuzzle(p);
      inputRefs.value.clear();
      focusedCell.value = null;
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
});
</script>

<style scoped>
.muted { color: var(--text-muted); font-size: 0.95rem; margin-bottom: 0.5rem; }
.crossword-grid {
  display: grid;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-top: 0.5rem;
}
.cell {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  border-radius: 4px;
  border: 1px solid var(--border);
}
.cell.block { background: #e5e7eb; }
.cell.given { background: #e0f2fe; font-weight: 700; }
.cell.blank { background: var(--bg-card); }
.cell-input {
  width: 100%;
  height: 100%;
  border: none;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  background: transparent;
}
.cell-input:focus {
  outline: 2px solid var(--primary);
  outline-offset: -2px;
}
.cell-input.focused {
  background: #fef3c7;
}
.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; }
.clue-list li { margin-bottom: 0.25rem; }
.correct { color: #15803d; margin-left: 0.5rem; }
.wrong { color: #b91c1c; margin-left: 0.5rem; }
</style>
