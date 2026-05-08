<template>
  <Transition name="banner">
    <div v-if="visible" class="win-mask">
      <div class="win-card animate-pop">
        <div class="win-emoji">{{ emoji }}</div>
        <div class="win-title">{{ title }}</div>
        <div class="win-reason">{{ reason }}</div>
        <div v-if="text" class="win-text">「{{ text }}」</div>

        <div class="win-actions">
          <button class="btn btn-secondary" @click="$emit('home')">返回首頁</button>
          <button class="btn btn-primary" @click="$emit('rematch')">再來一局</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Player } from "@/lib/types";

const props = defineProps<{
  visible: boolean;
  winner: Player | "draw" | null;
  reason: string;
  text?: string;
  blackName: string;
  whiteName: string;
}>();

defineEmits<{
  (e: "rematch"): void;
  (e: "home"): void;
}>();

const emoji = computed(() => {
  if (props.winner === "draw") return "⚖️";
  return "🏆";
});

const title = computed(() => {
  if (props.winner === "draw") return "平手！";
  if (props.winner === "black") return `${props.blackName} 勝出`;
  if (props.winner === "white") return `${props.whiteName} 勝出`;
  return "對局結束";
});
</script>

<style scoped>
.win-mask {
  position: fixed;
  inset: 0;
  background: rgba(45, 36, 25, 0.6);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  z-index: 200;
}

.win-card {
  background: linear-gradient(160deg, #fffefa 0%, #fff5e0 100%);
  border: 3px solid var(--gold);
  border-radius: 28px;
  padding: 2rem 2.4rem;
  text-align: center;
  max-width: 420px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  position: relative;
  overflow: hidden;
}

.win-card::before {
  content: "";
  position: absolute;
  inset: -2px;
  background: linear-gradient(45deg, transparent 30%, rgba(200, 148, 58, 0.4) 50%, transparent 70%);
  background-size: 200% 200%;
  animation: shimmer 3s linear infinite;
  z-index: 0;
}

.win-card > * { position: relative; z-index: 1; }

.win-emoji {
  font-size: 4rem;
  margin-bottom: 0.5rem;
  animation: bounce 1s ease infinite;
}

.win-title {
  font-family: var(--font-heading);
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--gold-deep);
  margin-bottom: 0.5rem;
}

.win-reason {
  color: var(--text-muted);
  font-size: 1rem;
  margin-bottom: 0.4rem;
}

.win-text {
  font-family: var(--font-heading);
  font-size: 1.6rem;
  color: var(--crimson);
  margin: 1rem 0;
  letter-spacing: 0.1em;
}

.win-actions {
  display: flex;
  gap: 0.8rem;
  justify-content: center;
  margin-top: 1.5rem;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.banner-enter-active, .banner-leave-active { transition: all 0.4s ease; }
.banner-enter-from, .banner-leave-to { opacity: 0; }
</style>
