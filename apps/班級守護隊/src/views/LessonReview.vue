<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG, CATEGORY_LABELS, CATEGORY_COLORS, RARITY_CONFIG, type ScoreCategory } from '../types'
import GroupTrendChart from '../components/charts/GroupTrendChart.vue'
import CategoryRadarChart from '../components/charts/CategoryRadarChart.vue'
import CategoryStackChart from '../components/charts/CategoryStackChart.vue'
import StudentProgressChart from '../components/charts/StudentProgressChart.vue'

const store = useClassStore()

const sortedLessons = computed(() =>
  [...store.lessons]
    .filter(l => !l.isActive && l.endedAt)
    .sort((a, b) => (b.endedAt ?? 0) - (a.endedAt ?? 0))
)

const selectedLessonId = ref<string | null>(null)

const selectedLesson = computed(() =>
  selectedLessonId.value ? store.getLessonById(selectedLessonId.value) : null
)

const selectedLessonEvents = computed(() => {
  if (!selectedLesson.value) return []
  return store.getLessonEvents(selectedLesson.value.id)
})

const selectedLessonDraws = computed(() => {
  if (!selectedLesson.value) return []
  return store.getDrawsBySession(selectedLesson.value.id)
})

const selectedStudentId = ref<string | null>(null)

function formatDate(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatDuration(start: number, end?: number): string {
  if (!end) return '進行中'
  const mins = Math.round((end - start) / 60000)
  if (mins < 60) return `${mins} 分鐘`
  return `${Math.floor(mins / 60)} 時 ${mins % 60} 分`
}

function getCategoryBreakdownForSession(sessionId: string): Record<ScoreCategory, number> {
  const result: Record<ScoreCategory, number> = {
    learning: 0, listening: 0, cooperation: 0, habit: 0, reminder: 0,
  }
  store.scoreEvents
    .filter(e => e.sessionId === sessionId)
    .forEach(e => { result[e.category] += e.points })
  return result
}

function getLessonWinners(lessonId: string): string[] {
  const lesson = store.getLessonById(lessonId)
  return lesson?.winningGroupIds ?? []
}

const sortedStudents = computed(() =>
  [...store.students].sort((a, b) => a.seatNumber - b.seatNumber)
)

/** 總覽：學生本週累計分數 */
const weekStart = computed(() => {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff).getTime()
})

const studentWeeklyRanking = computed(() => {
  return sortedStudents.value
    .map(s => ({
      student: s,
      score: store.getStudentScore(s.id, weekStart.value),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
})

/** 學生印章排行 */
const stampRanking = computed(() => {
  return [...store.students]
    .filter(s => (s.stamps ?? 0) > 0)
    .sort((a, b) => (b.stamps ?? 0) - (a.stamps ?? 0))
    .slice(0, 10)
})
</script>

<template>
  <div class="p-6 max-w-6xl mx-auto space-y-6">
    <h1 class="text-2xl font-bold text-stone-700 flex items-center gap-2">
      <span class="text-2xl">📚</span> 課堂回顧與數據
    </h1>

    <!-- 總覽圖表區 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
        <h2 class="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
          <span>📈</span> 小組分數趨勢（最近 10 節課）
        </h2>
        <div class="h-64">
          <GroupTrendChart :limit="10" />
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
        <h2 class="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
          <span>🕸️</span> 本週小組類別強項雷達圖
        </h2>
        <div class="h-64">
          <CategoryRadarChart :since="weekStart" />
        </div>
      </div>

      <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100 lg:col-span-2">
        <h2 class="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
          <span>📊</span> 各課類別分佈（堆疊長條）
        </h2>
        <div class="h-64">
          <CategoryStackChart :limit="8" />
        </div>
      </div>
    </div>

    <!-- 學生個人進步圖 -->
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
      <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 class="text-sm font-bold text-stone-600 flex items-center gap-2">
          <span>👤</span> 學生個人進步曲線
        </h2>
        <select
          v-model="selectedStudentId"
          class="px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
        >
          <option :value="null">選擇學生查看</option>
          <option v-for="s in sortedStudents" :key="s.id" :value="s.id">
            {{ s.seatNumber }}號 {{ s.name }}
          </option>
        </select>
      </div>
      <div v-if="selectedStudentId" class="h-64">
        <StudentProgressChart :student-id="selectedStudentId" />
      </div>
      <div v-else class="h-64 flex items-center justify-center text-stone-400 text-sm">
        請選擇學生查看其近期課堂得分趨勢
      </div>
    </div>

    <!-- 本週學生排行 + 印章排行 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
        <h2 class="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
          <span>🏆</span> 本週學生得分排行
        </h2>
        <div v-if="studentWeeklyRanking.length === 0" class="text-center text-stone-400 py-8 text-sm">
          尚無本週得分紀錄
        </div>
        <ol v-else class="space-y-2">
          <li
            v-for="(item, idx) in studentWeeklyRanking"
            :key="item.student.id"
            class="flex items-center gap-3 py-1.5 px-2 rounded-lg"
            :class="idx < 3 ? 'bg-amber-50' : ''"
          >
            <span class="w-7 text-center font-bold" :class="idx === 0 ? 'text-amber-500' : 'text-stone-400'">
              {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1 }}
            </span>
            <span class="flex-1 text-sm text-stone-700">{{ item.student.name }}</span>
            <span class="text-sm font-bold" :class="item.score >= 0 ? 'text-emerald-600' : 'text-red-500'">
              {{ item.score >= 0 ? '+' : '' }}{{ item.score }}
            </span>
          </li>
        </ol>
      </div>

      <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
        <h2 class="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
          <span>🎖️</span> 學生印章排行
        </h2>
        <div v-if="stampRanking.length === 0" class="text-center text-stone-400 py-8 text-sm">
          尚未獲得任何印章，下課抽卡時可為小組贏得印章！
        </div>
        <ol v-else class="space-y-2">
          <li
            v-for="(s, idx) in stampRanking"
            :key="s.id"
            class="flex items-center gap-3 py-1.5 px-2 rounded-lg"
            :class="idx < 3 ? 'bg-amber-50' : ''"
          >
            <span class="w-7 text-center font-bold" :class="idx === 0 ? 'text-amber-500' : 'text-stone-400'">
              {{ idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1 }}
            </span>
            <span class="flex-1 text-sm text-stone-700">{{ s.name }}</span>
            <span class="text-sm font-bold text-amber-600 flex items-center gap-1">
              🎖 {{ s.stamps }}
            </span>
          </li>
        </ol>
      </div>
    </div>

    <!-- 課堂列表 -->
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-stone-100">
      <h2 class="text-sm font-bold text-stone-600 mb-3 flex items-center gap-2">
        <span>📚</span> 課堂紀錄（共 {{ sortedLessons.length }} 節）
      </h2>
      <div v-if="sortedLessons.length === 0" class="text-center text-stone-400 py-10">
        <p class="text-4xl mb-2">📭</p>
        <p class="text-sm">尚無結束的課堂。在課堂記分頁面點擊「開始上課」即可建立第一節課。</p>
      </div>
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          v-for="lesson in sortedLessons"
          :key="lesson.id"
          @click="selectedLessonId = lesson.id"
          class="text-left bg-stone-50 rounded-xl p-4 border-2 hover:border-violet-300 hover:bg-violet-50 transition-colors cursor-pointer"
          :class="selectedLessonId === lesson.id ? 'border-violet-400 bg-violet-50' : 'border-stone-100'"
        >
          <div class="flex items-start justify-between mb-2">
            <span class="text-sm font-bold text-stone-700">{{ lesson.subject }}</span>
            <span class="text-xs text-stone-400">{{ formatDate(lesson.endedAt) }}</span>
          </div>
          <p class="text-xs text-stone-500 mb-2">時長：{{ formatDuration(lesson.startedAt, lesson.endedAt) }}</p>
          <div class="flex items-center gap-2">
            <span
              v-for="g in store.groups"
              :key="g.id"
              class="text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5"
              :style="{
                backgroundColor: getLessonWinners(lesson.id).includes(g.id)
                  ? ANIMAL_CONFIG[g.animal].color
                  : ANIMAL_CONFIG[g.animal].lightColor,
                color: getLessonWinners(lesson.id).includes(g.id)
                  ? 'white'
                  : ANIMAL_CONFIG[g.animal].darkColor,
              }"
            >
              <img :src="ANIMAL_CONFIG[g.animal].avatar" :alt="`${g.name} 頭像`" class="w-4 h-4 rounded-full object-cover" />
              {{ lesson.groupScores?.[g.id] ?? 0 }}
            </span>
          </div>
        </button>
      </div>
    </div>

    <!-- 選中課堂的詳細資訊 -->
    <div v-if="selectedLesson" class="bg-white rounded-2xl p-6 shadow-sm border-2 border-violet-200">
      <div class="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 class="text-lg font-bold text-stone-700">
            📖 {{ selectedLesson.subject }} 詳細數據
          </h2>
          <p class="text-xs text-stone-500 mt-0.5">
            {{ formatDate(selectedLesson.startedAt) }} - {{ formatDate(selectedLesson.endedAt) }}
            · {{ formatDuration(selectedLesson.startedAt, selectedLesson.endedAt) }}
          </p>
        </div>
        <button
          @click="selectedLessonId = null"
          class="text-xs text-stone-400 hover:text-stone-600 cursor-pointer"
        >
          ✕ 關閉
        </button>
      </div>

      <!-- 本堂小組得分 -->
      <div class="grid grid-cols-3 gap-3 mb-5">
        <div
          v-for="g in store.groups"
          :key="g.id"
          class="rounded-xl p-3 text-center border-2"
          :style="{
            backgroundColor: ANIMAL_CONFIG[g.animal].lightColor,
            borderColor: getLessonWinners(selectedLesson.id).includes(g.id)
              ? ANIMAL_CONFIG[g.animal].color
              : ANIMAL_CONFIG[g.animal].lightColor,
          }"
        >
          <div class="text-3xl mb-1 flex items-center justify-center gap-1">
            <img :src="ANIMAL_CONFIG[g.animal].avatar" :alt="`${g.name} 頭像`" class="w-10 h-10 rounded-full object-cover border-2 border-white/70" />
            <span v-if="getLessonWinners(selectedLesson.id).includes(g.id)" class="ml-1">👑</span>
          </div>
          <p class="text-xs text-stone-600">{{ g.name }}</p>
          <p class="text-2xl font-extrabold mt-0.5" :style="{ color: ANIMAL_CONFIG[g.animal].darkColor }">
            {{ selectedLesson.groupScores?.[g.id] ?? 0 }}
          </p>
        </div>
      </div>

      <!-- 本堂類別分佈（簡易長條） -->
      <div class="mb-5">
        <h3 class="text-sm font-semibold text-stone-600 mb-2">📂 本堂類別分佈</h3>
        <div class="space-y-2">
          <div
            v-for="(label, cat) in CATEGORY_LABELS"
            :key="cat"
            class="flex items-center gap-3"
          >
            <span class="w-20 text-xs text-stone-500 text-right shrink-0">{{ label }}</span>
            <div class="flex-1 h-5 bg-stone-100 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all"
                :style="{
                  width: Math.min(100, Math.abs(getCategoryBreakdownForSession(selectedLesson.id)[cat]) * 10) + '%',
                  backgroundColor: CATEGORY_COLORS[cat].bar,
                }"
              />
            </div>
            <span class="w-10 text-xs font-bold text-right shrink-0" :style="{ color: CATEGORY_COLORS[cat].text }">
              {{ getCategoryBreakdownForSession(selectedLesson.id)[cat] }}
            </span>
          </div>
        </div>
      </div>

      <!-- 抽卡獎勵記錄 -->
      <div v-if="selectedLessonDraws.length > 0" class="mb-5">
        <h3 class="text-sm font-semibold text-stone-600 mb-2">🎁 抽卡獎勵</h3>
        <div class="space-y-2">
          <div
            v-for="draw in selectedLessonDraws"
            :key="draw.id"
            class="flex items-center gap-3 p-3 rounded-xl border"
            :style="{
              backgroundColor: RARITY_CONFIG[draw.card.rarity].bg,
              borderColor: RARITY_CONFIG[draw.card.rarity].border,
            }"
          >
            <span class="text-3xl">{{ draw.card.emoji }}</span>
            <div class="flex-1">
              <div class="flex items-center gap-2">
                <span class="font-bold text-stone-700">{{ draw.card.name }}</span>
                <span
                  class="text-[10px] font-bold px-1.5 py-0.5 rounded"
                  :style="{ backgroundColor: RARITY_CONFIG[draw.card.rarity].color, color: 'white' }"
                >
                  {{ RARITY_CONFIG[draw.card.rarity].label }}
                </span>
              </div>
              <p class="text-xs text-stone-500 mt-0.5">{{ draw.card.description }}</p>
              <p class="text-xs text-stone-400 mt-0.5">
                <img
                  :src="ANIMAL_CONFIG[store.getGroupById(draw.groupId)?.animal ?? 'owl'].avatar"
                  :alt="`${store.getGroupById(draw.groupId)?.name ?? '小組'} 頭像`"
                  class="inline-block w-4 h-4 rounded-full object-cover align-text-bottom mr-1"
                />
                {{ store.getGroupById(draw.groupId)?.name }}
                · {{ draw.applied ? '✓ 已套用' : '未套用' }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- 事件列表 -->
      <div>
        <h3 class="text-sm font-semibold text-stone-600 mb-2">🕐 事件時間軸（{{ selectedLessonEvents.length }} 筆）</h3>
        <div class="max-h-80 overflow-y-auto space-y-1 pr-2">
          <div
            v-for="event in [...selectedLessonEvents].sort((a, b) => a.timestamp - b.timestamp)"
            :key="event.id"
            class="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-stone-50"
          >
            <span class="text-xs font-mono text-stone-400 w-12">
              {{ new Date(event.timestamp).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' }) }}
            </span>
            <span class="text-sm flex-1 truncate">
              <span class="font-medium text-stone-700">
                {{ event.targetType === 'student' ? store.getStudentById(event.targetId)?.name : store.getGroupById(event.targetId)?.name }}
              </span>
              <span class="text-stone-400 mx-1">·</span>
              <span class="text-stone-500">{{ event.label }}</span>
            </span>
            <span
              class="text-xs font-bold px-2 py-0.5 rounded"
              :class="event.points >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'"
            >
              {{ event.points >= 0 ? '+' : '' }}{{ event.points }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
