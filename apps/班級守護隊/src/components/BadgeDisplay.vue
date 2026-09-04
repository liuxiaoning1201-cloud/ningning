<script setup lang="ts">
import { computed } from 'vue'
import { useClassStore } from '../stores/classStore'

const props = defineProps<{
  groupId?: string
}>()

const store = useClassStore()

const unlockedBadges = computed(() => store.getUnlockedBadges(props.groupId))

function formatDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
</script>

<template>
  <div>
    <div v-if="unlockedBadges.length === 0" class="text-center py-10">
      <div class="text-5xl mb-3">🌱</div>
      <p class="text-stone-500 font-medium">還沒有獲得徽章</p>
      <p class="text-stone-400 text-sm mt-1">繼續努力，很快就能解鎖第一個徽章！</p>
    </div>

    <div v-else class="flex flex-wrap gap-3">
      <div
        v-for="badge in unlockedBadges"
        :key="badge.id"
        class="flex flex-col items-center gap-1.5 rounded-2xl bg-amber-50 border-2 border-amber-200 px-5 py-4 shadow-sm hover:shadow-md transition-shadow duration-200 min-w-[110px]"
      >
        <span class="text-4xl leading-none">{{ badge.emoji }}</span>
        <span class="text-sm font-bold text-amber-800 text-center leading-tight">
          {{ badge.name }}
        </span>
        <span v-if="badge.unlockedAt" class="text-xs text-amber-500">
          {{ formatDate(badge.unlockedAt) }} 解鎖
        </span>
      </div>
    </div>
  </div>
</template>
