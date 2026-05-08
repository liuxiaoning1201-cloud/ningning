<template>
  <div class="hud">
    <!-- 玩家欄：黑棋 -->
    <div class="player-card" :class="{ active: currentTurn === 'black', winner: winner === 'black' }">
      <div class="stone-mark stone-black-icon"></div>
      <div class="player-info">
        <div class="player-name">{{ blackName }}</div>
        <div class="player-extra">
          <span v-if="rule?.win.kind === 'count'">連線 {{ blackLines }} 條</span>
          <span v-else-if="rule?.placement.kind === 'qa'">連答 {{ blackStreak }}</span>
          <span v-else>{{ currentTurn === 'black' ? '行棋中' : '等待' }}</span>
        </div>
      </div>
    </div>

    <!-- 中央資訊 -->
    <div class="center-info">
      <div class="center-title">{{ templateName }}</div>
      <div v-if="status === 'playing'" class="center-meta">
        <span v-if="rule?.win.kind === 'first'" class="rule-tag tag tag-primary">先連 {{ rule.win.n }} 子</span>
        <span v-else-if="rule?.win.kind === 'count'" class="rule-tag tag tag-gold">⏱ {{ formatTime(secondsLeft ?? 0) }}</span>
        <span v-else-if="rule?.win.kind === 'complete'" class="rule-tag tag tag-jade">拼出{{ targetLabel }}</span>
        <span v-if="turnDeadline" class="rule-tag tag tag-indigo">本回合 {{ turnSecondsLeft }}s</span>
      </div>
      <div v-else-if="status === 'waiting'" class="center-meta muted">等待對手加入…</div>
    </div>

    <!-- 玩家欄：白棋 -->
    <div class="player-card right" :class="{ active: currentTurn === 'white', winner: winner === 'white' }">
      <div class="player-info right">
        <div class="player-name">{{ whiteName }}</div>
        <div class="player-extra">
          <span v-if="rule?.win.kind === 'count'">連線 {{ whiteLines }} 條</span>
          <span v-else-if="rule?.placement.kind === 'qa'">連答 {{ whiteStreak }}</span>
          <span v-else>{{ currentTurn === 'white' ? '行棋中' : '等待' }}</span>
        </div>
      </div>
      <div class="stone-mark stone-white-icon"></div>
    </div>
  </div>

  <!-- 提示 -->
  <div v-if="hintText" class="hint-bar animate-fade-in">{{ hintText }}</div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { ContentType, GameRule, Player } from "@/lib/types";

const props = defineProps<{
  rule: GameRule | null;
  templateName: string;
  status: "waiting" | "playing" | "ended";
  currentTurn: Player;
  winner?: Player | "draw" | null;
  blackName: string;
  whiteName: string;
  blackLines?: number;
  whiteLines?: number;
  blackStreak?: number;
  whiteStreak?: number;
  secondsLeft?: number;          // count 模式倒數
  turnDeadline?: number | null;  // 回合截止 timestamp
  hintText?: string;
}>();

const targetLabel = computed(() => contentLabel(
  (props.rule?.win.kind === "complete" ? props.rule.win.targetType : props.rule?.content) ?? "free"
));

function contentLabel(t: ContentType): string {
  switch (t) {
    case "idiom": return "成語";
    case "poem-5": return "五言詩";
    case "poem-7": return "七言詩";
    case "sentence": return "完整句子";
    case "char": return "識字組合";
    case "word": return "詞語";
    default: return "連線";
  }
}

const tickNow = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => { timer = setInterval(() => { tickNow.value = Date.now(); }, 500); });
onUnmounted(() => { if (timer) clearInterval(timer); });

const turnSecondsLeft = computed(() => {
  if (!props.turnDeadline) return 0;
  return Math.max(0, Math.ceil((props.turnDeadline - tickNow.value) / 1000));
});

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
</script>

<style scoped>
.hud {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0.8rem;
  background: var(--card-bg);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);
  margin-bottom: 0.8rem;
  box-shadow: var(--shadow);
}

.player-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.4rem 0.6rem;
  border-radius: 12px;
  transition: background 0.2s ease, transform 0.2s ease;
  border: 2px solid transparent;
}
.player-card.right { flex-direction: row-reverse; }

.player-card.active {
  background: linear-gradient(135deg, rgba(193, 53, 45, 0.08), rgba(200, 148, 58, 0.08));
  border-color: rgba(193, 53, 45, 0.3);
  transform: translateY(-1px);
}

.player-card.winner {
  background: linear-gradient(135deg, rgba(200, 148, 58, 0.18), rgba(193, 53, 45, 0.12));
  border-color: var(--gold);
}

.stone-mark {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}
.stone-black-icon { background: var(--black-stone); box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
.stone-white-icon { background: var(--white-stone); box-shadow: 0 2px 4px rgba(0,0,0,0.2); }

.player-info { line-height: 1.2; }
.player-info.right { text-align: right; }
.player-name {
  font-family: var(--font-heading);
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--ink);
}
.player-extra {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.center-info { text-align: center; min-width: 0; }
.center-title {
  font-family: var(--font-heading);
  font-size: 1rem;
  font-weight: 700;
  color: var(--gold-deep);
  margin-bottom: 0.2rem;
  letter-spacing: 0.02em;
}
.center-meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.3rem;
}
.rule-tag { font-size: 0.7rem; padding: 0.1rem 0.5rem; }

.hint-bar {
  background: linear-gradient(135deg, rgba(200, 148, 58, 0.1), rgba(200, 148, 58, 0.04));
  border: 1px dashed var(--gold);
  color: var(--gold-deep);
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  font-size: 0.85rem;
  margin-bottom: 0.6rem;
  text-align: center;
}

@media (max-width: 480px) {
  .hud { grid-template-columns: 1fr 1fr; }
  .center-info { grid-column: 1 / -1; order: -1; }
  .player-card.right { flex-direction: row; justify-content: flex-end; }
  .player-info.right { text-align: left; }
}
</style>
