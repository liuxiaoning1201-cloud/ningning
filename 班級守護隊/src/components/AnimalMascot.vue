<script setup lang="ts">
import { computed } from 'vue'
import { ANIMAL_CONFIG, type AnimalType } from '../types'

const props = withDefaults(defineProps<{
  animal: AnimalType
  size?: 'sm' | 'md' | 'lg' | 'xl'
  animated?: boolean
}>(), {
  size: 'md',
  animated: false,
})

const config = computed(() => ANIMAL_CONFIG[props.animal])

const sizeMap: Record<string, { container: string; emoji: string }> = {
  sm: { container: 'w-12 h-12', emoji: 'text-2xl' },
  md: { container: 'w-[72px] h-[72px]', emoji: 'text-4xl' },
  lg: { container: 'w-24 h-24', emoji: 'text-5xl' },
  xl: { container: 'w-32 h-32', emoji: 'text-6xl' },
}

const sizeClasses = computed(() => sizeMap[props.size])
</script>

<template>
  <div
    class="rounded-full flex items-center justify-center shadow-md transition-transform duration-300 select-none"
    :class="[
      sizeClasses.container,
      animated && 'animate-bounce-gentle',
    ]"
    :style="{
      backgroundColor: config.lightColor,
      border: `3px solid ${config.color}`,
    }"
  >
    <span :class="sizeClasses.emoji" class="leading-none drop-shadow-sm">
      {{ config.emoji }}
    </span>
  </div>
</template>

<style scoped>
@keyframes bounce-gentle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
.animate-bounce-gentle {
  animation: bounce-gentle 2s ease-in-out infinite;
}
</style>
