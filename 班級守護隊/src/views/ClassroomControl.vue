<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG, DEFAULT_SCORE_BUTTONS, ENCOURAGEMENTS_BY_CATEGORY, type AnimalType, type ScoreButton as ScoreButtonType, type ScoreEvent, type ScoreCategory } from '../types'
import StudentChip from '../components/StudentChip.vue'
import ScoreButton from '../components/ScoreButton.vue'

const store = useClassStore()

const selectedGroupId = ref<string | null>(null)
const selectedStudentId = ref<string | null>(null)
const showNoteInput = ref(false)
const noteText = ref('')

interface Toast {
  id: number
  message: string
  emoji: string
  points: number
  color: string
  /** 對應類別的鼓勵語，顯示約 5 秒提示學生 */
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

function selectGroup(groupId: string) {
  selectedGroupId.value = groupId
  selectedStudentId.value = null
  showNoteInput.value = false
  noteText.value = ''
}

function toggleStudent(studentId: string) {
  selectedStudentId.value = selectedStudentId.value === studentId ? null : studentId
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
  showToast('已撤銷上一筆', '↩️', 0, '#78716c') // 不加鼓勵語，維持約 2 秒
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
</script>

<template>
  <div class="h-full flex flex-col bg-cream overflow-hidden">

    <!-- Section 1: Group Tabs -->
    <div class="shrink-0 bg-white border-b border-stone-200 shadow-sm px-4 py-3">
      <div class="flex items-center gap-2 overflow-x-auto">
        <!-- All groups tab -->
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

        <!-- Group tabs -->
        <button
          v-for="group in store.groups"
          :key="group.id"
          @click="selectGroup(group.id)"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-150
                 min-h-[48px] shrink-0 border-2 cursor-pointer active:scale-95"
          :class="selectedGroupId === group.id && !isAllGroupMode
            ? 'shadow-md scale-[1.02]'
            : 'bg-white hover:shadow-sm'"
          :style="selectedGroupId === group.id && !isAllGroupMode
            ? {
                backgroundColor: ANIMAL_CONFIG[group.animal].lightColor,
                borderColor: ANIMAL_CONFIG[group.animal].color,
                color: ANIMAL_CONFIG[group.animal].darkColor,
              }
            : {
                borderColor: '#e7e5e4',
                color: '#78716c',
              }"
        >
          <span class="text-lg">{{ ANIMAL_CONFIG[group.animal].emoji }}</span>
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
              @click="toggleStudent(student.id)"
            />
          </div>

          <div v-if="displayStudents.length === 0" class="text-center py-10 text-stone-400 text-sm">
            此小組暫無學生
          </div>
        </div>

        <!-- Score Buttons -->
        <div class="flex-1 overflow-y-auto p-4">
          <h2 class="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
            計分按鈕
          </h2>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <ScoreButton
              v-for="btn in DEFAULT_SCORE_BUTTONS"
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
              個人計分 → 先點學生再點按鈕 ｜ 小組計分 → 選擇小組後直接點
              <span class="inline-flex items-center gap-0.5 text-purple-600 font-medium bg-purple-50 px-1 rounded">
                <span class="text-[10px]">組</span>
              </span>
              按鈕
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
</style>
