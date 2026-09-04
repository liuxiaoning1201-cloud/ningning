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

const sizeMap: Record<string, { container: string; image: string }> = {
  sm: { container: 'w-12 h-12', image: 'w-10 h-10' },
  md: { container: 'w-[72px] h-[72px]', image: 'w-14 h-14' },
  lg: { container: 'w-24 h-24', image: 'w-20 h-20' },
  xl: { container: 'w-32 h-32', image: 'w-28 h-28' },
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
    <img
      :src="config.avatar"
      :alt="`${config.name} 小組頭像`"
      :class="sizeClasses.image"
      class="object-contain drop-shadow-sm select-none"
      draggable="false"
    />
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
