<template>
  <div class="page battle-page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-ghost">← 離開</RouterLink>
      <div class="nav-actions">
        <button v-if="canDeclare" class="btn btn-secondary" @click="enterDeclareMode">📜 宣告連線</button>
      </div>
    </nav>

    <RuleHUD
      v-if="rule"
      :rule="rule"
      :template-name="templateName"
      :status="status"
      :current-turn="currentTurn"
      :winner="winner"
      :black-name="blackName"
      :white-name="whiteName"
      :black-lines="blackLines"
      :white-lines="whiteLines"
      :black-streak="blackStreak"
      :white-streak="whiteStreak"
      :seconds-left="countSecondsLeft"
      :turn-deadline="turnDeadline"
      :hint-text="hintText"
    />

    <GomokuBoard
      v-if="board"
      :board="board"
      :interactive="canInteract"
      :last-move="lastMove"
      :highlight-line="winnerLine"
      :selecting="declareCells"
      @cell-click="onCellClick"
    />

    <div v-if="declareMode" class="declare-bar animate-fade-in">
      <span>已選 {{ declareCells.length }} 格</span>
      <button class="btn btn-secondary" @click="cancelDeclare">取消</button>
      <button
        class="btn btn-primary"
        :disabled="declareCells.length < minDeclareLen"
        @click="openDeclareDialog"
      >下一步</button>
    </div>

    <div v-if="status === 'ended'" class="endgame-summary card animate-fade-in">
      <strong>對局結束：</strong>{{ endReason }}
    </div>

    <!-- 答題卡 -->
    <QuestionCard
      v-if="pendingQA"
      :card="pendingQA.card"
      :target-cell="pendingQA.targetCell"
      @answer="onAnswer"
      @close="onQACardClose"
    />

    <!-- 句子質疑（句子接龍模式） -->
    <div v-if="pendingComplete && !declareMode" class="modal-mask">
      <div class="modal animate-pop">
        <h3 class="modal-title">⚠️ 對手宣告</h3>
        <p>{{ pendingComplete.by === 'black' ? blackName : whiteName }} 宣告拼出：</p>
        <div class="declared-text">「{{ pendingComplete.text }}」</div>
        <p class="muted">請對手在 {{ pendingCompleteSeconds }} 秒內決定接受或質疑（沉默視為接受）。</p>
        <div class="modal-actions">
          <button class="btn btn-secondary" @click="onChallenge">質疑</button>
          <button class="btn btn-primary" @click="onAccept">接受</button>
        </div>
      </div>
    </div>

    <!-- 宣告對話框 -->
    <CompleteDeclareDialog
      v-if="declareDialog"
      :selected-cells="selectedCellsWithCh"
      :content-type="declareContentType"
      @submit="submitDeclare"
      @close="declareDialog = false"
    />

    <!-- 勝負橫幅 -->
    <WinBanner
      :visible="status === 'ended'"
      :winner="winner"
      :reason="endReason"
      :text="winnerLineText"
      :black-name="blackName"
      :white-name="whiteName"
      @rematch="onRematch"
      @home="$router.push('/')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import GomokuBoard from "@/components/GomokuBoard.vue";
import RuleHUD from "@/components/RuleHUD.vue";
import QuestionCard from "@/components/QuestionCard.vue";
import CompleteDeclareDialog from "@/components/CompleteDeclareDialog.vue";
import WinBanner from "@/components/WinBanner.vue";
import { useGameSessionStore } from "@/stores/gameSession";
import { useRemoteGameStore } from "@/stores/remoteGame";
import { useTemplatesStore } from "@/stores/templates";
import { findLineHints } from "@/lib/ruleEngine";
import type { ContentType, GameRule, Player } from "@/lib/types";

const route = useRoute();
const router = useRouter();
const local = useGameSessionStore();
const remote = useRemoteGameStore();
const templates = useTemplatesStore();

const isRemote = computed(() => route.name === "play-remote");
const roomId = computed(() => String(route.params.roomId || ""));

// ── 連接遠程 ──
onMounted(() => {
  if (isRemote.value && roomId.value) {
    remote.connect(roomId.value);
  } else if (!local.template) {
    router.replace("/");
  }
});

onUnmounted(() => {
  if (isRemote.value) remote.disconnect();
});

// ── 統一資料源（local / remote） ──
const board = computed(() => isRemote.value ? remote.state?.board ?? null : local.board);
const rule = computed<GameRule | null>(() => isRemote.value ? remote.state?.rule ?? null : local.rule);
const templateName = computed(() => isRemote.value ? remote.state?.templateName ?? "" : local.template?.name ?? "");
const status = computed(() => isRemote.value ? remote.state?.status ?? "waiting" : local.status);
const currentTurn = computed<Player>(() => isRemote.value ? remote.state?.currentTurn ?? "black" : local.currentTurn);
const winner = computed(() => isRemote.value ? remote.state?.winner ?? null : local.winner);
const winnerLine = computed(() => isRemote.value ? remote.state?.winnerLine ?? null : local.winnerLine);
const endReason = computed(() => isRemote.value ? remote.state?.endReason ?? "" : local.endReason);
const lastMove = computed(() => isRemote.value
  ? (remote.state?.lastMove ? { r: remote.state.lastMove.r, c: remote.state.lastMove.c } : null)
  : (local.lastMove ? { r: local.lastMove.r, c: local.lastMove.c } : null));

const blackName = computed(() => {
  if (isRemote.value) return remote.findPlayer("black")?.name ?? "黑方";
  return local.players.black.name;
});
const whiteName = computed(() => {
  if (isRemote.value) return remote.findPlayer("white")?.name ?? "白方";
  return local.players.white.name;
});

const blackLines = computed(() => isRemote.value ? remote.findPlayer("black")?.countLines ?? 0 : local.players.black.countLines);
const whiteLines = computed(() => isRemote.value ? remote.findPlayer("white")?.countLines ?? 0 : local.players.white.countLines);
const blackStreak = computed(() => isRemote.value ? remote.findPlayer("black")?.qaStreak ?? 0 : local.players.black.qaStreak);
const whiteStreak = computed(() => isRemote.value ? remote.findPlayer("white")?.qaStreak ?? 0 : local.players.white.qaStreak);

const countSecondsLeft = computed(() => {
  if (isRemote.value) return remote.countdownSecondsLeft;
  if (rule.value?.win.kind !== "count") return 0;
  if (!local.deadline) return 0;
  return Math.max(0, Math.ceil((local.deadline - tickNow.value) / 1000));
});

const turnDeadline = computed(() => {
  if (rule.value?.win.kind === "count") return null;
  return isRemote.value ? remote.state?.deadline ?? null : local.deadline;
});

const tickNow = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timer = setInterval(() => {
    tickNow.value = Date.now();
    // 本地 count 模式倒數歸零自動結束
    if (!isRemote.value && local.rule?.win.kind === "count" && local.status === "playing" && local.deadline && Date.now() >= local.deadline) {
      local.onCountTimeout();
    }
  }, 500);
});
onUnmounted(() => { if (timer) clearInterval(timer); });

// ── 互動權限 ──
const canInteract = computed(() => {
  if (status.value !== "playing") return false;
  if (declareMode.value) return true;
  if (pendingComplete.value && !isMyTurn.value) return false;
  if (isRemote.value) {
    if (!remote.you.color) return false;
    if (remote.pendingQA && remote.pendingQA.forPlayer === remote.you.color) return false;
    return remote.you.color === currentTurn.value;
  }
  return true;
});

const isMyTurn = computed(() => {
  if (!isRemote.value) return true;
  return remote.you.color === currentTurn.value;
});

// ── 答題 ──
const pendingQA = computed(() => {
  if (isRemote.value) {
    if (!remote.pendingQA) return null;
    if (remote.pendingQA.forPlayer !== remote.you.color) return null;
    return remote.pendingQA;
  }
  if (!local.pendingQA) return null;
  return local.pendingQA;
});

function onAnswer(idx: number) {
  if (isRemote.value) {
    remote.answer(idx);
  } else {
    local.answerQuestion(idx);
  }
}

function onQACardClose() {
  // 由父層動畫淡出，狀態已在 onAnswer 中清空
}

// ── 落子 ──
function onCellClick(cell: { r: number; c: number }) {
  if (declareMode.value) {
    toggleDeclareCell(cell);
    return;
  }
  if (status.value !== "playing") return;

  if (isRemote.value) {
    if (!isMyTurn.value) return;
    remote.place(cell.r, cell.c);
  } else {
    const result = local.requestPlace(cell.r, cell.c);
    if (!result.placed && !result.needsQA && result.reason) {
      flashError(result.reason);
    }
  }
}

const errorFlash = ref("");
function flashError(msg: string) {
  errorFlash.value = msg;
  setTimeout(() => { errorFlash.value = ""; }, 2000);
}

// ── 句子質疑 ──
const pendingComplete = computed(() => {
  if (isRemote.value) return remote.pendingComplete;
  return local.pendingComplete;
});

const pendingCompleteSeconds = computed(() => {
  if (!pendingComplete.value) return 0;
  return Math.max(0, Math.ceil((pendingComplete.value.expiresAt - tickNow.value) / 1000));
});

function onChallenge() {
  if (isRemote.value) remote.challenge();
  else local.rejectComplete();
}
function onAccept() {
  if (isRemote.value) remote.accept();
  else local.acceptComplete();
}

// ── 宣告連線（句子模式或非自動 complete 模式） ──
const declareMode = ref(false);
const declareCells = ref<{ r: number; c: number }[]>([]);
const declareDialog = ref(false);

const canDeclare = computed(() => {
  if (status.value !== "playing") return false;
  if (rule.value?.win.kind !== "complete") return false;
  if (!rule.value.challengeable) return false;
  if (isRemote.value && !isMyTurn.value) return false;
  return true;
});

const minDeclareLen = computed(() => {
  const t = rule.value?.win.kind === "complete" ? rule.value.win.targetType : rule.value?.content;
  switch (t) {
    case "idiom": return 4;
    case "poem-5": return 5;
    case "poem-7": return 7;
    case "sentence": return 5;
    default: return 2;
  }
});

const declareContentType = computed<ContentType>(() => {
  return (rule.value?.win.kind === "complete" ? rule.value.win.targetType : rule.value?.content) ?? "free";
});

function enterDeclareMode() {
  declareCells.value = [];
  declareMode.value = true;
}

function cancelDeclare() {
  declareMode.value = false;
  declareCells.value = [];
}

function toggleDeclareCell(cell: { r: number; c: number }) {
  // 取消已選
  const i = declareCells.value.findIndex((p) => p.r === cell.r && p.c === cell.c);
  if (i >= 0) {
    declareCells.value = declareCells.value.slice(0, i);
    return;
  }
  // 必須是當前玩家的棋子
  const me = isRemote.value ? remote.you.color : currentTurn.value;
  if (!me) return;
  const cs = board.value?.cells[cell.r]?.[cell.c];
  if (!cs || cs.type !== "claimed" || cs.by !== me) {
    flashError("只能選擇自己的棋子");
    return;
  }
  declareCells.value = [...declareCells.value, cell];
}

const selectedCellsWithCh = computed(() =>
  declareCells.value.map((p) => {
    const cs = board.value?.cells[p.r]?.[p.c];
    return { r: p.r, c: p.c, ch: cs?.type === "claimed" ? cs.ch : undefined };
  })
);

function openDeclareDialog() {
  declareDialog.value = true;
}

function submitDeclare(text: string) {
  if (isRemote.value) {
    remote.declareComplete(declareCells.value, text);
  } else {
    const r = local.declareComplete(declareCells.value, text);
    if (!r.ok) flashError(r.reason || "宣告失敗");
  }
  declareDialog.value = false;
  declareMode.value = false;
  declareCells.value = [];
}

// ── HUD 提示 ──
const hintText = computed(() => {
  if (status.value !== "playing") return "";
  if (errorFlash.value) return errorFlash.value;
  if (rule.value?.win.kind !== "complete") return "";
  if (!board.value) return "";
  const me = isRemote.value ? remote.you.color : currentTurn.value;
  if (!me) return "";
  const hints = findLineHints(board.value, me, rule.value);
  if (hints.length === 0) return "";
  const top = hints[0];
  if (top.perfectHit) return `🎯 你已連成「${top.perfectHit}」！系統將自動判勝。`;
  if (top.candidates.length > 0) return `💡 你目前的連線「${top.text}」接近「${top.candidates[0]}」（差 1 字）`;
  return "";
});

const winnerLineText = computed(() => {
  const line = winnerLine.value;
  if (!line) return "";
  return line.cells.map((c) => c.ch || "").join("");
});

function onRematch() {
  if (isRemote.value) {
    remote.rematch();
  } else {
    local.requestRematch();
  }
}

// 重新進入時若 local 沒有對局，回首頁
watch(() => local.status, (s) => {
  if (!isRemote.value && s === "waiting" && !local.template) router.replace("/");
});
</script>

<style scoped>
.battle-page { max-width: 720px; margin: 0 auto; }

.nav-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.nav-actions { display: flex; gap: 0.4rem; }

.endgame-summary {
  margin-top: 1rem;
  font-size: 0.95rem;
  color: var(--ink);
}

.declare-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  background: linear-gradient(135deg, rgba(193, 53, 45, 0.06), rgba(200, 148, 58, 0.08));
  border: 2px dashed var(--crimson);
  border-radius: 12px;
  padding: 0.6rem 1rem;
  margin-top: 0.8rem;
}

.modal-mask {
  position: fixed; inset: 0;
  background: rgba(45, 36, 25, 0.55);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  padding: 1rem; z-index: 100;
}
.modal {
  background: var(--card-bg);
  border: 2px solid var(--gold);
  border-radius: var(--radius-lg);
  padding: 1.5rem;
  max-width: 420px; width: 100%;
  text-align: center;
}
.modal-title {
  font-family: var(--font-heading);
  margin: 0 0 0.5rem;
}
.declared-text {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  color: var(--crimson);
  margin: 1rem 0;
  letter-spacing: 0.1em;
}
.modal-actions {
  display: flex; gap: 0.6rem; justify-content: center;
  margin-top: 1rem;
}
</style>
