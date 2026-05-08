<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { useVocabStore } from '@/stores/vocab'
import { isDue } from '@yueyu/shared/srs'
import { useNative } from '@/composables/useNative'

const vocab = useVocabStore()
const native = useNative()
const overlayGranted = ref(false)
const bubbleRunning = ref(false)

onMounted(async () => {
  if (!vocab.loaded) vocab.load()
  if (native.isNative.value && native.platform.value === 'android') {
    overlayGranted.value = await native.hasOverlayPermission()
  }
})

async function toggleBubble() {
  if (!overlayGranted.value) {
    await native.requestOverlayPermission()
    overlayGranted.value = await native.hasOverlayPermission()
    if (!overlayGranted.value) return
  }
  if (bubbleRunning.value) {
    await native.stopFloatingBubble()
    bubbleRunning.value = false
  } else {
    await native.startFloatingBubble()
    bubbleRunning.value = true
  }
}

const stats = computed(() => {
  const total = vocab.entries.length
  const due = vocab.entries.filter((e) => isDue(e.srs)).length
  const mastered = vocab.entries.filter((e) => (e.srs?.repetitions ?? 0) >= 4).length
  const reviews = vocab.entries.reduce((sum, e) => sum + (e.srs?.repetitions ?? 0), 0)

  // 統計過去 7 天添加的生詞
  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('zh-HK', { month: 'numeric', day: 'numeric' }), count: 0 }
  })
  for (const e of vocab.entries) {
    const day = e.createdAt.slice(0, 10)
    const slot = last7.find((d) => d.date === day)
    if (slot) slot.count += 1
  }

  return { total, due, mastered, reviews, last7 }
})

const maxCount = computed(() => Math.max(1, ...stats.value.last7.map((d) => d.count)))
</script>

<template>
  <div class="space-y-5 pb-24 md:pb-0">
    <header>
      <h2 class="text-2xl font-bold mb-1">📊 學習儀表板</h2>
      <p class="text-sm" style="color: var(--color-muted)">追蹤您的粵語學習進度</p>
    </header>

    <!-- 4 個指標 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--color-ink)">{{ stats.total }}</div>
        <div class="text-xs mt-1" style="color: var(--color-muted)">累積生詞</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--color-accent)">{{ stats.due }}</div>
        <div class="text-xs mt-1" style="color: var(--color-muted)">待複習</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--color-jade)">{{ stats.mastered }}</div>
        <div class="text-xs mt-1" style="color: var(--color-muted)">已掌握</div>
      </div>
      <div class="card p-4 text-center">
        <div class="text-2xl font-bold" style="color: var(--color-ink)">{{ stats.reviews }}</div>
        <div class="text-xs mt-1" style="color: var(--color-muted)">累積複習</div>
      </div>
    </div>

    <!-- 7 日趨勢 -->
    <div class="card p-5">
      <div class="text-sm font-medium mb-3">📈 過去 7 日新增</div>
      <div class="flex items-end gap-2 h-32">
        <div
          v-for="d in stats.last7"
          :key="d.date"
          class="flex-1 flex flex-col items-center justify-end gap-1"
        >
          <div class="text-[10px] tabular-nums" style="color: var(--color-muted)">{{ d.count }}</div>
          <div
            class="w-full rounded-t transition-all"
            :style="{
              height: `${(d.count / maxCount) * 100}%`,
              background: d.count > 0 ? 'var(--color-accent)' : 'color-mix(in srgb, var(--color-ink) 8%, transparent)',
              minHeight: '2px',
            }"
          />
          <div class="text-[10px]" style="color: var(--color-muted)">{{ d.label }}</div>
        </div>
      </div>
    </div>

    <!-- Android 浮窗 OCR 開關（僅原生 APP 顯示） -->
    <div
      v-if="native.isNative.value && native.platform.value === 'android'"
      class="card p-5"
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="font-medium mb-1">🫧 浮窗 OCR</div>
          <div class="text-xs" style="color: var(--color-muted)">
            喺其他 APP 上方顯示一個小球，睇劇時點一下就截圖識別字幕。
            <span v-if="!overlayGranted" style="color: var(--color-accent)">需要先授予「顯示在其他 APP 上層」權限。</span>
          </div>
        </div>
        <button
          class="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer whitespace-nowrap"
          :style="bubbleRunning
            ? { background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }
            : { background: 'var(--color-jade)', color: 'white' }"
          @click="toggleBubble"
        >
          {{ bubbleRunning ? '關閉浮窗' : '開啟浮窗' }}
        </button>
      </div>
    </div>

    <!-- API Keys 入口 -->
    <RouterLink
      to="/apikeys"
      class="card p-5 flex items-center gap-3 no-underline"
      style="color: inherit"
    >
      <span class="text-3xl">🔑</span>
      <div class="flex-1">
        <div class="font-medium">個人 API Keys</div>
        <div class="text-xs" style="color: var(--color-muted)">
          為您自寫的軟件、命令列腳本或第三方插件申請長期 Token，所有調用計入您的個人配額。
        </div>
      </div>
      <span style="color: var(--color-muted)">→</span>
    </RouterLink>

    <!-- 提示 -->
    <div class="card p-4 text-sm" style="color: var(--color-muted)">
      💡 建議每天花 5–10 分鐘複習待複習生詞，搭配看劇收藏新句，1 個月可形成完整的粵語口語語感。
    </div>
  </div>
</template>
