<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG, ENCOURAGEMENTS_BY_CATEGORY, type ScoreCategory } from '../types'

const store = useClassStore()
const router = useRouter()

// 依課堂計分類別歸類的鼓勵語，輪播時攤平為一維陣列（共 21 句）
const encouragements = (['learning', 'listening', 'cooperation', 'habit', 'reminder'] as ScoreCategory[])
  .flatMap(cat => ENCOURAGEMENTS_BY_CATEGORY[cat])

const currentEncouragementIndex = ref(0)
let encouragementTimer: ReturnType<typeof setInterval>

onMounted(() => {
  encouragementTimer = setInterval(() => {
    currentEncouragementIndex.value = (currentEncouragementIndex.value + 1) % encouragements.length
  }, 6000)
})

onUnmounted(() => {
  clearInterval(encouragementTimer)
})

const currentEncouragement = computed(() => encouragements[currentEncouragementIndex.value])

const todayDate = computed(() => {
  const d = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${weekdays[d.getDay()]}`
})

const MAX_DISPLAY_SCORE = 30

function scoreToStars(score: number): number {
  const clamped = Math.max(0, Math.min(score, MAX_DISPLAY_SCORE))
  return Math.round((clamped / MAX_DISPLAY_SCORE) * 5)
}

function scoreToPercent(score: number): number {
  return Math.min(100, Math.max(0, (score / MAX_DISPLAY_SCORE) * 100))
}

function getAnimalStyle(animal: keyof typeof ANIMAL_CONFIG) {
  const cfg = ANIMAL_CONFIG[animal]
  return {
    card: { backgroundColor: cfg.lightColor, borderColor: cfg.color },
    bar: { backgroundColor: cfg.color },
    text: { color: cfg.darkColor },
  }
}

function getGroupBadges(groupId: string) {
  return store.getUnlockedBadges(groupId).slice(-5)
}

function getCategoryProgress(groupId: string) {
  const breakdown = store.getCategoryBreakdown(groupId, getTodayStart())
  const categories = ['learning', 'listening', 'cooperation', 'habit'] as const
  return categories.map(cat => ({
    key: cat,
    filled: (breakdown[cat] ?? 0) > 0,
  }))
}

function getTodayStart(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}
</script>

<template>
  <div class="w-full min-h-screen bg-gradient-to-br from-amber-50 via-purple-50 to-teal-50 flex flex-col relative overflow-hidden">
    <div class="absolute inset-0 opacity-5 pointer-events-none">
      <div class="absolute top-10 left-10 text-9xl">🐾</div>
      <div class="absolute top-20 right-20 text-8xl">⭐</div>
      <div class="absolute bottom-20 left-1/4 text-8xl">🌟</div>
      <div class="absolute bottom-10 right-10 text-9xl">🐾</div>
    </div>

    <button
      @click="router.push('/')"
      class="absolute top-4 right-4 z-20 px-4 py-2 bg-white/70 hover:bg-white rounded-full text-sm text-stone-500 hover:text-stone-700 shadow-sm backdrop-blur transition-all"
    >
      ← 返回
    </button>

    <header class="text-center pt-8 pb-4 relative z-10">
      <h1 class="text-5xl font-bold text-stone-700 tracking-wide">
        {{ store.classData.name }}
      </h1>
      <p class="text-2xl text-stone-400 mt-2">{{ todayDate }}</p>
    </header>

    <main class="flex-1 flex items-stretch gap-6 px-8 pb-6 relative z-10">
      <div
        v-for="group in store.groups"
        :key="group.id"
        class="flex-1 rounded-3xl p-6 flex flex-col items-center shadow-lg border-2 transition-all duration-500"
        :style="getAnimalStyle(group.animal).card"
      >
        <span class="text-8xl mb-3 drop-shadow-md animate-bounce" style="animation-duration: 3s;">
          {{ ANIMAL_CONFIG[group.animal].emoji }}
        </span>

        <h2
          class="text-3xl font-bold mb-4"
          :style="getAnimalStyle(group.animal).text"
        >
          {{ group.name }}
        </h2>

        <div class="flex gap-1.5 mb-4">
          <span
            v-for="i in 5"
            :key="i"
            class="text-4xl transition-all duration-300"
            :class="i <= scoreToStars(store.getGroupTodayScore(group.id))
              ? 'scale-110 drop-shadow-md'
              : 'opacity-25 grayscale'"
          >
            ⭐
          </span>
        </div>

        <div class="w-full h-5 bg-white/60 rounded-full overflow-hidden mb-5 shadow-inner">
          <div
            class="h-full rounded-full transition-all duration-700 ease-out"
            :style="{
              ...getAnimalStyle(group.animal).bar,
              width: scoreToPercent(store.getGroupTodayScore(group.id)) + '%',
            }"
          />
        </div>

        <div class="flex gap-3 mb-5">
          <div
            v-for="cat in getCategoryProgress(group.id)"
            :key="cat.key"
            class="w-5 h-5 rounded-full border-2 transition-all duration-300"
            :style="{
              borderColor: ANIMAL_CONFIG[group.animal].color,
              backgroundColor: cat.filled ? ANIMAL_CONFIG[group.animal].color : 'transparent',
            }"
          />
        </div>

        <div
          v-if="getGroupBadges(group.id).length > 0"
          class="mt-auto bg-white/50 rounded-2xl px-4 py-3 w-full"
        >
          <p class="text-xs text-stone-400 text-center mb-2">獲得徽章</p>
          <div class="flex justify-center gap-2 flex-wrap">
            <span
              v-for="badge in getGroupBadges(group.id)"
              :key="badge.id"
              class="text-3xl"
              :title="badge.name"
            >
              {{ badge.emoji }}
            </span>
          </div>
        </div>

        <div
          v-else
          class="mt-auto bg-white/30 rounded-2xl px-4 py-3 w-full text-center"
        >
          <p class="text-sm text-stone-400">努力收集徽章中 ✨</p>
        </div>
      </div>
    </main>

    <footer class="relative z-10 pb-8 text-center">
      <div class="inline-block bg-white/70 backdrop-blur rounded-2xl px-10 py-4 shadow-md">
        <p class="text-2xl font-medium text-stone-600 transition-all duration-500">
          {{ currentEncouragement }}
        </p>
      </div>
    </footer>
  </div>
</template>
