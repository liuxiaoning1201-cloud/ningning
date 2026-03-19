<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
      <RouterLink v-if="currentUser?.role === 'teacher'" to="/play/remote/teacher" class="btn btn-secondary">教師後台</RouterLink>
    </nav>

    <h1 class="page-title" style="font-family: var(--font-heading)">🌐 遠程對戰</h1>

    <div class="card notice animate-fade-in">
      <h3>說明</h3>
      <p>與同學即時協作填字，或參加班級計時競賽。可設定本機示範或連線至學校部署的 API。</p>
      <p class="muted">學生帳號須為 <code>@student.isf.edu.hk</code>；教師由管理員加入白名單；其他訪客仍可練習模式遊玩。</p>
    </div>

    <div v-if="!isZyAuthUser" class="card animate-fade-in" style="animation-delay: 0.05s">
      <h3>後端 API</h3>
      <p class="muted">目前：<strong>{{ apiUrlDisplay }}</strong></p>
      <div class="api-config">
        <input v-model="apiUrlInput" type="url" placeholder="https://…" class="input-field" />
        <button type="button" class="btn btn-secondary" @click="saveApiUrl">儲存網址</button>
      </div>
      <p class="muted" style="margin-top: 0.5rem">正式站若使用右上角平台登入，通常不必改此欄位。</p>
    </div>

    <div v-if="!currentUser" class="card auth-card animate-fade-in" style="animation-delay: 0.08s">
      <h3>登入</h3>
      <p>請使用下方「示範登入」、Google，或右上角平台帳戶。</p>
      <div class="demo-form">
        <input v-model="demoName" type="text" placeholder="顯示名稱" class="input-field" />
        <input v-model="demoEmail" type="email" placeholder="電郵" class="input-field" />
        <button type="button" class="btn btn-primary" :disabled="signingIn" @click="handleDemoLogin">示範登入（後端）</button>
        <button
          v-if="isGoogleLoginAvailable()"
          type="button"
          class="btn btn-secondary google-btn"
          :disabled="signingIn"
          @click="handleGoogleSignIn"
        >
          {{ signingIn ? "登入中…" : "Google 登入" }}
        </button>
        <button type="button" class="btn btn-secondary" :disabled="signingIn" @click="oneClickDemoEnter">一鍵示範學生</button>
      </div>
      <p v-if="authError" class="error-text">{{ authError }}</p>
    </div>

    <div v-else class="card user-card animate-fade-in">
      <div class="user-info">
        <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" alt="" class="avatar" />
        <div>
          <strong>{{ currentUser.displayName }}</strong>
          <span v-if="currentUser.role" class="student-badge">{{ roleLabel(currentUser.role) }}</span>
          <div class="muted">{{ currentUser.email }}</div>
        </div>
      </div>
      <button type="button" class="btn btn-secondary" @click="handleSignOut">登出</button>
    </div>

    <template v-if="currentUser">
      <div class="card animate-fade-in" style="animation-delay: 0.1s">
        <h3>🏆 加入競賽場次（六位數碼）</h3>
        <p class="muted">向教師索取場次碼，登入後在此輸入即可加入計時競賽。</p>
        <div class="join-form">
          <input
            v-model="sessionCodeInput"
            type="text"
            inputmode="numeric"
            maxlength="8"
            placeholder="例如 123456"
            class="input-field"
            style="max-width: 10rem; letter-spacing: 0.15em"
          />
          <button type="button" class="btn btn-primary" :disabled="joiningSession || !sessionCodeInput.trim()" @click="joinSessionByCode">
            {{ joiningSession ? "加入中…" : "加入場次" }}
          </button>
        </div>
      </div>

      <div class="card animate-fade-in" style="animation-delay: 0.12s">
        <h3>📚 加入班級（選填）</h3>
        <p class="muted">若學校啟用班級 API，輸入班級碼後可看到房間與場次列表。</p>
        <div class="join-form">
          <input v-model="classCodeInput" type="text" placeholder="班級碼" class="input-field" />
          <button type="button" class="btn btn-primary" :disabled="joiningClass" @click="joinClass">加入班級</button>
        </div>
        <p v-if="joinClassError" class="error-text">{{ joinClassError }}</p>
      </div>

      <div v-if="myClass" class="card animate-fade-in" style="animation-delay: 0.14s">
        <h3>🤝 小組合作房間</h3>
        <p class="muted">由教師建立房間後，輸入房間碼加入。</p>
        <div class="join-form">
          <input v-model="joinRoomId" type="text" placeholder="房間碼" class="input-field" />
          <button type="button" class="btn btn-primary" :disabled="joining" @click="joinRoomByCode">加入房間</button>
        </div>
        <div v-if="groupRooms.length" class="room-list">
          <RouterLink v-for="r in groupRooms" :key="r.id" :to="`/play/remote/room/${r.id}`" class="room-item">
            <span>{{ r.puzzleTitle }}</span>
            <span class="status-dot" :class="{ playing: r.status === 'playing' }">{{ r.status === "playing" ? "進行中" : "等待中" }}</span>
          </RouterLink>
        </div>
      </div>

      <div v-if="myClass" class="card animate-fade-in" style="animation-delay: 0.16s">
        <h3>🏁 班級競賽列表</h3>
        <p class="muted">已加入班級時，由此進入教師發起的場次。</p>
        <div v-if="classSessions.length" class="session-list">
          <RouterLink v-for="s in classSessions" :key="s.id" :to="`/play/remote/session/${s.id}`" class="session-item">
            <span>{{ s.puzzleTitle }}</span>
            <span class="session-meta">{{ s.durationMinutes }} 分 · {{ s.status === "playing" ? "進行中" : "等待中" }}</span>
          </RouterLink>
        </div>
        <p v-else class="muted">目前沒有可加入的場次（或後端尚未啟用班級 API）。請使用上方「六位數碼」加入。</p>
      </div>
    </template>

    <p class="muted" style="margin-top: 1rem; text-align: center">需要浮動登入時，請使用頁面角落的平台按鈕。</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  isOnlineMode,
  getApiUrl,
  setApiUrl,
  getSavedUser,
  saveUser,
  setJwt,
  clearAuth,
  fetchAuthMe,
  type ApiUser,
  type ApiUserRole,
} from "@/lib/api";
import { signInWithGoogle, signOut as googleSignOut, isGoogleLoginAvailable } from "@/lib/googleAuth";
import { useRemoteBackendStore } from "@/stores/remoteBackend";
import {
  isRemoteApiAvailable,
  authDemo,
  getMyClassAndGroups,
  joinClass as apiJoinClass,
  getRoomsForClass,
  getSessionsForClass,
  joinRoom as apiJoinRoom,
  joinSessionByCode as apiJoinSessionByCode,
} from "@/lib/remoteApi";

const router = useRouter();
const backend = useRemoteBackendStore();

const isZyAuthUser = ref(false);

const isOnline = computed(() => isOnlineMode());
const apiUrlInput = ref(getApiUrl());
const apiUrlDisplay = computed(() => getApiUrl() || "未設定（本機示範）");
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
const sessionCodeInput = ref("");
const joiningSession = ref(false);

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
    (r) => r.classId === myClass.value!.id && groupIds.includes(r.groupId) && (r.status === "waiting" || r.status === "playing"),
  );
});

const classSessions = computed(() => {
  if (!myClass.value) return [];
  if (isRemoteApiAvailable()) return apiSessionsRef.value;
  return backend.getSessionsByClassId(myClass.value.id).filter((s) => s.status === "waiting" || s.status === "playing");
});

function roleLabel(r: ApiUserRole): string {
  if (r === "teacher") return "教師";
  if (r === "student") return "學生";
  return "訪客";
}

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

async function syncFromZYAuth() {
  const zy = (window as unknown as { ZYAuth?: { user: { id: string; email: string; name: string; avatarUrl?: string } | null } }).ZYAuth;
  if (zy?.user) {
    currentUser.value = {
      id: zy.user.id,
      email: zy.user.email,
      displayName: zy.user.name,
      avatarUrl: zy.user.avatarUrl ?? undefined,
    };
    isZyAuthUser.value = true;
    const me = await fetchAuthMe();
    if (me) {
      currentUser.value = { ...currentUser.value, ...me, avatarUrl: currentUser.value.avatarUrl ?? me.avatarUrl };
      saveUser(currentUser.value);
    }
  }
}

onMounted(() => {
  signingIn.value = false;
  apiUrlInput.value = getApiUrl();
  currentUser.value = getSavedUser();

  const zy = (window as unknown as {
    ZYAuth?: {
      ready: Promise<unknown>;
      user: unknown;
      onLogin: (cb: () => void) => void;
      onLogout: (cb: () => void) => void;
    };
  }).ZYAuth;
  if (zy) {
    void zy.ready.then(() => {
      void syncFromZYAuth();
    });
    zy.onLogin(() => {
      void syncFromZYAuth();
    });
    zy.onLogout(() => {
      currentUser.value = null;
      isZyAuthUser.value = false;
      clearAuth();
    });
  }

  void loadApiData();
});

function saveApiUrl() {
  const url = apiUrlInput.value.trim().replace(/\/$/, "");
  if (url) setApiUrl(url);
}

const DEMO_LOGIN_TIMEOUT_MS = 6000;

async function oneClickDemoEnter() {
  authError.value = "";
  signingIn.value = true;
  const demoUser: ApiUser = {
    id: "demo",
    displayName: "示範學生",
    email: "demo@student.isf.edu.hk",
  };
  try {
    if (isRemoteApiAvailable()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEMO_LOGIN_TIMEOUT_MS);
      try {
        const result = await authDemo(demoUser.displayName, demoUser.email, controller.signal);
        clearTimeout(timeoutId);
        setJwt(result.token);
        saveUser(result.user);
        currentUser.value = result.user;
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error && e.name === "AbortError") {
          authError.value = "後端連線逾時，已改為本機示範登入。";
          saveUser(demoUser);
          currentUser.value = demoUser;
        } else {
          authError.value = e instanceof Error ? e.message : "登入失敗";
        }
      }
    } else {
      saveUser(demoUser);
      currentUser.value = demoUser;
    }
  } finally {
    signingIn.value = false;
  }
}

async function handleDemoLogin() {
  authError.value = "";
  const name = demoName.value.trim();
  const email = demoEmail.value.trim();
  if (!name || !email) return;
  signingIn.value = true;
  try {
    if (isRemoteApiAvailable()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEMO_LOGIN_TIMEOUT_MS);
      try {
        const result = await authDemo(name, email, controller.signal);
        clearTimeout(timeoutId);
        setJwt(result.token);
        saveUser(result.user);
        currentUser.value = result.user;
      } catch (e) {
        clearTimeout(timeoutId);
        if (e instanceof Error) {
          authError.value =
            e.name === "AbortError"
              ? "登入逾時，請檢查後端是否已啟動，或重新整理後使用「一鍵進入（示範）」"
              : e.message;
        } else {
          authError.value = "登入失敗";
        }
      }
    } else {
      const user: ApiUser = { id: email, email, displayName: name };
      saveUser(user);
      currentUser.value = user;
    }
  } finally {
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
  const timeoutMs = 90000;
  try {
    const user = await Promise.race([
      signInWithGoogle(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("登入逾時，請重試。若曾出現 Google 視窗請關閉後再按一次登入。")), timeoutMs),
      ),
    ]);
    if (user) currentUser.value = user;
  } catch (error) {
    authError.value = error instanceof Error ? error.message : "登入失敗";
  } finally {
    signingIn.value = false;
  }
}

async function handleSignOut() {
  if (isOnline.value) {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
  }
  googleSignOut();
  clearAuth();
  currentUser.value = null;
  isZyAuthUser.value = false;
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

async function joinSessionByCode() {
  if (!currentUser.value || !sessionCodeInput.value.trim()) return;
  if (!isRemoteApiAvailable()) {
    alert("請先設定並連線至後端 API，或使用本機示範時由教師頁建立場次後從列表進入。");
    return;
  }
  joiningSession.value = true;
  try {
    const sess = await apiJoinSessionByCode(sessionCodeInput.value.trim());
    if (sess && typeof sess === "object" && "id" in sess && typeof (sess as { id: string }).id === "string") {
      router.push(`/play/remote/session/${(sess as { id: string }).id}`);
    } else {
      alert("場次碼錯誤、場次已開始或已結束，或無法加入。請確認已登入。");
    }
  } finally {
    joiningSession.value = false;
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
.api-config .input-field { flex: 1; min-width: 200px; }
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
