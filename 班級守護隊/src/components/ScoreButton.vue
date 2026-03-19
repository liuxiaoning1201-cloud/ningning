<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ScoreButton } from '../types'

const props = defineProps<{
  button: ScoreButton
  disabled: boolean
}>()

defineEmits<{
  click: []
}>()

const justClicked = ref(false)

const isNegative = computed(() => props.button.points < 0)
const isGroupType = computed(() => props.button.targetType === 'group')

const categoryColorMap: Record<string, { bg: string; border: string; text: string; activeBg: string }> = {
  learning: { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', activeBg: '#DBEAFE' },
  listening: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', activeBg: '#DCFCE7' },
  cooperation: { bg: '#FDF4FF', border: '#D8B4FE', text: '#7E22CE', activeBg: '#FAE8FF' },
  habit: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', activeBg: '#FFEDD5' },
  reminder: { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', activeBg: '#FEE2E2' },
}

const colors = computed(() => categoryColorMap[props.button.category] ?? categoryColorMap.habit)

function handleClick() {
  if (props.disabled) return
  justClicked.value = true
  setTimeout(() => { justClicked.value = false }, 300)
}
</script>

<template>
  <button
    @click="handleClick(); $emit('click')"
    class="relative flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-2xl border-2
           font-medium text-sm transition-all duration-150 select-none min-h-[80px] cursor-pointer
           active:scale-95"
    :class="[
      disabled ? 'opacity-40 cursor-not-allowed grayscale' : 'hover:shadow-md hover:-translate-y-0.5',
      justClicked && !disabled && 'score-pop',
    ]"
    :style="{
      backgroundColor: disabled ? '#f5f5f4' : colors.bg,
      borderColor: disabled ? '#d6d3d1' : colors.border,
      color: disabled ? '#a8a29e' : colors.text,
    }"
    :disabled="disabled"
  >
    <span class="text-2xl leading-none">{{ button.emoji }}</span>
    <span class="text-xs font-bold leading-tight text-center">{{ button.label }}</span>
    <span
      class="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
      :style="{
        backgroundColor: isNegative ? '#FEE2E2' : colors.activeBg,
        color: isNegative ? '#B91C1C' : colors.text,
      }"
    >
      {{ button.points > 0 ? '+' : '' }}{{ button.points }}
    </span>
    <span
      v-if="isGroupType"
      class="absolute top-1.5 right-1.5 text-[9px] font-bold px-1 py-0.5 rounded bg-purple-100 text-purple-700"
    >
      組
    </span>
  </button>
</template>
