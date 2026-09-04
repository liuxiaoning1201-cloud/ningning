<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { ScoreButton as ScoreButtonType, ScoreCategory, Student } from '../types'
import { CATEGORY_LABELS, CATEGORY_EMOJIS, CATEGORY_COLORS, ANIMAL_CONFIG, type AnimalType } from '../types'

const props = defineProps<{
  /** 目標學生（個人計分）；若為 null 則是整組計分 */
  student: Student | null
  /** 動物主題 */
  animal: AnimalType
  /** 可用的按鈕 */
  buttons: ScoreButtonType[]
  /** 浮窗顯示位置相對於視窗的參考座標 */
  anchorRect?: { x: number; y: number; width: number; height: number } | null
  /** 標題（小組模式） */
  title?: string
}>()

const emit = defineEmits<{
  (e: 'select', button: ScoreButtonType): void
  (e: 'close'): void
}>()

const activeCategory = ref<ScoreCategory | 'all'>('all')

const availableCategories = computed<ScoreCategory[]>(() => {
  const cats = new Set<ScoreCategory>()
  props.buttons.forEach(b => cats.add(b.category))
  return (Object.keys(CATEGORY_LABELS) as ScoreCategory[]).filter(c => cats.has(c))
})

const filteredButtons = computed(() => {
  if (activeCategory.value === 'all') return props.buttons
  return props.buttons.filter(b => b.category === activeCategory.value)
})

/** 計算浮窗定位 */
const popupStyle = computed(() => {
  const rect = props.anchorRect
  if (!rect) {
    return {
      top: '50%',
      left: '50%',
      marginTop: '-250px',
      marginLeft: '-240px',
    }
  }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const popupWidth = 480
  const popupHeight = 500
  let left = rect.x + rect.width + 12
  if (left + popupWidth > vw - 12) {
    left = rect.x - popupWidth - 12
  }
  if (left < 12) left = 12
  let top = rect.y + rect.height / 2 - popupHeight / 2
  if (top < 12) top = 12
  if (top + popupHeight > vh - 12) top = vh - popupHeight - 12
  return {
    top: `${top}px`,
    left: `${left}px`,
  }
})

function handleBackdropClick() {
  emit('close')
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleEscape)
})

function handleSelect(btn: ScoreButtonType) {
  emit('select', btn)
}

const subtitle = computed(() => {
  if (props.student) return `${props.student.seatNumber}號 · ${props.student.name}`
  return props.title ?? '小組計分'
})
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-40 bg-stone-900/10 backdrop-blur-[1px]"
      @click="handleBackdropClick"
    />
    <div
      class="quick-popup fixed z-50 bg-white rounded-2xl shadow-2xl border-2 p-5 w-[480px] max-h-[90vh] overflow-y-auto"
      :style="[popupStyle, { borderColor: ANIMAL_CONFIG[animal].color }]"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span
            class="w-11 h-11 rounded-full flex items-center justify-center text-xl"
            :style="{ backgroundColor: ANIMAL_CONFIG[animal].color, color: 'white' }"
          >
            <template v-if="student">{{ student.seatNumber }}</template>
            <img
              v-else
              :src="ANIMAL_CONFIG[animal].avatar"
              :alt="`${ANIMAL_CONFIG[animal].name} 頭像`"
              class="w-8 h-8 rounded-full object-cover border border-white/70"
            />
          </span>
          <div>
            <p class="text-sm text-stone-400 leading-none">快速計分</p>
            <p class="text-base font-bold text-stone-700 mt-0.5">{{ subtitle }}</p>
          </div>
        </div>
        <button
          @click="emit('close')"
          class="w-7 h-7 rounded-full hover:bg-stone-100 text-stone-400 hover:text-stone-600 flex items-center justify-center cursor-pointer transition-colors"
          aria-label="關閉"
        >
          ✕
        </button>
      </div>

      <!-- Category tabs -->
      <div class="flex gap-1 mb-3 overflow-x-auto -mx-1 px-1">
        <button
          @click="activeCategory = 'all'"
          class="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border"
          :class="activeCategory === 'all'
            ? 'bg-stone-700 text-white border-stone-700'
            : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'"
        >
          全部
        </button>
        <button
          v-for="cat in availableCategories"
          :key="cat"
          @click="activeCategory = cat"
          class="shrink-0 text-xs font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer border flex items-center gap-1"
          :style="activeCategory === cat
            ? { backgroundColor: CATEGORY_COLORS[cat].bar, color: 'white', borderColor: CATEGORY_COLORS[cat].bar }
            : { backgroundColor: CATEGORY_COLORS[cat].bg, color: CATEGORY_COLORS[cat].text, borderColor: CATEGORY_COLORS[cat].border }"
        >
          <span>{{ CATEGORY_EMOJIS[cat] }}</span>
          <span>{{ CATEGORY_LABELS[cat] }}</span>
        </button>
      </div>

      <!-- Buttons grid -->
      <div class="grid grid-cols-3 gap-2.5">
        <button
          v-for="btn in filteredButtons"
          :key="btn.id"
          @click="handleSelect(btn)"
          class="compact-btn relative flex flex-col items-center gap-1 rounded-xl px-2 py-3 border-2 cursor-pointer active:scale-95 transition-all hover:-translate-y-0.5 hover:shadow-md"
          :style="{
            backgroundColor: CATEGORY_COLORS[btn.category].bg,
            borderColor: CATEGORY_COLORS[btn.category].border,
            color: CATEGORY_COLORS[btn.category].text,
          }"
        >
          <span class="text-2xl leading-none">{{ btn.emoji }}</span>
          <span class="text-sm font-bold leading-tight text-center">{{ btn.label }}</span>
          <span
            class="text-xs font-bold px-2 py-0.5 rounded-full mt-0.5"
            :style="{
              backgroundColor: btn.points < 0 ? '#FEE2E2' : 'white',
              color: btn.points < 0 ? '#B91C1C' : CATEGORY_COLORS[btn.category].text,
            }"
          >
            {{ btn.points > 0 ? '+' : '' }}{{ btn.points }}
          </span>
          <span
            v-if="btn.targetType === 'group'"
            class="absolute top-1 right-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700"
          >組</span>
        </button>
      </div>

      <p
        v-if="filteredButtons.length === 0"
        class="text-center text-stone-400 py-6 text-sm"
      >
        此類別尚無按鈕
      </p>
    </div>
  </Teleport>
</template>

<style scoped>
.quick-popup {
  animation: popIn 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes popIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
