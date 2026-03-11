<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading, 'LXGW WenKai TC', cursive)">🌐 遠程對戰</h1>

    <!-- Connection Status -->
    <div v-if="!isOnline" class="card notice animate-fade-in">
      <h3>⚠️ 離線模式</h3>
      <p>遠程對戰需要連接後端伺服器。請在設定頁面配置 API URL。</p>
      <div class="api-config">
        <input v-model="apiUrlInput" type="text" placeholder="輸入 API URL（如 https://your-worker.workers.dev）" class="input-field" />
        <button class="btn btn-primary" @click="saveApiUrl">連接</button>
      </div>
      <RouterLink to="/settings" class="btn btn-secondary" style="margin-top: 0.5rem">前往設定 →</RouterLink>
    </div>

    <template v-else>
      <!-- Auth Section -->
      <div v-if="!currentUser" class="card auth-card animate-fade-in">
        <h3>🔐 登入</h3>
        <p>使用 Google 帳號登入以加入對戰房間。</p>
        <button class="btn btn-primary google-btn" @click="handleGoogleSignIn" :disabled="signingIn">
          {{ signingIn ? '登入中...' : '🔑 Google 登入' }}
        </button>
        <p v-if="authError" class="error-text">{{ authError }}</p>
      </div>

      <template v-else>
        <!-- User Info -->
        <div class="card user-card animate-fade-in">
          <div class="user-info">
            <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" class="avatar" alt="" />
            <div>
              <strong>{{ currentUser.displayName }}</strong>
              <p class="muted">{{ currentUser.email }}</p>
            </div>
          </div>
          <button class="btn btn-secondary" @click="handleSignOut">登出</button>
        </div>

        <!-- Room Management (when not in a room) -->
        <template v-if="!remoteGame.room">
          <div class="card animate-fade-in" style="animation-delay: 0.1s">
            <h3>🏠 建立房間</h3>
            <p class="muted">選擇一個題組，建立對戰房間讓其他玩家加入。</p>
            <div class="create-room-form">
              <select v-model="selectedPuzzleId" class="input-field">
                <option value="">— 選擇題組 —</option>
                <option v-for="s in crosswordSets" :key="s.id" :value="s.id">{{ s.title }}</option>
              </select>
              <button class="btn btn-primary" :disabled="!selectedPuzzleId || creating" @click="createRoom">
                {{ creating ? '建立中...' : '建立房間' }}
              </button>
            </div>
          </div>

          <div class="card animate-fade-in" style="animation-delay: 0.2s">
            <h3>🚪 加入房間</h3>
            <p class="muted">輸入房間碼加入已有的對戰房間。</p>
            <div class="join-room-form">
              <input v-model="joinRoomId" type="text" placeholder="輸入房間碼" class="input-field" />
              <button class="btn btn-primary" :disabled="!joinRoomId.trim() || joining" @click="joinRoom">
                {{ joining ? '加入中...' : '加入房間' }}
              </button>
            </div>
          </div>
        </template>

        <!-- In Room -->
        <template v-else>
          <div class="card room-card animate-fade-in">
            <div class="room-header">
              <h3>🏠 房間 {{ remoteGame.room.id.slice(0, 8) }}</h3>
              <span class="status-badge" :class="remoteGame.room.status">
                {{ statusText }}
              </span>
            </div>
            <p class="muted">將此房間碼分享給其他玩家：</p>
            <div class="room-code">
              <code>{{ remoteGame.room.id }}</code>
              <button class="btn btn-secondary btn-sm" @click="copyRoomId">📋 複製</button>
            </div>
          </div>

          <!-- Members List -->
          <div class="card animate-fade-in" style="animation-delay: 0.1s">
            <h3>👥 玩家 ({{ remoteGame.room.members.length }})</h3>
            <ul class="member-list">
              <li v-for="m in remoteGame.room.members" :key="m.userId" class="member-item">
                <span>{{ m.displayName }}</span>
                <span class="member-score">{{ remoteGame.scores[m.userId] ?? 0 }} 分</span>
              </li>
            </ul>
            <div v-if="remoteGame.room.status === 'waiting'" class="start-actions">
              <button class="btn btn-primary" :disabled="remoteGame.room.members.length < 2" @click="startGame">
                🚀 開始對戰
              </button>
              <p v-if="remoteGame.room.members.length < 2" class="muted">等待更多玩家加入...</p>
            </div>
          </div>

          <!-- Rankings (when game ended) -->
          <div v-if="remoteGame.room.status === 'ended' && remoteGame.rankings.length > 0" class="card rankings-card animate-fade-in">
            <h3>🏆 排名</h3>
            <ol class="ranking-list">
              <li v-for="(r, i) in remoteGame.rankings" :key="r.userId" class="ranking-item" :class="{ gold: i === 0, silver: i === 1, bronze: i === 2 }">
                <span class="rank">{{ i + 1 }}</span>
                <span class="rank-name">{{ r.displayName }}</span>
                <span class="rank-score">{{ r.score }} 分</span>
                <span class="rank-time">{{ formatTime(r.timeMs) }}</span>
              </li>
            </ol>
          </div>

          <div class="card" style="margin-top: 0.5rem">
            <button class="btn btn-secondary" @click="leaveRoom">🚪 離開房間</button>
          </div>
        </template>
      </template>
    </template>

    <!-- Connection indicator -->
    <div v-if="remoteGame.isConnected" class="connection-indicator connected">🟢 已連線</div>
    <div v-else-if="remoteGame.error" class="connection-indicator error">🔴 {{ remoteGame.error }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import { useRemoteGameStore } from "@/stores/remoteGame";
import { isOnlineMode, getApiUrl, setApiUrl, apiPost, getSavedUser, type ApiUser } from "@/lib/api";
import { signInWithGoogle, signOut as googleSignOut } from "@/lib/googleAuth";

const puzzleSets = usePuzzleSetsStore();
const remoteGame = useRemoteGameStore();

const isOnline = computed(() => isOnlineMode());
const apiUrlInput = ref(getApiUrl());
const currentUser = ref<ApiUser | null>(getSavedUser());
const signingIn = ref(false);
const authError = ref("");
const selectedPuzzleId = ref("");
const joinRoomId = ref("");
const creating = ref(false);
const joining = ref(false);

const crosswordSets = computed(() =>
  puzzleSets.sets.filter((s) => s.type === "crossword")
);

const statusText = computed(() => {
  switch (remoteGame.room?.status) {
    case "waiting": return "等待中";
    case "playing": return "進行中";
    case "ended": return "已結束";
    default: return "";
  }
});

function saveApiUrl() {
  const url = apiUrlInput.value.trim().replace(/\/$/, "");
  if (url) {
    setApiUrl(url);
  }
}

async function handleGoogleSignIn() {
  signingIn.value = true;
  authError.value = "";
  try {
    const user = await signInWithGoogle();
    if (user) {
      currentUser.value = user;
    }
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "登入失敗";
  } finally {
    signingIn.value = false;
  }
}

function handleSignOut() {
  googleSignOut();
  currentUser.value = null;
  remoteGame.disconnect();
}

async function createRoom() {
  if (!currentUser.value || !selectedPuzzleId.value) return;
  creating.value = true;
  try {
    const result = await apiPost<{ id: string }>("/api/rooms", {
      puzzleId: selectedPuzzleId.value,
      hostId: currentUser.value.id,
    });
    remoteGame.joinRoom(result.id, currentUser.value.id, currentUser.value.displayName);
  } catch (error) {
    alert(error instanceof Error ? error.message : "建立房間失敗");
  } finally {
    creating.value = false;
  }
}

function joinRoom() {
  if (!currentUser.value || !joinRoomId.value.trim()) return;
  joining.value = true;
  try {
    remoteGame.joinRoom(joinRoomId.value.trim(), currentUser.value.id, currentUser.value.displayName);
  } finally {
    joining.value = false;
  }
}

function startGame() {
  if (!selectedPuzzleId.value && !remoteGame.room?.puzzleId) return;
  remoteGame.startGame(selectedPuzzleId.value || remoteGame.room?.puzzleId || "");
}

function leaveRoom() {
  remoteGame.disconnect();
}

function copyRoomId() {
  if (remoteGame.room?.id) {
    navigator.clipboard.writeText(remoteGame.room.id);
  }
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

onUnmounted(() => {
  // Don't disconnect on unmount - keep connection alive
});
</script>

<style scoped>
.notice { border-left: 4px solid #F59E0B; }
.notice h3 { margin-bottom: 0.5rem; }
.notice p { color: var(--text-muted, #8B8B8B); margin-bottom: 0.75rem; }

.api-config, .create-room-form, .join-room-form {
  display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;
}
.input-field {
  flex: 1; min-width: 200px; padding: 0.6rem 0.75rem;
  border: 2px solid var(--border, #F0E6D8); border-radius: 12px;
  font-size: 0.95rem; font-family: inherit;
  transition: border-color 0.2s;
}
.input-field:focus { border-color: var(--primary, #FF6B8A); outline: none; }

.auth-card { text-align: center; }
.auth-card h3 { margin-bottom: 0.5rem; }
.auth-card p { color: var(--text-muted, #8B8B8B); margin-bottom: 1rem; }
.google-btn { font-size: 1.1rem; padding: 0.75rem 2rem; }
.error-text { color: var(--danger, #F87171); margin-top: 0.5rem; font-size: 0.9rem; }

.user-card { display: flex; justify-content: space-between; align-items: center; }
.user-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar { width: 40px; height: 40px; border-radius: 50%; }
.muted { color: var(--text-muted, #8B8B8B); font-size: 0.9rem; }

.room-card .room-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.status-badge {
  padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 600;
}
.status-badge.waiting { background: #FEF3C7; color: #92400E; }
.status-badge.playing { background: #D1FAE5; color: #065F46; }
.status-badge.ended { background: #E5E7EB; color: #4B5563; }

.room-code {
  display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;
  background: #F9F5F0; padding: 0.5rem 0.75rem; border-radius: 8px;
}
.room-code code { font-size: 0.95rem; font-weight: 600; flex: 1; word-break: break-all; }
.btn-sm { padding: 0.35rem 0.75rem; font-size: 0.85rem; }

.member-list { list-style: none; padding: 0; margin-top: 0.5rem; }
.member-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.5rem 0; border-bottom: 1px solid var(--border, #F0E6D8);
}
.member-item:last-child { border-bottom: none; }
.member-score { font-weight: 600; color: var(--primary, #FF6B8A); }

.start-actions { margin-top: 1rem; text-align: center; }

.rankings-card { margin-top: 1rem; }
.ranking-list { list-style: none; padding: 0; counter-reset: rank; }
.ranking-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem; border-radius: 12px; margin-bottom: 0.5rem;
  background: #F9F5F0;
}
.ranking-item.gold { background: linear-gradient(135deg, #FEF3C7, #FDE68A); }
.ranking-item.silver { background: linear-gradient(135deg, #F3F4F6, #E5E7EB); }
.ranking-item.bronze { background: linear-gradient(135deg, #FED7AA, #FDBA74); }
.rank { font-size: 1.5rem; font-weight: 700; min-width: 2rem; text-align: center; }
.rank-name { flex: 1; font-weight: 600; }
.rank-score { font-weight: 700; color: var(--primary, #FF6B8A); }
.rank-time { color: var(--text-muted, #8B8B8B); font-size: 0.85rem; }

.connection-indicator {
  position: fixed; bottom: 1rem; right: 1rem;
  padding: 0.35rem 0.75rem; border-radius: 999px;
  font-size: 0.8rem; font-weight: 500;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
.connection-indicator.connected { background: #D1FAE5; color: #065F46; }
.connection-indicator.error { background: #FEE2E2; color: #991B1B; }
</style>
