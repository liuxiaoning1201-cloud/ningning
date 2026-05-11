<script setup lang="ts">
import { computed, ref } from 'vue'
import { ApiError } from '@yueyu/shared/api-client'
import type { AsrResponse, AsrTerm } from '@yueyu/shared/types'
import { useApi } from '@/composables/useApi'
import { useTts } from '@/composables/useTts'

const api = useApi()
const tts = useTts()

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const previewUrl = ref('')
const subtitleHint = ref('')
const result = ref<AsrResponse | null>(null)
const loading = ref(false)
const errorMsg = ref('')
const selectedTerm = ref<AsrTerm | null>(null)

const sentenceText = computed(() =>
  result.value?.sentences.map((s) => s.cantonese).join('') || '',
)

async function pickFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await handleFile(file)
}

async function handleFile(file: File) {
  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    errorMsg.value = '請選擇音頻或短視頻檔案'
    return
  }
  if (file.size > 12 * 1024 * 1024) {
    errorMsg.value = '檔案不能超過 12MB，建議截取 10-30 秒'
    return
  }

  clear(false)
  fileName.value = file.name
  previewUrl.value = URL.createObjectURL(file)

  const media: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  await runAsr(media)
}

async function runAsr(media: string) {
  loading.value = true
  errorMsg.value = ''
  selectedTerm.value = null
  try {
    result.value = await api.asr({
      media,
      subtitleHint: subtitleHint.value.trim() || undefined,
    })
    selectedTerm.value = result.value.terms[0] ?? null
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.needsLogin) errorMsg.value = '請先登入後再使用粵語口語聽寫'
      else if (err.isRateLimited) errorMsg.value = '今日語音識別配額已用完，請明日再試'
      else errorMsg.value = err.message || '識別失敗'
    } else {
      errorMsg.value = '網路錯誤，請檢查連線'
    }
  } finally {
    loading.value = false
  }
}

function clear(resetInput = true) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  fileName.value = ''
  previewUrl.value = ''
  result.value = null
  selectedTerm.value = null
  errorMsg.value = ''
  if (resetInput && fileInput.value) fileInput.value.value = ''
}

function confidenceLabel(n?: number) {
  if (typeof n !== 'number') return '未評估'
  if (n >= 0.85) return '高信心'
  if (n >= 0.65) return '中信心'
  return '低信心'
}

function speak(text: string, speed: 'slow' | 'normal' = 'normal') {
  tts.speak(text, { speed, voice: 'female' })
}
</script>

<template>
  <div class="space-y-6 pb-24 md:pb-0">
    <header class="relative overflow-hidden rounded-[28px] px-5 py-7 md:px-8 md:py-10"
      style="background: radial-gradient(circle at 15% 10%, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent 36%), linear-gradient(135deg, color-mix(in srgb, var(--color-paper) 82%, white), white); border: 1px solid color-mix(in srgb, var(--color-ink) 8%, transparent)">
      <div class="max-w-2xl">
        <div class="text-sm mb-2" style="color: var(--color-jade)">先聽聲音，再對照字幕</div>
        <h2 class="text-3xl md:text-4xl font-bold leading-tight mb-3" style="color: var(--color-ink)">
          粵語口語聽寫
        </h2>
        <p class="text-sm md:text-base leading-relaxed" style="color: var(--color-muted)">
          上傳 10-30 秒粵語對白片段，系統會直接聽出人物實際講法，再補上粵拼、書面意思和常見口語詞例句。
          字幕只作輔助，不會硬翻成口語。
        </p>
      </div>
    </header>

    <section class="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,.95fr)] gap-5">
      <div class="space-y-4">
        <label
          class="card p-8 flex flex-col items-center justify-center cursor-pointer transition hover:scale-[1.01]"
          style="border: 2px dashed color-mix(in srgb, var(--color-ink) 18%, transparent); background: color-mix(in srgb, var(--color-paper) 60%, white)"
        >
          <input ref="fileInput" type="file" accept="audio/*,video/*" class="hidden" @change="pickFile" />
          <div class="text-5xl mb-3">🎧</div>
          <div class="font-medium mb-1">上傳粵語音頻 / 短視頻</div>
          <div class="text-xs text-center" style="color: var(--color-muted)">
            建議 10-30 秒，支援 mp3 / m4a / wav / webm / mp4，12MB 以內
          </div>
        </label>

        <div class="card p-4">
          <label class="text-xs mb-2 block" style="color: var(--color-muted)">
            可選：貼上畫面原字幕，幫助理解上下文
          </label>
          <textarea
            v-model="subtitleHint"
            rows="4"
            class="w-full resize-y rounded-xl p-3 text-sm outline-none"
            maxlength="1000"
            placeholder="例如：你在做什麼？（只作語義參考，不會直接翻譯）"
            style="background: color-mix(in srgb, var(--color-paper) 70%, white); border: 1px solid color-mix(in srgb, var(--color-ink) 10%, transparent)"
          />
          <div class="mt-2 text-[11px]" style="color: var(--color-muted)">
            已輸入 {{ subtitleHint.length }} / 1000 字
          </div>
        </div>

        <div v-if="previewUrl" class="card p-4">
          <div class="flex items-center justify-between gap-3 mb-3">
            <div>
              <div class="font-medium">{{ fileName }}</div>
              <div class="text-xs" style="color: var(--color-muted)">完整句子會一次顯示，不做逐字打字效果。</div>
            </div>
            <button class="text-xs px-3 py-1.5 rounded cursor-pointer hover:bg-black/5" style="color: var(--color-muted)" @click="clear()">
              換一段
            </button>
          </div>
          <audio v-if="previewUrl" :src="previewUrl" controls class="w-full" />
        </div>
      </div>

      <aside class="card p-5 h-fit">
        <div class="font-semibold mb-2">怎樣讓識別更準？</div>
        <ul class="space-y-2 text-sm" style="color: var(--color-muted)">
          <li>1. 儘量截人聲清楚、背景音少的一小段。</li>
          <li>2. 一次不要上傳整集，10-30 秒最適合。</li>
          <li>3. 如果有書面字幕，貼在左邊作語義提示。</li>
          <li>4. 模型會保留「唔、冇、喺、咗、緊、啲」等口語字。</li>
        </ul>
      </aside>
    </section>

    <div v-if="loading" class="card p-4 flex items-center gap-3">
      <div class="animate-spin text-xl">⏳</div>
      <div>
        <div class="font-medium">正在聽寫粵語對白…</div>
        <div class="text-xs" style="color: var(--color-muted)">先用 Whisper 聽聲音，再做自然斷句和詞語拓展</div>
      </div>
    </div>

    <div
      v-if="errorMsg"
      class="card p-3 text-sm"
      style="background: color-mix(in srgb, var(--color-accent) 8%, transparent); color: var(--color-accent)"
    >
      ⚠️ {{ errorMsg }}
    </div>

    <section v-if="result && !loading" class="space-y-5">
      <div class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div class="text-xs mb-1" style="color: var(--color-muted)">🗣️ 實際聽到的粵語口語</div>
            <div class="text-[11px]" style="color: var(--color-muted)">已按自然語氣斷句，不逐字蹦出</div>
          </div>
          <div class="flex gap-2">
            <button class="px-3 py-1.5 rounded-lg text-sm cursor-pointer" style="background: var(--color-ink); color: var(--color-paper)" @click="speak(sentenceText)">
              ▶ 整段朗讀
            </button>
            <button class="px-3 py-1.5 rounded-lg text-sm cursor-pointer" style="background: color-mix(in srgb, var(--color-jade) 14%, transparent); color: var(--color-jade)" @click="speak(sentenceText, 'slow')">
              慢速
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <article
            v-for="(s, i) in result.sentences"
            :key="i"
            class="rounded-2xl p-4"
            style="background: color-mix(in srgb, var(--color-accent-soft) 32%, transparent)"
          >
            <div class="flex items-start gap-3">
              <span class="text-xs px-2 py-1 rounded-full shrink-0" style="background: white; color: var(--color-muted)">
                {{ confidenceLabel(s.confidence) }}
              </span>
              <div class="flex-1">
                <div class="text-xl leading-relaxed font-medium select-text" style="color: var(--color-ink)">
                  {{ s.cantonese }}
                </div>
                <div v-if="s.jyutping" class="font-mono text-sm mt-2" style="color: var(--color-muted)">
                  {{ s.jyutping }}
                </div>
                <div v-if="s.meaning" class="text-sm mt-2" style="color: var(--color-muted)">
                  書面意思：{{ s.meaning }}
                </div>
              </div>
              <button class="text-sm cursor-pointer hover:opacity-70" style="color: var(--color-jade)" @click="speak(s.cantonese)">
                🔊
              </button>
            </div>
          </article>
        </div>

        <details class="mt-4 text-xs" style="color: var(--color-muted)">
          <summary class="cursor-pointer">查看 Whisper 原始轉寫</summary>
          <div class="mt-2 p-3 rounded-xl select-text" style="background: color-mix(in srgb, var(--color-ink) 5%, transparent)">
            {{ result.rawText }}
          </div>
        </details>
      </div>

      <div v-if="result.terms.length" class="grid lg:grid-cols-[260px_minmax(0,1fr)] gap-4">
        <div class="card p-4 h-fit">
          <div class="font-semibold mb-3">高頻口語詞</div>
          <div class="flex lg:flex-col gap-2 overflow-x-auto">
            <button
              v-for="term in result.terms"
              :key="term.term"
              class="px-3 py-2 rounded-xl text-left cursor-pointer whitespace-nowrap lg:whitespace-normal"
              :style="selectedTerm?.term === term.term
                ? { background: 'var(--color-ink)', color: 'var(--color-paper)' }
                : { background: 'color-mix(in srgb, var(--color-ink) 5%, transparent)', color: 'var(--color-ink)' }"
              @click="selectedTerm = term"
            >
              <span class="font-medium">{{ term.term }}</span>
              <span v-if="term.jyutping" class="block text-[11px] opacity-70">{{ term.jyutping }}</span>
            </button>
          </div>
        </div>

        <div v-if="selectedTerm" class="card p-5">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div>
              <div class="text-2xl font-bold" style="color: var(--color-ink)">{{ selectedTerm.term }}</div>
              <div v-if="selectedTerm.jyutping" class="font-mono text-sm" style="color: var(--color-muted)">
                {{ selectedTerm.jyutping }}
              </div>
            </div>
            <button class="px-3 py-1.5 rounded-lg text-sm cursor-pointer" style="background: color-mix(in srgb, var(--color-jade) 14%, transparent); color: var(--color-jade)" @click="speak(selectedTerm.term)">
              讀詞
            </button>
          </div>
          <p class="text-sm mb-2" style="color: var(--color-muted)">{{ selectedTerm.meaning }}</p>
          <p v-if="selectedTerm.note" class="text-xs mb-4 italic" style="color: var(--color-muted)">
            {{ selectedTerm.note }}
          </p>

          <div class="space-y-3">
            <div
              v-for="(ex, i) in selectedTerm.examples"
              :key="i"
              class="rounded-2xl p-4"
              style="background: color-mix(in srgb, var(--color-paper) 70%, white)"
            >
              <div class="flex gap-3 items-start">
                <div class="flex-1">
                  <div class="font-medium leading-relaxed">{{ ex.cantonese }}</div>
                  <div v-if="ex.jyutping" class="font-mono text-xs mt-1" style="color: var(--color-muted)">{{ ex.jyutping }}</div>
                  <div class="text-xs mt-1" style="color: var(--color-muted)">{{ ex.meaning }}</div>
                </div>
                <button class="text-sm cursor-pointer hover:opacity-70" style="color: var(--color-jade)" @click="speak(ex.cantonese)">
                  🔊
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
