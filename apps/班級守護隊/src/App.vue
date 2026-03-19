<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useClassStore } from './stores/classStore'

const store = useClassStore()
const route = useRoute()

onMounted(() => {
  store.init()
})

const navItems = [
  { path: '/', label: '總覽', emoji: '🏠' },
  { path: '/classroom', label: '課堂記分', emoji: '✏️' },
  { path: '/display', label: '學生展示', emoji: '📺' },
  { path: '/history', label: '歷史紀錄', emoji: '📊' },
  { path: '/settings', label: '設定', emoji: '⚙️' },
]
</script>

<template>
  <div class="min-h-screen flex" v-if="route.name === 'display'">
    <router-view />
  </div>
  <div class="min-h-screen flex" v-else>
    <aside class="w-56 bg-white shadow-lg flex flex-col shrink-0">
      <div class="p-5 border-b border-stone-100">
        <h1 class="text-xl font-bold text-stone-700 flex items-center gap-2">
          <span class="text-2xl">🐾</span>
          <span>班級守護隊</span>
        </h1>
        <p class="text-xs text-stone-400 mt-1">{{ store.classData.name }}</p>
      </div>
      <nav class="flex-1 p-3">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="flex items-center gap-3 px-4 py-3 rounded-xl mb-1 text-sm font-medium transition-all duration-200"
          :class="route.path === item.path
            ? 'bg-violet-50 text-violet-700 shadow-sm'
            : 'text-stone-500 hover:bg-stone-50 hover:text-stone-700'"
        >
          <span class="text-lg">{{ item.emoji }}</span>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
      <div class="p-4 border-t border-stone-100 text-xs text-stone-400 text-center">
        {{ store.classData.semester }}
      </div>
    </aside>
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>
  </div>
</template>
