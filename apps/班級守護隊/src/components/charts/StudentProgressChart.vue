<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import './chartRegistry'
import { useClassStore } from '../../stores/classStore'
import { ANIMAL_CONFIG } from '../../types'

const store = useClassStore()

const props = defineProps<{
  studentId: string
}>()

const student = computed(() => store.getStudentById(props.studentId))
const group = computed(() => student.value ? store.getGroupById(student.value.groupId) : null)

const recentLessons = computed(() => {
  return [...store.lessons]
    .filter(l => !l.isActive && l.endedAt)
    .sort((a, b) => (a.endedAt ?? 0) - (b.endedAt ?? 0))
    .slice(-10)
})

const chartData = computed(() => {
  if (!student.value) return { labels: [], datasets: [] }

  const labels = recentLessons.value.map((l, i) => `${i + 1}. ${l.subject}`)
  const data = recentLessons.value.map(l =>
    store.scoreEvents
      .filter(e => e.sessionId === l.id && e.targetType === 'student' && e.targetId === props.studentId)
      .reduce((sum, e) => sum + e.points, 0)
  )
  const color = group.value ? ANIMAL_CONFIG[group.value.animal].color : '#8B5CF6'

  return {
    labels,
    datasets: [{
      label: student.value.name,
      data,
      borderColor: color,
      backgroundColor: color + '33',
      fill: true,
      tension: 0.35,
      borderWidth: 3,
      pointRadius: 5,
      pointBackgroundColor: color,
    }],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(41, 37, 36, 0.95)',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f5f5f4' }, ticks: { font: { size: 11 } } },
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
}
</script>

<template>
  <div class="w-full h-full">
    <div v-if="recentLessons.length === 0" class="h-full flex items-center justify-center text-stone-400 text-sm">
      尚無已結束的課堂
    </div>
    <Line v-else :data="chartData" :options="chartOptions" />
  </div>
</template>
