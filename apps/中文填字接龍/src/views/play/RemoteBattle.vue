<template>
  <div class="page remote-simple">
    <nav class="nav-bar nav-bar-min">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
      <RouterLink v-if="currentUser?.role === 'teacher'" to="/play/remote/teacher" class="btn btn-secondary">
        教師開場
      </RouterLink>
    </nav>

    <h1 class="page-title page-title-tight">遠程對戰</h1>
    <p v-if="showStudentMinimalCopy" class="lead lead-one">
      登入後輸入教師給的<strong>活動碼</strong>即可開始。
    </p>
    <p v-else class="lead">
      登入後輸入教師提供的<strong>活動碼</strong>：<strong>6 位數字</strong>為計時競賽；其他格式為小組合作（需本機或學校已開通）。
    </p>

    <!-- 未登入：只做登入 -->
    <div v-if="!currentUser" class="card hero-card">
      <h2 class="card-title">{{ showStudentMinimalCopy ? "登入" : "步驟 1：登入" }}</h2>
      <p class="muted small-gap">
        {{ showStudentMinimalCopy ? "使用學校 Google 帳戶登入。" : "使用學校 Google 帳戶，或點頁面右上角的「Google 登入」。" }}
      </p>
      <button
        v-if="isGoogleLoginAvailable()"
        type="button"
        class="btn btn-primary btn-block btn-lg"
        :disabled="signingIn"
        @click="handleGoogleSignIn"
      >
        {{ signingIn ? "登入中…" : "使用 Google 登入" }}
      </button>
      <p v-if="authError" class="error-text">{{ authError }}</p>

      <details v-if="showAdvancedPanel" class="advanced">
        <summary>進階：本機示範／手動 API</summary>
        <div v-if="showApiUrlCard" class="advanced-inner">
          <p class="muted">API 網址：{{ apiUrlDisplay }}</p>
          <div class="row">
            <input v-model="apiUrlInput" type="url" placeholder="https://…" class="input-field" />
            <button type="button" class="btn btn-secondary" @click="saveApiUrl">儲存</button>
          </div>
        </div>
        <div class="advanced-inner demo-block">
          <input v-model="demoName" type="text" placeholder="顯示名稱" class="input-field" />
          <input v-model="demoEmail" type="email" placeholder="電郵" class="input-field" />
          <div class="row">
            <button type="button" class="btn btn-secondary" :disabled="signingIn" @click="handleDemoLogin">示範登入</button>
            <button type="button" class="btn btn-secondary" :disabled="signingIn" @click="oneClickDemoEnter">一鍵示範學生</button>
          </div>
        </div>
      </details>
    </div>

    <!-- 已登入：活動碼為主 -->
    <template v-else>
      <div class="card hero-card join-card">
        <div class="join-head">
          <div class="join-head-text">
            <h2 class="card-title join-title">{{ showStudentMinimalCopy ? "輸入活動碼" : "步驟 2：輸入活動碼" }}</h2>
            <p class="muted hint-tight">
              <template v-if="showStudentMinimalCopy">
                <strong>6 位數字</strong>＝競賽；教師若給較長的碼＝小組合作。
              </template>
              <template v-else>
                <strong>競賽碼</strong>：剛好 6 位數字。<br />
                <strong>合作碼</strong>：非純六位（本機示範可用房間 ID）。
              </template>
            </p>
          </div>
          <div class="user-chip">
            <span class="user-name">{{ currentUser.displayName }}</span>
            <button type="button" class="btn-text" @click="handleSignOut">登出</button>
          </div>
        </div>
        <div class="code-row">
          <input
            v-model="unifiedCodeInput"
            type="text"
            inputmode="text"
            autocomplete="one-time-code"
            maxlength="64"
            :placeholder="showStudentMinimalCopy ? '輸入 6 位數或其他活動碼' : '例如 123456 或合作碼'"
            class="input-field input-code"
            @keydown.enter.prevent="joinByUnifiedCode"
          />
          <button
            type="button"
            class="btn btn-primary btn-lg"
            :disabled="joining || !unifiedCodeInput.trim()"
            @click="joinByUnifiedCode"
          >
            {{ joining ? "進入中…" : "進入" }}
          </button>
        </div>
        <p v-if="joinError" class="error-text">{{ joinError }}</p>
      </div>

      <details v-if="showAdvancedPanel" class="advanced wide">
        <summary>更多：班級碼、場次與合作房列表</summary>
        <div class="advanced-inner">
          <h3 class="h3-adv">加入班級（選填）</h3>
          <p class="muted">若學校啟用班級 API，可輸入班級碼以顯示房間／場次捷徑。</p>
          <div class="row">
            <input v-model="classCodeInput" type="text" placeholder="班級碼" class="input-field" />
            <button type="button" class="btn btn-primary" :disabled="joiningClass" @click="joinClass">加入班級</button>
          </div>
          <p v-if="joinClassError" class="error-text">{{ joinClassError }}</p>
        </div>

        <div v-if="myClass" class="advanced-inner">
          <h3 class="h3-adv">小組合作房</h3>
          <div class="row">
            <input v-model="joinRoomId" type="text" placeholder="合作碼／房間 ID" class="input-field" />
            <button type="button" class="btn btn-secondary" :disabled="joining" @click="joinRoomByCode">加入合作房</button>
          </div>
          <div v-if="groupRooms.length" class="link-list">
            <RouterLink v-for="r in groupRooms" :key="r.id" :to="`/play/remote/room/${r.id}`" class="link-item">
              {{ r.puzzleTitle }} · {{ r.status === "playing" ? "進行中" : "等待中" }}
            </RouterLink>
          </div>
        </div>

        <div v-if="myClass" class="advanced-inner">
          <h3 class="h3-adv">班級競賽列表</h3>
          <div v-if="classSessions.length" class="link-list">
            <RouterLink v-for="s in classSessions" :key="s.id" :to="`/play/remote/session/${s.id}`" class="link-item">
              {{ s.puzzleTitle }} · {{ s.durationMinutes }} 分 · {{ s.status === "playing" ? "進行中" : "等待中" }}
            </RouterLink>
          </div>
          <p v-else class="muted">目前沒有列表中的場次，請直接用上方六位對戰碼加入。</p>
        </div>

        <div v-if="showApiUrlCard" class="advanced-inner">
          <h3 class="h3-adv">後端 API 網址</h3>
          <p class="muted">{{ apiUrlDisplay }}</p>
          <div class="row">
            <input v-model="apiUrlInput" type="url" class="input-field" />
            <button type="button" class="btn btn-secondary" @click="saveApiUrl">儲存</button>
          </div>
        </div>
      </details>
    </template>
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

/** 正式託管站：一般學生介面極簡；開發本機、教師仍可看進階 */
const isHostedProduction = computed(() => {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname;
  return h.endsWith("pages.dev") || h.includes("zykongjian");
});

const showAdvancedPanel = computed(() => {
  if (import.meta.env.DEV) return true;
  if (!isHostedProduction.value) return true;
  return currentUser.value?.role === "teacher";
});
/** 正式站一般學生：極簡文案與單卡動線（教師帳號仍看完整標籤） */
const showStudentMinimalCopy = computed(() => {
  if (import.meta.env.DEV) return false;
  if (!isHostedProduction.value) return false;
  if (!currentUser.value) return true;
  return currentUser.value.role !== "teacher";
});
const showApiUrlCard = computed(() => import.meta.env.DEV && !isZyAuthUser.value);

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
const unifiedCodeInput = ref("");
const joinError = ref("");

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
              ? "登入逾時，請檢查後端是否已啟動，或重新整理後再試。"
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
    authError.value = "請先在「進階」設定後端 API 網址，或使用右上角平台登入。";
    return;
  }
  signingIn.value = true;
  authError.value = "";
  const timeoutMs = 90000;
  try {
    const user = await Promise.race([
      signInWithGoogle(),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error("登入逾時，請重試。")), timeoutMs),
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
  if (isOnlineMode()) {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
  }
  googleSignOut();
  clearAuth();
  currentUser.value = null;
  isZyAuthUser.value = false;
  joinError.value = "";
  unifiedCodeInput.value = "";
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
      } else joinClassError.value = "班級碼錯誤或後端尚未開通此功能。";
    } else {
      const result = backend.joinClass(currentUser.value.id, currentUser.value.email, classCodeInput.value.trim());
      if (!result) joinClassError.value = "班級碼錯誤或不存在。";
    }
  } finally {
    joiningClass.value = false;
  }
}

async function joinRoomByCode() {
  if (!currentUser.value || !joinRoomId.value.trim()) return;
  joinError.value = "";
  joining.value = true;
  try {
    if (isRemoteApiAvailable()) {
      const room = await apiJoinRoom(joinRoomId.value.trim());
      if (room) router.push(`/play/remote/room/${room.id}`);
      else joinError.value = "找不到房間。雲端站目前僅支援「六位數」競賽碼；小組房間請使用本機後端。";
    } else {
      const room = backend.joinRoom(joinRoomId.value.trim(), currentUser.value.id, currentUser.value.displayName, currentUser.value.email);
      if (room) router.push(`/play/remote/room/${room.id}`);
      else joinError.value = "房間碼錯誤或房間已關閉。";
    }
  } finally {
    joining.value = false;
  }
}

/** 六位數 → 競賽場次；否則 → 房間（本機或日後 API） */
async function joinByUnifiedCode() {
  if (!currentUser.value) return;
  const raw = unifiedCodeInput.value.trim();
  if (!raw) return;
  joinError.value = "";
  joining.value = true;
  try {
    const digitsOnly = raw.replace(/\D/g, "");
    const isSixDigitCompetition = digitsOnly.length === 6 && /^\d{6}$/.test(digitsOnly);

    if (isSixDigitCompetition) {
      if (!isRemoteApiAvailable()) {
        joinError.value = "未連線後端時，請用本機示範並由教師頁建立場次。";
        return;
      }
      const sess = await apiJoinSessionByCode(digitsOnly);
      if (sess && typeof sess === "object" && "id" in sess && typeof (sess as { id: string }).id === "string") {
        router.push(`/play/remote/session/${(sess as { id: string }).id}`);
        return;
      }
      joinError.value = "找不到此競賽碼，或場次已開始／已結束。請向教師確認六位數字。";
      return;
    }

    if (isRemoteApiAvailable()) {
      const room = await apiJoinRoom(raw);
      if (room) {
        router.push(`/play/remote/room/${room.id}`);
        return;
      }
      joinError.value =
        "此碼不是有效的房間。在 zykongjian.pages.dev 上請使用教師提供的「六位數競賽碼」。小組合作房間需本機伺服器。";
      return;
    }

    const room = backend.joinRoom(raw, currentUser.value.id, currentUser.value.displayName, currentUser.value.email);
    if (room) {
      router.push(`/play/remote/room/${room.id}`);
      return;
    }
    joinError.value = "找不到房間或無法加入。";
  } finally {
    joining.value = false;
  }
}

watch(currentUser, (u) => {
  if (!u) joinClassError.value = "";
}, { immediate: true });
</script>

<style scoped>
.remote-simple { max-width: 520px; margin: 0 auto; }
.nav-bar-min { flex-wrap: wrap; gap: 0.35rem; }
.page-title-tight { margin-bottom: 0.35rem; }
.lead {
  color: var(--text-muted, #6b6b6b);
  font-size: 0.95rem;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}
.lead-one { margin-bottom: 1rem; }
.hero-card { margin-bottom: 1rem; }
.card-title {
  font-size: 1.15rem;
  margin: 0 0 0.5rem;
  font-family: var(--font-heading, inherit);
}
.small-gap { margin-bottom: 1rem; }
.btn-block { width: 100%; justify-content: center; }
.btn-lg { padding: 0.75rem 1.25rem; font-size: 1.05rem; }
.join-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}
.join-head-text { flex: 1; min-width: 0; }
.join-title { margin-bottom: 0.25rem !important; }
.hint-tight { margin-bottom: 0 !important; font-size: 0.85rem; line-height: 1.45; }
.user-chip {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.2rem;
  flex-shrink: 0;
  max-width: 42%;
  text-align: right;
}
.user-name { font-weight: 600; font-size: 0.9rem; line-height: 1.25; word-break: break-all; }
.btn-text {
  border: none;
  background: none;
  color: var(--text-muted, #888);
  font-size: 0.8rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}
.btn-text:hover { color: var(--primary, #ff6b8a); }
.btn-sm { font-size: 0.85rem; padding: 0.35rem 0.65rem; }
.join-card { border: 2px solid var(--primary, #ff6b8a); box-shadow: 0 4px 20px rgba(255, 107, 138, 0.12); }
.code-row {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}
@media (min-width: 480px) {
  .code-row {
    flex-direction: row;
    align-items: stretch;
  }
  .code-row .input-code { flex: 1; min-width: 0; }
  .code-row .btn-lg { flex-shrink: 0; }
}
.input-field {
  padding: 0.65rem 0.85rem;
  border: 2px solid var(--border, #f0e6d8);
  border-radius: 12px;
  font-size: 1rem;
}
.input-field:focus {
  border-color: var(--primary, #ff6b8a);
  outline: none;
}
.input-code {
  font-size: 1.35rem;
  letter-spacing: 0.12em;
  font-weight: 600;
  text-align: center;
}
.row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
  margin-top: 0.35rem;
}
.row .input-field { flex: 1; min-width: 160px; }
.muted { color: var(--text-muted, #8b8b8b); font-size: 0.9rem; }
.error-text { color: var(--danger, #f87171); margin-top: 0.65rem; font-size: 0.9rem; }
.advanced {
  margin-top: 1rem;
  border: 1px dashed var(--border, #e5d5c3);
  border-radius: 12px;
  padding: 0.5rem 0.75rem;
  background: #faf8f5;
}
.advanced.wide { max-width: 100%; }
.advanced summary {
  cursor: pointer;
  font-weight: 600;
  color: var(--text-muted, #666);
  font-size: 0.9rem;
}
.advanced-inner { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border, #eee); }
.advanced-inner:first-of-type { border-top: none; padding-top: 0; }
.demo-block .input-field { width: 100%; margin-bottom: 0.5rem; }
.h3-adv { font-size: 1rem; margin: 0 0 0.35rem; }
.link-list { display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.5rem; }
.link-item {
  padding: 0.5rem 0.65rem;
  background: #fff;
  border-radius: 10px;
  text-decoration: none;
  color: inherit;
  border: 1px solid var(--border, #f0e6d8);
}
.link-item:hover { background: #fff5f7; }
</style>
