<template>
  <div class="page home-page">
    <header class="hero animate-fade-in">
      <div class="hero-emblem">字字珠璣</div>
      <h1 class="hero-title">中文連字棋</h1>
      <p class="hero-subtitle">六種模板 · 動態長度 · 為小學生量身打造</p>
    </header>

    <section class="quick-actions animate-fade-in" style="animation-delay: 0.1s">
      <RouterLink to="/room" class="quick-action card">
        <span class="qa-icon">🌐</span>
        <div>
          <div class="qa-title">遠程對戰</div>
          <div class="qa-desc muted">建房 / 加入六位數房號</div>
        </div>
      </RouterLink>
      <RouterLink to="/teacher" class="quick-action card">
        <span class="qa-icon">🛠</span>
        <div>
          <div class="qa-title">教師後台</div>
          <div class="qa-desc muted">自訂規則 · 課堂模板</div>
        </div>
      </RouterLink>
    </section>

    <section class="gallery animate-fade-in" style="animation-delay: 0.2s">
      <h2 class="section-title">課堂模板</h2>
      <p class="section-sub muted">選一個模板開始本地對戰，或進入遠程房間使用相同模板</p>

      <div class="template-grid">
        <article
          v-for="(t, i) in templates"
          :key="t.id"
          class="template-card card"
          :style="{ animationDelay: `${0.1 * i}s` }"
        >
          <div class="tpl-head">
            <span class="tpl-emoji">{{ t.emoji }}</span>
            <div class="tpl-tags">
              <span v-for="y in t.yearLevels" :key="y" class="tag tag-indigo">{{ yearLabel(y) }}</span>
            </div>
          </div>
          <h3 class="tpl-name">{{ t.name }}</h3>
          <p class="tpl-desc">{{ t.description }}</p>
          <div class="tpl-meta muted">
            棋盤 {{ t.boardSize }}×{{ t.boardSize }} · 連 {{ lineLenLabel(t) }} · {{ winLabel(t) }}
          </div>
          <div class="tpl-actions">
            <RouterLink
              :to="{ name: 'setup', params: { templateId: t.id } }"
              class="btn btn-primary"
            >
              開始對戰
            </RouterLink>
          </div>
          <span v-if="!t.builtIn" class="custom-tag tag tag-gold">自訂</span>
        </article>
      </div>
    </section>

    <footer class="footer">
      <a href="#" class="footer-link" @click.prevent="openSettings">⚙️ 設定 API</a>
      <span class="footer-sep">·</span>
      <span class="muted">字字珠璣 v1.0</span>
    </footer>

    <Transition name="fade">
      <div v-if="showSettings" class="settings-mask" @click.self="showSettings = false">
        <div class="settings-card animate-pop">
          <h3>後端 API</h3>
          <p class="muted">遠程對戰 Worker URL（建議格式 https://zizi-zhuji.&lt;account&gt;.workers.dev）</p>
          <input v-model="apiInput" type="text" placeholder="https://..." />
          <h3 style="margin-top: 1rem">玩家暱稱</h3>
          <input v-model="profileName" type="text" placeholder="您的暱稱" />
          <div class="settings-actions">
            <button class="btn btn-secondary" @click="showSettings = false">取消</button>
            <button class="btn btn-primary" @click="saveSettings">儲存</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useTemplatesStore } from "@/stores/templates";
import type { GameTemplate, YearLevel } from "@/lib/types";
import { getApiUrl, setApiUrl, getProfile, saveProfile } from "@/lib/api";

const store = useTemplatesStore();
const templates = computed<GameTemplate[]>(() => store.all);

const showSettings = ref(false);
const apiInput = ref(getApiUrl());
const profileName = ref(getProfile().name);

function openSettings() {
  apiInput.value = getApiUrl();
  profileName.value = getProfile().name;
  showSettings.value = true;
}
function saveSettings() {
  setApiUrl(apiInput.value.trim());
  const p = getProfile();
  saveProfile({ ...p, name: profileName.value.trim() || "玩家" });
  showSettings.value = false;
}

function yearLabel(y: YearLevel): string {
  switch (y) {
    case "g1-2": return "1–2 年級";
    case "g3-4": return "3–4 年級";
    case "g5-6": return "5–6 年級";
  }
}

function lineLenLabel(t: GameTemplate): string {
  if (t.rule.lineLength === "match-content") return "動態";
  return String(t.rule.lineLength);
}

function winLabel(t: GameTemplate): string {
  switch (t.rule.win.kind) {
    case "first": return `先到 ${t.rule.win.n} 子`;
    case "count": return `${Math.round(t.rule.win.durationSec / 60)} 分鐘累積`;
    case "complete": return "拼出內容";
  }
}
</script>

<style scoped>
.home-page { padding-top: 2rem; }

.hero {
  text-align: center;
  margin-bottom: 2rem;
}

.hero-emblem {
  display: inline-block;
  font-family: var(--font-heading);
  font-size: 0.9rem;
  letter-spacing: 0.5em;
  color: var(--crimson);
  margin-bottom: 0.5rem;
  padding: 0.2rem 0.4rem 0.2rem 0.9rem;
  border: 1px solid var(--crimson);
  border-radius: 4px;
  background: rgba(193, 53, 45, 0.06);
}

.hero-title {
  font-family: var(--font-heading);
  font-size: clamp(2.4rem, 6vw, 3.4rem);
  font-weight: 700;
  color: var(--ink);
  margin: 0.4rem 0;
  letter-spacing: 0.05em;
  background: linear-gradient(135deg, var(--ink) 0%, var(--gold-deep) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  font-family: var(--font-heading);
  color: var(--text-muted);
  font-size: 1.05rem;
  margin: 0;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.8rem;
  margin-bottom: 2rem;
}

@media (max-width: 600px) {
  .quick-actions { grid-template-columns: 1fr; }
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem 1.2rem;
  text-decoration: none;
  color: inherit;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.quick-action:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-deep);
}

.qa-icon {
  font-size: 2rem;
  flex-shrink: 0;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--paper-deep), #f5e6c4);
  border-radius: 12px;
  border: 1.5px solid var(--border);
}

.qa-title {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 1.05rem;
  color: var(--ink);
}
.qa-desc { font-size: 0.85rem; }

.section-title {
  font-family: var(--font-heading);
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 0.3rem;
  color: var(--ink);
}
.section-sub { font-size: 0.92rem; margin: 0 0 1.2rem; }

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.template-card {
  display: flex;
  flex-direction: column;
  position: relative;
  animation: fadeIn 0.4s ease both;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.template-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-deep);
}

.tpl-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
}

.tpl-emoji {
  font-size: 2.2rem;
  width: 3rem;
  height: 3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--paper-deep);
  border-radius: 12px;
}

.tpl-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  justify-content: flex-end;
}

.tpl-name {
  font-family: var(--font-heading);
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 0.3rem;
  color: var(--ink);
}

.tpl-desc {
  font-size: 0.9rem;
  color: var(--text-muted);
  margin: 0 0 0.6rem;
  line-height: 1.5;
  min-height: 2.7em;
}

.tpl-meta {
  font-size: 0.78rem;
  margin-bottom: 0.8rem;
  padding-bottom: 0.7rem;
  border-bottom: 1px dashed var(--border);
}

.tpl-actions {
  margin-top: auto;
  display: flex;
  justify-content: flex-end;
}

.custom-tag {
  position: absolute;
  top: 0.6rem;
  right: 0.6rem;
  font-size: 0.7rem;
}

.footer {
  text-align: center;
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
}
.footer-link {
  color: var(--text-muted);
  text-decoration: none;
}
.footer-link:hover { color: var(--ink); }
.footer-sep { margin: 0 0.6rem; }

.settings-mask {
  position: fixed; inset: 0;
  background: rgba(45, 36, 25, 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; z-index: 80;
}
.settings-card {
  background: var(--card-bg);
  padding: 1.5rem;
  border-radius: var(--radius);
  max-width: 420px; width: 100%;
}
.settings-card h3 { font-family: var(--font-heading); margin: 0 0 0.4rem; }
.settings-actions {
  display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1rem;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
