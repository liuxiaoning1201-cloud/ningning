<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play" class="btn btn-secondary">← 題目列表</RouterLink>
    </nav>
    <template v-if="!set || !puzzle">
      <p>找不到該題組。</p>
    </template>
    <template v-else>
      <!-- Mode Selection -->
      <div v-if="!gameStarted" class="mode-selection animate-fade-in">
        <h1 class="page-title" style="font-family: var(--font-heading, 'LXGW WenKai TC', cursive)">⚔️ 本地對戰</h1>
        <p class="subtitle">{{ set.title }}</p>
        <div class="mode-cards">
          <div class="mode-card" @click="startGame('race')">
            <div class="mode-icon">🏃</div>
            <h3>搶先填完制</h3>
            <p>輪流填格，比誰答對的多！</p>
          </div>
          <div class="mode-card" @click="startGame('collab')">
            <div class="mode-icon">🤝</div>
            <h3>共同填制</h3>
            <p>各填各的，用顏色區分陣營！</p>
          </div>
        </div>
      </div>

      <!-- Game Grid -->
      <div v-else-if="!showResults" class="game-area animate-fade-in">
        <h1 class="page-title" style="font-family: var(--font-heading, 'LXGW WenKai TC', cursive)">
          {{ battleMode === 'race' ? '🏃 搶先填完' : '🤝 共同填制' }}
        </h1>
        <div class="turn-indicator" :class="currentPlayer === 1 ? 'player1' : 'player2'">
          {{ currentPlayer === 1 ? '🌸 玩家一' : '🌊 玩家二' }} 的回合
        </div>

        <div class="crossword-grid"
          :style="{ gridTemplateColumns: `repeat(${cols}, 2.5rem)` }">
          <template v-for="(row, r) in puzzle.grid" :key="r">
            <template v-for="(cell, c) in row" :key="`${r}-${c}`">
              <span v-if="cell.type === 'block'" class="cell block"></span>
              <span v-else-if="cell.type === 'given'" class="cell given">{{ cell.value }}</span>
              <span v-else class="cell blank" :class="cellClass(r, c)">
                <input
                  :value="answers[cellKey(r, c)]"
                  type="text"
                  maxlength="1"
                  class="cell-input"
                  :style="cellInputStyle(r, c)"
                  :disabled="isCellDisabled(r, c)"
                  @compositionstart="isComposing = true"
                  @compositionend="onCompositionEnd(r, c, $event)"
                  @input="onInput(r, c, $event)"
                />
              </span>
            </template>
          </template>
        </div>

        <div class="score-bar">
          <div class="score-item player1-bg">🌸 玩家一：{{ score1 }} 分</div>
          <div class="score-item player2-bg">🌊 玩家二：{{ score2 }} 分</div>
        </div>

        <div v-if="gameSession.settings.showHints" class="card" style="margin-top: 1rem">
          <strong>📖 提示</strong>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem">
            <div>
              <strong>→ 橫向</strong>
              <ul class="clue-list">
                <li v-for="h in puzzle.horizontalClues" :key="h.id">{{ h.label }}. {{ h.clue }}</li>
              </ul>
            </div>
            <div>
              <strong>↓ 豎向</strong>
              <ul class="clue-list">
                <li v-for="v in puzzle.verticalClues" :key="v.id">{{ v.label }}. {{ v.clue }}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Results -->
      <div v-else class="results animate-fade-in">
        <h1 class="page-title" style="font-family: var(--font-heading, 'LXGW WenKai TC', cursive)">🏆 對戰結果</h1>
        <div class="result-cards">
          <div class="result-card" :class="{ winner: score1 >= score2 }">
            <div class="result-emoji">🌸</div>
            <h3>玩家一</h3>
            <div class="result-score">{{ score1 }} 分</div>
            <div class="result-detail">答對 {{ score1 }} / {{ playerCells(1) }} 格</div>
          </div>
          <div class="vs">VS</div>
          <div class="result-card" :class="{ winner: score2 >= score1 }">
            <div class="result-emoji">🌊</div>
            <h3>玩家二</h3>
            <div class="result-score">{{ score2 }} 分</div>
            <div class="result-detail">答對 {{ score2 }} / {{ playerCells(2) }} 格</div>
          </div>
        </div>
        <div class="winner-announce">
          {{ score1 > score2 ? '🎉 玩家一獲勝！' : score2 > score1 ? '🎉 玩家二獲勝！' : '🤝 平手！' }}
        </div>
        <div class="result-actions">
          <button class="btn btn-primary" @click="resetGame">再來一局</button>
          <RouterLink to="/play" class="btn btn-secondary">返回題目列表</RouterLink>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute } from "vue-router";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";

const route = useRoute();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();

const setId = computed(() => route.params.setId as string);
const set = computed(() =>
  puzzleSets.sets.find((s) => s.id === setId.value && s.type === "crossword")
);
const puzzle = computed(() => set.value?.crossword ?? null);
const cols = computed(() => puzzle.value?.grid[0]?.length ?? 0);

const gameStarted = ref(false);
const showResults = ref(false);
const battleMode = ref<"race" | "collab">("race");
const currentPlayer = ref<1 | 2>(1);
const answers = ref<Record<string, string>>({});
const filledBy = ref<Record<string, 1 | 2>>({});
const isComposing = ref(false);

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function startGame(mode: "race" | "collab") {
  battleMode.value = mode;
  gameStarted.value = true;
  answers.value = {};
  filledBy.value = {};
  currentPlayer.value = 1;
  showResults.value = false;
}

function resetGame() {
  gameStarted.value = false;
  showResults.value = false;
  answers.value = {};
  filledBy.value = {};
  currentPlayer.value = 1;
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

function playerCells(player: 1 | 2): number {
  return Object.values(filledBy.value).filter((p) => p === player).length;
}

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

function isCellDisabled(r: number, c: number): boolean {
  const key = cellKey(r, c);
  const owner = filledBy.value[key];
  if (owner === undefined) return false;
  if (battleMode.value === "race") return true;
  return owner !== currentPlayer.value;
}

function cellClass(r: number, c: number): string {
  const key = cellKey(r, c);
  const owner = filledBy.value[key];
  if (owner === 1) return "player1-cell";
  if (owner === 2) return "player2-cell";
  return "";
}

function cellInputStyle(r: number, c: number): Record<string, string> {
  const key = cellKey(r, c);
  const owner = filledBy.value[key];
  if (owner === 1) return { color: "#FF6B8A" };
  if (owner === 2) return { color: "#60A5FA" };
  return {};
}

function handleCellFill(r: number, c: number, value: string) {
  const key = cellKey(r, c);
  const ch = value.slice(-1) || "";
  if (!ch) return;
  answers.value = { ...answers.value, [key]: ch };
  filledBy.value = { ...filledBy.value, [key]: currentPlayer.value };
  currentPlayer.value = currentPlayer.value === 1 ? 2 : 1;

  if (allFilled.value) {
    setTimeout(() => {
      showResults.value = true;
    }, 500);
  }
}

function onCompositionEnd(r: number, c: number, e: Event) {
  isComposing.value = false;
  const target = e.target as HTMLInputElement;
  const value = target.value;
  handleCellFill(r, c, value);
  target.value = answers.value[cellKey(r, c)] || "";
}

function onInput(r: number, c: number, e: Event) {
  if (isComposing.value) {
    e.stopPropagation();
    return;
  }
  const target = e.target as HTMLInputElement;
  handleCellFill(r, c, target.value);
  target.value = answers.value[cellKey(r, c)] || "";
}

watch(puzzle, (p) => {
  if (p) {
    resetGame();
  }
}, { immediate: true });
</script>

<style scoped>
.subtitle { color: var(--text-muted, #8B8B8B); margin-bottom: 1.5rem; font-size: 1.1rem; }

.mode-selection { text-align: center; }
.mode-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 1rem; }
.mode-card {
  background: var(--bg-card, #fff);
  border: 2px solid var(--border, #F0E6D8);
  border-radius: 16px;
  padding: 2rem 1rem;
  cursor: pointer;
  transition: all 0.3s;
  text-align: center;
}
.mode-card:hover {
  border-color: var(--primary, #FF6B8A);
  transform: translateY(-4px);
  box-shadow: 0 8px 25px rgba(255, 107, 138, 0.15);
}
.mode-icon { font-size: 3rem; margin-bottom: 0.5rem; }
.mode-card h3 { font-family: var(--font-heading, 'LXGW WenKai TC', cursive); margin-bottom: 0.5rem; }
.mode-card p { color: var(--text-muted, #8B8B8B); font-size: 0.9rem; }

.turn-indicator {
  text-align: center;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-weight: 700;
  margin-bottom: 1rem;
  font-size: 1.1rem;
  transition: all 0.3s;
}
.turn-indicator.player1 { background: #FFF0F3; color: #FF6B8A; }
.turn-indicator.player2 { background: #EFF6FF; color: #60A5FA; }

.crossword-grid {
  display: grid;
  gap: 2px;
  padding: 4px;
  border: 2px solid var(--border, #F0E6D8);
  border-radius: 12px;
  background: var(--border, #F0E6D8);
  overflow-x: auto;
}
.cell {
  width: 2.5rem; height: 2.5rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; border-radius: 4px;
}
.cell.block { background: #E8DDD0; }
.cell.given { background: #DBEAFE; font-weight: 700; }
.cell.blank { background: var(--bg-card, #fff); border: 1px dashed #E5D5C3; }
.cell.player1-cell { background: #FFF0F3; }
.cell.player2-cell { background: #EFF6FF; }
.cell-input {
  width: 100%; height: 100%; border: none;
  text-align: center; font-size: 1rem; font-weight: 700;
  background: transparent;
}
.cell-input:disabled { opacity: 0.7; }
.cell-input:focus { outline: 2px solid var(--primary, #FF6B8A); outline-offset: -2px; }

.score-bar {
  display: flex; gap: 1rem; margin-top: 1rem; justify-content: center;
}
.score-item {
  padding: 0.5rem 1.5rem; border-radius: 999px; font-weight: 600;
}
.player1-bg { background: #FFF0F3; color: #FF6B8A; }
.player2-bg { background: #EFF6FF; color: #60A5FA; }

.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; font-size: 0.9rem; }
.clue-list li { margin-bottom: 0.25rem; }

.results { text-align: center; }
.result-cards {
  display: flex; align-items: center; justify-content: center; gap: 1rem;
  margin: 2rem 0;
}
.result-card {
  background: var(--bg-card, #fff);
  border: 2px solid var(--border, #F0E6D8);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  min-width: 160px;
  transition: all 0.3s;
}
.result-card.winner {
  border-color: #FFD700;
  box-shadow: 0 4px 20px rgba(255, 215, 0, 0.3);
  transform: scale(1.05);
}
.result-emoji { font-size: 2.5rem; }
.result-card h3 { font-family: var(--font-heading, 'LXGW WenKai TC', cursive); margin: 0.5rem 0; }
.result-score { font-size: 2rem; font-weight: 700; color: var(--primary, #FF6B8A); }
.result-detail { color: var(--text-muted, #8B8B8B); font-size: 0.85rem; margin-top: 0.25rem; }
.vs { font-size: 1.5rem; font-weight: 700; color: var(--text-muted, #8B8B8B); }

.winner-announce {
  font-size: 1.5rem; font-weight: 700;
  font-family: var(--font-heading, 'LXGW WenKai TC', cursive);
  margin-bottom: 1.5rem;
}
.result-actions { display: flex; gap: 0.5rem; justify-content: center; }
</style>
