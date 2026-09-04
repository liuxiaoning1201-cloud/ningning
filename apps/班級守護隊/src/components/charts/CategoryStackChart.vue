<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import './chartRegistry'
import { CATEGORY_LABELS, CATEGORY_COLORS, type ScoreCategory } from '../../types'
import { useClassStore } from '../../stores/classStore'

const store = useClassStore()

const props = withDefaults(defineProps<{
  limit?: number
}>(), {
  limit: 8,
})

const categories = Object.keys(CATEGORY_LABELS) as ScoreCategory[]

const recentLessons = computed(() => {
  return [...store.lessons]
    .filter(l => !l.isActive && l.endedAt)
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
    .slice(-props.limit)
})

const chartData = computed(() => {
  const labels = recentLessons.value.map(l => l.subject)
  const datasets = categories.map(cat => {
    const data = recentLessons.value.map(l => {
      const events = store.scoreEvents.filter(e => e.sessionId === l.id && e.category === cat)
      return events.reduce((sum, e) => sum + e.points, 0)
    })
    return {
      label: CATEGORY_LABELS[cat],
      data,
      backgroundColor: CATEGORY_COLORS[cat].bar,
      borderRadius: 6,
    }
  })
  return { labels, datasets }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { font: { size: 12 }, usePointStyle: true },
    },
    tooltip: {
      backgroundColor: 'rgba(41, 37, 36, 0.95)',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      ticks: { font: { size: 11 }, color: '#78716c' },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      grid: { color: '#f5f5f4' },
      ticks: { font: { size: 11 }, color: '#78716c' },
    },
  },
}
</script>

<template>
  <div class="w-full h-full">
    <div v-if="recentLessons.length === 0" class="h-full flex items-center justify-center text-stone-400 text-sm">
      <div class="text-center">
        <p class="text-3xl mb-2">📊</p>
        <p>尚無已結束的課堂</p>
      </div>
    </div>
    <Bar v-else :data="chartData" :options="chartOptions" />
  </div>
</template>
