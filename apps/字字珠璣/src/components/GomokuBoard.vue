<template>
  <div class="board-shell">
    <div
      class="board"
      :style="boardStyle"
      :class="{ disabled: !interactive }"
      @click="onBoardClick"
    >
      <div
        v-for="(row, r) in board.cells"
        :key="r"
        class="board-row"
      >
        <div
          v-for="(cell, c) in row"
          :key="`${r}-${c}`"
          class="cell"
          :class="cellClasses(r, c, cell)"
          :data-r="r"
          :data-c="c"
          @click.stop="onCellClick(r, c)"
        >
          <span v-if="cell.type === 'char'" class="cell-ch">{{ cell.ch }}</span>
          <span
            v-else-if="cell.type === 'claimed'"
            class="cell-stone"
            :class="cell.by === 'black' ? 'stone-black' : 'stone-white'"
          >
            <span v-if="cell.ch" class="cell-stone-ch">{{ cell.ch }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BoardState, CellState, ConnectedLine } from "@/lib/types";

const props = defineProps<{
  board: BoardState;
  interactive?: boolean;
  lastMove?: { r: number; c: number } | null;
  highlightLine?: ConnectedLine | null;
  selecting?: { r: number; c: number }[];
}>();

const emit = defineEmits<{
  (e: "cell-click", payload: { r: number; c: number }): void;
}>();

const boardStyle = computed(() => {
  const size = props.board.size;
  const cellPx = clamp(Math.floor((Math.min(window.innerWidth, 720) - 40) / size), 28, 56);
  return {
    "--board-size": String(size),
    "--cell-size": `${cellPx}px`,
  };
});

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function cellClasses(r: number, c: number, cell: CellState) {
  const classes: string[] = [];
  classes.push(`cell-${cell.type}`);
  if (props.lastMove && props.lastMove.r === r && props.lastMove.c === c) classes.push("cell-last");
  if (props.highlightLine?.cells.some((p) => p.r === r && p.c === c)) classes.push("cell-win");
  if (props.selecting?.some((p) => p.r === r && p.c === c)) classes.push("cell-select");
  return classes;
}

function onCellClick(r: number, c: number) {
  if (!props.interactive) return;
  emit("cell-click", { r, c });
}

function onBoardClick(_e: MouseEvent) { /* fallback */ }
</script>

<style scoped>
.board-shell {
  display: flex;
  justify-content: center;
  padding: 0.5rem;
  user-select: none;
  -webkit-user-select: none;
}

.board {
  display: inline-grid;
  grid-template-rows: repeat(var(--board-size), var(--cell-size));
  background: linear-gradient(135deg, #f4dfb8, #e8c98a);
  border: 4px solid #8b6a3b;
  border-radius: 12px;
  padding: 6px;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.3),
    0 8px 28px rgba(45, 36, 25, 0.2);
  position: relative;
}

.board.disabled { cursor: not-allowed; opacity: 0.92; }

.board-row {
  display: grid;
  grid-template-columns: repeat(var(--board-size), var(--cell-size));
}

.cell {
  position: relative;
  width: var(--cell-size);
  height: var(--cell-size);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s ease;
  border-right: 1px solid rgba(139, 106, 59, 0.35);
  border-bottom: 1px solid rgba(139, 106, 59, 0.35);
}

.board-row .cell:last-child { border-right: none; }
.board-row:last-child .cell { border-bottom: none; }

.cell:hover {
  background: rgba(255, 255, 255, 0.18);
}
.board.disabled .cell:hover { background: transparent; }

.cell-empty { background: transparent; }

.cell-char .cell-ch {
  font-family: var(--font-heading);
  font-size: calc(var(--cell-size) * 0.55);
  color: #5b4530;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.cell-stone {
  width: calc(var(--cell-size) * 0.92);
  height: calc(var(--cell-size) * 0.92);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  animation: stoneIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  z-index: 1;
}

.stone-black {
  background: var(--black-stone);
  box-shadow:
    inset -3px -4px 8px rgba(0, 0, 0, 0.5),
    inset 1px 1px 4px rgba(255, 255, 255, 0.15),
    0 3px 6px rgba(0, 0, 0, 0.35);
}

.stone-white {
  background: var(--white-stone);
  box-shadow:
    inset -3px -4px 8px rgba(0, 0, 0, 0.18),
    inset 1px 1px 4px rgba(255, 255, 255, 0.85),
    0 3px 6px rgba(0, 0, 0, 0.25);
}

.cell-stone-ch {
  font-family: var(--font-heading);
  font-size: calc(var(--cell-size) * 0.42);
  font-weight: 700;
  letter-spacing: -0.02em;
}
.stone-black .cell-stone-ch { color: #f7e5c4; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
.stone-white .cell-stone-ch { color: #2d2419; text-shadow: 0 1px 1px rgba(255,255,255,0.5); }

.cell-last .cell-stone {
  outline: 2px solid var(--crimson);
  outline-offset: 2px;
}

.cell-win .cell-stone {
  animation: winPulse 1.2s ease-in-out infinite;
  outline: 3px solid var(--gold);
  outline-offset: 2px;
}

.cell-select {
  background: rgba(193, 53, 45, 0.18);
  outline: 2px dashed var(--crimson);
  outline-offset: -3px;
}

@keyframes stoneIn {
  from { transform: scale(0.2); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}

@keyframes winPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(200, 148, 58, 0.7), 0 3px 6px rgba(0, 0, 0, 0.35); }
  50%      { box-shadow: 0 0 0 8px rgba(200, 148, 58, 0), 0 3px 6px rgba(0, 0, 0, 0.35); }
}

/* RWD：較窄螢幕格子變小 */
@media (max-width: 480px) {
  .board { padding: 4px; border-width: 3px; }
}
</style>
