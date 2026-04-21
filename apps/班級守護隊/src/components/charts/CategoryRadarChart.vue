<script setup lang="ts">
import { computed } from 'vue'
import { Radar } from 'vue-chartjs'
import './chartRegistry'
import { CATEGORY_LABELS, ANIMAL_CONFIG, type ScoreCategory } from '../../types'
import { useClassStore } from '../../stores/classStore'

const store = useClassStore()

const props = defineProps<{
  /** 若提供，則只顯示此 session 的數據；否則為最近一週 */
  sessionId?: string
  since?: number
}>()

const categories = Object.keys(CATEGORY_LABELS) as ScoreCategory[]

const chartData = computed(() => {
  const datasets = store.groups.map(g => {
    const data = categories.map(cat => {
      let events = store.scoreEvents.filter(e => e.groupId === g.id && e.category === cat)
      if (props.sessionId) events = events.filter(e => e.sessionId === props.sessionId)
      if (props.since) events = events.filter(e => e.timestamp >= props.since!)
      return Math.max(0, events.reduce((sum, e) => sum + e.points, 0))
    })
    return {
      label: g.name,
      data,
      borderColor: ANIMAL_CONFIG[g.animal].color,
      backgroundColor: ANIMAL_CONFIG[g.animal].color + '33',
      borderWidth: 2,
      pointBackgroundColor: ANIMAL_CONFIG[g.animal].color,
      pointRadius: 4,
    }
  })
  return {
    labels: categories.map(c => CATEGORY_LABELS[c]),
    datasets,
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: { font: { size: 12 }, usePointStyle: true },
    },
  },
  scales: {
    r: {
      beginAtZero: true,
      grid: { color: '#e7e5e4' },
      angleLines: { color: '#e7e5e4' },
      pointLabels: { font: { size: 12, weight: 600 as any }, color: '#57534e' },
      ticks: { font: { size: 10 }, color: '#a8a29e', backdropColor: 'transparent' },
    },
  },
}
</script>

<template>
  <div class="w-full h-full">
    <Radar :data="chartData" :options="chartOptions" />
  </div>
</template>
