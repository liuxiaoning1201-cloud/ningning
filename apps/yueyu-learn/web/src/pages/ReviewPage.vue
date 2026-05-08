<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useVocabStore } from '@/stores/vocab'
import { useTts } from '@/composables/useTts'
import { isDue, reviewSrs, type ReviewQuality } from '@yueyu/shared/srs'
import type { VocabEntry } from '@yueyu/shared/types'

const vocab = useVocabStore()
const tts = useTts()

type Mode = 'recognize' | 'choose-yue' | 'cloze'
const mode = ref<Mode>('recognize')

onMounted(() => {
  if (!vocab.loaded) vocab.load()
})

const queue = ref<VocabEntry[]>([])
const idx = ref(0)
const showAnswer = ref(false)
const sessionDone = ref(false)
const sessionStats = ref({ total: 0, correct: 0 })

function startSession() {
  const due = vocab.entries.filter((e) => isDue(e.srs))
  // 隨機打亂
  queue.value = [...due].sort(() => Math.random() - 0.5).slice(0, 20)
  idx.value = 0
  showAnswer.value = false
  sessionDone.value = false
  sessionStats.value = { total: queue.value.length, correct: 0 }
}

const current = computed(() => queue.value[idx.value])

// 「看書面選口語」生成選項
const choices = computed(() => {
  if (mode.value !== 'choose-yue' || !current.value) return []
  const correct = current.value.cantonese
  // 從其他生詞 + 隨機構造干擾項
  const pool = vocab.entries
    .filter((e) => e.id !== current.value!.id && e.cantonese !== correct)
    .map((e) => e.cantonese)
  const distractors = [...new Set(pool)].sort(() => Math.random() - 0.5).slice(0, 3)
  return [correct, ...distractors].sort(() => Math.random() - 0.5)
})

const cloze = computed(() => {
  if (mode.value !== 'cloze' || !current.value) return null
  const c = current.value.cantonese
  // 隱去最有特色的 1-3 個字（簡單策略：隱中間段）
  if (c.length <= 2) return { masked: '___', answer: c }
  const start = Math.floor(c.length / 3)
  const end = Math.min(c.length, start + Math.max(1, Math.floor(c.length / 3)))
  return {
    masked: c.slice(0, start) + '___' + c.slice(end),
    answer: c.slice(start, end),
  }
})

async function rate(quality: ReviewQuality) {
  const entry = current.value
  if (!entry) return
  const newSrs = reviewSrs(entry.srs, quality)
  await vocab.update({ ...entry, srs: newSrs })
  if (quality >= 3) sessionStats.value.correct += 1
  next()
}

function next() {
  showAnswer.value = false
  if (idx.value + 1 >= queue.value.length) {
    sessionDone.value = true
  } else {
    idx.value += 1
  }
}

function evaluateChoice(c: string) {
  showAnswer.value = true
  if (c === current.value!.cantonese) {
    setTimeout(() => rate(4), 600)
  }
}

function evaluateCloze(value: string) {
  showAnswer.value = true
  if (value.trim() === cloze.value!.answer) {
    setTimeout(() => rate(4), 800)
  }
}

const userInput = ref('')

function speakNow() {
  if (current.value) tts.speak(current.value.cantonese)
}
</script>

<template>
  <div class="space-y-5 pb-24 md:pb-0">
    <header>
      <h2 class="text-2xl font-bold mb-1">🎯 間隔複習</h2>
      <p class="text-sm" style="color: var(--color-muted)">
        基於 SuperMemo-2 算法，每天 5 分鐘把粵語口語刻進腦子。
      </p>
    </header>

    <!-- 模式切換 -->
    <div v-if="!queue.length" class="card p-5 space-y-4">
      <div class="text-sm font-medium">選一種複習模式：</div>
      <div class="grid sm:grid-cols-3 gap-3">
        <button
          v-for="opt in [
            { id: 'recognize', icon: '👂', label: '聽音辨意', desc: '聽粵語口語，回憶意思' },
            { id: 'choose-yue', icon: '✨', label: '看書面選口語', desc: '看書面語，從 4 個選項中選對的' },
            { id: 'cloze', icon: '🧩', label: '句子填空', desc: '補全粵語口語句中關鍵字' },
          ] as const"
          :key="opt.id"
          class="card p-4 text-left cursor-pointer transition hover:scale-[1.02]"
          :style="mode === opt.id ? { borderColor: 'var(--color-accent)', boxShadow: '0 0 0 2px var(--color-accent)' } : {}"
          @click="mode = opt.id"
        >
          <div class="text-3xl mb-2">{{ opt.icon }}</div>
          <div class="font-medium mb-1">{{ opt.label }}</div>
          <div class="text-xs" style="color: var(--color-muted)">{{ opt.desc }}</div>
        </button>
      </div>

      <div class="flex justify-between items-center pt-3 border-t" style="border-color: color-mix(in srgb, var(--color-ink) 8%, transparent)">
        <div class="text-sm" style="color: var(--color-muted)">
          今日待複習：<strong style="color: var(--color-accent)">{{ vocab.entries.filter(e => isDue(e.srs)).length }}</strong> 句
        </div>
        <button
          class="px-5 py-2 rounded-lg font-medium cursor-pointer transition"
          style="background: var(--color-accent); color: white"
          :disabled="vocab.entries.filter(e => isDue(e.srs)).length === 0"
          @click="startSession"
        >
          開始複習 →
        </button>
      </div>
    </div>

    <!-- Session 完成 -->
    <div v-else-if="sessionDone" class="card p-8 text-center">
      <div class="text-5xl mb-3">🎉</div>
      <div class="text-xl font-bold mb-2">完成！</div>
      <p class="text-sm mb-4" style="color: var(--color-muted)">
        本輪複習了 <strong style="color: var(--color-ink)">{{ sessionStats.total }}</strong> 句，
        答對 <strong style="color: var(--color-jade)">{{ sessionStats.correct }}</strong> 句
      </p>
      <button
        class="px-5 py-2 rounded-lg cursor-pointer transition"
        style="background: var(--color-ink); color: var(--color-paper)"
        @click="startSession"
      >再來一輪</button>
    </div>

    <!-- 複習中 -->
    <div v-else-if="current" class="space-y-4">
      <div class="flex justify-between items-center text-xs" style="color: var(--color-muted)">
        <div>進度 {{ idx + 1 }} / {{ queue.length }}</div>
        <div>模式：{{ mode === 'recognize' ? '聽音辨意' : mode === 'choose-yue' ? '看書面選口語' : '句子填空' }}</div>
      </div>

      <!-- 模式 1：聽音辨意 -->
      <div v-if="mode === 'recognize'" class="card p-6 text-center">
        <div class="text-sm mb-4" style="color: var(--color-muted)">點擊播放，回憶這句意思</div>
        <button
          class="text-5xl mb-4 transition hover:scale-110 cursor-pointer"
          @click="speakNow"
        >🔊</button>
        <div v-if="!showAnswer">
          <button class="text-sm hover:underline cursor-pointer" style="color: var(--color-jade)" @click="showAnswer = true">
            顯示答案 →
          </button>
        </div>
        <div v-else class="space-y-2 pt-3 border-t mt-3" style="border-color: color-mix(in srgb, var(--color-ink) 10%, transparent)">
          <div class="text-lg font-semibold">{{ current.cantonese }}</div>
          <div v-if="current.jyutping" class="font-mono text-sm" style="color: var(--color-muted)">{{ current.jyutping }}</div>
          <div class="text-base" style="color: var(--color-ink)">{{ current.written }}</div>
          <div class="flex justify-center gap-2 pt-3">
            <button
              v-for="r in [
                { q: 0 as ReviewQuality, label: '完全忘了', tone: 'red' },
                { q: 2 as ReviewQuality, label: '很難', tone: 'orange' },
                { q: 4 as ReviewQuality, label: '記得', tone: 'jade' },
                { q: 5 as ReviewQuality, label: '完美', tone: 'green' },
              ]"
              :key="r.q"
              class="px-3 py-1.5 rounded-lg text-sm cursor-pointer transition hover:scale-105"
              :style="r.tone === 'red'
                ? { background: 'color-mix(in srgb, var(--color-accent) 14%, transparent)', color: 'var(--color-accent)' }
                : r.tone === 'orange'
                ? { background: 'color-mix(in srgb, #f59e0b 18%, transparent)', color: '#b45309' }
                : { background: 'color-mix(in srgb, var(--color-jade) 14%, transparent)', color: 'var(--color-jade)' }"
              @click="rate(r.q)"
            >{{ r.label }}</button>
          </div>
        </div>
      </div>

      <!-- 模式 2：看書面選口語 -->
      <div v-else-if="mode === 'choose-yue'" class="card p-6 space-y-3">
        <div class="text-sm" style="color: var(--color-muted)">下面這句書面語，粵語口語怎麼講？</div>
        <div class="text-xl font-medium">{{ current.written }}</div>
        <div class="grid sm:grid-cols-2 gap-2 pt-3">
          <button
            v-for="(c, i) in choices"
            :key="i"
            class="p-3 rounded-lg text-left cursor-pointer transition hover:scale-[1.01]"
            :style="showAnswer && c === current.cantonese
              ? { background: 'color-mix(in srgb, var(--color-jade) 18%, transparent)', borderColor: 'var(--color-jade)', color: 'var(--color-jade)' }
              : { background: 'color-mix(in srgb, var(--color-ink) 4%, transparent)' }"
              :disabled="showAnswer"
              @click="evaluateChoice(c)"
            >
              {{ c }}
            </button>
          </div>
          <div v-if="showAnswer && current.cantonese" class="text-xs italic pt-2" style="color: var(--color-muted)">
            正確答案：<strong style="color: var(--color-jade)">{{ current.cantonese }}</strong>
            <span v-if="current.jyutping" class="font-mono ml-2">{{ current.jyutping }}</span>
          </div>
          <div v-if="showAnswer" class="flex justify-center gap-2 pt-2">
            <button class="text-sm px-4 py-1.5 rounded cursor-pointer" style="color: var(--color-accent)" @click="rate(1)">記錯了</button>
            <button class="text-sm px-4 py-1.5 rounded cursor-pointer" style="background: var(--color-jade); color: white" @click="rate(4)">下一題 →</button>
          </div>
      </div>

      <!-- 模式 3：句子填空 -->
      <div v-else-if="mode === 'cloze' && cloze" class="card p-6 space-y-3">
        <div class="text-sm" style="color: var(--color-muted)">補全粵語口語空缺：</div>
        <div class="text-xl">{{ cloze.masked }}</div>
        <div class="text-xs italic" style="color: var(--color-muted)">提示：{{ current.written }}</div>
        <input
          v-model="userInput"
          type="text"
          placeholder="填入空缺處的字"
          class="card w-full px-3 py-2 outline-none"
          style="background: white"
          :disabled="showAnswer"
          @keyup.enter="evaluateCloze(userInput)"
        />
        <div class="flex justify-end gap-2">
          <button class="text-sm hover:underline cursor-pointer" style="color: var(--color-muted)" @click="showAnswer = true">
            顯示答案
          </button>
          <button class="px-4 py-1.5 rounded cursor-pointer" style="background: var(--color-accent); color: white" @click="evaluateCloze(userInput)">
            確認
          </button>
        </div>
        <div v-if="showAnswer" class="space-y-2 pt-3 border-t" style="border-color: color-mix(in srgb, var(--color-ink) 10%, transparent)">
          <div>正確答案：<strong style="color: var(--color-jade)">{{ cloze.answer }}</strong></div>
          <div class="text-sm">完整句：{{ current.cantonese }}</div>
          <div class="flex justify-center gap-2 pt-2">
            <button class="text-sm px-4 py-1.5 rounded cursor-pointer" style="color: var(--color-accent)" @click="rate(1)">填錯了</button>
            <button class="text-sm px-4 py-1.5 rounded cursor-pointer" style="background: var(--color-jade); color: white" @click="rate(4)">下一題 →</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
