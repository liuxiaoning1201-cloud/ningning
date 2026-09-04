<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { computed, onMounted } from 'vue'
import { useNative } from '@/composables/useNative'

const route = useRoute()
const router = useRouter()
const native = useNative()

const navItems = [
  { name: 'home', label: '首頁', icon: '🏮' },
  { name: 'asr', label: '口語聽寫', icon: '🎧' },
  { name: 'translate', label: '粘貼翻譯', icon: '📝' },
  { name: 'ocr', label: '截圖識別', icon: '📷' },
  { name: 'vocab', label: '生詞本', icon: '📓' },
  { name: 'review', label: '複習', icon: '🎯' },
  { name: 'dashboard', label: '儀表板', icon: '📊' },
]

const currentName = computed(() => route.name)

function go(name: string) {
  router.push({ name })
}

// APP 啟動 / 從 Share Extension 喚起時，消費掉外部寫入的截圖並跳到 OCR 頁
async function consumeShare() {
  if (!native.isNative.value) return
  const images = await native.consumeSharedImages()
  if (!images.length) return
  // 把圖片暫存到 sessionStorage，OCR 頁讀取後自動執行 OCR
  sessionStorage.setItem('yueyu:incomingImages', JSON.stringify(images))
  router.push({ name: 'ocr' })
}

onMounted(() => {
  void consumeShare()
  // 從 background 拉回時也檢查一次（iOS app resume）
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void consumeShare()
  })
})
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <header class="border-b" style="border-color: color-mix(in srgb, var(--color-ink) 10%, transparent)">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" class="flex items-center gap-2 no-underline" style="color: var(--color-ink)">
          <span class="text-2xl">🎙️</span>
          <span class="font-bold text-lg tracking-tight">粵語學習</span>
          <span class="text-xs px-2 py-0.5 rounded-full" style="background: var(--color-accent-soft); color: var(--color-ink)">MVP</span>
        </a>
        <nav class="hidden md:flex gap-1">
          <button
            v-for="item in navItems"
            :key="item.name"
            class="px-3 py-1.5 text-sm rounded-lg transition cursor-pointer"
            :class="currentName === item.name
              ? 'font-semibold'
              : 'hover:bg-black/5'"
            :style="currentName === item.name
              ? { background: 'var(--color-ink)', color: 'var(--color-paper)' }
              : {}"
            @click="go(item.name)"
          >
            <span class="mr-1">{{ item.icon }}</span>{{ item.label }}
          </button>
        </nav>
      </div>
    </header>

    <main class="flex-1 max-w-6xl mx-auto px-4 py-6 w-full">
      <RouterView v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </main>

    <!-- 手機底部 nav -->
    <nav
      class="md:hidden fixed bottom-0 inset-x-0 border-t flex justify-around py-2"
      style="background: var(--color-paper); border-color: color-mix(in srgb, var(--color-ink) 12%, transparent); backdrop-filter: blur(10px); padding-bottom: max(8px, env(safe-area-inset-bottom))"
    >
      <button
        v-for="item in navItems.slice(0, 5)"
        :key="item.name"
        class="flex flex-col items-center px-2 py-1 text-[11px] rounded transition"
        :class="currentName === item.name ? 'font-bold' : ''"
        :style="currentName === item.name ? { color: 'var(--color-accent)' } : { color: 'var(--color-muted)' }"
        @click="go(item.name)"
      >
        <span class="text-lg">{{ item.icon }}</span>
        {{ item.label }}
      </button>
    </nav>

    <footer class="md:block hidden text-xs text-center py-4" style="color: var(--color-muted)">
      字遊空間 · 粵語學習 MVP — 邊睇劇邊學粵語
    </footer>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.18s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
