<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ApiError } from '@yueyu/shared/api-client'
import type {
  AsrHistorySession,
  AsrResponse,
  AsrSentence,
  AsrTerm,
} from '@yueyu/shared/types'
import { useApi } from '@/composables/useApi'
import { useTts } from '@/composables/useTts'
import { useVocabStore } from '@/stores/vocab'

const api = useApi()
const tts = useTts()
const vocab = useVocabStore()

const fileInput = ref<HTMLInputElement | null>(null)
const fileName = ref('')
const previewUrl = ref('')
const subtitleHint = ref('')
const result = ref<AsrResponse | null>(null)
const loading = ref(false)
const loadingStage = ref('')
const errorMsg = ref('')
const selectedTerm = ref<AsrTerm | null>(null)
const dragActive = ref(false)

// ── P0 新增：收藏 / 循環 / 歷史 ──
/** 當前正在循環朗讀的句子索引。-1 = 不循環 */
const loopingSentenceIdx = ref<number | null>(null)
/** 收藏進行中的索引（防止連點重複請求） */
const savingSentenceIdx = ref<number | null>(null)
const savingTermName = ref<string | null>(null)
/** 已收藏的標記，給 UI 顯示「已加入」 */
const savedSentenceIdxs = ref<Set<number>>(new Set())
const savedTermNames = ref<Set<string>>(new Set())
const saveToast = ref('')
/** 當前識別到的音頻時長（秒），落歷史用 */
const audioDuration = ref<number | null>(null)
/** 識別歷史 */
const history = ref<AsrHistorySession[]>([])
const historyLoading = ref(false)
const historyOpen = ref(false)

const sentenceText = computed(() =>
  result.value?.sentences.map((s) => s.cantonese).join('') || '',
)

onMounted(() => {
  if (!vocab.loaded) vocab.load()
  void loadHistory()
})

async function loadHistory() {
  historyLoading.value = true
  try {
    const res = await api.asrHistory()
    history.value = res.sessions ?? []
  } catch (e) {
    // 未登入或網絡錯誤都靜默：歷史是錦上添花，不能影響主功能
    if (e instanceof ApiError && e.needsLogin) {
      history.value = []
    } else {
      history.value = []
    }
  } finally {
    historyLoading.value = false
  }
}

async function pickFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  await handleFile(file)
}

async function handleFile(file: File) {
  const looksLikeMedia =
    file.type.startsWith('audio/') ||
    file.type.startsWith('video/') ||
    /\.(mp3|m4a|wav|aac|flac|ogg|webm|mp4|mov|mkv|avi|3gp|opus|amr)$/i.test(file.name)
  if (!looksLikeMedia) {
    errorMsg.value = '請選擇音頻或視頻檔案'
    return
  }
  if (file.size > 200 * 1024 * 1024) {
    errorMsg.value = '檔案不能超過 200MB，建議截取一段 30-60 秒'
    return
  }

  clear(false)
  fileName.value = file.name
  previewUrl.value = URL.createObjectURL(file)
  loading.value = true
  loadingStage.value = '正在準備音頻（解碼 → 重採樣到 16kHz）…'
  errorMsg.value = ''
  audioDuration.value = null

  let chunks: string[] = []
  let fallbackMedia = ''
  let decodeFailed = false
  try {
    // 統一處理：解碼 → 16kHz 單聲道 → 切成多個 ≤20 秒的 WAV，繞開 Workers AI 單請求大小限制
    const out = await fileToWhisperFriendlyWavChunks(file)
    chunks = out.chunks
    audioDuration.value = out.durationSeconds
  } catch (e) {
    decodeFailed = true
    const reason = e instanceof Error ? e.message : String(e)
    console.warn(`[ASR] 瀏覽器無法解碼此檔案，改用原檔上傳：${reason}`, {
      fileName: file.name,
      fileType: file.type,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)}MB`,
    })
    // 提早告訴用戶：如果原檔大於 1.5MB，又是視頻容器，後端基本要靠 Groq 才能識別
    const isVideoLike = file.type.startsWith('video/') || /\.(mp4|mov|hevc|mkv|webm|avi)$/i.test(file.name)
    if (isVideoLike && file.size > 1.5 * 1024 * 1024) {
      loadingStage.value = '本地解碼失敗（可能是 HEVC/H.265 視頻），改用原檔上傳，靠後端 Groq 處理…'
    } else {
      loadingStage.value = '本地音頻解碼失敗，改用原檔上傳…'
    }
    try {
      fallbackMedia = await fileToDataUrl(file)
    } catch {
      loading.value = false
      loadingStage.value = ''
      errorMsg.value = '檔案讀取失敗，請重試或換一個檔案。'
      return
    }
  }

  if (decodeFailed) {
    loadingStage.value = '送後端識別…（無法本地切塊，靠後端 provider 處理大檔）'
  } else {
    loadingStage.value = chunks.length > 1
      ? `正在用 Whisper 聽寫 ${chunks.length} 個音頻片段…`
      : '正在用 Whisper 聽寫粵語…'
  }
  await runAsr({ chunks: chunks.length ? chunks : undefined, media: fallbackMedia || undefined })
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragActive.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  dragActive.value = false
}

async function onDrop(e: DragEvent) {
  e.preventDefault()
  dragActive.value = false
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  await handleFile(file)
}

async function runAsr(payload: { chunks?: string[]; media?: string }) {
  loading.value = true
  errorMsg.value = ''
  selectedTerm.value = null
  savedSentenceIdxs.value = new Set()
  savedTermNames.value = new Set()
  try {
    result.value = await api.asr({
      chunks: payload.chunks,
      media: payload.media,
      subtitleHint: subtitleHint.value.trim() || undefined,
      fileName: fileName.value || undefined,
      durationSeconds: audioDuration.value ?? undefined,
    })
    selectedTerm.value = result.value.terms[0] ?? null
    // 識別成功後刷新歷史列表，讓「最近識別」立刻多一條
    void loadHistory()
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
    loadingStage.value = ''
  }
}

function clear(resetInput = true) {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  fileName.value = ''
  previewUrl.value = ''
  result.value = null
  selectedTerm.value = null
  errorMsg.value = ''
  loadingStage.value = ''
  loopingSentenceIdx.value = null
  savingSentenceIdx.value = null
  savingTermName.value = null
  savedSentenceIdxs.value = new Set()
  savedTermNames.value = new Set()
  audioDuration.value = null
  tts.stop()
  if (resetInput && fileInput.value) fileInput.value.value = ''
}

function confidenceLabel(n?: number) {
  if (typeof n !== 'number') return '未評估'
  if (n >= 0.85) return '高信心'
  if (n >= 0.65) return '中信心'
  return '低信心'
}

function speak(text: string, speed: 'slow' | 'normal' = 'normal') {
  // 任何一次主動朗讀都會打斷循環
  loopingSentenceIdx.value = null
  tts.speak(text, { speed, voice: 'female' })
}

// ── 收藏整句到生詞本 ──
async function saveSentence(idx: number, s: AsrSentence) {
  if (savingSentenceIdx.value !== null) return
  if (savedSentenceIdxs.value.has(idx)) return
  savingSentenceIdx.value = idx
  try {
    await vocab.add({
      granularity: 'sentence',
      written: s.meaning?.trim() || s.cantonese,
      cantonese: s.cantonese,
      jyutping: s.jyutping,
      explanation: s.meaning,
      source: { title: fileName.value || '識別片段' },
    })
    savedSentenceIdxs.value = new Set([...savedSentenceIdxs.value, idx])
    flashToast(`已加入生詞本：${truncate(s.cantonese, 18)}`)
  } catch (e) {
    if (e instanceof ApiError && e.needsLogin) {
      flashToast('請先登入才能跨設備同步生詞本（本地已暫存）')
      savedSentenceIdxs.value = new Set([...savedSentenceIdxs.value, idx])
    } else {
      flashToast('收藏失敗，請稍後重試')
    }
  } finally {
    savingSentenceIdx.value = null
  }
}

// ── 收藏高頻詞到生詞本 ──
async function saveTerm(t: AsrTerm) {
  if (savingTermName.value === t.term) return
  if (savedTermNames.value.has(t.term)) return
  savingTermName.value = t.term
  try {
    await vocab.add({
      granularity: 'word',
      written: t.meaning?.trim() || t.term,
      cantonese: t.term,
      jyutping: t.jyutping,
      explanation: t.note ? `${t.meaning}（${t.note}）` : t.meaning,
      source: { title: fileName.value || '識別片段' },
    })
    savedTermNames.value = new Set([...savedTermNames.value, t.term])
    flashToast(`已加入生詞本：${t.term}`)
  } catch (e) {
    if (e instanceof ApiError && e.needsLogin) {
      flashToast('請先登入才能跨設備同步生詞本（本地已暫存）')
      savedTermNames.value = new Set([...savedTermNames.value, t.term])
    } else {
      flashToast('收藏失敗，請稍後重試')
    }
  } finally {
    savingTermName.value = null
  }
}

// ── 循環朗讀單句 ──
function toggleLoopSentence(idx: number, s: AsrSentence) {
  if (loopingSentenceIdx.value === idx) {
    loopingSentenceIdx.value = null
    tts.stop()
    return
  }
  loopingSentenceIdx.value = idx
  playLoopingSentence(idx, s)
}

function playLoopingSentence(idx: number, s: AsrSentence) {
  if (loopingSentenceIdx.value !== idx) return
  tts.speak(s.cantonese, {
    voice: 'female',
    onEnded: () => {
      if (loopingSentenceIdx.value !== idx) return
      // 兩輪之間留 600ms 喘息，跟人耳節奏更接近
      window.setTimeout(() => playLoopingSentence(idx, s), 600)
    },
  })
}

// ── 從歷史記錄重新展示某次識別結果（不重新跑 Whisper） ──
function loadFromHistory(h: AsrHistorySession) {
  loopingSentenceIdx.value = null
  tts.stop()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = ''
  fileName.value = h.fileName || `歷史記錄 ${h.id.slice(0, 6)}`
  audioDuration.value = h.durationSeconds ?? null
  result.value = {
    rawText: h.rawText,
    sentences: h.sentences,
    terms: h.terms,
    provider: h.provider,
    sessionId: h.id,
  }
  selectedTerm.value = h.terms[0] ?? null
  savedSentenceIdxs.value = new Set()
  savedTermNames.value = new Set()
  errorMsg.value = ''
  historyOpen.value = false
  // 滾到結果區
  window.requestAnimationFrame(() => {
    document.getElementById('asr-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function deleteHistory(id: string) {
  const prev = history.value
  history.value = prev.filter((h) => h.id !== id)
  try {
    await api.asrHistoryDelete(id)
  } catch {
    // 刪不掉就回滾
    history.value = prev
  }
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso)
  if (!isFinite(t)) return iso
  const diff = Date.now() - t
  if (diff < 60_000) return '剛剛'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分鐘前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)} 小時前`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`
  return new Date(t).toLocaleDateString('zh-Hant', { month: 'numeric', day: 'numeric' })
}

function formatDuration(sec?: number | null): string {
  if (!sec || !isFinite(sec)) return ''
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return m ? `${m}分${s}秒` : `${s}秒`
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

let toastTimer: number | undefined
function flashToast(msg: string) {
  saveToast.value = msg
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => { saveToast.value = '' }, 2400)
}

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

/**
 * 把任意音頻 / 視頻檔案 → 多個 ≤20 秒的 16kHz 單聲道 WAV data URL。
 *
 * 為什麼是這個格式？
 *   - Cloudflare Workers AI Whisper 對「單次請求 payload」有硬性大小限制（>2MB 會
 *     返回 `3006: Request is too large`，<1MB 才穩定）。
 *   - Whisper 內部就是工作在 16kHz 單聲道 PCM，多餘的取樣率/聲道既不會提升準確度，
 *     反而會撐爆請求體積。
 *   - 20 秒 × 16kHz × 1ch × 2byte ≈ 640KB raw → 約 ~853KB base64，安全穩在閾值下。
 *
 * 步驟：
 *   1. AudioContext.decodeAudioData：瀏覽器原生解碼器，能吃 mp3/m4a/mp4/mov/wav/
 *      webm/ogg/opus/aac/flac，視頻容器會自動丟掉視軌只留音軌。
 *   2. 多聲道 → 單聲道（平均）。
 *   3. OfflineAudioContext 重採樣到 16kHz。
 *   4. 截取前 MAX_TOTAL_SECONDS（避免有人上傳整部電影）。
 *   5. 切成 CHUNK_SECONDS 一塊，每塊獨立編碼成有效 16-bit PCM WAV。
 *
 * 後端會依序送每一塊給 Whisper，再把所有 text 合併。
 */
const MAX_TOTAL_SECONDS = 5 * 60 // 最長處理 5 分鐘
const CHUNK_SECONDS = 20
const TARGET_SAMPLE_RATE = 16000

async function fileToWhisperFriendlyWavChunks(
  file: File,
): Promise<{ chunks: string[]; durationSeconds: number }> {
  const arrayBuffer = await file.arrayBuffer()

  const ContextCtor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!ContextCtor) throw new Error('AudioContext unsupported')

  const ctx = new ContextCtor()
  let decoded: AudioBuffer
  try {
    decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
  } finally {
    void ctx.close()
  }

  const sourceRate = decoded.sampleRate
  const totalLen = Math.min(decoded.length, Math.floor(sourceRate * MAX_TOTAL_SECONDS))
  const durationSeconds = totalLen / sourceRate

  const monoSrc = new Float32Array(totalLen)
  const channels = decoded.numberOfChannels
  for (let c = 0; c < channels; c++) {
    const data = decoded.getChannelData(c)
    for (let i = 0; i < totalLen; i++) monoSrc[i] += data[i] / channels
  }

  const targetLen = Math.max(1, Math.floor((totalLen * TARGET_SAMPLE_RATE) / sourceRate))
  const OfflineCtor: typeof OfflineAudioContext =
    window.OfflineAudioContext ||
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext })
      .webkitOfflineAudioContext
  if (!OfflineCtor) throw new Error('OfflineAudioContext unsupported')

  const offline = new OfflineCtor(1, targetLen, TARGET_SAMPLE_RATE)
  const buf = offline.createBuffer(1, totalLen, sourceRate)
  buf.copyToChannel(monoSrc, 0)
  const node = offline.createBufferSource()
  node.buffer = buf
  node.connect(offline.destination)
  node.start()
  const rendered = await offline.startRendering()

  const pcm = rendered.getChannelData(0)
  const samplesPerChunk = CHUNK_SECONDS * TARGET_SAMPLE_RATE
  const chunks: string[] = []
  for (let i = 0; i < pcm.length; i += samplesPerChunk) {
    const slice = pcm.subarray(i, Math.min(i + samplesPerChunk, pcm.length))
    if (slice.length === 0) break
    const blob = encodeWav(slice, TARGET_SAMPLE_RATE)
    chunks.push(await fileToDataUrl(blob))
  }
  if (chunks.length === 0) throw new Error('no audio samples decoded')
  return { chunks, durationSeconds }
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const dataBytes = samples.length * 2
  const buf = new ArrayBuffer(44 + dataBytes)
  const view = new DataView(buf)

  // RIFF header
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  writeAscii(view, 8, 'WAVE')
  // fmt chunk
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  // data chunk
  writeAscii(view, 36, 'data')
  view.setUint32(40, dataBytes, true)

  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([buf], { type: 'audio/wav' })
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
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
          :style="dragActive
            ? 'border: 2px dashed var(--color-accent); background: color-mix(in srgb, var(--color-accent-soft) 40%, white)'
            : 'border: 2px dashed color-mix(in srgb, var(--color-ink) 18%, transparent); background: color-mix(in srgb, var(--color-paper) 60%, white)'"
          @dragover="onDragOver"
          @dragleave="onDragLeave"
          @drop="onDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept="audio/*,video/*,.mp3,.m4a,.wav,.aac,.flac,.ogg,.webm,.mp4,.mov,.mkv,.avi"
            class="hidden"
            @change="pickFile"
          />
          <div class="text-5xl mb-3">🎧</div>
          <div class="font-medium mb-1">拖拽上傳或點擊選擇音頻 / 視頻</div>
          <div class="text-xs text-center leading-relaxed" style="color: var(--color-muted)">
            支援 mp3 / m4a / wav / aac / flac / ogg / webm / mp4 / mov / mkv / avi。<br />
            檔案太長會自動只取前 90 秒；音頻在你的瀏覽器先壓縮再上傳，不會把整段視頻發出去。
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

      <aside class="space-y-4 h-fit">
        <div class="card p-5">
          <div class="font-semibold mb-2">怎樣讓識別更準？</div>
          <ul class="space-y-2 text-sm" style="color: var(--color-muted)">
            <li>1. 儘量截人聲清楚、背景音少的一小段。</li>
            <li>2. 識別出的句子可以一鍵加入生詞本，配合循環朗讀反覆練。</li>
            <li>3. 如果有書面字幕，貼在左邊作語義提示。</li>
            <li>4. 模型會保留「唔、冇、喺、咗、緊、啲」等口語字。</li>
          </ul>
        </div>

        <!-- 最近識別歷史：折疊面板 -->
        <div class="card p-4">
          <button
            class="w-full flex items-center justify-between gap-2 cursor-pointer"
            @click="historyOpen = !historyOpen"
          >
            <span class="font-semibold flex items-center gap-2">
              📚 最近識別<span class="text-xs font-normal" style="color: var(--color-muted)">
                （{{ history.length }} 條）
              </span>
            </span>
            <span class="text-xs" style="color: var(--color-muted)">
              {{ historyOpen ? '收起 ▲' : '展開 ▼' }}
            </span>
          </button>

          <div v-if="historyOpen" class="mt-3 space-y-2 max-h-[420px] overflow-y-auto">
            <div
              v-if="historyLoading"
              class="text-xs text-center py-3"
              style="color: var(--color-muted)"
            >
              載入中…
            </div>
            <div
              v-else-if="!history.length"
              class="text-xs text-center py-3 leading-relaxed"
              style="color: var(--color-muted)"
            >
              還沒識別過任何片段。<br />
              識別後會自動保存到這裡，方便日後反覆查看。
            </div>
            <div
              v-for="h in history"
              :key="h.id"
              class="rounded-xl p-3 transition group"
              style="background: color-mix(in srgb, var(--color-paper) 70%, white); border: 1px solid color-mix(in srgb, var(--color-ink) 6%, transparent)"
            >
              <button
                class="w-full text-left cursor-pointer"
                @click="loadFromHistory(h)"
              >
                <div class="text-sm font-medium mb-1 truncate" style="color: var(--color-ink)">
                  {{ h.fileName || '未命名片段' }}
                </div>
                <div class="text-xs line-clamp-2 leading-relaxed mb-1.5" style="color: var(--color-muted)">
                  {{ h.sentences.map(s => s.cantonese).join('') || h.rawText }}
                </div>
                <div class="flex items-center justify-between gap-2 text-[11px]" style="color: var(--color-muted)">
                  <span>{{ formatRelativeTime(h.createdAt) }}</span>
                  <span class="flex items-center gap-1.5">
                    <span v-if="h.durationSeconds">{{ formatDuration(h.durationSeconds) }}</span>
                    <span v-if="h.sentences.length">· {{ h.sentences.length }} 句</span>
                    <span v-if="h.terms.length">· {{ h.terms.length }} 詞</span>
                  </span>
                </div>
              </button>
              <button
                class="opacity-0 group-hover:opacity-100 transition mt-2 text-[11px] cursor-pointer hover:underline"
                style="color: var(--color-accent)"
                @click.stop="deleteHistory(h.id)"
              >
                ✕ 刪除這條記錄
              </button>
            </div>
          </div>
        </div>
      </aside>
    </section>

    <div v-if="loading" class="card p-4 flex items-center gap-3">
      <div class="animate-spin text-xl">⏳</div>
      <div>
        <div class="font-medium">{{ loadingStage || '正在聽寫粵語對白…' }}</div>
        <div class="text-xs" style="color: var(--color-muted)">
          先在你瀏覽器把音頻壓成 16kHz 單聲道，再交 Whisper 聽寫，最後做自然斷句和詞語拓展
        </div>
      </div>
    </div>

    <div
      v-if="errorMsg"
      class="card p-4 text-sm leading-relaxed"
      style="background: color-mix(in srgb, var(--color-accent) 8%, transparent); color: var(--color-accent); white-space: pre-line"
    >
      ⚠️ {{ errorMsg }}
    </div>

    <section v-if="result && !loading" id="asr-result" class="space-y-5">
      <div class="card p-5">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <div class="text-xs mb-1 flex flex-wrap items-center gap-1.5" style="color: var(--color-muted)">
              🗣️ 實際聽到的粵語口語
              <span
                v-if="result.provider"
                class="text-[10px] px-1.5 py-0.5 rounded-full"
                style="background: color-mix(in srgb, var(--color-jade) 12%, transparent); color: var(--color-jade)"
              >
                {{ result.provider }}
              </span>
              <span
                v-if="audioDuration"
                class="text-[10px] px-1.5 py-0.5 rounded-full"
                style="background: color-mix(in srgb, var(--color-ink) 5%, transparent); color: var(--color-muted)"
              >
                {{ formatDuration(audioDuration) }}
              </span>
            </div>
            <div class="text-[11px]" style="color: var(--color-muted)">
              按「⭐」收藏整句到生詞本，按「🔁」反覆循環聽
            </div>
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
            :style="loopingSentenceIdx === i
              ? 'background: color-mix(in srgb, var(--color-jade) 14%, transparent); border: 1px solid color-mix(in srgb, var(--color-jade) 32%, transparent)'
              : 'background: color-mix(in srgb, var(--color-accent-soft) 32%, transparent); border: 1px solid transparent'"
          >
            <div class="flex items-start gap-3">
              <span class="text-xs px-2 py-1 rounded-full shrink-0" style="background: white; color: var(--color-muted)">
                {{ confidenceLabel(s.confidence) }}
              </span>
              <div class="flex-1 min-w-0">
                <div class="text-xl leading-relaxed font-medium select-text break-words" style="color: var(--color-ink)">
                  {{ s.cantonese }}
                </div>
                <div v-if="s.jyutping" class="font-mono text-sm mt-2 break-all" style="color: var(--color-muted)">
                  {{ s.jyutping }}
                </div>
                <div v-if="s.meaning" class="text-sm mt-2" style="color: var(--color-muted)">
                  書面意思：{{ s.meaning }}
                </div>
              </div>
              <div class="flex flex-col gap-2 shrink-0">
                <button
                  class="text-base cursor-pointer hover:scale-110 transition"
                  :style="{ color: 'var(--color-jade)' }"
                  :title="`朗讀：${s.cantonese}`"
                  @click="speak(s.cantonese)"
                >
                  🔊
                </button>
                <button
                  class="text-base cursor-pointer hover:scale-110 transition"
                  :style="{
                    color: loopingSentenceIdx === i ? 'var(--color-accent)' : 'var(--color-muted)',
                  }"
                  :title="loopingSentenceIdx === i ? '停止循環' : '循環朗讀這句'"
                  @click="toggleLoopSentence(i, s)"
                >
                  {{ loopingSentenceIdx === i ? '⏸' : '🔁' }}
                </button>
                <button
                  class="text-base cursor-pointer hover:scale-110 transition disabled:opacity-40 disabled:cursor-not-allowed"
                  :style="{
                    color: savedSentenceIdxs.has(i) ? 'var(--color-accent)' : 'var(--color-muted)',
                  }"
                  :disabled="savingSentenceIdx === i || savedSentenceIdxs.has(i)"
                  :title="savedSentenceIdxs.has(i) ? '已加入生詞本' : '加入生詞本'"
                  @click="saveSentence(i, s)"
                >
                  {{ savedSentenceIdxs.has(i) ? '✅' : (savingSentenceIdx === i ? '…' : '⭐') }}
                </button>
              </div>
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
              <span class="font-medium">
                {{ term.term }}
                <span v-if="savedTermNames.has(term.term)" class="text-[11px] ml-1">✅</span>
              </span>
              <span v-if="term.jyutping" class="block text-[11px] opacity-70">{{ term.jyutping }}</span>
            </button>
          </div>
        </div>

        <div v-if="selectedTerm" class="card p-5">
          <div class="flex items-start justify-between gap-3 mb-4">
            <div class="min-w-0">
              <div class="text-2xl font-bold break-words" style="color: var(--color-ink)">{{ selectedTerm.term }}</div>
              <div v-if="selectedTerm.jyutping" class="font-mono text-sm break-all" style="color: var(--color-muted)">
                {{ selectedTerm.jyutping }}
              </div>
            </div>
            <div class="flex gap-2 shrink-0">
              <button
                class="px-3 py-1.5 rounded-lg text-sm cursor-pointer"
                style="background: color-mix(in srgb, var(--color-jade) 14%, transparent); color: var(--color-jade)"
                @click="speak(selectedTerm.term)"
              >
                🔊 讀詞
              </button>
              <button
                class="px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                :style="savedTermNames.has(selectedTerm.term)
                  ? 'background: var(--color-accent); color: white'
                  : 'background: color-mix(in srgb, var(--color-accent) 14%, transparent); color: var(--color-accent)'"
                :disabled="savingTermName === selectedTerm.term || savedTermNames.has(selectedTerm.term)"
                @click="saveTerm(selectedTerm)"
              >
                {{ savedTermNames.has(selectedTerm.term)
                  ? '✅ 已收藏'
                  : (savingTermName === selectedTerm.term ? '收藏中…' : '⭐ 加入生詞本') }}
              </button>
            </div>
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

    <!-- 收藏 toast：右下角 / 移動端底部 -->
    <transition name="toast">
      <div
        v-if="saveToast"
        class="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 px-4 py-2.5 rounded-full text-sm font-medium shadow-lg"
        style="background: var(--color-ink); color: var(--color-paper); box-shadow: 0 8px 24px color-mix(in srgb, var(--color-ink) 30%, transparent)"
      >
        {{ saveToast }}
      </div>
    </transition>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.28s;
}
.toast-enter-from {
  opacity: 0;
  transform: translate(-50%, 12px);
}
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}
</style>
