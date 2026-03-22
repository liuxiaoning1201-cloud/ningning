<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import {
  DEMO_BANK,
  STORAGE_KEY_TEXT,
  parseSlashBank,
  parseExcelBank,
  shuffle,
} from "./bank";

interface Token {
  id: string;
  text: string;
}

const screen = ref<"start" | "game">("start");
const showSettings = ref(false);
const bankText = ref(DEMO_BANK);
const levels = ref<string[][]>([]);
const currentIdx = ref(0);
const answer = ref<Token[]>([]);
const pool = ref<Token[]>([]);
const slots = ref<(Token | null)[]>([]);

const poolEl = ref<HTMLElement | null>(null);
const drag = ref<{
  token: Token;
  fromSlot: number | null;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
} | null>(null);

const departAnim = ref(false);
const instantTrackReset = ref(false);
const celebrate = ref(false);
const excelError = ref("");

/** 火車開走時汽笛（public/train-whistle.mp3） */
const trainWhistle = ref<HTMLAudioElement | null>(null);

const seasonNames = ["春", "夏", "秋", "冬"];

const currentLevelLabel = computed(
  () => `${currentIdx.value + 1} / ${levels.value.length}`
);

function makeTokens(words: string[], levelKey: string): Token[] {
  return words.map((text, i) => ({
    id: `${levelKey}-${i}-${text}`,
    text,
  }));
}

function loadBankFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEXT);
    if (raw?.trim()) bankText.value = raw;
  } catch {
    /* ignore */
  }
  syncLevelsFromText();
}

function syncLevelsFromText() {
  const parsed = parseSlashBank(bankText.value);
  levels.value = parsed.length ? parsed : parseSlashBank(DEMO_BANK);
}

function saveBankText() {
  try {
    localStorage.setItem(STORAGE_KEY_TEXT, bankText.value);
  } catch {
    /* ignore */
  }
}

function startGame() {
  syncLevelsFromText();
  if (!levels.value.length) return;
  currentIdx.value = 0;
  screen.value = "game";
  setupLevel(0);
}

function setupLevel(idx: number) {
  const words = levels.value[idx];
  if (!words?.length) return;
  answer.value = makeTokens(words, `L${idx}`);
  pool.value = shuffle([...answer.value]);
  slots.value = words.map(() => null);
  departAnim.value = false;
  celebrate.value = false;
}

function seasonName(i: number) {
  return seasonNames[i % 4];
}

function onPointerMove(e: PointerEvent) {
  const d = drag.value;
  if (!d) return;
  d.x = e.clientX - d.offsetX;
  d.y = e.clientY - d.offsetY;
}

function endDrag(e: PointerEvent) {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);

  const d = drag.value;
  if (!d) return;
  drag.value = null;

  const el = document.elementFromPoint(e.clientX, e.clientY);
  const zone = el?.closest("[data-drop]") as HTMLElement | null;
  const kind = zone?.dataset.drop;

  if (kind === "pool") {
    if (d.fromSlot !== null) {
      slots.value[d.fromSlot] = null;
      if (!pool.value.some((t) => t.id === d.token.id)) {
        pool.value.push(d.token);
      }
    }
    return;
  }

  if (kind === "slot") {
    const i = Number(zone?.dataset.index);
    if (Number.isNaN(i)) return;

    if (d.fromSlot === null) {
      const idx = pool.value.findIndex((t) => t.id === d.token.id);
      if (idx >= 0) pool.value.splice(idx, 1);
      const displaced = slots.value[i];
      if (displaced && displaced.id !== d.token.id) {
        pool.value.push(displaced);
      }
      slots.value[i] = d.token;
    } else if (d.fromSlot === i) {
      return;
    } else {
      const j = d.fromSlot;
      const other = slots.value[i];
      slots.value[j] = other;
      slots.value[i] = d.token;
    }
    nextTick(() => checkWin());
    return;
  }

  if (d.fromSlot !== null) {
    slots.value[d.fromSlot] = null;
    if (!pool.value.some((t) => t.id === d.token.id)) {
      pool.value.push(d.token);
    }
  }
}

function startDrag(e: PointerEvent, token: Token, fromSlot: number | null) {
  if (departAnim.value) return;
  e.preventDefault();
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  drag.value = {
    token,
    fromSlot,
    x: rect.left,
    y: rect.top,
    offsetX: e.clientX - rect.left,
    offsetY: e.clientY - rect.top,
  };
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);
}

function playTrainWhistle() {
  const a = trainWhistle.value;
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => {});
  } catch {
    /* 略過 */
  }
}

function checkWin() {
  const ans = answer.value;
  const sl = slots.value;
  if (sl.some((s) => s === null)) return;
  const ok = sl.every((s, i) => s!.id === ans[i].id);
  if (!ok) return;
  celebrate.value = true;
  setTimeout(() => {
    celebrate.value = false;
    departAnim.value = true;
    playTrainWhistle();
  }, 650);
}

function onTrainTransitionEnd(ev: TransitionEvent) {
  if (ev.target !== ev.currentTarget) return;
  if (ev.propertyName !== "transform") return;
  if (!departAnim.value) return;

  departAnim.value = false;
  instantTrackReset.value = true;

  if (currentIdx.value < levels.value.length - 1) {
    currentIdx.value += 1;
    setupLevel(currentIdx.value);
  } else {
    screen.value = "start";
    currentIdx.value = 0;
  }

  nextTick(() => {
    requestAnimationFrame(() => {
      instantTrackReset.value = false;
    });
  });
}

function closeSettings() {
  showSettings.value = false;
  saveBankText();
  syncLevelsFromText();
}

async function onExcelChange(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  excelError.value = "";
  try {
    const parsed = await parseExcelBank(file);
    if (!parsed.length) {
      excelError.value = "表格中沒有有效的詞語列（每列至少兩格，或由 / 分詞）。";
      return;
    }
    bankText.value = parsed
      .map((row) => row.join("/"))
      .join("\n");
    saveBankText();
    syncLevelsFromText();
  } catch {
    excelError.value = "無法讀取此檔案，請確認為 .xlsx 或 .xls。";
  }
}

function resetDemo() {
  bankText.value = DEMO_BANK;
  saveBankText();
  syncLevelsFromText();
}

const ghostStyle = computed(() => {
  const d = drag.value;
  if (!d) return { display: "none" };
  return {
    display: "block",
    left: `${d.x}px`,
    top: `${d.y}px`,
  };
});

function isDraggingToken(token: Token, fromSlot: number | null) {
  const d = drag.value;
  if (!d || d.token.id !== token.id) return false;
  return d.fromSlot === fromSlot;
}

onMounted(() => {
  loadBankFromStorage();
  const url = `${import.meta.env.BASE_URL}train-whistle.mp3`;
  trainWhistle.value = new Audio(url);
  trainWhistle.value.preload = "auto";
});

onUnmounted(() => {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);
});
</script>

<template>
  <div class="page">
    <button
      type="button"
      class="btn-icon gear"
      aria-label="詞庫設定"
      @click="showSettings = true"
    >
      ⚙️
    </button>

    <main v-if="screen === 'start'" class="panel start-panel">
      <div class="logo">🚂</div>
      <h1>句子排序小火車</h1>
      <p class="lede">
        詞語在上方，季節小車廂在火車上。用手指拖進正確順序，排對了火車就開往下一關！
      </p>
      <button type="button" class="btn primary" @click="startGame">
        開始遊戲
      </button>
      <p class="hint">老師可先點左上角 ⚙️ 輸入詞庫或匯入 Excel</p>
    </main>

    <main v-else class="game">
      <header class="game-head">
        <button type="button" class="btn ghost" @click="screen = 'start'">
          首頁
        </button>
        <span class="badge">第 {{ currentLevelLabel }} 關</span>
      </header>

      <div ref="poolEl" class="word-pool" data-drop="pool">
        <p class="pool-title">詞語（拖到下面車廂）</p>
        <div class="chips">
          <button
            v-for="t in pool"
            :key="t.id"
            type="button"
            class="chip"
            :class="{ 'chip-dragging': isDraggingToken(t, null) }"
            @pointerdown.prevent="startDrag($event, t, null)"
          >
            {{ t.text }}
          </button>
        </div>
      </div>

      <div
        class="track"
        :class="{
          depart: departAnim,
          celebrate: celebrate,
          'track-instant': instantTrackReset,
        }"
        @transitionend="onTrainTransitionEnd"
      >
        <div class="train">
          <div class="engine" aria-hidden="true">
            <span class="smoke">💨</span>
            <span class="loco">🚂</span>
          </div>
          <div
            v-for="(_, i) in slots"
            :key="i"
            class="carriage"
            :class="`season-${i % 4}`"
          >
            <div class="season-ribbon">{{ seasonName(i) }}</div>
            <div
              class="drop-slot"
              data-drop="slot"
              :data-index="String(i)"
            >
              <button
                v-if="slots[i]"
                type="button"
                class="chip chip-on-train"
                :class="{ 'chip-dragging': isDraggingToken(slots[i]!, i) }"
                @pointerdown.prevent="startDrag($event, slots[i]!, i)"
              >
                {{ slots[i]!.text }}
              </button>
            </div>
          </div>
        </div>
        <div class="rails" aria-hidden="true" />
      </div>

      <p v-if="celebrate" class="toast">太棒了！火車出發！</p>
    </main>

    <div
      v-if="drag"
      class="chip ghost"
      :style="ghostStyle"
      aria-hidden="true"
    >
      {{ drag.token.text }}
    </div>

    <Teleport to="body">
      <div
        v-if="showSettings"
        class="modal-backdrop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        @click.self="closeSettings"
      >
        <div class="modal">
          <h2 id="settings-title">詞庫設定（老師）</h2>
          <p class="modal-desc">
            每<strong>一行</strong>是一關正確順序；同一行裡用 <strong>/</strong>
            隔開每個詞語。車廂數量會依詞數自動產生。
          </p>
          <label class="sr-only" for="bank-ta">詞庫內容</label>
          <textarea
            id="bank-ta"
            v-model="bankText"
            class="bank-textarea"
            rows="10"
            placeholder="例：&#10;春天來了/花兒/開了&#10;我們/一起/去/郊遊"
          />
          <div class="excel-row">
            <label class="file-label">
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                class="sr-only"
                @change="onExcelChange"
              />
              匯入 Excel
            </label>
            <span class="excel-hint"
              >每列一關：由左至右一格一詞；或單欄用 / 分詞</span
            >
          </div>
          <p v-if="excelError" class="error">{{ excelError }}</p>
          <div class="modal-actions">
            <button type="button" class="btn ghost" @click="resetDemo">
              恢復示範詞庫
            </button>
            <button type="button" class="btn primary" @click="closeSettings">
              儲存並關閉
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.page {
  min-height: 100dvh;
  padding: 12px 16px 28px;
  position: relative;
  max-width: 720px;
  margin: 0 auto;
}

.gear {
  position: fixed;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  z-index: 40;
  font-size: 1.35rem;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 4px 14px rgba(0, 80, 120, 0.12);
}

.btn-icon:active {
  transform: scale(0.96);
}

.panel {
  padding-top: 72px;
  text-align: center;
}

.logo {
  font-size: 4rem;
  line-height: 1;
  margin-bottom: 8px;
  filter: drop-shadow(0 6px 0 rgba(0, 0, 0, 0.06));
}

h1 {
  margin: 0 0 12px;
  font-size: 1.65rem;
  font-weight: 700;
  color: #1a4d6d;
}

.lede {
  margin: 0 auto 24px;
  max-width: 28rem;
  line-height: 1.65;
  color: #456;
  font-size: 1.02rem;
}

.hint {
  margin-top: 20px;
  font-size: 0.88rem;
  color: #789;
}

.btn {
  border: none;
  border-radius: 999px;
  padding: 12px 28px;
  font-size: 1.05rem;
  font-weight: 600;
}

.btn.primary {
  background: linear-gradient(180deg, #3d9ae8, #2b7fcc);
  color: #fff;
  box-shadow: 0 6px 0 #1f5f99, 0 8px 18px rgba(43, 127, 204, 0.35);
}

.btn.primary:active {
  transform: translateY(3px);
  box-shadow: 0 3px 0 #1f5f99;
}

.btn.ghost {
  background: rgba(255, 255, 255, 0.85);
  color: #2a5a7a;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.game-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-top: 52px;
}

.badge {
  font-weight: 700;
  color: #1a4d6d;
  background: rgba(255, 255, 255, 0.75);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.95rem;
}

.word-pool {
  background: rgba(255, 255, 255, 0.88);
  border-radius: 20px;
  padding: 14px 14px 18px;
  box-shadow: 0 8px 24px rgba(30, 100, 140, 0.1);
  margin-bottom: 20px;
  min-height: 120px;
  touch-action: none;
}

.pool-title {
  margin: 0 0 10px;
  font-size: 0.82rem;
  font-weight: 600;
  color: #5a7a8f;
  text-align: center;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  align-items: center;
  min-height: 52px;
}

.chip {
  touch-action: none;
  border: none;
  border-radius: 14px;
  padding: 12px 16px;
  font-size: 1.05rem;
  font-weight: 600;
  background: linear-gradient(180deg, #fff9e6, #ffe8b8);
  color: #4a3a20;
  box-shadow: 0 4px 0 #d4a84a, 0 6px 12px rgba(180, 140, 60, 0.2);
  cursor: grab;
  user-select: none;
}

.chip:active {
  cursor: grabbing;
}

.chip-dragging {
  opacity: 0.25;
}

.chip-on-train {
  box-shadow: 0 3px 0 rgba(0, 0, 0, 0.12);
  font-size: 0.98rem;
  padding: 10px 12px;
}

.chip.ghost {
  position: fixed;
  z-index: 100;
  pointer-events: none;
  opacity: 0.95;
  margin: 0;
  cursor: grabbing;
}

.track {
  overflow-x: auto;
  overflow-y: visible;
  padding: 8px 0 24px;
  transition: transform 1.35s cubic-bezier(0.45, 0, 0.2, 1);
  transform: translateX(0);
}

.track.track-instant {
  transition: none;
}

.track.depart {
  transform: translateX(115%);
}

.track.celebrate .engine .smoke {
  animation: puff 0.6s ease-out 2;
}

@keyframes puff {
  0% {
    opacity: 0.4;
    transform: translate(0, 0) scale(0.8);
  }
  100% {
    opacity: 0;
    transform: translate(18px, -28px) scale(1.4);
  }
}

.train {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  gap: 4px;
  width: max-content;
  margin: 0 auto;
  padding: 0 8px;
}

.engine {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 2px;
}

.smoke {
  font-size: 1.2rem;
  line-height: 1;
  opacity: 0.7;
}

.loco {
  font-size: 2.6rem;
  line-height: 1;
  filter: drop-shadow(2px 4px 0 rgba(0, 0, 0, 0.08));
}

.carriage {
  width: 92px;
  min-height: 118px;
  border-radius: 12px 12px 8px 8px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  box-shadow: inset 0 -6px 0 rgba(0, 0, 0, 0.08), 0 6px 14px rgba(0, 0, 0, 0.12);
  touch-action: none;
}

.season-ribbon {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 6px 4px 4px;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}

.drop-slot {
  flex: 1;
  margin: 0 6px 8px;
  border-radius: 10px;
  border: 2px dashed rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 64px;
  padding: 4px;
}

.season-0 {
  background: linear-gradient(180deg, #7bc96f, #4a9f5c);
}
.season-1 {
  background: linear-gradient(180deg, #ffd54f, #ffb300);
}
.season-2 {
  background: linear-gradient(180deg, #ff8a65, #e64a19);
}
.season-3 {
  background: linear-gradient(180deg, #81d4fa, #039be5);
}

.rails {
  height: 10px;
  margin: 0 12px;
  margin-top: -6px;
  border-radius: 4px;
  background: repeating-linear-gradient(
    90deg,
    #789 0,
    #789 14px,
    transparent 14px,
    transparent 22px
  );
  opacity: 0.45;
}

.toast {
  text-align: center;
  font-weight: 700;
  font-size: 1.2rem;
  color: #0d6e3d;
  margin-top: 8px;
  animation: pop 0.45s ease;
}

@keyframes pop {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(20, 50, 70, 0.45);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  background: #fff;
  border-radius: 20px;
  padding: 22px 20px 18px;
  max-width: 520px;
  width: 100%;
  max-height: 90dvh;
  overflow: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
}

.modal h2 {
  margin: 0 0 10px;
  font-size: 1.25rem;
  color: #1a4d6d;
}

.modal-desc {
  margin: 0 0 12px;
  font-size: 0.92rem;
  line-height: 1.55;
  color: #567;
}

.bank-textarea {
  width: 100%;
  border-radius: 12px;
  border: 2px solid #cfe3f0;
  padding: 12px;
  font-size: 0.95rem;
  line-height: 1.5;
  resize: vertical;
  font-family: inherit;
  margin-bottom: 14px;
}

.excel-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.file-label {
  display: inline-block;
  padding: 8px 16px;
  background: #e8f4fc;
  color: #1a6cad;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.92rem;
  cursor: pointer;
}

.excel-hint {
  font-size: 0.82rem;
  color: #789;
  flex: 1;
  min-width: 180px;
}

.error {
  color: #c62828;
  font-size: 0.88rem;
  margin: 0 0 8px;
}

.modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 8px;
}
</style>
