<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useClassStore } from '../stores/classStore'
import {
  ANIMAL_CONFIG, DEFAULT_SCORE_BUTTONS, ENCOURAGEMENTS_BY_CATEGORY,
  CATEGORY_LABELS, CATEGORY_EMOJIS, CATEGORY_COLORS,
  type AnimalType, type ScoreButton as ScoreButtonType, type ScoreEvent, type ScoreCategory, type Student,
} from '../types'
import StudentChip from '../components/StudentChip.vue'
import ScoreButton from '../components/ScoreButton.vue'
import QuickScorePopup from '../components/QuickScorePopup.vue'

const store = useClassStore()
const router = useRouter()

const selectedGroupId = ref<string | null>(null)
const selectedStudentId = ref<string | null>(null)
const showNoteInput = ref(false)
const noteText = ref('')

// 類別篩選
const activeCategory = ref<ScoreCategory | 'all'>('all')

// 浮窗
interface PopupState {
  mode: 'student' | 'group'
  student?: Student
  groupId?: string
  groupTitle?: string
  animal: AnimalType
  anchorRect: { x: number; y: number; width: number; height: number }
  buttons: ScoreButtonType[]
}
const popup = ref<PopupState | null>(null)

// 課堂 session
const showStartLessonDialog = ref(false)
const lessonSubjectInput = ref('')
const now = ref(Date.now())
let clockTimer: ReturnType<typeof setInterval>

onMounted(() => {
  clockTimer = setInterval(() => { now.value = Date.now() }, 1000)
})
onUnmounted(() => {
  clearInterval(clockTimer)
})

const activeLesson = computed(() => store.activeLesson)

const lessonElapsed = computed(() => {
  if (!activeLesson.value) return ''
  const secs = Math.floor((now.value - activeLesson.value.startedAt) / 1000)
  const mm = Math.floor(secs / 60).toString().padStart(2, '0')
  const ss = (secs % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
})

interface Toast {
  id: number
  message: string
  emoji: string
  points: number
  color: string
  encouragement?: string
  durationMs: number
}
const toasts = ref<Toast[]>([])
let toastCounter = 0

function getRandomEncouragement(category: ScoreCategory): string {
  const list = ENCOURAGEMENTS_BY_CATEGORY[category]
  return list[Math.floor(Math.random() * list.length)] ?? ''
}

watch(() => store.groups, (groups) => {
  if (groups.length > 0 && !selectedGroupId.value) {
    selectedGroupId.value = groups[0].id
  }
}, { immediate: true })

const selectedGroup = computed(() => {
  if (!selectedGroupId.value) return null
  return store.getGroupById(selectedGroupId.value) ?? null
})

const selectedAnimal = computed<AnimalType>(() => selectedGroup.value?.animal ?? 'owl')

const groupStudents = computed(() => {
  if (!selectedGroupId.value) return []
  return store.getStudentsByGroup(selectedGroupId.value)
})

const recentFeed = computed(() => store.todayEvents.slice(0, 8))

const lastEventId = computed(() => recentFeed.value.length > 0 ? recentFeed.value[0].id : null)

const allStudents = computed(() => store.students)

const isAllGroupMode = computed(() => selectedGroupId.value === '__all__')

const displayStudents = computed(() => {
  if (isAllGroupMode.value) return allStudents.value
  return groupStudents.value
})

// 類別篩選過的主按鈕區按鈕
const filteredButtons = computed(() => {
  if (activeCategory.value === 'all') return DEFAULT_SCORE_BUTTONS
  return DEFAULT_SCORE_BUTTONS.filter(b => b.category === activeCategory.value)
})

const availableCategories = computed<ScoreCategory[]>(() => {
  const cats = new Set<ScoreCategory>()
  DEFAULT_SCORE_BUTTONS.forEach(b => cats.add(b.category))
  return (Object.keys(CATEGORY_LABELS) as ScoreCategory[]).filter(c => cats.has(c))
})

function selectGroup(groupId: string) {
  selectedGroupId.value = groupId
  selectedStudentId.value = null
  showNoteInput.value = false
  noteText.value = ''
}

function toggleStudent(studentId: string, event?: MouseEvent) {
  // 若再次點擊已選中的學生，則取消；否則打開浮窗
  if (selectedStudentId.value === studentId) {
    selectedStudentId.value = null
    popup.value = null
    return
  }
  selectedStudentId.value = studentId

  // 開啟浮窗，定位到學生按鈕旁
  const student = store.getStudentById(studentId)
  if (!student) return
  const targetEl = event?.currentTarget as HTMLElement | undefined
  const rect = targetEl?.getBoundingClientRect()
  const anchorRect = rect
    ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height }
    : { x: window.innerWidth / 2, y: window.innerHeight / 2, width: 0, height: 0 }

  const group = store.getGroupById(student.groupId)
  const animal: AnimalType = group?.animal ?? 'owl'

  // 浮窗中不顯示小組類別的按鈕，因為是對學生個人加分
  const buttons = DEFAULT_SCORE_BUTTONS.filter(b => b.targetType === 'student')

  popup.value = {
    mode: 'student',
    student,
    animal,
    anchorRect,
    buttons,
  }
}

function openGroupPopup(groupId: string, event: MouseEvent) {
  event.stopPropagation()
  const group = store.getGroupById(groupId)
  if (!group) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()

  popup.value = {
    mode: 'group',
    groupId,
    groupTitle: group.name,
    animal: group.animal,
    anchorRect: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    buttons: DEFAULT_SCORE_BUTTONS.filter(b => b.targetType === 'group'),
  }
}

function closePopup() {
  popup.value = null
}

function handlePopupSelect(btn: ScoreButtonType) {
  const state = popup.value
  if (!state) return

  if (state.mode === 'student' && state.student) {
    store.addStudentScoreEvent(state.student.id, btn)
    showToast(
      `${state.student.name} ${btn.label}`,
      btn.emoji,
      btn.points,
      ANIMAL_CONFIG[state.animal].color,
      { encouragement: getRandomEncouragement(btn.category), durationMs: 5000 }
    )
    selectedStudentId.value = null
  } else if (state.mode === 'group' && state.groupId) {
    store.addGroupScoreEvent(state.groupId, btn)
    const group = store.getGroupById(state.groupId)
    showToast(
      `${group?.name ?? '小組'} ${btn.label}`,
      btn.emoji,
      btn.points,
      ANIMAL_CONFIG[state.animal].color,
      { encouragement: getRandomEncouragement(btn.category), durationMs: 5000 }
    )
  }

  popup.value = null
}

function isScoreButtonDisabled(button: ScoreButtonType): boolean {
  if (button.targetType === 'group') {
    return isAllGroupMode.value || !selectedGroupId.value
  }
  return !selectedStudentId.value
}

function handleScore(button: ScoreButtonType) {
  if (isScoreButtonDisabled(button)) return

  const note = noteText.value.trim() || undefined

  if (button.targetType === 'group' && selectedGroupId.value && !isAllGroupMode.value) {
    store.addGroupScoreEvent(selectedGroupId.value, button, note)
    const group = store.getGroupById(selectedGroupId.value)
    showToast(`${group?.name ?? '小組'} ${button.label}`, button.emoji, button.points, ANIMAL_CONFIG[selectedAnimal.value].color, {
      encouragement: getRandomEncouragement(button.category),
      durationMs: 5000,
    })
  } else if (button.targetType === 'student' && selectedStudentId.value) {
    const student = store.getStudentById(selectedStudentId.value)
    store.addStudentScoreEvent(selectedStudentId.value, button, note)
    showToast(`${student?.name ?? '學生'} ${button.label}`, button.emoji, button.points, ANIMAL_CONFIG[selectedAnimal.value].color, {
      encouragement: getRandomEncouragement(button.category),
      durationMs: 5000,
    })
    selectedStudentId.value = null
  }

  noteText.value = ''
  showNoteInput.value = false
}

function handleUndo() {
  store.undoLastEvent()
  showToast('已撤銷上一筆', '↩️', 0, '#78716c')
}

function showToast(
  message: string,
  emoji: string,
  points: number,
  color: string,
  options?: { encouragement?: string; durationMs?: number }
) {
  const id = ++toastCounter
  const durationMs = options?.durationMs ?? 2200
  toasts.value.push({
    id,
    message,
    emoji,
    points,
    color,
    encouragement: options?.encouragement,
    durationMs,
  })
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }, durationMs)
}

function getEventDescription(event: ScoreEvent): string {
  if (event.targetType === 'group') {
    const group = store.getGroupById(event.targetId)
    return `${group?.name ?? '小組'}`
  }
  const student = store.getStudentById(event.targetId)
  return `${student?.name ?? '學生'}`
}

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getStudentAnimal(studentId: string): AnimalType {
  const student = store.getStudentById(studentId)
  if (!student) return 'owl'
  const group = store.getGroupById(student.groupId)
  return group?.animal ?? 'owl'
}

// 課堂生命週期
function openStartLesson() {
  lessonSubjectInput.value = ''
  showStartLessonDialog.value = true
}

function confirmStartLesson() {
  const subject = lessonSubjectInput.value.trim() || '課堂'
  store.startLesson(subject)
  showStartLessonDialog.value = false
}

function handleEndLesson() {
  const lesson = store.endActiveLesson()
  if (lesson) {
    router.push({ name: 'lesson-end', params: { lessonId: lesson.id } })
  }
}

function handleCancelLesson() {
  if (window.confirm('取消本堂課？本堂課的計分將被清除，此操作無法復原。')) {
    store.cancelActiveLesson()
  }
}

// 若有 pending 加分，顯示提示
const pendingBonusHint = computed(() => {
  const pending = store.classData.pendingBonusPoints ?? {}
  const items = Object.entries(pending).filter(([, v]) => v > 0)
  if (items.length === 0) return null
  return items.map(([gid, points]) => {
    const g = store.getGroupById(gid)
    return { name: g?.name ?? '小組', animal: g?.animal ?? 'owl', points }
  })
})
</script>

<template>
  <div class="h-full flex flex-col bg-cream overflow-hidden">

    <!-- Lesson Status Bar -->
    <div
      v-if="activeLesson"
      class="shrink-0 px-4 py-2 flex items-center gap-3 text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow"
    >
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-white animate-pulse" />
        <span class="font-bold">課堂中</span>
      </span>
      <span class="font-medium">{{ activeLesson.subject }}</span>
      <span class="font-mono text-xs bg-white/20 px-2 py-0.5 rounded">⏱ {{ lessonElapsed }}</span>
      <div class="flex-1" />
      <button
        @click="handleCancelLesson"
        class="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded-lg transition-colors cursor-pointer"
      >
        取消
      </button>
      <button
        @click="handleEndLesson"
        class="text-sm font-bold bg-white text-emerald-600 hover:bg-emerald-50 px-4 py-1.5 rounded-lg shadow-sm cursor-pointer transition-colors"
      >
        🎁 下課結算
      </button>
    </div>
    <div
      v-else
      class="shrink-0 px-4 py-2 flex items-center gap-3 text-sm bg-stone-100 text-stone-500 border-b border-stone-200"
    >
      <span class="inline-flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-stone-400" />
        <span>未開始課堂</span>
      </span>
      <span v-if="pendingBonusHint" class="text-xs text-amber-600">
        🎟️ 下節課起始加分：
        <span v-for="item in pendingBonusHint" :key="item.name" class="ml-1">
          <img
            :src="ANIMAL_CONFIG[item.animal].avatar"
            :alt="`${item.name} 頭像`"
            class="inline-block w-5 h-5 object-cover rounded-full align-text-bottom mx-1"
          />
          {{ item.name }} +{{ item.points }}
        </span>
      </span>
      <div class="flex-1" />
      <button
        @click="openStartLesson"
        class="text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-1.5 rounded-lg shadow-sm cursor-pointer transition-colors"
      >
        ▶ 開始上課
      </button>
    </div>

    <!-- Section 1: Group Tabs -->
    <div class="shrink-0 bg-white border-b border-stone-200 shadow-sm px-4 py-3">
      <div class="flex items-center gap-2 overflow-x-auto">
        <button
          @click="selectGroup('__all__')"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150
                 min-h-[48px] shrink-0 border-2 cursor-pointer active:scale-95"
          :class="isAllGroupMode
            ? 'bg-stone-700 text-white border-stone-700 shadow-md'
            : 'bg-white text-stone-500 border-stone-200 hover:border-stone-300 hover:bg-stone-50'"
        >
          <span class="text-lg">👥</span>
          <span>全班</span>
        </button>

        <div class="w-px h-8 bg-stone-200 shrink-0" />

        <div
          v-for="group in store.groups"
          :key="group.id"
          class="flex items-stretch shrink-0 rounded-xl border-2 overflow-hidden transition-all duration-150"
          :class="selectedGroupId === group.id && !isAllGroupMode
            ? 'shadow-md scale-[1.02]'
            : ''"
          :style="selectedGroupId === group.id && !isAllGroupMode
            ? {
                backgroundColor: ANIMAL_CONFIG[group.animal].lightColor,
                borderColor: ANIMAL_CONFIG[group.animal].color,
              }
            : { borderColor: '#e7e5e4', backgroundColor: 'white' }"
        >
          <button
            @click="selectGroup(group.id)"
            class="flex items-center gap-2 px-4 py-2.5 font-semibold text-sm transition-all duration-150 min-h-[48px] cursor-pointer active:scale-95"
            :style="selectedGroupId === group.id && !isAllGroupMode
              ? { color: ANIMAL_CONFIG[group.animal].darkColor }
              : { color: '#78716c' }"
          >
            <img
              :src="ANIMAL_CONFIG[group.animal].avatar"
              :alt="`${group.name} 頭像`"
              class="w-8 h-8 rounded-full object-cover border-2"
              :style="{ borderColor: ANIMAL_CONFIG[group.animal].color }"
            />
            <span>{{ group.name }}</span>
            <span
              class="ml-1 text-xs font-bold px-2 py-0.5 rounded-full"
              :style="{
                backgroundColor: selectedGroupId === group.id && !isAllGroupMode
                  ? ANIMAL_CONFIG[group.animal].color + '20'
                  : '#f5f5f4',
                color: selectedGroupId === group.id && !isAllGroupMode
                  ? ANIMAL_CONFIG[group.animal].darkColor
                  : '#a8a29e',
              }"
            >
              {{ store.getGroupTodayScore(group.id) }} 分
            </span>
          </button>
          <!-- Quick group score button -->
          <button
            @click="openGroupPopup(group.id, $event)"
            class="px-2 flex items-center justify-center text-lg font-bold border-l-2 cursor-pointer hover:opacity-80 transition-opacity"
            :title="`${group.name} 快速計分`"
            :style="{
              borderLeftColor: '#e7e5e4',
              backgroundColor: ANIMAL_CONFIG[group.animal].color + '20',
              color: ANIMAL_CONFIG[group.animal].darkColor,
            }"
          >
            ＋
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex min-h-0 overflow-hidden">

      <!-- Left + Center: Students + Score Buttons -->
      <div class="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">

        <!-- Student Selection -->
        <div class="lg:w-[280px] xl:w-[320px] shrink-0 border-r border-stone-100 overflow-y-auto p-4">
          <h2 class="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span>選擇學生</span>
            <span v-if="selectedStudentId" class="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full normal-case tracking-normal">
              已選擇 1 人
            </span>
          </h2>

          <div class="grid grid-cols-2 gap-2">
            <StudentChip
              v-for="student in displayStudents"
              :key="student.id"
              :student="student"
              :selected="selectedStudentId === student.id"
              :group-animal="isAllGroupMode ? getStudentAnimal(student.id) : selectedAnimal"
              @click="toggleStudent(student.id, $event)"
            />
          </div>

          <div v-if="displayStudents.length === 0" class="text-center py-10 text-stone-400 text-sm">
            此小組暫無學生
          </div>

          <p class="text-[11px] text-stone-400 mt-4 leading-relaxed">
            💡 點擊學生會在旁邊開啟快捷計分面板，免切換頁面！
          </p>
        </div>

        <!-- Score Buttons -->
        <div class="flex-1 overflow-y-auto p-4">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xs font-bold text-stone-400 uppercase tracking-wider">
              計分按鈕
            </h2>
          </div>

          <!-- Category Filter Tabs -->
          <div class="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            <button
              @click="activeCategory = 'all'"
              class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border-2"
              :class="activeCategory === 'all'
                ? 'bg-stone-700 text-white border-stone-700 shadow-sm'
                : 'bg-white text-stone-500 border-stone-200 hover:bg-stone-50'"
            >
              全部
            </button>
            <button
              v-for="cat in availableCategories"
              :key="cat"
              @click="activeCategory = cat"
              class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border-2 flex items-center gap-1"
              :style="activeCategory === cat
                ? { backgroundColor: CATEGORY_COLORS[cat].bar, color: 'white', borderColor: CATEGORY_COLORS[cat].bar }
                : { backgroundColor: CATEGORY_COLORS[cat].bg, color: CATEGORY_COLORS[cat].text, borderColor: CATEGORY_COLORS[cat].border }"
            >
              <span>{{ CATEGORY_EMOJIS[cat] }}</span>
              <span>{{ CATEGORY_LABELS[cat] }}</span>
            </button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <ScoreButton
              v-for="btn in filteredButtons"
              :key="btn.id"
              :button="btn"
              :disabled="isScoreButtonDisabled(btn)"
              @click="handleScore(btn)"
            />
          </div>

          <!-- Quick Note -->
          <div class="mt-4">
            <button
              @click="showNoteInput = !showNoteInput"
              class="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>📝</span>
              <span>{{ showNoteInput ? '收起備註' : '加入備註（選填）' }}</span>
            </button>
            <Transition name="slide-up">
              <div v-if="showNoteInput" class="mt-2">
                <input
                  v-model="noteText"
                  type="text"
                  placeholder="例如：主動舉手回答問題..."
                  class="w-full px-3 py-2.5 rounded-xl border-2 border-stone-200 text-sm
                         focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100
                         transition-all placeholder:text-stone-300"
                  @keyup.enter="noteText.trim() && (showNoteInput = false)"
                />
              </div>
            </Transition>
          </div>

          <!-- Scoring hint -->
          <div class="mt-5 p-3 rounded-xl bg-stone-50 border border-stone-100">
            <p class="text-xs text-stone-400 leading-relaxed">
              <span class="font-semibold text-stone-500">操作提示：</span>
              點擊學生會自動彈出快捷面板 ｜ 點擊小組標籤旁的「＋」可直接小組計分 ｜ 上方可按類別篩選按鈕
            </p>
          </div>
        </div>
      </div>

      <!-- Right Sidebar: Activity Feed -->
      <div class="w-[260px] xl:w-[300px] shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-hidden">
        <div class="p-4 border-b border-stone-100 flex items-center justify-between">
          <h2 class="text-xs font-bold text-stone-400 uppercase tracking-wider">
            今日動態
          </h2>
          <button
            v-if="lastEventId"
            @click="handleUndo"
            class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium
                   text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100
                   transition-colors cursor-pointer active:scale-95 min-h-[36px]"
          >
            <span>↩️</span>
            <span>撤銷</span>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-3">
          <TransitionGroup name="slide-up" tag="div" class="space-y-2">
            <div
              v-for="event in recentFeed"
              :key="event.id"
              class="p-2.5 rounded-xl border transition-all duration-300"
              :class="event.points < 0 ? 'bg-red-50 border-red-100' : 'bg-stone-50 border-stone-100'"
            >
              <div class="flex items-start gap-2">
                <span class="text-base shrink-0 mt-0.5">
                  {{ DEFAULT_SCORE_BUTTONS.find(b => b.label === event.label)?.emoji ?? '✨' }}
                </span>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-bold text-stone-600 truncate">
                      {{ getEventDescription(event) }}
                    </span>
                    <span
                      class="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                      :class="event.points < 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-700'"
                    >
                      {{ event.points > 0 ? '+' : '' }}{{ event.points }}
                    </span>
                  </div>
                  <p class="text-[11px] text-stone-400 mt-0.5">
                    {{ event.label }} · {{ formatTime(event.timestamp) }}
                  </p>
                  <p v-if="event.note" class="text-[11px] text-stone-500 mt-1 italic">
                    📝 {{ event.note }}
                  </p>
                </div>
              </div>
            </div>
          </TransitionGroup>

          <div v-if="recentFeed.length === 0" class="text-center py-10 text-stone-300 text-sm">
            <p class="text-2xl mb-2">📋</p>
            <p>尚無記錄</p>
            <p class="text-xs mt-1">開始計分吧！</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Score Popup -->
    <QuickScorePopup
      v-if="popup"
      :student="popup.student ?? null"
      :animal="popup.animal"
      :buttons="popup.buttons"
      :anchor-rect="popup.anchorRect"
      :title="popup.groupTitle"
      @select="handlePopupSelect"
      @close="closePopup"
    />

    <!-- Start Lesson Dialog -->
    <Teleport to="body">
      <div
        v-if="showStartLessonDialog"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        @click.self="showStartLessonDialog = false"
      >
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 class="text-lg font-semibold text-stone-700 mb-3 flex items-center gap-2">
            <span>📚</span> 開始上課
          </h3>
          <p class="text-xs text-stone-500 mb-3">輸入科目名稱，系統會為本堂課記錄所有計分與小組表現。</p>
          <input
            v-model="lessonSubjectInput"
            type="text"
            placeholder="例如：國語、數學、英語"
            class="w-full px-4 py-2.5 border-2 border-stone-200 rounded-xl text-sm focus:outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
            @keyup.enter="confirmStartLesson"
            autofocus
          />
          <div class="flex justify-end gap-2 mt-5">
            <button
              @click="showStartLessonDialog = false"
              class="px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              @click="confirmStartLesson"
              class="px-5 py-2 bg-emerald-500 text-white rounded-xl text-sm font-bold hover:bg-emerald-600 transition-colors cursor-pointer"
            >
              開始
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Toast：計分時顯示對應類別鼓勵語約 5 秒，提示學生 -->
    <Teleport to="body">
      <TransitionGroup name="toast" tag="div" class="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 max-w-[90vw]">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="flex flex-col items-center gap-1 px-6 py-4 rounded-2xl shadow-xl text-white font-bold
                 backdrop-blur-sm border border-white/20 text-center"
          :style="{ backgroundColor: toast.color + 'ee' }"
        >
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ toast.emoji }}</span>
            <span
              v-if="toast.encouragement"
              class="text-lg leading-snug"
            >
              {{ toast.encouragement }}
            </span>
            <template v-else>
              <span class="text-sm">{{ toast.message }}</span>
              <span
                v-if="toast.points !== 0"
                class="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20"
              >
                {{ toast.points > 0 ? '+' : '' }}{{ toast.points }}
              </span>
            </template>
          </div>
          <p
            v-if="toast.encouragement"
            class="text-xs font-medium opacity-90"
          >
            {{ toast.message }}
            <span v-if="toast.points !== 0"> · {{ toast.points > 0 ? '+' : '' }}{{ toast.points }} 分</span>
          </p>
        </div>
      </TransitionGroup>
    </Teleport>
  </div>
</template>

<style scoped>
.toast-enter-active {
  transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.toast-leave-active {
  transition: all 0.25s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
.toast-move {
  transition: transform 0.3s ease;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
.slide-up-move {
  transition: transform 0.3s ease;
}
</style>
