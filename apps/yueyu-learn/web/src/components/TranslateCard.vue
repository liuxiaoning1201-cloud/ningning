<script setup lang="ts">
import { computed, ref } from 'vue'
import type { TranslateResult } from '@yueyu/shared/types'
import { useTts } from '@/composables/useTts'
import { useVocabStore } from '@/stores/vocab'

const props = defineProps<{
  result: TranslateResult
  /** 來源信息（可選），用於收藏時帶上下文 */
  source?: { site?: string; title?: string; timestampSec?: number; url?: string }
}>()

const tts = useTts()
const vocab = useVocabStore()

const hovering = ref<number | null>(null)

const sourceTag = computed(() => {
  switch (props.result.source) {
    case 'cache': return { label: '緩存', tone: 'jade' }
    case 'dict': return { label: '詞表', tone: 'jade' }
    case 'llm': return { label: 'LLM', tone: 'accent' }
  }
})

async function favorite() {
  await vocab.add({
    granularity: 'sentence',
    written: props.result.written,
    cantonese: props.result.cantonese,
    jyutping: props.result.jyutping,
    explanation: props.result.explanation,
    source: props.source,
  })
}

const isFavorite = computed(() =>
  vocab.entries.some((e) => e.written === props.result.written && e.cantonese === props.result.cantonese),
)

function speakSentence(speed: 'slow' | 'normal' | 'fast' = 'normal') {
  tts.speak(props.result.cantonese, { speed })
}

function speakToken(token: string) {
  tts.speak(token)
}
</script>

<template>
  <div class="card p-4 md:p-5">
    <!-- 頂部：原句 + 來源標籤 + 操作 -->
    <div class="flex items-start justify-between gap-2 mb-3">
      <div class="flex-1 min-w-0">
        <div class="text-xs mb-1 flex items-center gap-2" style="color: var(--color-muted)">
          <span>📖 書面語原文</span>
          <span
            class="px-1.5 py-0.5 rounded text-[10px]"
            :style="sourceTag?.tone === 'accent'
              ? { background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', color: 'var(--color-accent)' }
              : { background: 'color-mix(in srgb, var(--color-jade) 14%, transparent)', color: 'var(--color-jade)' }"
          >
            {{ sourceTag?.label }}
          </span>
        </div>
        <div class="text-base md:text-lg leading-relaxed select-text" style="color: var(--color-ink)">
          {{ result.written }}
        </div>
      </div>

      <div class="flex flex-col gap-1 shrink-0">
        <button
          class="text-xs px-2.5 py-1 rounded-lg transition cursor-pointer"
          :title="isFavorite ? '已收藏' : '收藏到生詞本'"
          :style="isFavorite
            ? { background: 'var(--color-accent)', color: 'white' }
            : { background: 'color-mix(in srgb, var(--color-ink) 6%, transparent)', color: 'var(--color-ink)' }"
          @click="favorite"
        >
          {{ isFavorite ? '★ 已收藏' : '☆ 收藏' }}
        </button>
      </div>
    </div>

    <!-- 中部：粵語口語 -->
    <div class="rounded-lg p-3 md:p-4 mb-3" style="background: color-mix(in srgb, var(--color-accent-soft) 35%, transparent)">
      <div class="text-xs mb-2 flex items-center gap-3" style="color: var(--color-muted)">
        <span>🗣️ 粵語口語</span>
        <button
          class="hover:underline cursor-pointer"
          :style="{ color: tts.playing ? 'var(--color-accent)' : 'var(--color-jade)' }"
          @click="speakSentence('normal')"
        >
          {{ tts.playing ? '⏸ 停止' : '▶ 朗讀' }}
        </button>
        <button class="hover:underline cursor-pointer" style="color: var(--color-jade)" @click="speakSentence('slow')">慢速</button>
      </div>

      <!-- 字對字映射高亮 -->
      <div class="text-lg md:text-xl leading-relaxed font-medium select-text">
        <span
          v-for="(token, i) in result.tokens"
          :key="i"
          class="cursor-pointer relative inline-block"
          :class="{ 'token-yue': !!token.jyutping && token.cantonese !== token.written }"
          :title="token.jyutping ? `${token.cantonese} ${token.jyutping}${token.note ? '\n' + token.note : ''}` : ''"
          @click="speakToken(token.cantonese)"
          @mouseenter="hovering = i"
          @mouseleave="hovering = null"
        >{{ token.cantonese }}</span>
      </div>

      <!-- 粵拼 -->
      <div v-if="result.jyutping" class="text-sm mt-2 font-mono" style="color: var(--color-muted)">
        {{ result.jyutping }}
      </div>
    </div>

    <!-- 字對字映射詳表（可摺疊） -->
    <details v-if="result.tokens.length > 1" class="text-sm">
      <summary class="cursor-pointer select-none" style="color: var(--color-muted)">
        🔍 字對字映射（{{ result.tokens.filter(t => t.jyutping).length }} 個對照）
      </summary>
      <div class="mt-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <div
          v-for="(t, i) in result.tokens.filter(tk => !!tk.jyutping)"
          :key="i"
          class="border rounded-lg px-2 py-1.5 text-xs flex items-center gap-2"
          style="border-color: color-mix(in srgb, var(--color-ink) 10%, transparent)"
        >
          <span class="opacity-60">{{ t.written }}</span>
          <span style="color: var(--color-muted)">→</span>
          <div class="flex-1">
            <div class="font-semibold">{{ t.cantonese }}</div>
            <div class="font-mono opacity-60">{{ t.jyutping }}</div>
          </div>
          <button
            class="text-xs cursor-pointer hover:opacity-80"
            style="color: var(--color-jade)"
            @click="speakToken(t.cantonese)"
          >🔊</button>
        </div>
      </div>
    </details>

    <!-- 解釋 -->
    <div v-if="result.explanation" class="text-xs mt-3 italic" style="color: var(--color-muted)">
      💡 {{ result.explanation }}
    </div>
  </div>
</template>
