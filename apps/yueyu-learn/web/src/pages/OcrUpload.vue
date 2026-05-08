<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ApiError } from '@yueyu/shared/api-client'
import { lookupSentence } from '@yueyu/shared/dict-lookup'
import type { TranslateResult } from '@yueyu/shared/types'
import { useApi } from '@/composables/useApi'
import TranslateCard from '@/components/TranslateCard.vue'

const api = useApi()
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const ocrLines = ref<string[]>([])
const results = ref<TranslateResult[]>([])
const loading = ref(false)
const stage = ref<'idle' | 'ocr' | 'translate'>('idle')
const errorMsg = ref('')

// 從 iOS Share Extension / Android 浮窗自動送進來的截圖
onMounted(async () => {
  const stash = sessionStorage.getItem('yueyu:incomingImages')
  if (!stash) return
  sessionStorage.removeItem('yueyu:incomingImages')
  try {
    const images = JSON.parse(stash) as Array<{ filename: string; dataUrl: string }>
    if (images.length === 0) return
    // 顯示第一張為預覽
    previewUrl.value = images[0].dataUrl
    await runOcr(images[0].dataUrl)
    // 後續多張可循環處理（簡化版只處理第一張，避免一次調太多 API）
  } catch (e) {
    console.warn('parse incoming images failed', e)
  }
})

async function pickFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    errorMsg.value = '請選擇圖片檔案'
    return
  }
  if (file.size > 2 * 1024 * 1024) {
    errorMsg.value = '圖片不能超過 2MB'
    return
  }
  errorMsg.value = ''
  const url = URL.createObjectURL(file)
  previewUrl.value = url

  // 讀為 dataURL
  const dataUrl: string = await new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(String(r.result))
    r.onerror = () => rej(r.error)
    r.readAsDataURL(file)
  })

  await runOcr(dataUrl)
}

async function runOcr(dataUrl: string) {
  loading.value = true
  stage.value = 'ocr'
  ocrLines.value = []
  results.value = []
  try {
    const ocr = await api.ocr(dataUrl)
    ocrLines.value = ocr.lines.length ? ocr.lines : (ocr.text ? [ocr.text] : [])
    if (ocrLines.value.length === 0) {
      errorMsg.value = '圖中未識別到字幕，請換一張更清晰的截圖。'
      return
    }

    // 自動翻譯
    stage.value = 'translate'
    const local = ocrLines.value.map((s) => lookupSentence(s))
    const need = local.map((r, i) => r ? null : ocrLines.value[i]).filter((s): s is string => Boolean(s))
    if (need.length === 0) {
      results.value = local.filter((r): r is TranslateResult => Boolean(r))
    } else {
      const tr = await api.translate(need)
      let j = 0
      results.value = local.map((r, i) => r ?? tr.results[j++] ?? {
        written: ocrLines.value[i],
        cantonese: ocrLines.value[i],
        jyutping: '',
        tokens: [{ written: ocrLines.value[i], cantonese: ocrLines.value[i] }],
        source: 'llm',
      })
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.needsLogin) errorMsg.value = '請先登入後再使用 AI 識別'
      else if (err.isRateLimited) errorMsg.value = '今日配額已用完，請明日再試'
      else errorMsg.value = err.message || '識別失敗'
    } else {
      errorMsg.value = '網路錯誤，請檢查連線'
    }
  } finally {
    loading.value = false
    stage.value = 'idle'
  }
}

function clear() {
  previewUrl.value = ''
  ocrLines.value = []
  results.value = []
  errorMsg.value = ''
  if (fileInput.value) fileInput.value.value = ''
}
</script>

<template>
  <div class="space-y-5 pb-24 md:pb-0">
    <header>
      <h2 class="text-2xl font-bold mb-1">📷 截圖識別</h2>
      <p class="text-sm" style="color: var(--color-muted)">
        手機看 Netflix / myTV SUPER 看不懂？截圖傳上來，自動識別字幕並還原粵語口語。
      </p>
    </header>

    <!-- 上傳區 -->
    <label
      class="card p-8 flex flex-col items-center justify-center cursor-pointer transition hover:scale-[1.01]"
      style="border: 2px dashed color-mix(in srgb, var(--color-ink) 18%, transparent); background: color-mix(in srgb, var(--color-paper) 60%, white)"
    >
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="pickFile" />
      <div class="text-5xl mb-3">📸</div>
      <div class="font-medium mb-1">點此上傳截圖（或拖入）</div>
      <div class="text-xs" style="color: var(--color-muted)">支援 PNG / JPG，2MB 以內</div>
    </label>

    <!-- 預覽 -->
    <div v-if="previewUrl" class="card p-3">
      <img :src="previewUrl" class="max-h-72 mx-auto rounded-lg" alt="截圖預覽" />
      <div class="mt-3 flex justify-end">
        <button class="text-xs px-3 py-1.5 rounded cursor-pointer hover:bg-black/5" style="color: var(--color-muted)" @click="clear">
          換一張
        </button>
      </div>
    </div>

    <!-- 進度 -->
    <div v-if="loading" class="card p-4 text-sm flex items-center gap-3">
      <div class="animate-spin text-lg">⏳</div>
      <div>
        <div class="font-medium">{{ stage === 'ocr' ? '識別字幕中…' : '翻譯為粵語口語…' }}</div>
        <div class="text-xs" style="color: var(--color-muted)">這通常只需 2-5 秒</div>
      </div>
    </div>

    <!-- 識別到的原文 -->
    <div v-if="ocrLines.length && !loading" class="card p-4">
      <div class="text-xs mb-2" style="color: var(--color-muted)">📖 識別到的字幕（{{ ocrLines.length }} 句）</div>
      <ul class="space-y-1 text-sm">
        <li v-for="(line, i) in ocrLines" :key="i">{{ line }}</li>
      </ul>
    </div>

    <!-- 錯誤 -->
    <div
      v-if="errorMsg"
      class="card p-3 text-sm"
      style="background: color-mix(in srgb, var(--color-accent) 8%, transparent); color: var(--color-accent)"
    >
      ⚠️ {{ errorMsg }}
    </div>

    <!-- 結果 -->
    <div v-if="results.length" class="space-y-4">
      <TranslateCard
        v-for="(r, i) in results"
        :key="i"
        :result="r"
        :source="{ site: 'web-ocr' }"
      />
    </div>
  </div>
</template>
