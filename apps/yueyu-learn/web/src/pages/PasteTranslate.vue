<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ApiError } from '@yueyu/shared/api-client'
import { splitSentences } from '@yueyu/shared/sentence-split'
import { lookupSentence } from '@yueyu/shared/dict-lookup'
import type { TranslateResult } from '@yueyu/shared/types'
import { useApi } from '@/composables/useApi'
import { useVocabStore } from '@/stores/vocab'
import TranslateCard from '@/components/TranslateCard.vue'

const api = useApi()
const vocab = useVocabStore()

const input = ref('')
const results = ref<TranslateResult[]>([])
const loading = ref(false)
const errorMsg = ref('')

const examples = [
  '你現在在幹什麼？我不知道應該怎麼辦。',
  '他剛才說馬上就回來，但是已經一個小時了，怎麼辦？',
  '不是我不想去，只是今天太累了，明天再說吧。',
]

const sentences = computed(() => splitSentences(input.value))

onMounted(() => {
  if (!vocab.loaded) vocab.load()
})

async function translate() {
  errorMsg.value = ''
  const list = sentences.value
  if (list.length === 0) {
    errorMsg.value = '請先粘貼或輸入字幕內容'
    return
  }
  if (list.length > 20) {
    errorMsg.value = `單次最多 20 句，當前 ${list.length} 句，請分批翻譯`
    return
  }

  loading.value = true
  results.value = []

  // 先嘗試離線詞表精確命中（整句匹配）
  const local: (TranslateResult | null)[] = list.map((s) => lookupSentence(s))
  const need: { idx: number; sentence: string }[] = []
  local.forEach((r, i) => { if (!r) need.push({ idx: i, sentence: list[i] }) })

  // 先把離線命中的部分顯示出來，未命中的先佔位
  results.value = list.map((s, i) => local[i] ?? {
    written: s,
    cantonese: '...',
    jyutping: '',
    tokens: [{ written: s, cantonese: '...' }],
    source: 'llm',
  })

  if (need.length === 0) {
    loading.value = false
    return
  }

  try {
    const res = await api.translate(need.map((n) => n.sentence))
    // 把後端結果寫回對應位置
    res.results.forEach((r, j) => {
      const idx = need[j].idx
      results.value[idx] = r
    })
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.needsLogin) {
        errorMsg.value = '需要先登入才能使用 AI 翻譯，未登入時只支援高頻詞匹配。'
      } else if (err.isRateLimited) {
        errorMsg.value = '請求太頻繁或今日配額已用完，請稍後再試。'
      } else {
        errorMsg.value = err.message || '翻譯失敗，請稍後再試'
      }
    } else {
      errorMsg.value = '網路錯誤，請檢查連線'
    }
  } finally {
    loading.value = false
  }
}

function loadExample(text: string) {
  input.value = text
  results.value = []
  errorMsg.value = ''
}

function clear() {
  input.value = ''
  results.value = []
  errorMsg.value = ''
}
</script>

<template>
  <div class="space-y-5 pb-24 md:pb-0">
    <header>
      <h2 class="text-2xl font-bold mb-1">📝 粘貼字幕翻譯</h2>
      <p class="text-sm" style="color: var(--color-muted)">
        把書面語字幕粘進來（支援整段，最多 20 句），即時看到粵語口語對照。
      </p>
    </header>

    <!-- 輸入區 -->
    <div class="card p-4">
      <textarea
        v-model="input"
        rows="6"
        placeholder="例如：你現在在幹什麼？我不知道應該怎麼辦。&#10;支援多句、可粘貼整段對白。"
        class="w-full resize-y outline-none text-base leading-relaxed bg-transparent"
        style="color: var(--color-ink)"
      />
      <div class="flex flex-wrap items-center justify-between gap-2 mt-3 text-xs" style="color: var(--color-muted)">
        <div>
          已輸入 <strong style="color: var(--color-ink)">{{ sentences.length }}</strong> 句
          / <strong style="color: var(--color-ink)">{{ input.length }}</strong> 字
        </div>
        <div class="flex gap-2">
          <button
            class="px-3 py-1.5 rounded-lg cursor-pointer transition hover:bg-black/5"
            :disabled="loading || !input"
            style="border: 1px solid color-mix(in srgb, var(--color-ink) 14%, transparent)"
            @click="clear"
          >
            清空
          </button>
          <button
            class="px-4 py-1.5 rounded-lg font-medium cursor-pointer transition disabled:opacity-50"
            :disabled="loading || !input"
            style="background: var(--color-accent); color: white"
            @click="translate"
          >
            {{ loading ? '翻譯中…' : '🌟 翻譯' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 範例 -->
    <div v-if="results.length === 0 && !loading" class="card p-4">
      <div class="text-sm font-medium mb-2">不知道貼什麼？試試這幾個：</div>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="ex in examples"
          :key="ex"
          class="text-xs px-3 py-1.5 rounded-full cursor-pointer transition hover:scale-105"
          style="background: color-mix(in srgb, var(--color-jade) 12%, transparent); color: var(--color-jade)"
          @click="loadExample(ex)"
        >
          {{ ex }}
        </button>
      </div>
    </div>

    <!-- 錯誤 -->
    <div
      v-if="errorMsg"
      class="card p-3 text-sm"
      style="background: color-mix(in srgb, var(--color-accent) 8%, transparent); color: var(--color-accent); border-color: color-mix(in srgb, var(--color-accent) 30%, transparent)"
    >
      ⚠️ {{ errorMsg }}
    </div>

    <!-- 結果卡片流 -->
    <transition-group v-if="results.length" name="list" tag="div" class="space-y-4">
      <TranslateCard
        v-for="(r, i) in results"
        :key="`${r.written}-${i}`"
        :result="r"
        :source="{ site: 'web-paste' }"
      />
    </transition-group>

    <!-- 一鍵全收藏（暫時隱藏，避免誤操作。可後續加） -->
  </div>
</template>

<style scoped>
.list-enter-active, .list-leave-active { transition: all 0.3s ease; }
.list-enter-from { opacity: 0; transform: translateY(20px); }
.list-leave-to { opacity: 0; transform: translateX(20px); }
</style>
