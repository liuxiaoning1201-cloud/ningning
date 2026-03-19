<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play/remote" class="btn btn-secondary">← 遠程對戰</RouterLink>
    </nav>

    <template v-if="!session">
      <div class="card">
        <p>找不到場次或無法加入。</p>
        <RouterLink to="/play/remote" class="btn btn-primary" style="margin-top: 0.5rem">返回</RouterLink>
      </div>
    </template>

    <template v-else-if="session.status === 'waiting'">
      <h1 class="page-title">🏆 班級競賽 · {{ session.puzzleTitle }}</h1>
      <div class="card">
        <p v-if="session.joinCode" class="muted">場次碼：<strong>{{ session.joinCode }}</strong></p>
        <p class="muted">等待主持人開始。計時 {{ session.durationMinutes }} 分鐘，目前 {{ session.participants.length }} 人已加入。</p>
        <ul class="member-list">
          <li v-for="p in session.participants" :key="p.userId">{{ p.displayName }}</li>
        </ul>
        <button v-if="isHost" class="btn btn-primary" style="margin-top: 1rem" @click="onStartSession">開始競賽</button>
      </div>
    </template>

    <template v-else-if="session.status === 'playing' && puzzle && me">
      <h1 class="page-title">🏆 班級競賽 · {{ session.puzzleTitle }}</h1>
      <div class="timer-bar" :class="{ warning: remainingSeconds <= 60 }">
        <span v-if="remainingSeconds > 0">剩餘 {{ timerDisplay }}</span>
        <span v-else>時間到！</span>
      </div>

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
                  :value="me.answers[cellKey(r, c)]"
                  type="text"
                  maxlength="10"
                  class="cell-input"
                  :disabled="remainingSeconds <= 0"
                  @compositionend="onCompositionEnd(r, c, $event)"
                  @input="onCellInput(r, c, $event)"
                />
              </span>
            </template>
          </template>
        </div>
      </div>

      <div v-if="session.showHints" class="card clues-card">
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
        <button v-if="isHost" class="btn btn-secondary" @click="onEndSession">結束競賽</button>
        <RouterLink to="/play/remote" class="btn btn-secondary">離開</RouterLink>
      </div>
    </template>

    <template v-else-if="session.status === 'ended'">
      <h1 class="page-title">🏆 班級競賽結果</h1>
      <div class="card">
        <h3>排名</h3>
        <ol class="ranking-list">
          <li v-for="(r, i) in rankings" :key="r.userId" class="ranking-item" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">
            <span class="rank-num">{{ i + 1 }}</span>
            <span class="rank-name">{{ r.displayName }}</span>
            <span class="rank-score">{{ r.score }} 分</span>
            <span class="rank-time">{{ formatTime(r.timeMs) }}</span>
          </li>
        </ol>
        <RouterLink to="/play/remote" class="btn btn-primary" style="margin-top: 1rem">返回遠程對戰</RouterLink>
      </div>
    </template>

    <template v-else>
      <div class="card">
        <p class="muted">題組載入中或您尚未加入此場次。</p>
        <RouterLink to="/play/remote" class="btn btn-primary">返回</RouterLink>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from "vue-router";
import { getSavedUser } from "@/lib/api";
import { useRemoteBackendStore } from "@/stores/remoteBackend";
import type { CrosswordPuzzle } from "@/lib/types";
import {
  isRemoteApiAvailable,
  getSession,
  joinSession,
  startSession,
  endSession,
  setSessionAnswer,
  getRankings,
} from "@/lib/remoteApi";

interface SessionParticipant {
  userId: string;
  displayName: string;
  answers: Record<string, string>;
  score?: number;
  finishedAt?: string | null;
}

interface SessionView {
  id: string;
  joinCode?: string;
  status: string;
  puzzleTitle: string;
  durationMinutes: number;
  showHints: boolean;
  hostId: string;
  puzzleSnapshot: CrosswordPuzzle | null;
  participants: SessionParticipant[];
  startedAt?: string | null;
  endsAt?: string | null;
}

const route = useRoute();
const backend = useRemoteBackendStore();
const useRemote = isRemoteApiAvailable();

const sessionId = computed(() => route.params.sessionId as string);
const remoteSession = ref<SessionView | null>(null);

const session = computed((): SessionView | null => {
  if (useRemote) return remoteSession.value;
  const s = backend.getSession(sessionId.value);
  if (!s) return null;
  return {
    id: s.id,
    status: s.status,
    puzzleTitle: s.puzzleTitle,
    durationMinutes: s.durationMinutes,
    showHints: s.showHints,
    hostId: s.hostId,
    puzzleSnapshot: (s.puzzleSnapshot ?? null) as CrosswordPuzzle | null,
    participants: s.participants.map((p) => ({
      userId: p.userId,
      displayName: p.displayName,
      answers: p.answers ?? {},
      score: p.score,
      finishedAt: p.finishedAt ?? null,
    })),
    startedAt: s.startedAt,
    endsAt: s.endsAt,
  };
});

const currentUser = ref(getSavedUser());

const puzzle = computed((): CrosswordPuzzle | null => {
  const s = session.value;
  if (!s) return null;
  return s.puzzleSnapshot ?? null;
});

const me = computed(() => {
  const s = session.value;
  const u = currentUser.value;
  if (!s || !u) return null;
  return s.participants.find((p) => p.userId === u.id) ?? null;
});

const cols = computed(() => puzzle.value?.grid[0]?.length ?? 0);
const isHost = computed(() => currentUser.value && session.value?.hostId === currentUser.value.id);

const endsAt = ref<number | null>(null);
const remainingSeconds = ref(0);

const timerDisplay = computed(() => {
  const s = remainingSeconds.value;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
});

let timerId: ReturnType<typeof setInterval> | null = null;
let pollId: ReturnType<typeof setInterval> | null = null;
const remoteRankings = ref<{ userId: string; displayName: string; score: number; timeMs: number }[]>([]);

function startTimer() {
  const s = session.value;
  if (!s?.endsAt) return;
  endsAt.value = new Date(s.endsAt).getTime();
  function tick() {
    if (!endsAt.value) return;
    const left = Math.max(0, Math.ceil((endsAt.value - Date.now()) / 1000));
    remainingSeconds.value = left;
    if (left <= 0 && timerId) {
      clearInterval(timerId);
      timerId = null;
      if (!useRemote) {
        backend.endSession(sessionId.value);
      } else {
        void endSession(sessionId.value).then(() => void refreshRemote());
      }
    }
  }
  tick();
  timerId = setInterval(tick, 1000);
}

async function refreshRemote() {
  if (!useRemote) return;
  const data = await getSession(sessionId.value);
  if (data && typeof data === "object") {
    remoteSession.value = data as SessionView;
  }
  if (remoteSession.value?.status === "ended") {
    remoteRankings.value = await getRankings(sessionId.value);
  }
}

watch(
  session,
  (s) => {
    if (s?.status === "playing" && s.endsAt) {
      startTimer();
    }
  },
  { immediate: true },
);

watch(
  () => session.value?.status,
  async (st) => {
    if (useRemote && st === "ended") {
      remoteRankings.value = await getRankings(sessionId.value);
    }
  },
);

onMounted(async () => {
  const user = getSavedUser();
  if (!user) return;
  currentUser.value = user;
  if (useRemote) {
    await joinSession(sessionId.value);
    await refreshRemote();
    pollId = setInterval(refreshRemote, 2000);
  } else {
    const s = backend.getSession(sessionId.value);
    if (s && s.status === "waiting" && !s.participants.some((p) => p.userId === user.id)) {
      backend.joinSession(sessionId.value, user.id, user.displayName, user.email);
    }
  }
});

onUnmounted(() => {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  if (pollId) {
    clearInterval(pollId);
    pollId = null;
  }
});

const rankings = computed(() => {
  if (useRemote) return remoteRankings.value;
  return backend.getRankings(sessionId.value);
});

function cellKey(r: number, c: number): string {
  return `${r},${c}`;
}

function onCompositionEnd(r: number, c: number, e: Event) {
  const target = e.target as HTMLInputElement;
  const value = (target.value ?? "").trim().slice(-1);
  if (value && currentUser.value) {
    if (useRemote) void setSessionAnswer(sessionId.value, cellKey(r, c), value).then(() => void refreshRemote());
    else backend.setSessionAnswer(sessionId.value, currentUser.value.id, cellKey(r, c), value);
  }
}

function onCellInput(r: number, c: number, e: Event) {
  const target = e.target as HTMLInputElement;
  const value = (target.value ?? "").trim().slice(-1);
  if (value && currentUser.value) {
    if (useRemote) void setSessionAnswer(sessionId.value, cellKey(r, c), value).then(() => void refreshRemote());
    else backend.setSessionAnswer(sessionId.value, currentUser.value.id, cellKey(r, c), value);
  }
}

async function onStartSession() {
  if (!session.value || !isHost.value) return;
  if (useRemote) {
    const ok = await startSession(sessionId.value);
    if (ok) await refreshRemote();
  } else {
    backend.startSession(sessionId.value);
  }
}

async function onEndSession() {
  if (!isHost.value) return;
  if (useRemote) {
    await endSession(sessionId.value);
    await refreshRemote();
  } else {
    backend.endSession(sessionId.value);
  }
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
</script>

<style scoped>
.grid-wrap { overflow-x: auto; padding: 4px; margin: 0.75rem 0; }
.crossword-grid {
  display: grid;
  gap: 2px;
  padding: 4px;
  border: 2px solid var(--border);
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
.cell-input:disabled { opacity: 0.8; cursor: not-allowed; }
.timer-bar {
  text-align: center; padding: 0.5rem 1rem;
  background: #D1FAE5; color: #065F46; font-weight: 700; border-radius: 10px; margin-bottom: 0.75rem;
}
.timer-bar.warning { background: #FEF3C7; color: #92400E; }
.member-list { list-style: none; padding: 0; margin-top: 0.5rem; }
.member-list li { padding: 0.25rem 0; }
.clues-card { margin-top: 1rem; }
.clues-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; font-size: 0.9rem; }
.nav-actions { display: flex; gap: 0.5rem; margin-top: 1rem; }
.ranking-list { list-style: none; padding: 0; margin-top: 0.5rem; }
.ranking-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.6rem 0.75rem; margin-bottom: 0.35rem; border-radius: 10px; background: #F9F5F0;
}
.ranking-item.gold { background: linear-gradient(135deg, #FEF3C7, #FDE68A); }
.ranking-item.silver { background: linear-gradient(135deg, #F3F4F6, #E5E7EB); }
.ranking-item.bronze { background: linear-gradient(135deg, #FED7AA, #FDBA74); }
.rank-num { font-size: 1.25rem; font-weight: 700; min-width: 2rem; }
.rank-name { flex: 1; font-weight: 600; }
.rank-score { font-weight: 700; color: var(--primary); }
.rank-time { font-size: 0.85rem; color: var(--text-muted); }
.muted { color: var(--text-muted); font-size: 0.9rem; }
</style>
