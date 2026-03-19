<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG, CATEGORY_LABELS } from '../types'
import type { ScoreCategory, ScoreEvent } from '../types'

const store = useClassStore()

type DateFilter = 'today' | 'week' | 'all'
const dateFilter = ref<DateFilter>('today')
const groupFilter = ref<string>('all')
const categoryFilter = ref<string>('all')

function getTodayStart(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function getWeekStart(): number {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).getTime()
}

const sinceTimestamp = computed(() => {
  if (dateFilter.value === 'today') return getTodayStart()
  if (dateFilter.value === 'week') return getWeekStart()
  return 0
})

const filteredEvents = computed(() => {
  let events = [...store.scoreEvents].sort((a, b) => b.timestamp - a.timestamp)

  if (sinceTimestamp.value > 0) {
    events = events.filter(e => e.timestamp >= sinceTimestamp.value)
  }
  if (groupFilter.value !== 'all') {
    events = events.filter(e => e.groupId === groupFilter.value)
  }
  if (categoryFilter.value !== 'all') {
    events = events.filter(e => e.category === categoryFilter.value)
  }
  return events
})

const totalCount = computed(() => filteredEvents.value.length)

const perGroupScores = computed(() =>
  store.groups.map(g => ({
    group: g,
    score: filteredEvents.value
      .filter(e => e.groupId === g.id)
      .reduce((sum, e) => sum + e.points, 0),
  }))
)

const categoryBreakdown = computed(() => {
  const result: Record<string, number> = {}
  for (const cat of Object.keys(CATEGORY_LABELS) as ScoreCategory[]) {
    result[cat] = filteredEvents.value
      .filter(e => e.category === cat)
      .reduce((sum, e) => sum + e.points, 0)
  }
  return result
})

const maxCategoryValue = computed(() =>
  Math.max(1, ...Object.values(categoryBreakdown.value).map(Math.abs))
)

const topStudents = computed(() => {
  const counts: Record<string, number> = {}
  filteredEvents.value
    .filter(e => e.targetType === 'student')
    .forEach(e => { counts[e.targetId] = (counts[e.targetId] ?? 0) + 1 })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, count]) => ({
      student: store.getStudentById(id),
      count,
    }))
    .filter(x => x.student)
})

function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isToday(ts: number): boolean {
  return ts >= getTodayStart()
}

function getEventTarget(event: ScoreEvent): string {
  if (event.targetType === 'group') {
    const g = store.getGroupById(event.targetId)
    return g ? `${ANIMAL_CONFIG[g.animal].emoji} ${g.name}` : '未知小組'
  }
  const s = store.getStudentById(event.targetId)
  return s ? s.name : '未知學生'
}

const weeklyGroupSummaries = computed(() =>
  store.groups.map(g => {
    const since = getWeekStart()
    const breakdown = store.getCategoryBreakdown(g.id, since)
    const maxVal = Math.max(1, ...Object.values(breakdown).map(Math.abs))
    return { group: g, breakdown, maxVal }
  })
)

const weeklyStudentRanking = computed(() => {
  const since = getWeekStart()
  const weekEvents = store.scoreEvents.filter(e => e.timestamp >= since && e.targetType === 'student')

  const stats: Record<string, { total: number; byCategory: Record<ScoreCategory, number> }> = {}
  weekEvents.forEach(e => {
    if (!stats[e.targetId]) {
      stats[e.targetId] = {
        total: 0,
        byCategory: { learning: 0, listening: 0, cooperation: 0, habit: 0, reminder: 0 },
      }
    }
    stats[e.targetId].total += e.points
    stats[e.targetId].byCategory[e.category] += e.points
  })

  return Object.entries(stats)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([id, data]) => ({
      student: store.getStudentById(id),
      ...data,
    }))
    .filter(x => x.student)
})

const growthHighlights = computed(() => {
  const now = Date.now()
  const midWeek = getWeekStart() + 3 * 24 * 60 * 60 * 1000
  const weekStart = getWeekStart()

  const studentIds = new Set(
    store.scoreEvents
      .filter(e => e.timestamp >= weekStart && e.targetType === 'student')
      .map(e => e.targetId)
  )

  const highlights: { name: string; improvement: string }[] = []

  studentIds.forEach(sid => {
    const firstHalf = store.scoreEvents
      .filter(e => e.targetType === 'student' && e.targetId === sid && e.timestamp >= weekStart && e.timestamp < midWeek)
      .reduce((s, e) => s + e.points, 0)
    const secondHalf = store.scoreEvents
      .filter(e => e.targetType === 'student' && e.targetId === sid && e.timestamp >= midWeek && e.timestamp <= now)
      .reduce((s, e) => s + e.points, 0)

    if (secondHalf > firstHalf && secondHalf > 0) {
      const student = store.getStudentById(sid)
      if (student) {
        highlights.push({
          name: student.name,
          improvement: `後半週得分 ${secondHalf} > 前半週 ${firstHalf}`,
        })
      }
    }
  })

  return highlights.slice(0, 5)
})
</script>

<template>
  <div class="p-6 max-w-5xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-stone-700 flex items-center gap-2">
      <span class="text-2xl">📊</span> 歷史紀錄
    </h1>

    <!-- Filter Bar -->
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-stone-100 flex flex-wrap gap-4 items-center">
      <div>
        <label class="block text-xs text-stone-400 mb-1">時間範圍</label>
        <div class="flex rounded-xl overflow-hidden border border-stone-200">
          <button
            v-for="opt in ([
              { value: 'today', label: '今日' },
              { value: 'week', label: '本週' },
              { value: 'all', label: '全部' },
            ] as { value: DateFilter; label: string }[])"
            :key="opt.value"
            @click="dateFilter = opt.value"
            class="px-4 py-1.5 text-sm transition-colors"
            :class="dateFilter === opt.value
              ? 'bg-violet-500 text-white'
              : 'bg-white text-stone-500 hover:bg-stone-50'"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-xs text-stone-400 mb-1">小組</label>
        <select
          v-model="groupFilter"
          class="px-3 py-1.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        >
          <option value="all">全部小組</option>
          <option v-for="g in store.groups" :key="g.id" :value="g.id">
            {{ ANIMAL_CONFIG[g.animal].emoji }} {{ g.name }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-xs text-stone-400 mb-1">類別</label>
        <select
          v-model="categoryFilter"
          class="px-3 py-1.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        >
          <option value="all">全部類別</option>
          <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
      </div>

      <div class="ml-auto text-right">
        <p class="text-xs text-stone-400">篩選結果</p>
        <p class="text-lg font-bold text-stone-700">{{ totalCount }} 筆</p>
      </div>
    </div>

    <!-- Summary Cards -->
    <div class="grid grid-cols-3 gap-4">
      <div
        v-for="item in perGroupScores"
        :key="item.group.id"
        class="rounded-2xl p-4 border-2 text-center"
        :style="{
          backgroundColor: ANIMAL_CONFIG[item.group.animal].lightColor,
          borderColor: ANIMAL_CONFIG[item.group.animal].color,
        }"
      >
        <span class="text-3xl">{{ ANIMAL_CONFIG[item.group.animal].emoji }}</span>
        <p
          class="text-sm font-medium mt-1"
          :style="{ color: ANIMAL_CONFIG[item.group.animal].darkColor }"
        >
          {{ item.group.name }}
        </p>
        <p
          class="text-2xl font-bold mt-1"
          :style="{ color: ANIMAL_CONFIG[item.group.animal].darkColor }"
        >
          {{ item.score >= 0 ? '+' : '' }}{{ item.score }}
        </p>
      </div>
    </div>

    <!-- Category Breakdown -->
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-base font-semibold text-stone-700 mb-4">📂 類別分佈</h2>
      <div class="space-y-3">
        <div
          v-for="(label, cat) in CATEGORY_LABELS"
          :key="cat"
          class="flex items-center gap-3"
        >
          <span class="w-20 text-sm text-stone-600 text-right shrink-0">{{ label }}</span>
          <div class="flex-1 h-6 bg-stone-100 rounded-full overflow-hidden relative">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="categoryBreakdown[cat] >= 0 ? 'bg-violet-400' : 'bg-red-400'"
              :style="{ width: (Math.abs(categoryBreakdown[cat]) / maxCategoryValue * 100) + '%' }"
            />
          </div>
          <span
            class="w-12 text-sm font-medium text-right shrink-0"
            :class="categoryBreakdown[cat] >= 0 ? 'text-stone-700' : 'text-red-500'"
          >
            {{ categoryBreakdown[cat] >= 0 ? '+' : '' }}{{ categoryBreakdown[cat] }}
          </span>
        </div>
      </div>
    </div>

    <!-- Top Students -->
    <div v-if="topStudents.length > 0" class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-base font-semibold text-stone-700 mb-4">🏆 最活躍學生</h2>
      <div class="flex gap-6">
        <div
          v-for="(item, idx) in topStudents"
          :key="item.student!.id"
          class="flex items-center gap-3"
        >
          <span class="text-2xl">{{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉' }}</span>
          <div>
            <p class="text-sm font-medium text-stone-700">{{ item.student!.name }}</p>
            <p class="text-xs text-stone-400">{{ item.count }} 次紀錄</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Event Timeline -->
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-base font-semibold text-stone-700 mb-4">🕐 事件時間軸</h2>
      <div class="max-h-96 overflow-y-auto space-y-1 pr-2">
        <div
          v-for="event in filteredEvents"
          :key="event.id"
          class="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-stone-50 transition-colors"
        >
          <div class="w-16 text-right shrink-0">
            <p class="text-sm font-mono text-stone-500">{{ formatTime(event.timestamp) }}</p>
            <p v-if="!isToday(event.timestamp)" class="text-xs text-stone-400">{{ formatDate(event.timestamp) }}</p>
          </div>
          <div class="w-px h-8 bg-stone-200 shrink-0" />
          <div class="flex-1 min-w-0">
            <p class="text-sm text-stone-700 truncate">
              <span class="font-medium">{{ getEventTarget(event) }}</span>
              <span class="text-stone-400 mx-1">·</span>
              {{ event.label }}
            </p>
            <p v-if="event.note" class="text-xs text-stone-400 truncate mt-0.5">📝 {{ event.note }}</p>
          </div>
          <span
            class="text-sm font-bold shrink-0 px-2 py-0.5 rounded-lg"
            :class="event.points >= 0
              ? 'text-green-700 bg-green-50'
              : 'text-red-600 bg-red-50'"
          >
            {{ event.points >= 0 ? '+' : '' }}{{ event.points }}
          </span>
        </div>
        <div v-if="filteredEvents.length === 0" class="text-center py-12 text-stone-400">
          <p class="text-4xl mb-2">📭</p>
          <p class="text-sm">目前沒有符合條件的紀錄</p>
        </div>
      </div>
    </div>

    <!-- Weekly Report -->
    <div class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-lg font-semibold text-stone-700 mb-6">📈 週報總覽</h2>

      <div class="grid grid-cols-3 gap-6 mb-8">
        <div
          v-for="item in weeklyGroupSummaries"
          :key="item.group.id"
          class="rounded-xl p-4 border"
          :style="{ borderColor: ANIMAL_CONFIG[item.group.animal].color }"
        >
          <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">{{ ANIMAL_CONFIG[item.group.animal].emoji }}</span>
            <span
              class="text-sm font-semibold"
              :style="{ color: ANIMAL_CONFIG[item.group.animal].darkColor }"
            >
              {{ item.group.name }}
            </span>
          </div>
          <div class="space-y-2">
            <div
              v-for="(label, cat) in CATEGORY_LABELS"
              :key="cat"
              class="flex items-center gap-2"
            >
              <span class="w-16 text-xs text-stone-500 text-right shrink-0">{{ label }}</span>
              <div class="flex-1 h-3 bg-stone-100 rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :style="{
                    width: item.maxVal > 0 ? (Math.abs(item.breakdown[cat as ScoreCategory]) / item.maxVal * 100) + '%' : '0%',
                    backgroundColor: item.breakdown[cat as ScoreCategory] >= 0
                      ? ANIMAL_CONFIG[item.group.animal].color
                      : '#EF4444',
                  }"
                />
              </div>
              <span class="w-6 text-xs text-stone-500 text-right shrink-0">{{ item.breakdown[cat as ScoreCategory] }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Student Ranking -->
      <div v-if="weeklyStudentRanking.length > 0" class="mb-8">
        <h3 class="text-sm font-semibold text-stone-600 mb-3">🎯 本週學生參與排行</h3>
        <div class="overflow-hidden rounded-xl border border-stone-200">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-stone-50 text-stone-500">
                <th class="text-left px-4 py-2 font-medium">排名</th>
                <th class="text-left px-4 py-2 font-medium">學生</th>
                <th class="text-center px-4 py-2 font-medium">個人學習</th>
                <th class="text-center px-4 py-2 font-medium">傾聽互動</th>
                <th class="text-center px-4 py-2 font-medium">小組合作</th>
                <th class="text-right px-4 py-2 font-medium">總分</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(item, idx) in weeklyStudentRanking"
                :key="item.student!.id"
                :class="idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'"
                class="border-t border-stone-100"
              >
                <td class="px-4 py-2 text-stone-500">
                  {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}` }}
                </td>
                <td class="px-4 py-2 font-medium text-stone-700">{{ item.student!.name }}</td>
                <td class="px-4 py-2 text-center text-stone-600">{{ item.byCategory.learning }}</td>
                <td class="px-4 py-2 text-center text-stone-600">{{ item.byCategory.listening }}</td>
                <td class="px-4 py-2 text-center text-stone-600">{{ item.byCategory.cooperation }}</td>
                <td class="px-4 py-2 text-right font-bold" :class="item.total >= 0 ? 'text-green-700' : 'text-red-500'">
                  {{ item.total >= 0 ? '+' : '' }}{{ item.total }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Growth Highlights -->
      <div v-if="growthHighlights.length > 0">
        <h3 class="text-sm font-semibold text-stone-600 mb-3">🌱 成長亮點</h3>
        <div class="grid grid-cols-2 gap-3">
          <div
            v-for="h in growthHighlights"
            :key="h.name"
            class="flex items-center gap-3 bg-green-50 rounded-xl p-3 border border-green-200"
          >
            <span class="text-2xl">🚀</span>
            <div>
              <p class="text-sm font-medium text-green-800">{{ h.name }}</p>
              <p class="text-xs text-green-600">{{ h.improvement }}</p>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="text-center py-6 text-stone-400">
        <p class="text-sm">累積更多資料後，這裡會顯示學生的成長亮點 🌱</p>
      </div>
    </div>
  </div>
</template>
