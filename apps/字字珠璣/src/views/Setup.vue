<template>
  <div class="page setup-page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-ghost">← 返回首頁</RouterLink>
    </nav>

    <template v-if="!template">
      <p class="muted">找不到該模板。</p>
    </template>
    <template v-else>
      <header class="setup-hero">
        <span class="setup-emoji">{{ template.emoji }}</span>
        <h1 class="setup-title">{{ template.name }}</h1>
        <p class="setup-desc">{{ template.description }}</p>
      </header>

      <section class="card config-card">
        <h2 class="config-title">對局設定</h2>

        <div class="config-row">
          <label>模式</label>
          <div class="mode-toggle">
            <button
              class="toggle-pill"
              :class="{ active: mode === 'local' }"
              @click="mode = 'local'"
            >📍 本地對戰</button>
            <button
              class="toggle-pill"
              :class="{ active: mode === 'remote' }"
              @click="mode = 'remote'"
            >🌐 遠程對戰</button>
          </div>
        </div>

        <div v-if="mode === 'local'" class="config-row two-col">
          <div>
            <label>黑棋玩家</label>
            <input v-model="blackName" type="text" placeholder="黑方暱稱" />
          </div>
          <div>
            <label>白棋玩家</label>
            <input v-model="whiteName" type="text" placeholder="白方暱稱" />
          </div>
        </div>

        <div class="config-row two-col">
          <div>
            <label>棋盤大小</label>
            <select v-model.number="boardSize">
              <option :value="9">9 × 9（低年級）</option>
              <option :value="11">11 × 11（適中）</option>
              <option :value="13">13 × 13（標準）</option>
              <option :value="15">15 × 15（挑戰）</option>
            </select>
          </div>
          <div>
            <label>每回合秒數</label>
            <select v-model.number="turnSeconds">
              <option :value="0">不限時</option>
              <option :value="30">30 秒</option>
              <option :value="45">45 秒</option>
              <option :value="60">1 分鐘</option>
              <option :value="90">1 分 30 秒</option>
            </select>
          </div>
        </div>

        <div class="rule-summary">
          <h4>規則摘要</h4>
          <ul>
            <li>內容：{{ contentLabel }}</li>
            <li>連線長度：{{ lineLenLabel }}</li>
            <li>勝負：{{ winLabel }}</li>
            <li>落子：{{ placementLabel }}</li>
          </ul>
        </div>

        <div class="config-actions">
          <button v-if="mode === 'local'" class="btn btn-primary" @click="startLocal">開始對戰</button>
          <RouterLink
            v-else
            to="/room"
            class="btn btn-primary"
          >
            前往遠程房間
          </RouterLink>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTemplatesStore } from "@/stores/templates";
import { useGameSessionStore } from "@/stores/gameSession";
import type { ContentType } from "@/lib/types";

const route = useRoute();
const router = useRouter();
const templatesStore = useTemplatesStore();
const session = useGameSessionStore();

const templateId = computed(() => String(route.params.templateId || ""));
const template = computed(() => templatesStore.byId(templateId.value));

const mode = ref<"local" | "remote">("local");
const blackName = ref("黑方");
const whiteName = ref("白方");
const boardSize = ref(template.value?.boardSize ?? 11);
const turnSeconds = ref(template.value?.turnSeconds ?? 60);

const contentLabel = computed(() => {
  const t = template.value?.rule.content as ContentType | undefined;
  switch (t) {
    case "idiom": return "成語（4 字）";
    case "poem-5": return "五言詩";
    case "poem-7": return "七言詩";
    case "sentence": return "句子（5–10 字）";
    case "char": return "識字";
    case "free": return "自由（高頻字隨機鋪）";
    default: return "—";
  }
});

const lineLenLabel = computed(() => {
  const len = template.value?.rule.lineLength;
  if (len === "match-content") return "跟隨內容（5–10 字）";
  return `${len} 子`;
});

const winLabel = computed(() => {
  const w = template.value?.rule.win;
  if (!w) return "—";
  if (w.kind === "first") return `先連 ${w.n} 子者勝`;
  if (w.kind === "count") return `${Math.round(w.durationSec / 60)} 分鐘內，N 連數量多者勝`;
  return "拼出內容（成語 / 詩句 / 句子）者勝";
});

const placementLabel = computed(() => {
  const p = template.value?.rule.placement;
  if (!p) return "—";
  if (p.kind === "qa") return `答對中文題才能落子（難度 ${p.difficulty}）`;
  return "自由落子";
});

function startLocal() {
  if (!template.value) return;
  // 套用使用者調整：覆蓋 boardSize / turnSeconds
  const customizedTemplate = {
    ...template.value,
    boardSize: boardSize.value as typeof template.value.boardSize,
    turnSeconds: turnSeconds.value,
  };
  session.initLocal(customizedTemplate, {
    blackName: blackName.value,
    whiteName: whiteName.value,
  });
  router.push({ name: "play-local", params: { templateId: template.value.id } });
}
</script>

<style scoped>
.setup-page { max-width: 720px; margin: 0 auto; }

.nav-bar { margin-bottom: 1rem; }

.setup-hero {
  text-align: center;
  margin-bottom: 1.5rem;
}
.setup-emoji {
  font-size: 3rem;
  display: inline-block;
  width: 4rem;
  height: 4rem;
  line-height: 4rem;
  background: var(--paper-deep);
  border-radius: 18px;
  margin-bottom: 0.5rem;
}
.setup-title {
  font-family: var(--font-heading);
  font-size: 2rem;
  margin: 0 0 0.3rem;
  color: var(--ink);
}
.setup-desc { color: var(--text-muted); margin: 0; max-width: 480px; margin: 0 auto; }

.config-card { padding: 1.5rem; }
.config-title {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  margin: 0 0 1rem;
}

.config-row { margin-bottom: 1rem; }
.config-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
}
@media (max-width: 480px) { .config-row.two-col { grid-template-columns: 1fr; } }

.mode-toggle {
  display: flex;
  gap: 0.4rem;
  background: var(--paper-deep);
  padding: 0.3rem;
  border-radius: 12px;
}
.toggle-pill {
  flex: 1;
  border: none;
  background: transparent;
  padding: 0.6rem 0.8rem;
  border-radius: 9px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.toggle-pill.active {
  background: white;
  color: var(--crimson);
  box-shadow: var(--shadow);
}

.rule-summary {
  background: var(--paper-deep);
  border-radius: 12px;
  padding: 0.8rem 1rem;
  margin: 1rem 0;
}
.rule-summary h4 {
  font-family: var(--font-heading);
  margin: 0 0 0.4rem;
  font-size: 0.95rem;
  color: var(--gold-deep);
}
.rule-summary ul {
  margin: 0;
  padding-left: 1.2rem;
  font-size: 0.88rem;
  color: var(--ink-soft);
  line-height: 1.7;
}

.config-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}
</style>
