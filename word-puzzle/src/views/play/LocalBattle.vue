<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play" class="btn btn-secondary">← 題目列表</RouterLink>
    </nav>
    <template v-if="!set || !puzzle">
      <p>找不到該題組。</p>
    </template>
    <template v-else>
      <h1 class="page-title">本地對戰 · {{ set.title }}</h1>
      <p class="muted">兩人同機，輪流填格。當前：{{ currentPlayer === 1 ? "玩家一" : "玩家二" }}</p>

      <div
        class="crossword-grid"
        :style="{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }"
      >
        <template v-for="(row, r) in puzzle.grid" :key="r">
          <template v-for="(cell, c) in row" :key="`${r}-${c}`">
            <span v-if="cell.type === 'block'" class="cell block"></span>
            <span v-else-if="cell.type === 'given'" class="cell given">{{ cell.value }}</span>
            <span v-else class="cell blank">
              <input
                :value="answers[cellKey(r, c)]"
                type="text"
                maxlength="1"
                class="cell-input"
                :disabled="filledBy[cellKey(r, c)] !== undefined && filledBy[cellKey(r, c)] !== currentPlayer"
                @input="onInput(r, c, ($event.target as HTMLInputElement).value)"
              />
            </span>
          </template>
        </template>
      </div>

      <div class="card scores">
        <span>玩家一：{{ score1 }} 分</span>
        <span>玩家二：{{ score2 }} 分</span>
      </div>

      <div v-if="gameSession.settings.showHints" class="card" style="margin-top: 1rem">
        <strong>橫向 / 豎向提示</strong>
        <ul class="clue-list">
          <li v-for="h in puzzle.horizontalClues" :key="h.id">{{ h.label }}. {{ h.clue }}</li>
          <li v-for="v in puzzle.verticalClues" :key="v.id">{{ v.label }}. {{ v.clue }}</li>
        </ul>
      </div>

      <div v-if="allFilled" class="card result">
        <strong>對戰結束</strong> — 玩家一：{{ score1 }} 分，玩家二：{{ score2 }} 分
        <span :class="score1 > score2 ? 'win' : score2 > score1 ? 'lose' : 'tie'">
          {{ score1 > score2 ? "玩家一勝" : score2 > score1 ? "玩家二勝" : "平手" }}
        </span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import type { CrosswordPuzzle } from "@/lib/types";

const route = useRoute();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();

const setId = computed(() => route.params.setId as string);
const set = computed(() =>
  puzzleSets.sets.find((s) => s.id === setId.value && s.type === "crossword")
);
const puzzle = computed(() => set.value?.crossword ?? null);
const cols = computed(() => puzzle.value?.grid[0]?.length ?? 0);

const currentPlayer = ref<1 | 2>(1);
const answers = ref<Record<string, string>>({});
const filledBy = ref<Record<string, 1 | 2>>({});

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

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

const blankCells = computed(() => {
  const p = puzzle.value;
  if (!p) return [];
  const out: { r: number; c: number }[] = [];
  p.grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell.type === "blank") out.push({ r, c });
    });
  });
  return out;
});

const allFilled = computed(() =>
  blankCells.value.every(({ r, c }) => (answers.value[cellKey(r, c)] ?? "").trim().length > 0)
);

const score1 = computed(() => {
  let n = 0;
  for (const [key, player] of Object.entries(filledBy.value)) {
    if (player !== 1) continue;
    const [r, c] = key.split(",").map(Number);
    const correct = getCorrectChar(r, c);
    const u = answers.value[key] ?? "";
    if (correct !== null && u.trim() === correct) n++;
  }
  return n;
});

const score2 = computed(() => {
  let n = 0;
  for (const [key, player] of Object.entries(filledBy.value)) {
    if (player !== 2) continue;
    const [r, c] = key.split(",").map(Number);
    const correct = getCorrectChar(r, c);
    const u = answers.value[key] ?? "";
    if (correct !== null && u.trim() === correct) n++;
  }
  return n;
});

function onInput(r: number, c: number, value: string) {
  const key = cellKey(r, c);
  const ch = value.slice(-1) || "";
  answers.value = { ...answers.value, [key]: ch };
  if (ch) {
    filledBy.value = { ...filledBy.value, [key]: currentPlayer.value };
    currentPlayer.value = currentPlayer.value === 1 ? 2 : 1;
  }
}

watch(puzzle, (p) => {
  if (p) {
    answers.value = {};
    filledBy.value = {};
    currentPlayer.value = 1;
  }
}, { immediate: true });
</script>

<style scoped>
.muted { color: var(--text-muted); margin-bottom: 0.5rem; }
.crossword-grid {
  display: grid;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  margin-top: 0.5rem;
}
.cell { width: 2.5rem; height: 2.5rem; display: flex; align-items: center; justify-content: center; font-size: 1rem; border-radius: 4px; border: 1px solid var(--border); }
.cell.block { background: #e5e7eb; }
.cell.given { background: #e0f2fe; font-weight: 700; }
.cell.blank { background: var(--bg-card); }
.cell-input { width: 100%; height: 100%; border: none; text-align: center; font-size: 1rem; font-weight: 700; background: transparent; }
.cell-input:disabled { background: #f1f5f9; color: var(--text-muted); }
.scores { display: flex; gap: 1.5rem; margin-top: 1rem; }
.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; }
.clue-list li { margin-bottom: 0.25rem; }
.result { margin-top: 1rem; }
.result .win { color: #15803d; margin-left: 0.5rem; }
.result .lose { color: #b91c1c; margin-left: 0.5rem; }
.result .tie { color: var(--text-muted); margin-left: 0.5rem; }
</style>
