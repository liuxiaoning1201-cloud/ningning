<script setup lang="ts">
import { computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG } from '../types'
import type { ScoreEvent } from '../types'
import GroupCard from '../components/GroupCard.vue'

const store = useClassStore()
store.init()

const today = computed(() => {
  const now = new Date()
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  return `${now.getMonth() + 1}月${now.getDate()}日 星期${weekDays[now.getDay()]}`
})

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 12) return '早安'
  if (hour < 18) return '午安'
  return '晚安'
})

const todayEventCount = computed(() => store.todayEvents.length)

const mostActiveGroup = computed(() => {
  if (store.groups.length === 0) return null
  let best = store.groups[0]
  let bestScore = store.getGroupTodayScore(best.id)
  for (const g of store.groups) {
    const s = store.getGroupTodayScore(g.id)
    if (s > bestScore) {
      best = g
      bestScore = s
    }
  }
  if (bestScore === 0) return null
  return best
})

const unlockedBadgesToday = computed(() => {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  return store.getUnlockedBadges().filter(b => b.unlockedAt && b.unlockedAt >= startOfDay.getTime())
})

const activityFeed = computed(() => store.todayEvents.slice(0, 10))

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '剛剛'
  if (minutes < 60) return `${minutes} 分鐘前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小時前`
  return `${Math.floor(hours / 24)} 天前`
}

function eventTargetName(event: ScoreEvent): string {
  if (event.targetType === 'group') {
    const group = store.getGroupById(event.targetId)
    return group ? group.name : '未知小組'
  }
  const student = store.getStudentById(event.targetId)
  return student ? `${student.name}（${student.seatNumber}號）` : '未知學生'
}

function eventGroupEmoji(event: ScoreEvent): string {
  const group = store.getGroupById(event.groupId)
  return group ? ANIMAL_CONFIG[group.animal].emoji : ''
}

function pointsDisplay(points: number): string {
  return points > 0 ? `+${points}` : `${points}`
}
</script>

<template>
  <div class="min-h-screen px-4 py-6 max-w-4xl mx-auto">
    <!-- Header -->
    <header class="mb-8 text-center">
      <h1 class="text-3xl font-bold text-amber-900 mb-1">
        🏫 {{ store.classData.name }}
      </h1>
      <p class="text-amber-700/80 text-sm mb-1">{{ store.classData.semester }}</p>
      <p class="text-lg text-amber-800">
        📅 {{ today }}・老師{{ greeting }}！
      </p>
    </header>

    <!-- Group Overview Cards -->
    <section class="mb-8">
      <h2 class="text-xl font-bold text-amber-900 mb-4">🐾 小組總覽</h2>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GroupCard
          v-for="group in store.groups"
          :key="group.id"
          :group-id="group.id"
        />
      </div>
    </section>

    <!-- Today's Summary -->
    <section class="mb-8">
      <h2 class="text-xl font-bold text-amber-900 mb-4">📊 今日小結</h2>
      <div class="grid grid-cols-3 gap-4">
        <div class="bg-white/80 rounded-2xl p-4 text-center shadow-sm border border-amber-100">
          <div class="text-3xl font-bold text-amber-700">{{ todayEventCount }}</div>
          <div class="text-sm text-amber-600 mt-1">記錄事件</div>
        </div>
        <div class="bg-white/80 rounded-2xl p-4 text-center shadow-sm border border-amber-100">
          <template v-if="mostActiveGroup">
            <div class="text-2xl font-bold">
              {{ ANIMAL_CONFIG[mostActiveGroup.animal].emoji }}
            </div>
            <div class="text-sm text-amber-600 mt-1">
              最活躍：{{ mostActiveGroup.name }}
            </div>
          </template>
          <template v-else>
            <div class="text-2xl">🌙</div>
            <div class="text-sm text-amber-600 mt-1">尚無紀錄</div>
          </template>
        </div>
        <div class="bg-white/80 rounded-2xl p-4 text-center shadow-sm border border-amber-100">
          <div class="text-3xl font-bold text-amber-700">{{ unlockedBadgesToday.length }}</div>
          <div class="text-sm text-amber-600 mt-1">今日徽章</div>
        </div>
      </div>
    </section>

    <!-- Recent Activity Feed -->
    <section class="mb-8">
      <h2 class="text-xl font-bold text-amber-900 mb-4">📝 即時動態</h2>
      <div
        v-if="activityFeed.length === 0"
        class="bg-white/80 rounded-2xl p-8 text-center shadow-sm border border-amber-100"
      >
        <p class="text-amber-600 text-lg">還沒有今天的紀錄，開始上課吧 ✨</p>
      </div>
      <ul v-else class="space-y-2">
        <li
          v-for="event in activityFeed"
          :key="event.id"
          class="bg-white/80 rounded-xl px-4 py-3 shadow-sm border border-amber-100 flex items-center gap-3"
        >
          <span class="text-xl flex-shrink-0">{{ eventGroupEmoji(event) }}</span>
          <div class="flex-1 min-w-0">
            <span class="font-medium text-amber-900">{{ eventTargetName(event) }}</span>
            <span class="mx-1 text-amber-400">·</span>
            <span class="text-amber-700">{{ event.label }}</span>
          </div>
          <span
            class="font-bold text-sm px-2 py-0.5 rounded-full flex-shrink-0"
            :class="event.points > 0
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-600'"
          >
            {{ pointsDisplay(event.points) }}
          </span>
          <span class="text-xs text-amber-400 flex-shrink-0 w-16 text-right">
            {{ relativeTime(event.timestamp) }}
          </span>
        </li>
      </ul>
    </section>

    <!-- Quick Actions -->
    <section class="mb-8">
      <h2 class="text-xl font-bold text-amber-900 mb-4">🚀 快速前往</h2>
      <div class="flex flex-col sm:flex-row gap-4">
        <router-link
          to="/classroom"
          class="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-4 px-6 rounded-2xl text-center text-lg shadow-md transition-colors"
        >
          🎯 進入課堂記分
        </router-link>
        <router-link
          to="/display"
          class="flex-1 bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 px-6 rounded-2xl text-center text-lg shadow-md transition-colors"
        >
          📺 查看學生展示
        </router-link>
      </div>
    </section>
  </div>
</template>
