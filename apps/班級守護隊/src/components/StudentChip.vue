<script setup lang="ts">
import { computed } from 'vue'
import { ANIMAL_CONFIG, type AnimalType, type Student } from '../types'

const props = defineProps<{
  student: Student
  selected: boolean
  groupAnimal: AnimalType
}>()

defineEmits<{
  click: []
}>()

const config = computed(() => ANIMAL_CONFIG[props.groupAnimal])
</script>

<template>
  <button
    @click="$emit('click')"
    class="relative flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 font-medium text-sm
           transition-all duration-150 active:scale-95 select-none min-h-[48px] cursor-pointer"
    :class="selected
      ? 'shadow-md ring-2 ring-offset-1 scale-[1.03]'
      : 'bg-white hover:shadow-sm'"
    :style="{
      borderColor: selected ? config.color : '#e7e5e4',
      backgroundColor: selected ? config.lightColor : undefined,
      color: selected ? config.darkColor : '#57534e',
      boxShadow: selected ? `0 4px 12px ${config.color}30` : undefined,
    }"
  >
    <span
      class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 transition-transform duration-150"
      :class="selected && 'scale-110'"
      :style="{ backgroundColor: config.color }"
    >
      {{ student.seatNumber }}
    </span>
    <span class="truncate">{{ student.name }}</span>
    <span
      v-if="selected"
      class="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px]"
      :style="{ backgroundColor: config.color }"
    >
      ✓
    </span>
  </button>
</template>
