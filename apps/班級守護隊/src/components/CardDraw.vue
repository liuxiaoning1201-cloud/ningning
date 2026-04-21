<script setup lang="ts">
import { ref, computed } from 'vue'
import type { RewardCard } from '../types'
import { RARITY_CONFIG } from '../types'

const props = defineProps<{
  /** 3 張候選卡片（背面相同，老師選其中一張翻開） */
  candidates: RewardCard[]
  /** 冠軍組名稱 */
  groupName: string
  /** 冠軍組頭像 */
  groupAvatar: string
  /** 冠軍組主色調 */
  groupColor: string
}>()

const emit = defineEmits<{
  (e: 'revealed', card: RewardCard): void
}>()

const flippedIndex = ref<number | null>(null)
const hovering = ref<number | null>(null)

const revealedCard = computed(() => flippedIndex.value !== null ? props.candidates[flippedIndex.value] : null)

function flipCard(idx: number) {
  if (flippedIndex.value !== null) return
  flippedIndex.value = idx
  setTimeout(() => {
    const card = props.candidates[idx]
    if (card) emit('revealed', card)
  }, 900)
}

function getRarityStyle(rarity: string) {
  const cfg = RARITY_CONFIG[rarity as keyof typeof RARITY_CONFIG] ?? RARITY_CONFIG.common
  return {
    color: cfg.color,
    background: cfg.bg,
    borderColor: cfg.border,
  }
}
</script>

<template>
  <div class="flex flex-col items-center gap-6">
    <div class="text-center">
      <p class="text-sm text-white/70 mb-1 flex items-center justify-center gap-2">
        <span>冠軍組 ·</span>
        <img :src="groupAvatar" :alt="`${groupName} 頭像`" class="w-6 h-6 rounded-full object-cover border border-white/60" />
        <span>{{ groupName }}</span>
      </p>
      <h2 class="text-3xl font-bold text-white drop-shadow-lg">
        <template v-if="flippedIndex === null">選一張卡片翻開</template>
        <template v-else>恭喜獲得獎勵！</template>
      </h2>
    </div>

    <div class="flex gap-6 perspective">
      <div
        v-for="(card, idx) in candidates"
        :key="idx"
        class="card-slot relative"
        :class="{
          'selected': flippedIndex === idx,
          'dimmed': flippedIndex !== null && flippedIndex !== idx,
          'hovering': hovering === idx && flippedIndex === null,
        }"
        @mouseenter="hovering = idx"
        @mouseleave="hovering = null"
      >
        <div
          class="card-inner"
          :class="{ flipped: flippedIndex === idx }"
          @click="flipCard(idx)"
        >
          <!-- Card Back -->
          <div
            class="card-face card-back"
            :style="{
              background: `linear-gradient(135deg, ${groupColor}, ${groupColor}cc)`,
              borderColor: groupColor,
            }"
          >
            <div class="card-back-pattern">
              <div class="text-6xl opacity-90 drop-shadow-lg">❓</div>
              <div class="text-sm font-bold text-white/90 mt-2">點擊翻開</div>
            </div>
            <div class="card-glow" :style="{ background: groupColor }" />
          </div>

          <!-- Card Front -->
          <div
            class="card-face card-front"
            :style="getRarityStyle(card.rarity)"
          >
            <div
              class="rarity-tag"
              :style="{ backgroundColor: RARITY_CONFIG[card.rarity].color, color: 'white' }"
            >
              {{ RARITY_CONFIG[card.rarity].label }}
            </div>
            <div class="text-6xl mt-4 drop-shadow">{{ card.emoji }}</div>
            <h3 class="text-xl font-extrabold mt-3 px-2 text-center">{{ card.name }}</h3>
            <p class="text-xs mt-2 px-3 text-center opacity-80 leading-relaxed">
              {{ card.description }}
            </p>
            <!-- sparkle for legendary -->
            <div v-if="card.rarity === 'legendary'" class="sparkles pointer-events-none">
              <span v-for="i in 6" :key="i" class="sparkle" :style="{
                top: (Math.random() * 80 + 10) + '%',
                left: (Math.random() * 80 + 10) + '%',
                animationDelay: (Math.random() * 2) + 's',
              }">✨</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="revealedCard"
      class="text-center animate-fadeIn mt-2"
    >
      <p class="text-lg text-white/90 font-medium">🎁 獎勵：{{ revealedCard.description }}</p>
    </div>
  </div>
</template>

<style scoped>
.perspective {
  perspective: 1200px;
}

.card-slot {
  width: 180px;
  height: 260px;
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  transform-style: preserve-3d;
  cursor: pointer;
}

.card-slot.hovering {
  transform: translateY(-10px);
}

.card-slot.selected {
  transform: translateY(-20px) scale(1.1);
  z-index: 10;
}

.card-slot.dimmed {
  opacity: 0.35;
  transform: scale(0.92);
  filter: grayscale(40%);
  pointer-events: none;
}

.card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 0.9s cubic-bezier(0.4, 0.1, 0.2, 1);
}

.card-inner.flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  border-radius: 18px;
  border: 3px solid;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.35);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.card-back {
  overflow: hidden;
}

.card-back-pattern {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.card-back::before {
  content: '';
  position: absolute;
  inset: 12px;
  border: 2px dashed rgba(255, 255, 255, 0.5);
  border-radius: 12px;
}

.card-glow {
  position: absolute;
  width: 200%;
  height: 200%;
  top: -50%;
  left: -50%;
  opacity: 0.3;
  animation: shimmer 3s infinite linear;
  background: radial-gradient(circle, currentColor 0%, transparent 60%);
}

@keyframes shimmer {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.card-front {
  transform: rotateY(180deg);
  padding: 16px;
}

.rarity-tag {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 9px;
  border-radius: 999px;
  letter-spacing: 0.05em;
}

.sparkles {
  position: absolute;
  inset: 0;
}

.sparkle {
  position: absolute;
  font-size: 14px;
  animation: sparkle 2s infinite;
}

@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0.6); }
  50% { opacity: 1; transform: scale(1.2); }
}

.animate-fadeIn {
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
