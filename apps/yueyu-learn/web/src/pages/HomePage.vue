<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useVocabStore } from '@/stores/vocab'
import { isDue } from '@yueyu/shared/srs'
import { useInstallPrompt } from '@/composables/usePwa'

const router = useRouter()
const vocab = useVocabStore()
const { installable, promptInstall } = useInstallPrompt()

onMounted(() => {
  if (!vocab.loaded) vocab.load()
})

const features = [
  {
    name: 'asr',
    title: '口語聽寫',
    desc: '上傳粵語對白片段，直接聽出人物實際講法，附粵拼和常見詞例句',
    icon: '🎧',
    accent: 'jade',
  },
  {
    name: 'translate',
    title: '粘貼字幕翻譯',
    desc: '只有字幕沒有聲音時，用書面語推測粵語口語說法',
    icon: '📝',
    accent: 'accent',
  },
  {
    name: 'ocr',
    title: '截圖識別',
    desc: '識別截圖中的書面字幕，再做口語對照',
    icon: '📷',
    accent: 'jade',
  },
  {
    name: 'vocab',
    title: '生詞本',
    desc: '收藏的金句自動帶劇名、時間、截圖，跨設備同步',
    icon: '📓',
    accent: 'accent',
  },
  {
    name: 'review',
    title: '間隔複習',
    desc: '科學記憶演算法，每天 5 分鐘把粵語口語刻進腦子',
    icon: '🎯',
    accent: 'jade',
  },
]

function go(name: string) {
  router.push({ name })
}
</script>

<template>
  <div class="space-y-8 pb-24 md:pb-0">
    <!-- Hero -->
    <section class="text-center py-8 md:py-14">
      <div class="text-6xl mb-4">🎙️</div>
      <h1 class="text-3xl md:text-5xl font-bold tracking-tight mb-3" style="color: var(--color-ink)">
        聽出真正嘅粵語<br class="md:hidden" />
        <span style="color: var(--color-accent)">口語對白</span>
      </h1>
      <p class="text-base md:text-lg max-w-xl mx-auto leading-relaxed" style="color: var(--color-muted)">
        字幕係書面語，演員講嘅卻係地道粵語。<br />
        先聽聲音識別口語，再補粵拼、解釋同例句朗讀。
      </p>
      <div class="mt-6 flex gap-3 justify-center flex-wrap">
        <button
          class="px-6 py-3 rounded-xl font-medium cursor-pointer transition hover:scale-105"
          style="background: var(--color-accent); color: white; box-shadow: 0 4px 14px color-mix(in srgb, var(--color-accent) 35%, transparent)"
          @click="go('asr')"
        >
          🎧 開始聽寫 →
        </button>
        <button
          class="px-6 py-3 rounded-xl font-medium border cursor-pointer transition hover:bg-black/5"
          style="border-color: color-mix(in srgb, var(--color-ink) 18%, transparent); color: var(--color-ink)"
          @click="go('vocab')"
        >
          📓 我的生詞本（{{ vocab.total }}）
        </button>
      </div>
    </section>

    <!-- 功能卡 -->
    <section class="grid sm:grid-cols-2 gap-4">
      <button
        v-for="f in features"
        :key="f.name"
        class="card p-5 text-left cursor-pointer group transition"
        @click="go(f.name)"
      >
        <div class="flex items-start gap-3">
          <div
            class="text-3xl rounded-lg w-14 h-14 flex items-center justify-center shrink-0"
            :style="f.accent === 'accent'
              ? { background: 'color-mix(in srgb, var(--color-accent-soft) 60%, transparent)' }
              : { background: 'color-mix(in srgb, var(--color-jade) 12%, transparent)' }"
          >
            {{ f.icon }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-lg mb-1 group-hover:text-[var(--color-accent)] transition">
              {{ f.title }} <span class="opacity-50 text-sm group-hover:translate-x-1 inline-block transition">→</span>
            </div>
            <div class="text-sm" style="color: var(--color-muted)">
              {{ f.desc }}
            </div>
          </div>
        </div>
      </button>
    </section>

    <!-- 學習進度條（如有生詞） -->
    <section v-if="vocab.total > 0" class="card p-5">
      <div class="flex items-center justify-between mb-2">
        <div class="font-medium">📊 今日待複習</div>
        <button class="text-sm hover:underline cursor-pointer" style="color: var(--color-jade)" @click="go('review')">
          開始複習 →
        </button>
      </div>
      <div class="text-sm" style="color: var(--color-muted)">
        共 <span class="font-semibold" style="color: var(--color-ink)">{{ vocab.entries.filter(e => isDue(e.srs)).length }}</span> 句
        / 總計 <span class="font-semibold" style="color: var(--color-ink)">{{ vocab.total }}</span>
      </div>
    </section>

    <!-- 介紹瀏覽器擴展 -->
    <section class="card p-5">
      <div class="flex items-center gap-3 mb-2">
        <span class="text-2xl">🧩</span>
        <div class="font-medium">瀏覽器擴展</div>
      </div>
      <p class="text-sm mb-1" style="color: var(--color-muted)">
        裝上 Chrome 擴展，睇 YouTube / bilibili / TVB / myTV SUPER 粵劇時自動跳出對照卡與雙軌字幕。
      </p>
    </section>

    <!-- PWA 安裝提示 -->
    <section v-if="installable" class="card p-5 flex items-center gap-3" style="background: linear-gradient(120deg, var(--color-accent-soft), white)">
      <span class="text-3xl">📱</span>
      <div class="flex-1">
        <div class="font-medium">裝到桌面，更像 APP</div>
        <div class="text-xs" style="color: var(--color-muted)">一鍵添加到主屏幕，離線也能查生詞本</div>
      </div>
      <button
        class="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
        style="background: var(--color-accent); color: white"
        @click="promptInstall()"
      >安裝</button>
    </section>
  </div>
</template>
