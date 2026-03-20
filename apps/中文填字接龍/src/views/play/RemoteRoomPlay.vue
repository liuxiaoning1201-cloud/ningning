<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play/remote" class="btn btn-secondary">← 遠程對戰</RouterLink>
    </nav>

    <template v-if="!room">
      <div class="card">
        <p>找不到房間或無法加入，請向教師確認<strong>合作碼</strong>是否正確。</p>
        <RouterLink to="/play/remote" class="btn btn-primary" style="margin-top: 0.5rem">返回</RouterLink>
      </div>
    </template>

    <template v-else-if="room.status === 'waiting'">
      <h1 class="page-title">🤝 小組合作 · {{ room.puzzleTitle }}</h1>
      <div class="card">
        <p class="muted">等待主持人開始遊戲。目前 {{ room.members.length }} 人在房間。</p>
        <ul class="member-list">
          <li v-for="m in room.members" :key="m.userId">{{ m.displayName }}</li>
        </ul>
        <button
          v-if="isHost"
          class="btn btn-primary"
          style="margin-top: 1rem"
          @click="startRoom"
        >
          開始遊戲
        </button>
      </div>
    </template>

    <template v-else-if="room.status === 'playing' && puzzle">
      <h1 class="page-title">🤝 小組合作 · {{ room.puzzleTitle }}</h1>
      <p class="muted">與組員共用填字圖，即時同步。</p>

      <div class="grid-wrap">
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
                  :value="room.sharedAnswers[cellKey(r, c)]"
                  type="text"
                  maxlength="10"
                  class="cell-input"
                  @compositionend="onCompositionEnd(r, c, $event)"
                  @input="onCellInput(r, c, $event)"
                />
              </span>
            </template>
          </template>
        </div>
      </div>

      <div class="members-bar">
        <span class="muted">同組：</span>
        <span v-for="m in room.members" :key="m.userId" class="member-tag">{{ m.displayName }}</span>
      </div>

      <div v-if="gameSession.settings.showHints" class="card clues-card">
        <div class="clues-columns">
          <div class="clue-section">
            <strong>→ 橫向</strong>
            <ul class="clue-list">
              <li v-for="h in puzzle.horizontalClues" :key="h.id">{{ h.label }}. {{ h.clue }}</li>
            </ul>
          </div>
          <div class="clue-section">
            <strong>↓ 豎向</strong>
            <ul class="clue-list">
              <li v-for="v in puzzle.verticalClues" :key="v.id">{{ v.label }}. {{ v.clue }}</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="nav-actions">
        <button v-if="isHost" class="btn btn-secondary" @click="endRoom">結束房間</button>
        <RouterLink to="/play/remote" class="btn btn-secondary">離開</RouterLink>
      </div>
    </template>

    <template v-else-if="room.status === 'ended'">
      <h1 class="page-title">🤝 小組合作已結束</h1>
      <div class="card">
        <p class="muted">本房間已結束。</p>
        <RouterLink to="/play/remote" class="btn btn-primary">返回遠程對戰</RouterLink>
      </div>
    </template>

    <template v-else>
      <div class="card">
        <p class="muted">題組資料載入中或遺失，請返回選擇其他房間。</p>
        <RouterLink to="/play/remote" class="btn btn-primary">返回</RouterLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { useRoute } from "vue-router";
import { getSavedUser } from "@/lib/api";
import { useRemoteBackendStore } from "@/stores/remoteBackend";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import type { CrosswordPuzzle } from "@/lib/types";

const route = useRoute();
const backend = useRemoteBackendStore();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();

const roomId = computed(() => route.params.roomId as string);
const room = computed(() => backend.getRoom(roomId.value));

const currentUser = ref(getSavedUser());

const puzzle = computed((): CrosswordPuzzle | null => {
  const r = room.value;
  if (!r) return null;
  if (r.puzzleSnapshot) return r.puzzleSnapshot;
  const set = puzzleSets.sets.find((s) => s.id === r.puzzleId && s.type === "crossword");
  return set?.crossword ?? null;
});

const cols = computed(() => puzzle.value?.grid[0]?.length ?? 0);
const isHost = computed(() => currentUser.value && room.value?.hostId === currentUser.value.id);

onMounted(() => {
  const user = getSavedUser();
  if (!user) return;
  currentUser.value = user;
  const r = backend.getRoom(roomId.value);
  if (r && !r.members.some((m) => m.userId === user.id)) {
    backend.joinRoom(roomId.value, user.id, user.displayName, user.email);
  }
});

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function onCompositionEnd(r: number, c: number, e: Event) {
  const target = e.target as HTMLInputElement;
  const value = (target.value ?? "").trim().slice(-1);
  if (value && currentUser.value) {
    backend.setRoomCell(roomId.value, cellKey(r, c), value, currentUser.value.id);
  }
}

function onCellInput(r: number, c: number, e: Event) {
  const target = e.target as HTMLInputElement;
  const value = (target.value ?? "").trim().slice(-1);
  if (value && currentUser.value) {
    backend.setRoomCell(roomId.value, cellKey(r, c), value, currentUser.value.id);
  }
  target.value = room.value?.sharedAnswers[cellKey(r, c)] ?? "";
}

function startRoom() {
  if (!room.value || !isHost.value) return;
  backend.startRoom(roomId.value, room.value.puzzleId);
}

function endRoom() {
  if (!isHost.value) return;
  backend.endRoom(roomId.value);
}
</script>

<style scoped>
.grid-wrap { overflow-x: auto; padding: 4px; margin: 0.75rem 0; }
.crossword-grid {
  display: grid;
  gap: 2px;
  padding: 4px;
  border: 2px solid var(--border, #F0E6D8);
  border-radius: 12px;
  background: var(--border);
}
.cell {
  width: 2.5rem; height: 2.5rem;
  display: flex; align-items: center; justify-content: center;
  font-size: 1rem; border-radius: 4px;
}
.cell.block { background: #E8DDD0; }
.cell.given { background: #DBEAFE; font-weight: 700; }
.cell.blank { background: #fff; border: 1px dashed #E5D5C3; }
.cell-input {
  width: 100%; height: 100%; border: none;
  text-align: center; font-size: 1rem; background: transparent;
}
.cell-input:focus { outline: 2px solid var(--primary); outline-offset: -2px; }
.member-list { list-style: none; padding: 0; margin-top: 0.5rem; }
.member-list li { padding: 0.25rem 0; }
.members-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0.75rem 0; }
.member-tag { padding: 0.2rem 0.5rem; background: #EFF6FF; border-radius: 999px; font-size: 0.85rem; }
.clues-card { margin-top: 1rem; }
.clues-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; font-size: 0.9rem; }
.nav-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.muted { color: var(--text-muted); font-size: 0.9rem; }
</style>
