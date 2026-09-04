<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ANIMAL_CONFIG, type Group } from '../types'

const props = defineProps<{
  /** 各組最終分數 */
  scores: { group: Group; score: number }[]
  /** 揭曉完成後觸發 */
}>()

const emit = defineEmits<{
  (e: 'done'): void
}>()

const displayScores = ref<Record<string, number>>({})
const showRank = ref(false)
const champIds = ref<string[]>([])

const ranked = computed(() => {
  return [...props.scores].sort((a, b) => b.score - a.score)
})

onMounted(() => {
  // 初始化顯示分數為 0
  props.scores.forEach(s => { displayScores.value[s.group.id] = 0 })

  // 各組分數從 0 爬升到目標值（約 1.5 秒）
  const duration = 1500
  const start = performance.now()
  const targets: Record<string, number> = {}
  props.scores.forEach(s => { targets[s.group.id] = s.score })

  function tick(now: number) {
    const t = Math.min(1, (now - start) / duration)
    // easeOutCubic
    const eased = 1 - Math.pow(1 - t, 3)
    props.scores.forEach(s => {
      displayScores.value[s.group.id] = Math.round(targets[s.group.id] * eased)
    })
    if (t < 1) requestAnimationFrame(tick)
    else {
      // 揭曉排名
      setTimeout(() => {
        const maxScore = Math.max(...props.scores.map(s => s.score))
        if (maxScore > 0) {
          champIds.value = props.scores.filter(s => s.score === maxScore).map(s => s.group.id)
        }
        showRank.value = true
        setTimeout(() => emit('done'), 1800)
      }, 500)
    }
  }
  requestAnimationFrame(tick)
})
</script>

<template>
  <div class="w-full flex flex-col items-center gap-4">
    <h2 class="text-4xl font-extrabold text-white drop-shadow-lg mb-2">
      {{ showRank ? '🎉 本堂課結算！' : '分數統計中...' }}
    </h2>

    <div class="flex gap-6 items-end">
      <div
        v-for="item in ranked"
        :key="item.group.id"
        class="group-card-wrapper"
        :class="{
          champion: champIds.includes(item.group.id) && showRank,
          'not-champion': showRank && champIds.length > 0 && !champIds.includes(item.group.id),
        }"
      >
        <div
          class="group-card"
          :style="{
            backgroundColor: ANIMAL_CONFIG[item.group.animal].lightColor,
            borderColor: ANIMAL_CONFIG[item.group.animal].color,
          }"
        >
          <img
            :src="ANIMAL_CONFIG[item.group.animal].avatar"
            :alt="`${item.group.name} 頭像`"
            class="w-28 h-28 rounded-full object-cover border-4 mb-2"
            :class="champIds.includes(item.group.id) && showRank ? 'animate-bounce-slow' : ''"
            :style="{ borderColor: ANIMAL_CONFIG[item.group.animal].color }"
          />
          <div
            class="text-lg font-bold"
            :style="{ color: ANIMAL_CONFIG[item.group.animal].darkColor }"
          >
            {{ item.group.name }}
          </div>
          <div
            class="text-5xl font-extrabold mt-2 tabular-nums"
            :style="{ color: ANIMAL_CONFIG[item.group.animal].darkColor }"
          >
            {{ displayScores[item.group.id] ?? 0 }}
          </div>
          <div class="text-xs text-stone-500 mt-1">分</div>
        </div>
        <div v-if="showRank && champIds.includes(item.group.id)" class="crown">
          👑
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.group-card-wrapper {
  position: relative;
  transition: all 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.group-card-wrapper.champion {
  transform: translateY(-20px) scale(1.15);
}

.group-card-wrapper.not-champion {
  opacity: 0.5;
  transform: scale(0.9);
  filter: grayscale(30%);
}

.group-card {
  width: 200px;
  padding: 24px 16px;
  border-radius: 24px;
  border: 4px solid;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: white;
}

.crown {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%) rotate(-10deg);
  font-size: 48px;
  animation: crownBounce 2s ease-in-out infinite;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
}

@keyframes crownBounce {
  0%, 100% { transform: translateX(-50%) rotate(-10deg) translateY(0); }
  50% { transform: translateX(-50%) rotate(-10deg) translateY(-8px); }
}

.animate-bounce-slow {
  animation: bounce 1.2s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
</style>
