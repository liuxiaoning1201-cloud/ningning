<template>
  <div class="page editor-page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-ghost">← 返回首頁</RouterLink>
    </nav>

    <header class="hero">
      <div class="hero-icon">🛠</div>
      <h1 class="hero-title">教師後台 · 自訂模板</h1>
      <p class="hero-subtitle">三步組合：內容形態 × 連線長度 × 勝負類型</p>
    </header>

    <section class="card editor-card">
      <h2 class="step-title">① 內容形態</h2>
      <div class="seg seg-content">
        <button
          v-for="opt in contentOptions"
          :key="opt.value"
          class="seg-pill"
          :class="{ active: form.content === opt.value }"
          @click="setContent(opt.value)"
        >
          <span class="seg-emoji">{{ opt.emoji }}</span>
          <span class="seg-label">{{ opt.label }}</span>
        </button>
      </div>

      <h2 class="step-title">② 連線長度</h2>
      <div class="seg">
        <button
          v-for="n in lineLenOptions"
          :key="n.value"
          class="seg-pill compact"
          :class="{ active: form.lineLength === n.value }"
          @click="form.lineLength = n.value"
        >
          {{ n.label }}
        </button>
      </div>

      <h2 class="step-title">③ 勝負類型</h2>
      <div class="seg">
        <button
          v-for="opt in winOptions"
          :key="opt.value"
          class="seg-pill"
          :class="{ active: form.winKind === opt.value }"
          @click="form.winKind = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>

      <div v-if="form.winKind === 'first'" class="config-row">
        <label>連 N 子勝</label>
        <select v-model.number="form.firstN">
          <option :value="3">3 連</option>
          <option :value="4">4 連</option>
          <option :value="5">5 連</option>
          <option :value="6">6 連</option>
        </select>
      </div>

      <div v-if="form.winKind === 'count'" class="config-row two-col">
        <div>
          <label>限時（秒）</label>
          <input v-model.number="form.countDuration" type="number" min="60" max="1800" />
        </div>
        <div>
          <label>連線長度</label>
          <select v-model.number="form.countLineLen">
            <option :value="3">3 連</option>
            <option :value="4">4 連</option>
            <option :value="5">5 連</option>
          </select>
        </div>
      </div>

      <h2 class="step-title">④ 落子規則</h2>
      <div class="seg">
        <button
          class="seg-pill"
          :class="{ active: form.placement === 'free' }"
          @click="form.placement = 'free'"
        >自由落子</button>
        <button
          class="seg-pill"
          :class="{ active: form.placement === 'qa' }"
          @click="form.placement = 'qa'"
        >答題才能落子</button>
      </div>

      <div v-if="form.placement === 'qa'" class="config-row">
        <label>題目難度（1–5）</label>
        <select v-model.number="form.qaDifficulty">
          <option :value="1">1 · 注音入門</option>
          <option :value="2">2 · 形近字</option>
          <option :value="3">3 · 詞義組詞</option>
          <option :value="4">4 · 成語意義</option>
          <option :value="5">5 · 進階</option>
        </select>
      </div>

      <h2 class="step-title">⑤ 棋盤與時長</h2>
      <div class="config-row two-col">
        <div>
          <label>棋盤大小</label>
          <select v-model.number="form.boardSize">
            <option :value="9">9 × 9</option>
            <option :value="11">11 × 11</option>
            <option :value="13">13 × 13</option>
            <option :value="15">15 × 15</option>
          </select>
        </div>
        <div>
          <label>每回合秒數</label>
          <select v-model.number="form.turnSeconds">
            <option :value="0">不限時</option>
            <option :value="30">30 秒</option>
            <option :value="45">45 秒</option>
            <option :value="60">1 分鐘</option>
          </select>
        </div>
      </div>

      <h2 class="step-title">⑥ 模板資訊</h2>
      <div class="config-row two-col">
        <div>
          <label>名稱</label>
          <input v-model="form.name" type="text" placeholder="例如：一年級識字接龍" />
        </div>
        <div>
          <label>表情</label>
          <input v-model="form.emoji" type="text" maxlength="2" placeholder="🎲" />
        </div>
      </div>
      <div class="config-row">
        <label>描述</label>
        <textarea v-model="form.description" rows="2" placeholder="一句話描述這個模板的玩法"></textarea>
      </div>

      <!-- 規則摘要預覽 -->
      <div class="preview-box">
        <h4>預覽</h4>
        <p class="preview-text">{{ previewText }}</p>
      </div>

      <div class="editor-actions">
        <button class="btn btn-secondary" @click="resetForm">重設</button>
        <button class="btn btn-primary" :disabled="!canSave" @click="saveTemplate">儲存模板</button>
      </div>
    </section>

    <section v-if="userTemplates.length > 0" class="user-list">
      <h2 class="section-title">已儲存的自訂模板</h2>
      <article v-for="t in userTemplates" :key="t.id" class="card user-tpl">
        <div class="user-tpl-head">
          <span class="tpl-row-emoji">{{ t.emoji }}</span>
          <strong>{{ t.name }}</strong>
        </div>
        <p class="muted">{{ t.description }}</p>
        <div class="user-tpl-actions">
          <RouterLink :to="{ name: 'setup', params: { templateId: t.id } }" class="btn btn-secondary">使用</RouterLink>
          <button class="btn btn-ghost" @click="store.remove(t.id)">刪除</button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { useTemplatesStore } from "@/stores/templates";
import type { ContentType, GameRule, GameTemplate } from "@/lib/types";

const store = useTemplatesStore();
const userTemplates = computed(() => store.user);

interface Form {
  name: string;
  emoji: string;
  description: string;
  content: ContentType;
  lineLength: number | "match-content";
  winKind: "first" | "count" | "complete";
  firstN: number;
  countDuration: number;
  countLineLen: number;
  placement: "free" | "qa";
  qaDifficulty: 1 | 2 | 3 | 4 | 5;
  boardSize: 9 | 11 | 13 | 15;
  turnSeconds: number;
}

function defaultForm(): Form {
  return {
    name: "",
    emoji: "🎲",
    description: "",
    content: "idiom",
    lineLength: 4,
    winKind: "complete",
    firstN: 5,
    countDuration: 300,
    countLineLen: 5,
    placement: "free",
    qaDifficulty: 2,
    boardSize: 11,
    turnSeconds: 60,
  };
}

const form = reactive<Form>(defaultForm());
const _showSaved = ref(false);

const contentOptions = [
  { value: "free" as ContentType, label: "自由", emoji: "✨" },
  { value: "char" as ContentType, label: "識字", emoji: "📖" },
  { value: "word" as ContentType, label: "詞語", emoji: "📝" },
  { value: "idiom" as ContentType, label: "成語", emoji: "📜" },
  { value: "poem-5" as ContentType, label: "五言詩", emoji: "🌙" },
  { value: "poem-7" as ContentType, label: "七言詩", emoji: "🍃" },
  { value: "sentence" as ContentType, label: "句子", emoji: "💬" },
];

const lineLenOptions = computed(() => {
  const arr: { value: number | "match-content"; label: string }[] = [
    { value: 3, label: "3 連" },
    { value: 4, label: "4 連" },
    { value: 5, label: "5 連" },
    { value: 6, label: "6 連" },
    { value: 7, label: "7 連" },
    { value: "match-content", label: "跟隨內容" },
  ];
  return arr;
});

const winOptions = [
  { value: "first" as const, label: "先到 N 連勝" },
  { value: "count" as const, label: "累計多者勝" },
  { value: "complete" as const, label: "拼出內容勝" },
];

function setContent(c: ContentType) {
  form.content = c;
  if (c === "idiom") form.lineLength = 4;
  else if (c === "poem-5") form.lineLength = 5;
  else if (c === "poem-7") form.lineLength = 7;
  else if (c === "sentence") form.lineLength = "match-content";
  if (c !== "free" && c !== "char") form.winKind = "complete";
}

const canSave = computed(() => form.name.trim().length >= 2);

const previewText = computed(() => {
  const c = form.content;
  const cLabel = contentOptions.find((o) => o.value === c)?.label ?? c;
  const lLabel = form.lineLength === "match-content" ? "動態" : `${form.lineLength} 連`;
  const wLabel =
    form.winKind === "first" ? `先連 ${form.firstN} 子勝` :
    form.winKind === "count" ? `${Math.round(form.countDuration / 60)} 分鐘內 ${form.countLineLen} 連數量多者勝` :
    "拼出內容勝";
  const pLabel = form.placement === "qa" ? `（答題難度 ${form.qaDifficulty}）` : "";
  return `${cLabel}：${lLabel}，${wLabel}${pLabel}，棋盤 ${form.boardSize}×${form.boardSize}`;
});

function buildRule(): GameRule {
  const win =
    form.winKind === "first" ? { kind: "first" as const, n: form.firstN } :
    form.winKind === "count" ? { kind: "count" as const, durationSec: form.countDuration, lineLength: form.countLineLen } :
    { kind: "complete" as const, targetType: form.content };

  const placement =
    form.placement === "qa"
      ? { kind: "qa" as const, difficulty: form.qaDifficulty }
      : { kind: "free" as const };

  return {
    content: form.content,
    lineLength: form.lineLength,
    win,
    placement,
    challengeable: form.content === "sentence",
  };
}

function saveTemplate() {
  const t: GameTemplate = {
    id: `user-${Date.now().toString(36)}`,
    name: form.name.trim(),
    description: form.description.trim() || previewText.value,
    emoji: form.emoji || "🎲",
    rule: buildRule(),
    boardSize: form.boardSize,
    yearLevels: ["g3-4"],
    turnSeconds: form.turnSeconds,
    builtIn: false,
  };
  store.add(t);
  resetForm();
  _showSaved.value = true;
  setTimeout(() => { _showSaved.value = false; }, 1500);
}

function resetForm() {
  Object.assign(form, defaultForm());
}
</script>

<style scoped>
.editor-page { max-width: 760px; margin: 0 auto; }
.nav-bar { margin-bottom: 1rem; }

.hero { text-align: center; margin-bottom: 1.5rem; }
.hero-icon { font-size: 3rem; }
.hero-title { font-family: var(--font-heading); font-size: 1.8rem; margin: 0.4rem 0; color: var(--ink); }
.hero-subtitle { color: var(--text-muted); margin: 0; }

.editor-card { padding: 1.5rem; }

.step-title {
  font-family: var(--font-heading);
  font-size: 1rem;
  margin: 1.2rem 0 0.5rem;
  color: var(--gold-deep);
}

.seg {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}
.seg-pill {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: white;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  padding: 0.5rem 0.9rem;
  font-family: inherit;
  font-size: 0.88rem;
  color: var(--ink);
  cursor: pointer;
  transition: all 0.15s ease;
}
.seg-pill.compact { padding: 0.5rem 0.8rem; }
.seg-pill:hover { border-color: var(--crimson); }
.seg-pill.active {
  background: var(--crimson);
  color: white;
  border-color: var(--crimson);
}
.seg-emoji { font-size: 1.05rem; }

.config-row { margin: 0.6rem 0; }
.config-row.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
}
@media (max-width: 480px) { .config-row.two-col { grid-template-columns: 1fr; } }

.preview-box {
  background: var(--paper-deep);
  border-radius: 12px;
  padding: 0.8rem 1rem;
  margin: 1rem 0;
}
.preview-box h4 { font-family: var(--font-heading); margin: 0 0 0.3rem; color: var(--gold-deep); }
.preview-text { margin: 0; font-size: 0.92rem; color: var(--ink-soft); }

.editor-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1rem;
}

.user-list { margin-top: 2rem; }
.section-title {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  margin: 0 0 0.8rem;
  color: var(--ink);
}
.user-tpl { margin-bottom: 0.6rem; }
.user-tpl-head {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.user-tpl-head strong { font-family: var(--font-heading); }
.tpl-row-emoji { font-size: 1.4rem; }
.user-tpl-actions {
  display: flex;
  gap: 0.4rem;
  justify-content: flex-end;
}
</style>
