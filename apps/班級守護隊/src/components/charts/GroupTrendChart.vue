<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import '../charts/chartRegistry'
import { ANIMAL_CONFIG } from '../../types'
import { useClassStore } from '../../stores/classStore'

const store = useClassStore()

const props = withDefaults(defineProps<{
  /** 只顯示最近幾節課 */
  limit?: number
}>(), {
  limit: 10,
})

const recentLessons = computed(() => {
  return [...store.lessons]
    .filter(l => !l.isActive && l.endedAt)
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
    .slice(-props.limit)
})

const chartData = computed(() => {
  const labels = recentLessons.value.map((l, i) => `${i + 1}. ${l.subject}`)
  const datasets = store.groups.map(g => ({
    label: g.name,
    data: recentLessons.value.map(l => l.groupScores?.[g.id] ?? 0),
    borderColor: ANIMAL_CONFIG[g.animal].color,
    backgroundColor: ANIMAL_CONFIG[g.animal].color + '33',
    tension: 0.35,
    borderWidth: 3,
    pointRadius: 5,
    pointHoverRadius: 7,
    pointBackgroundColor: ANIMAL_CONFIG[g.animal].color,
  }))
  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { font: { size: 13, weight: 600 as any }, usePointStyle: true },
    },
    tooltip: {
      backgroundColor: 'rgba(41, 37, 36, 0.95)',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: { color: '#f5f5f4' },
      ticks: { font: { size: 11 }, color: '#78716c' },
    },
    x: {
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#78716c' },
    },
  },
}
</script>

<template>
  <div class="w-full h-full">
    <div v-if="recentLessons.length === 0" class="h-full flex items-center justify-center text-stone-400 text-sm">
      <div class="text-center">
        <p class="text-3xl mb-2">📈</p>
        <p>尚無已結束的課堂，開始上課並下課結算後即可顯示趨勢</p>
      </div>
    </div>
    <Line v-else :data="chartData" :options="chartOptions" />
  </div>
</template>
