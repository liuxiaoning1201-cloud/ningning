<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import {
  DEMO_BANK,
  STORAGE_KEY_TEXT,
  parseSlashBank,
  parseExcelBank,
  shuffle,
} from "./bank";
import {
  DEPART_DURATION_MS,
  computeDepartTranslateX,
  evaluateOrder,
  nextAfterDepart,
} from "./gameLogic";

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
const convoyEl = ref<HTMLElement | null>(null);
const scrollEl = ref<HTMLElement | null>(null);
const drag = ref<{
  token: Token;
  fromSlot: number | null;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
} | null>(null);

const departAnim = ref(false);
const celebrate = ref(false);
const orderWrong = ref(false);
const excelError = ref("");
let departFallbackTimeout: ReturnType<typeof setTimeout> | null = null;
let departDelayTimeout: ReturnType<typeof setTimeout> | null = null;
let departAnimation: Animation | null = null;
let orderCheckSerial = 0;

/** 火車開走時汽笛（public/train-whistle.mp3） */
const trainWhistle = ref<HTMLAudioElement | null>(null);

const seasonNames = ["春", "夏", "秋", "冬"];

interface Vehicle {
  id: string;
  name: string;
  engine: string;
  trail: string;
  ground: "rail" | "road" | "water" | "sky" | "grass";
}

/** 多種交通工具，每一關輪流出現，吸引小朋友 */
const VEHICLES: Vehicle[] = [
  { id: "train", name: "火車", engine: "🚂", trail: "💨", ground: "rail" },
  { id: "bus", name: "巴士", engine: "🚌", trail: "💨", ground: "road" },
  { id: "truck", name: "貨車", engine: "🚚", trail: "💨", ground: "road" },
  { id: "race", name: "賽車", engine: "🏎️", trail: "💨", ground: "road" },
  { id: "boat", name: "輪船", engine: "🚢", trail: "🌊", ground: "water" },
  { id: "rocket", name: "火箭", engine: "🚀", trail: "🔥", ground: "sky" },
  { id: "plane", name: "飛機", engine: "✈️", trail: "☁️", ground: "sky" },
  { id: "caterpillar", name: "毛毛蟲車", engine: "🐛", trail: "🍃", ground: "grass" },
];

const currentVehicle = ref<Vehicle>(VEHICLES[0]);

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
  orderWrong.value = false;
  clearDepartureMotion();
  currentVehicle.value = VEHICLES[idx % VEHICLES.length];
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

function findDropZone(x: number, y: number): HTMLElement | null {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    const zone = el.closest?.("[data-drop]") as HTMLElement | null;
    if (zone) return zone;
  }
  for (const slot of document.querySelectorAll<HTMLElement>("[data-drop='slot']")) {
    const car = slot.closest(".carriage") ?? slot;
    const rect = car.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return slot;
    }
  }
  const pool = document.querySelector<HTMLElement>("[data-drop='pool']");
  if (pool) {
    const rect = pool.getBoundingClientRect();
    if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
      return pool;
    }
  }
  return null;
}

function endDrag(e: PointerEvent) {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", endDrag);
  window.removeEventListener("pointercancel", endDrag);

  const d = drag.value;
  if (!d) return;
  drag.value = null;

  const zone = findDropZone(e.clientX, e.clientY);
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
    } else if (d.fromSlot !== i) {
      const j = d.fromSlot;
      const other = slots.value[i];
      slots.value[j] = other;
      slots.value[i] = d.token;
    }
    checkWin();
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

function clearDepartureMotion() {
  if (departDelayTimeout) {
    clearTimeout(departDelayTimeout);
    departDelayTimeout = null;
  }
  if (departFallbackTimeout) {
    clearTimeout(departFallbackTimeout);
    departFallbackTimeout = null;
  }
  departAnimation?.cancel();
  departAnimation = null;
  const scroller = scrollEl.value;
  if (scroller) {
    scroller.getAnimations().forEach((anim) => anim.cancel());
    scroller.style.transform = "";
  }
}

function checkWin() {
  if (departAnim.value || celebrate.value) return;
  const serial = ++orderCheckSerial;
  const result = evaluateOrder(slots.value, answer.value);
  if (result === "incomplete") {
    orderWrong.value = false;
    return;
  }
  if (result === "wrong") {
    orderWrong.value = false;
    nextTick(() => {
      if (serial === orderCheckSerial) orderWrong.value = true;
    });
    return;
  }
  orderWrong.value = false;
  celebrate.value = true;
  if (departDelayTimeout) clearTimeout(departDelayTimeout);
  departDelayTimeout = setTimeout(() => {
    departDelayTimeout = null;
    startDeparture();
  }, 650);
}

function startDeparture() {
  if (departAnim.value) return;
  celebrate.value = false;
  const rect = convoyEl.value?.getBoundingClientRect();
  const dx = computeDepartTranslateX(
    rect ?? { left: 0, width: typeof window === "undefined" ? 800 : window.innerWidth }
  );
  departAnim.value = true;
  try {
    const scroller = scrollEl.value;
    if (scroller) {
      departAnimation?.cancel();
      departAnimation = scroller.animate(
        [
          { transform: "translate3d(0px, 0, 0)" },
          { transform: `translate3d(${dx}px, 0, 0)` },
        ],
        {
          duration: DEPART_DURATION_MS,
          easing: "cubic-bezier(0.45, 0, 0.2, 1)",
          fill: "forwards",
        }
      );
      departAnimation.onfinish = () => {
        handleDepartComplete();
      };
    }
  } catch {
    /* 動畫失敗時仍靠計時器進入下一關 */
  }
  playTrainWhistle();
  startDepartFallbackTimer();
}

function startDepartFallbackTimer() {
  if (departFallbackTimeout) {
    clearTimeout(departFallbackTimeout);
  }
  departFallbackTimeout = setTimeout(() => {
    if (departAnim.value) {
      handleDepartComplete();
    }
  }, DEPART_DURATION_MS + 150);
}

function handleDepartComplete() {
  if (!departAnim.value) return;
  departAnim.value = false;
  clearDepartureMotion();

  const next = nextAfterDepart(currentIdx.value, levels.value.length);
  if (next.kind === "next") {
    currentIdx.value = next.index;
    setupLevel(currentIdx.value);
  } else {
    screen.value = "start";
    currentIdx.value = 0;
  }
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
  clearDepartureMotion();
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
      <div class="logo">🚂🚌🚀🚢</div>
      <h1>句子排序小火車</h1>
      <p class="lede">
        詞語在上方，把它們拖進下面的車廂排成正確順序。排對了，車子就向前出發開往下一關！每一關還會換不同的交通工具喔～
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

      <div class="track-stage">
        <div ref="scrollEl" class="track-scroll" :class="{ departing: departAnim }">
          <div
            ref="convoyEl"
            class="convoy"
            :class="{ celebrate: celebrate }"
          >
            <div class="train" :class="{ wrong: orderWrong }">
              <div class="engine" aria-hidden="true">
                <span class="smoke">{{ currentVehicle.trail }}</span>
                <span class="loco">{{ currentVehicle.engine }}</span>
              </div>
              <div
                v-for="(_, i) in slots"
                :key="i"
                class="carriage"
                :class="`season-${i % 4}`"
                data-drop="slot"
                :data-index="String(i)"
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
            <div class="rails" :class="`rails-${currentVehicle.ground}`" aria-hidden="true" />
          </div>
        </div>
        <p v-if="celebrate" class="toast">太棒了！{{ currentVehicle.name }}出發！</p>
        <p v-else-if="orderWrong" class="toast toast-bad">順序還不對，再排排看</p>
      </div>
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
  padding: 12px 0 16px;
  position: relative;
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
  padding: 72px 16px 0;
  text-align: center;
  max-width: 720px;
  margin: 0 auto;
}

.logo {
  font-size: 2.8rem;
  line-height: 1.1;
  letter-spacing: 4px;
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

.game {
  display: flex;
  flex-direction: column;
  min-height: calc(100dvh - 28px);
}

.game-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 auto 10px;
  padding: 52px 16px 0;
  flex-shrink: 0;
  width: 100%;
  max-width: 960px;
  box-sizing: border-box;
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
  margin: 0 auto 12px;
  min-height: 100px;
  touch-action: none;
  flex-shrink: 0;
  width: calc(100% - 32px);
  max-width: 960px;
  box-sizing: border-box;
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
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.12);
  font-size: 1.1rem;
  padding: 12px 14px;
  white-space: nowrap;
}

.chip.ghost {
  position: fixed;
  z-index: 100;
  pointer-events: none;
  opacity: 0.95;
  margin: 0;
  cursor: grabbing;
}

.track-stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  min-height: 220px;
  width: 100%;
  overflow: hidden;
  position: relative;
}

.track-scroll {
  width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 12px 0 28px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
  overflow-anchor: none;
}

.track-scroll.departing {
  overflow-x: hidden;
  pointer-events: none;
}

.convoy {
  width: max-content;
  margin: 0 auto;
}

.convoy.celebrate .engine .smoke {
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
  gap: 6px;
  width: max-content;
  padding: 0 24px;
}

.train.wrong {
  animation: shake 0.45s ease;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-10px);
  }
  75% {
    transform: translateX(10px);
  }
}

.engine {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-right: 4px;
}

.smoke {
  font-size: 2rem;
  line-height: 1;
  opacity: 0.7;
}

.loco {
  font-size: 4.5rem;
  line-height: 1;
  filter: drop-shadow(3px 6px 0 rgba(0, 0, 0, 0.12));
}

.carriage {
  flex: 0 0 auto;
  min-width: 7.5rem;
  width: max-content;
  min-height: 150px;
  border-radius: 16px 16px 10px 10px;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  box-shadow: inset 0 -8px 0 rgba(0, 0, 0, 0.1), 0 8px 18px rgba(0, 0, 0, 0.15);
  touch-action: none;
}

.season-ribbon {
  text-align: center;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 8px 4px 6px;
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}

.drop-slot {
  flex: 1;
  margin: 0 8px 10px;
  border-radius: 12px;
  border: 3px dashed rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  padding: 6px;
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
  height: 14px;
  margin: 0 16px;
  margin-top: -8px;
  border-radius: 6px;
  opacity: 0.6;
}

/* 鐵軌：枕木 */
.rails-rail {
  background: repeating-linear-gradient(
    90deg,
    #789 0,
    #789 18px,
    transparent 18px,
    transparent 28px
  );
}

/* 馬路：柏油 + 中線 */
.rails-road {
  height: 14px;
  border-radius: 6px;
  background: #555a60;
  background-image: repeating-linear-gradient(
    90deg,
    #ffd54f 0,
    #ffd54f 18px,
    transparent 18px,
    transparent 36px
  );
  background-size: 100% 3px;
  background-position: center;
  background-repeat: no-repeat;
  opacity: 0.7;
}

/* 水面：波浪 */
.rails-water {
  height: 14px;
  border-radius: 8px;
  background: repeating-linear-gradient(
    90deg,
    #4fc3f7 0,
    #29b6f6 12px,
    #4fc3f7 24px
  );
  opacity: 0.6;
}

/* 天空：虛線雲帶 */
.rails-sky {
  height: 8px;
  background: repeating-linear-gradient(
    90deg,
    #cfe8ff 0,
    #cfe8ff 10px,
    transparent 10px,
    transparent 26px
  );
  opacity: 0.8;
}

/* 草地 */
.rails-grass {
  height: 12px;
  border-radius: 6px;
  background: repeating-linear-gradient(
    90deg,
    #7bc96f 0,
    #5fb35a 10px,
    #7bc96f 20px
  );
  opacity: 0.7;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 4px;
  transform: translateX(-50%);
  text-align: center;
  font-weight: 700;
  font-size: 1.2rem;
  color: #0d6e3d;
  margin: 0;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.88);
  border-radius: 999px;
  pointer-events: none;
  animation: pop 0.45s ease;
  white-space: nowrap;
}

.toast-bad {
  color: #a33b12;
}

@keyframes pop {
  from {
    transform: translateX(-50%) scale(0.85);
    opacity: 0;
  }
  to {
    transform: translateX(-50%) scale(1);
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
