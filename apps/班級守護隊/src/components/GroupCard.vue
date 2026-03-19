<script setup lang="ts">
import { computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG } from '../types'
import AnimalMascot from './AnimalMascot.vue'

const props = withDefaults(defineProps<{
  groupId: string
  showScore?: boolean
}>(), {
  showScore: true,
})

const store = useClassStore()

const group = computed(() => store.getGroupById(props.groupId))
const config = computed(() => group.value ? ANIMAL_CONFIG[group.value.animal] : null)
const students = computed(() => store.getStudentsByGroup(props.groupId))
const todayScore = computed(() => store.getGroupTodayScore(props.groupId))
const scorePercent = computed(() => Math.min(100, Math.max(0, (todayScore.value / 30) * 100)))
const unlockedBadges = computed(() => store.getUnlockedBadges(props.groupId).slice(-3))
</script>

<template>
  <div
    v-if="group && config"
    class="rounded-2xl bg-white shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
  >
    <div
      class="h-2 rounded-t-2xl"
      :style="{ backgroundColor: config.color }"
    />

    <div class="p-5">
      <div class="flex items-center gap-4 mb-4">
        <AnimalMascot :animal="group.animal" size="md" :animated="todayScore > 0" />
        <div class="flex-1 min-w-0">
          <h3 class="text-lg font-bold text-stone-700 truncate">{{ group.name }}</h3>
          <p class="text-sm text-stone-400">{{ students.length }} 位成員</p>
        </div>
      </div>

      <div v-if="showScore" class="mb-4">
        <div class="flex items-center justify-between mb-1.5">
          <span class="text-xs font-medium text-stone-500">今日表現</span>
          <span
            class="text-xs font-bold px-2 py-0.5 rounded-full"
            :style="{
              backgroundColor: config.lightColor,
              color: config.darkColor,
            }"
          >
            {{ todayScore }} 分
          </span>
        </div>
        <div class="w-full h-3 rounded-full bg-stone-100 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-500 ease-out"
            :style="{
              width: `${scorePercent}%`,
              backgroundColor: config.color,
            }"
          />
        </div>
      </div>

      <div class="flex items-center gap-1.5 mb-3">
        <div
          v-for="student in students.slice(0, 6)"
          :key="student.id"
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium text-white shrink-0"
          :style="{ backgroundColor: config.color }"
          :title="student.name"
        >
          {{ student.name.charAt(0) }}
        </div>
        <div
          v-if="students.length > 6"
          class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium bg-stone-200 text-stone-500 shrink-0"
        >
          +{{ students.length - 6 }}
        </div>
      </div>

      <div v-if="unlockedBadges.length > 0" class="flex items-center gap-1.5 pt-3 border-t border-stone-100">
        <span
          v-for="badge in unlockedBadges"
          :key="badge.id"
          class="text-lg"
          :title="badge.name"
        >
          {{ badge.emoji }}
        </span>
        <span class="text-xs text-stone-400 ml-1">已獲得徽章</span>
      </div>
    </div>
  </div>
</template>
