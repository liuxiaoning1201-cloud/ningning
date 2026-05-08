<template>
  <div class="page room-page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-ghost">← 返回首頁</RouterLink>
    </nav>

    <header class="hero">
      <div class="hero-icon">🌐</div>
      <h1 class="hero-title">遠程對戰</h1>
      <p class="hero-subtitle">建立房間或輸入六位數房號加入</p>
    </header>

    <div v-if="!apiConfigured" class="api-warn card">
      <div class="api-warn-icon">⚠️</div>
      <div>
        <strong>尚未設定後端 Worker</strong>
        <p class="muted">遠程對戰需要部署 <code>workers/zizi-zhuji</code> 並在首頁右下角的「⚙️ 設定 API」填入網址。</p>
      </div>
    </div>

    <div class="tabs">
      <button class="tab-pill" :class="{ active: tab === 'create' }" @click="tab = 'create'">📡 建立房間</button>
      <button class="tab-pill" :class="{ active: tab === 'join' }" @click="tab = 'join'">🔑 加入房間</button>
    </div>

    <!-- 建立房間 -->
    <section v-if="tab === 'create'" class="card create-card">
      <h2 class="card-title">選擇模板</h2>
      <p class="muted">從 6 個內建模板挑一個，房間建立後分享 6 位數房號邀請對手。</p>

      <div class="template-list">
        <button
          v-for="t in templates"
          :key="t.id"
          class="tpl-row"
          :class="{ active: selectedTemplateId === t.id }"
          @click="selectedTemplateId = t.id"
        >
          <span class="tpl-row-emoji">{{ t.emoji }}</span>
          <div class="tpl-row-info">
            <strong>{{ t.name }}</strong>
            <span class="muted">{{ t.description }}</span>
          </div>
        </button>
      </div>

      <div class="form-row">
        <label>玩家暱稱</label>
        <input v-model="hostName" type="text" placeholder="您的暱稱" />
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="creating || !selectedTemplateId" @click="onCreate">
          {{ creating ? "建立中…" : "建立房間" }}
        </button>
      </div>

      <div v-if="createdRoom" class="created-card animate-pop">
        <div class="created-emoji">🎉</div>
        <p>房間已建立：</p>
        <div class="join-code">{{ createdRoom.joinCode }}</div>
        <p class="muted">對手在「加入房間」輸入此 6 位數即可加入。</p>
        <button class="btn btn-gold" @click="enterRoom">立即進入</button>
      </div>
    </section>

    <!-- 加入房間 -->
    <section v-else class="card join-card">
      <h2 class="card-title">輸入房號</h2>
      <p class="muted">向房主索取 6 位數房號。</p>

      <div class="form-row">
        <label>玩家暱稱</label>
        <input v-model="hostName" type="text" placeholder="您的暱稱" />
      </div>

      <div class="code-input">
        <input
          v-for="(_, i) in 6"
          :key="i"
          ref="codeRefs"
          v-model="codeDigits[i]"
          type="text"
          maxlength="1"
          inputmode="numeric"
          @input="onCodeInput(i)"
          @keydown="onCodeKeydown(i, $event)"
        />
      </div>

      <div v-if="error" class="error-msg">{{ error }}</div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="joinCode.length !== 6 || joining" @click="onJoin">
          {{ joining ? "加入中…" : "加入房間" }}
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { useRouter } from "vue-router";
import { useTemplatesStore } from "@/stores/templates";
import { createRoom, lookupRoomByCode, getProfile, saveProfile, getApiUrl } from "@/lib/api";

const router = useRouter();
const templatesStore = useTemplatesStore();
const templates = computed(() => templatesStore.all);

const tab = ref<"create" | "join">("create");
const selectedTemplateId = ref(templates.value[0]?.id ?? "");
const hostName = ref(getProfile().name);

const creating = ref(false);
const joining = ref(false);
const error = ref("");

const createdRoom = ref<{ roomId: string; joinCode: string } | null>(null);

const codeDigits = ref<string[]>(["", "", "", "", "", ""]);
const codeRefs = ref<HTMLInputElement[]>([]);
const joinCode = computed(() => codeDigits.value.join(""));

const apiConfigured = computed(() => !!getApiUrl());

function onCodeInput(i: number) {
  codeDigits.value[i] = codeDigits.value[i].replace(/\D/g, "").slice(0, 1);
  if (codeDigits.value[i] && i < 5) {
    nextTick(() => codeRefs.value[i + 1]?.focus());
  }
}

function onCodeKeydown(i: number, e: KeyboardEvent) {
  if (e.key === "Backspace" && !codeDigits.value[i] && i > 0) {
    nextTick(() => codeRefs.value[i - 1]?.focus());
  }
}

function persistName() {
  const p = getProfile();
  if (hostName.value && hostName.value !== p.name) {
    saveProfile({ ...p, name: hostName.value.trim() });
  }
}

async function onCreate() {
  error.value = "";
  if (!hostName.value.trim()) { error.value = "請輸入暱稱"; return; }
  persistName();
  creating.value = true;
  try {
    const room = await createRoom({ template: selectedTemplateId.value });
    createdRoom.value = { roomId: room.roomId, joinCode: room.joinCode };
  } catch (e) {
    error.value = e instanceof Error ? e.message : "建立失敗";
  } finally {
    creating.value = false;
  }
}

function enterRoom() {
  if (!createdRoom.value) return;
  router.push({ name: "play-remote", params: { roomId: createdRoom.value.roomId } });
}

async function onJoin() {
  error.value = "";
  if (!hostName.value.trim()) { error.value = "請輸入暱稱"; return; }
  persistName();
  joining.value = true;
  try {
    const info = await lookupRoomByCode(joinCode.value);
    if (!info?.exists || !info.roomId) {
      error.value = "找不到該房間";
      return;
    }
    router.push({ name: "play-remote", params: { roomId: info.roomId } });
  } catch (e) {
    error.value = e instanceof Error ? e.message : "加入失敗";
  } finally {
    joining.value = false;
  }
}
</script>

<style scoped>
.room-page { max-width: 640px; margin: 0 auto; }
.nav-bar { margin-bottom: 1rem; }

.hero { text-align: center; margin-bottom: 1.5rem; }
.hero-icon { font-size: 3rem; }
.hero-title { font-family: var(--font-heading); font-size: 2rem; margin: 0.4rem 0; color: var(--ink); }
.hero-subtitle { color: var(--text-muted); margin: 0; }

.tabs {
  display: flex;
  gap: 0.4rem;
  background: var(--paper-deep);
  padding: 0.3rem;
  border-radius: 14px;
  margin-bottom: 1rem;
}
.tab-pill {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.7rem;
  border-radius: 10px;
  font-family: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text-muted);
}
.tab-pill.active {
  background: white;
  color: var(--crimson);
  box-shadow: var(--shadow);
}

.card-title {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  margin: 0 0 0.4rem;
  color: var(--ink);
}

.template-list {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin: 0.8rem 0 1rem;
}
.tpl-row {
  display: flex;
  gap: 0.7rem;
  align-items: center;
  padding: 0.7rem;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 12px;
  cursor: pointer;
  font-family: inherit;
  text-align: left;
  transition: all 0.15s ease;
  width: 100%;
}
.tpl-row:hover { background: var(--paper-deep); }
.tpl-row.active {
  border-color: var(--crimson);
  background: rgba(193, 53, 45, 0.06);
  box-shadow: 0 0 0 3px rgba(193, 53, 45, 0.12);
}

.tpl-row-emoji { font-size: 1.6rem; flex-shrink: 0; }
.tpl-row-info { display: flex; flex-direction: column; gap: 0.2rem; }
.tpl-row-info strong { font-family: var(--font-heading); font-size: 0.95rem; }
.tpl-row-info .muted { font-size: 0.8rem; }

.form-row { margin: 0.8rem 0; }

.code-input {
  display: flex;
  gap: 0.4rem;
  justify-content: center;
  margin: 1rem 0;
}
.code-input input {
  width: 48px;
  height: 56px;
  text-align: center;
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
}

.error-msg {
  background: rgba(193, 53, 45, 0.08);
  color: var(--crimson);
  padding: 0.5rem 0.8rem;
  border-radius: 8px;
  margin: 0.6rem 0;
  font-size: 0.88rem;
}

.actions {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
}

.created-card {
  text-align: center;
  margin-top: 1.5rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(200, 148, 58, 0.1), rgba(193, 53, 45, 0.06));
  border: 2px dashed var(--gold);
  border-radius: 16px;
}
.created-emoji { font-size: 2.5rem; }
.join-code {
  font-family: var(--font-heading);
  font-size: 2.5rem;
  letter-spacing: 0.5em;
  font-weight: 700;
  color: var(--crimson);
  margin: 0.5rem 0;
}

.api-warn {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  background: rgba(200, 148, 58, 0.08);
  border: 1.5px solid rgba(200, 148, 58, 0.4);
  margin-bottom: 1rem;
}
.api-warn-icon {
  font-size: 1.6rem;
  flex-shrink: 0;
}
.api-warn strong { font-family: var(--font-heading); }
.api-warn .muted { font-size: 0.85rem; margin-top: 0.2rem; }
.api-warn code { background: rgba(0,0,0,0.05); padding: 0 0.3rem; border-radius: 4px; font-family: ui-monospace, monospace; }
</style>
