<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading, 'LXGW WenKai TC', cursive)">🌐 遠程對戰</h1>

    <!-- 無 API：示範模式 -->
    <div v-if="!isOnline" class="card notice animate-fade-in">
      <h3>📡 示範模式（無需伺服器）</h3>
      <p class="muted">未設定 API URL 時使用本機模擬，可體驗班級碼、小組合作與班級競賽流程。</p>
      <div class="api-config" style="margin-top: 0.75rem">
        <input v-model="apiUrlInput" type="text" placeholder="或輸入 API URL 連接真實後端" class="input-field" />
        <button class="btn btn-primary" @click="saveApiUrl">連接</button>
      </div>
      <RouterLink to="/settings" class="btn btn-secondary" style="margin-top: 0.5rem">前往設定 →</RouterLink>
    </div>

    <!-- 未登入 -->
    <template v-if="!currentUser">
      <div class="card auth-card animate-fade-in">
        <h3>🔐 登入</h3>
        <p class="muted">輸入顯示名稱與電郵（學生請使用 <code>xxxxxxx@student.isf.edu.hk</code>）</p>
        <div class="demo-form">
          <input v-model="demoName" type="text" placeholder="顯示名稱" class="input-field" />
          <input v-model="demoEmail" type="email" placeholder="電郵" class="input-field" />
          <button class="btn btn-primary" :disabled="!demoName.trim() || !demoEmail.trim() || signingIn" @click="handleDemoLogin">
            {{ signingIn ? "登入中..." : "進入" }}
          </button>
        </div>
        <p v-if="isGoogleLoginAvailable()" class="muted" style="margin-top: 0.5rem">或使用 Google 登入（{{ isOnline ? '需後端支援' : '請先設定後端 API 網址' }}）：</p>
        <button v-if="isGoogleLoginAvailable()" class="btn btn-secondary" style="margin-top: 0.35rem" :disabled="signingIn" @click="handleGoogleSignIn">
          🔑 Google 登入
        </button>
        <p v-if="authError" class="error-text">{{ authError }}</p>
      </div>
    </template>

    <!-- 已登入 -->
    <template v-else>
      <div class="card user-card animate-fade-in">
        <div class="user-info">
          <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" class="avatar" alt="" />
          <div>
            <strong>{{ currentUser.displayName }}</strong>
            <p class="muted">
              {{ currentUser.email }}
              <span v-if="isStudentEmail(currentUser.email)" class="student-badge">學生</span>
            </p>
          </div>
        </div>
        <button class="btn btn-secondary" @click="handleSignOut">登出</button>
      </div>

      <!-- 教師入口（非學生電郵） -->
      <div v-if="!isStudentEmail(currentUser.email)" class="card animate-fade-in" style="animation-delay: 0.05s">
        <RouterLink to="/play/remote/teacher" class="btn btn-primary" style="display: inline-block">
          👩‍🏫 教師後台（班級／小組／發起活動）
        </RouterLink>
      </div>

      <!-- 未加入班級：輸入班級碼 -->
      <div v-if="!myClass" class="card animate-fade-in" style="animation-delay: 0.1s">
        <h3>📌 加入班級</h3>
        <p class="muted">輸入教師提供的班級碼加入班級，即可參加小組合作與班級競賽。</p>
        <div class="join-form">
          <input v-model="classCodeInput" type="text" placeholder="班級碼" class="input-field" maxlength="12" />
          <button class="btn btn-primary" :disabled="!classCodeInput.trim() || joiningClass" @click="joinClass">
            {{ joiningClass ? "加入中..." : "加入班級" }}
          </button>
        </div>
        <p v-if="joinClassError" class="error-text">{{ joinClassError }}</p>
      </div>

      <!-- 已加入班級：顯示班級與模式選擇 -->
      <template v-else>
        <div class="card animate-fade-in" style="animation-delay: 0.1s">
          <h3>📚 {{ myClass.name }}</h3>
          <p class="muted">班級碼：<code>{{ myClass.code }}</code></p>
          <div v-if="myGroups.length > 0" class="my-groups">
            <span class="muted">我的小組：</span>
            <span v-for="g in myGroups" :key="g.id" class="group-tag">{{ g.name }}</span>
          </div>
        </div>

        <!-- 小組合作 -->
        <div class="card animate-fade-in" style="animation-delay: 0.15s">
          <h3>🤝 小組合作</h3>
          <p class="muted">共用一張填字圖，與組員即時協作。</p>
          <div class="join-form">
            <input v-model="joinRoomId" type="text" placeholder="輸入房間碼加入" class="input-field" />
            <button class="btn btn-primary" :disabled="!joinRoomId.trim() || joining" @click="joinRoomByCode">
              {{ joining ? "加入中..." : "加入房間" }}
            </button>
          </div>
          <div v-if="groupRooms.length > 0" class="room-list">
            <p class="muted" style="margin-bottom: 0.5rem">我的小組進行中房間：</p>
            <RouterLink
              v-for="r in groupRooms"
              :key="r.id"
              :to="`/play/remote/room/${r.id}`"
              class="room-item"
            >
              <span>{{ r.puzzleTitle }}</span>
              <span class="status-dot" :class="r.status">{{ r.status === "playing" ? "進行中" : "等待中" }}</span>
            </RouterLink>
          </div>
        </div>

        <!-- 班級競賽 -->
        <div class="card animate-fade-in" style="animation-delay: 0.2s">
          <h3>🏆 班級競賽</h3>
          <p class="muted">同一時間作答，以正確數量與時間排名。</p>
          <div v-if="classSessions.length > 0" class="session-list">
            <RouterLink
              v-for="s in classSessions"
              :key="s.id"
              :to="`/play/remote/session/${s.id}`"
              class="session-item"
            >
              <span>{{ s.puzzleTitle }}</span>
              <span class="session-meta">{{ s.durationMinutes }} 分鐘 · {{ s.status === "playing" ? "進行中" : "等待中" }}</span>
            </RouterLink>
          </div>
          <p v-else class="muted">尚無進行中或等待中的競賽場次，請等候教師發起。</p>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import { isOnlineMode, getApiUrl, setApiUrl, getSavedUser, saveUser, setJwt, type ApiUser } from "@/lib/api";
import { signInWithGoogle, signOut as googleSignOut, isGoogleLoginAvailable } from "@/lib/googleAuth";
import { isStudentEmail } from "@/lib/remoteBattle";
import { useRemoteBackendStore } from "@/stores/remoteBackend";
import {
  isRemoteApiAvailable,
  authDemo,
  getMyClassAndGroups,
  joinClass as apiJoinClass,
  getRoomsForClass,
  getSessionsForClass,
  joinRoom as apiJoinRoom,
} from "@/lib/remoteApi";

const router = useRouter();
const backend = useRemoteBackendStore();

const isOnline = computed(() => isOnlineMode());
const apiUrlInput = ref(getApiUrl());
const currentUser = ref<ApiUser | null>(getSavedUser());
const signingIn = ref(false);
const authError = ref("");
const demoName = ref("");
const demoEmail = ref("");
const classCodeInput = ref("");
const joinClassError = ref("");
const joiningClass = ref(false);
const joinRoomId = ref("");
const joining = ref(false);

const apiClassRef = ref<{ class: { id: string; name: string; code: string }; groups: { id: string; name: string }[] } | null>(null);
const apiRoomsRef = ref<{ id: string; puzzleTitle: string; status: string }[]>([]);
const apiSessionsRef = ref<{ id: string; puzzleTitle: string; status: string; durationMinutes: number }[]>([]);

const myClass = computed(() => {
  if (!currentUser.value) return null;
  if (isRemoteApiAvailable()) return apiClassRef.value?.class ?? null;
  return backend.getMyClass(currentUser.value.id);
});

const myGroups = computed(() => {
  if (!currentUser.value) return [];
  if (isRemoteApiAvailable()) return apiClassRef.value?.groups ?? [];
  return backend.getMyGroups(currentUser.value.id, currentUser.value.email);
});

const groupRooms = computed(() => {
  if (!myClass.value) return [];
  if (isRemoteApiAvailable()) return apiRoomsRef.value;
  const groupIds = myGroups.value.map((g) => g.id);
  return backend.rooms.filter(
    (r) => r.classId === myClass.value!.id && groupIds.includes(r.groupId) && (r.status === "waiting" || r.status === "playing")
  );
});

const classSessions = computed(() => {
  if (!myClass.value) return [];
  if (isRemoteApiAvailable()) return apiSessionsRef.value;
  return backend.getSessionsByClassId(myClass.value.id).filter((s) => s.status === "waiting" || s.status === "playing");
});

async function loadApiData() {
  if (!isRemoteApiAvailable() || !currentUser.value) return;
  const r = await getMyClassAndGroups();
  apiClassRef.value = r;
  if (r?.class) {
    apiRoomsRef.value = await getRoomsForClass(r.class.id);
    apiSessionsRef.value = await getSessionsForClass(r.class.id);
  } else {
    apiRoomsRef.value = [];
    apiSessionsRef.value = [];
  }
}

watch(currentUser, () => loadApiData(), { immediate: true });

onMounted(() => {
  signingIn.value = false; // 進入頁面時清除可能卡住的「登入中」狀態
  loadApiData();
});

function saveApiUrl() {
  const url = apiUrlInput.value.trim().replace(/\/$/, "");
  if (url) setApiUrl(url);
}

const DEMO_LOGIN_TIMEOUT_MS = 8000; // 8 秒逾時，並用 AbortController 中止請求，避免一直卡在「登入中」

async function handleDemoLogin() {
  authError.value = "";
  const name = demoName.value.trim();
  const email = demoEmail.value.trim();
  if (!name || !email) return;
  signingIn.value = true;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEMO_LOGIN_TIMEOUT_MS);
  try {
    if (isRemoteApiAvailable()) {
      const result = await authDemo(name, email, controller.signal);
      setJwt(result.token);
      saveUser(result.user);
      currentUser.value = result.user;
    } else {
      const user: ApiUser = { id: email, email, displayName: name };
      saveUser(user);
      currentUser.value = user;
    }
  } catch (e) {
    if (e instanceof Error) {
      authError.value = e.name === "AbortError"
        ? "連線逾時，請確認後端已啟動（在專案目錄執行 npm run server）"
        : e.message;
    } else {
      authError.value = "登入失敗";
    }
  } finally {
    clearTimeout(timeoutId);
    signingIn.value = false;
  }
}

async function handleGoogleSignIn() {
  if (!isRemoteApiAvailable()) {
    authError.value = "請先設定後端 API 網址（上方輸入或前往設定頁），後端需支援 Google 登入。";
    return;
  }
  signingIn.value = true;
  authError.value = "";
  const timeoutMs = 90000; // 90 秒逾時，避免一直卡在「登入中」
  try {
    const user = await Promise.race([
      signInWithGoogle(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("登入逾時，請重試。若曾出現 Google 視窗請關閉後再按一次登入。")), timeoutMs)
      ),
    ]);
    if (user) currentUser.value = user;
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "登入失敗";
  } finally {
    signingIn.value = false;
  }
}

function handleSignOut() {
  googleSignOut();
  currentUser.value = null;
}

async function joinClass() {
  if (!currentUser.value || !classCodeInput.value.trim()) return;
  joinClassError.value = "";
  joiningClass.value = true;
  try {
    if (isRemoteApiAvailable()) {
      const result = await apiJoinClass(classCodeInput.value.trim());
      if (result && result.class && typeof (result.class as { id: string }).id === "string") {
        apiClassRef.value = result as { class: { id: string; name: string; code: string }; groups: { id: string; name: string }[] };
        apiRoomsRef.value = await getRoomsForClass((result.class as { id: string }).id);
        apiSessionsRef.value = await getSessionsForClass((result.class as { id: string }).id);
      } else joinClassError.value = "班級碼錯誤或不存在，請確認後再試。";
    } else {
      const result = backend.joinClass(currentUser.value.id, currentUser.value.email, classCodeInput.value.trim());
      if (!result) joinClassError.value = "班級碼錯誤或不存在，請確認後再試。";
    }
  } finally {
    joiningClass.value = false;
  }
}

async function joinRoomByCode() {
  if (!currentUser.value || !joinRoomId.value.trim()) return;
  joining.value = true;
  try {
    if (isRemoteApiAvailable()) {
      const room = await apiJoinRoom(joinRoomId.value.trim());
      if (room) router.push(`/play/remote/room/${room.id}`);
      else alert("房間碼錯誤或房間已開始/結束，無法加入。");
    } else {
      const room = backend.joinRoom(joinRoomId.value.trim(), currentUser.value.id, currentUser.value.displayName, currentUser.value.email);
      if (room) router.push(`/play/remote/room/${room.id}`);
      else alert("房間碼錯誤或房間已開始/結束，無法加入。");
    }
  } finally {
    joining.value = false;
  }
}

watch(currentUser, (u) => {
  if (!u) joinClassError.value = "";
}, { immediate: true });
</script>

<style scoped>
.notice { border-left: 4px solid #F59E0B; }
.notice h3 { margin-bottom: 0.5rem; }
.notice p { margin-bottom: 0.5rem; }

.api-config, .join-form, .demo-form { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem; }
.input-field { flex: 1; min-width: 160px; padding: 0.6rem 0.75rem; border: 2px solid var(--border, #F0E6D8); border-radius: 12px; font-size: 0.95rem; }
.input-field:focus { border-color: var(--primary, #FF6B8A); outline: none; }

.auth-card { text-align: center; }
.auth-card h3 { margin-bottom: 0.5rem; }
.auth-card p { margin-bottom: 0.75rem; }
.demo-form { flex-direction: column; align-items: stretch; }
.google-btn { font-size: 1.1rem; padding: 0.75rem 2rem; }
.error-text { color: var(--danger, #F87171); margin-top: 0.5rem; font-size: 0.9rem; }

.user-card { display: flex; justify-content: space-between; align-items: center; }
.user-info { display: flex; align-items: center; gap: 0.75rem; }
.avatar { width: 40px; height: 40px; border-radius: 50%; }
.muted { color: var(--text-muted, #8B8B8B); font-size: 0.9rem; }

.my-groups { margin-top: 0.5rem; display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem; }
.group-tag { display: inline-block; padding: 0.2rem 0.6rem; background: #EFF6FF; color: #1D4ED8; border-radius: 999px; font-size: 0.85rem; }

.room-list, .session-list { margin-top: 0.75rem; }
.room-item, .session-item {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.6rem 0.75rem; margin-bottom: 0.35rem;
  background: #F9F5F0; border-radius: 10px; text-decoration: none; color: inherit;
  transition: background 0.2s;
}
.room-item:hover, .session-item:hover { background: #FFF0F3; }
.status-dot { font-size: 0.8rem; color: var(--text-muted); }
.status-dot.playing { color: #059669; font-weight: 600; }
.session-meta { font-size: 0.85rem; color: var(--text-muted); }

.student-badge {
  display: inline-block; margin-left: 0.5rem; padding: 0.15rem 0.5rem; font-size: 0.75rem; font-weight: 600;
  color: #065F46; background: #D1FAE5; border-radius: 999px;
}
.auth-card code { font-size: 0.85em; background: #F3F4F6; padding: 0.1rem 0.3rem; border-radius: 4px; }
</style>
