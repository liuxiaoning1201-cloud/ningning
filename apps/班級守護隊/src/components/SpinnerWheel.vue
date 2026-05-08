<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { SpinnerItem, SpinnerCategory, SpinnerConfig } from '../types'
import { SPINNER_CATEGORY_CONFIG } from '../types'

export type SpinnerDropMode = 'help' | 'challenge'

interface TargetGroupInfo {
  id: string
  name: string
  avatar?: string
  color?: string
  /** help = 救援落後組（偏向獎勵）；challenge = 挑戰領先組（偏向反轉/挑戰） */
  mode: SpinnerDropMode
}

const props = defineProps<{
  config: SpinnerConfig
  /** 平衡掉落時指定目標小組與意圖 */
  targetGroup?: TargetGroupInfo | null
  /** 覆寫類別權重（不變動全域設定） */
  overrideWeights?: Record<SpinnerCategory, number> | null
  /** 自訂主標題；預設為「命運轉盤」 */
  title?: string
  /** 副標題說明 */
  subtitle?: string
}>()

const emit = defineEmits<{
  (e: 'result', payload: { item: SpinnerItem; targetGroupId?: string; mode?: SpinnerDropMode }): void
  (e: 'close'): void
}>()

const isSpinning = ref(false)
const rotation = ref(0)
const resultItem = ref<SpinnerItem | null>(null)
const showResult = ref(false)
const showResultCard = ref(false)

const segments: { category: SpinnerCategory; startDeg: number; endDeg: number }[] = [
  { category: 'reward', startDeg: 0, endDeg: 120 },
  { category: 'punishment', startDeg: 120, endDeg: 240 },
  { category: 'reversal', startDeg: 240, endDeg: 360 },
]

const segmentColors: Record<SpinnerCategory, { main: string; accent: string; glow: string }> = {
  reward: { main: '#4ADE80', accent: '#22C55E', glow: '#86EFAC' },
  punishment: { main: '#FB923C', accent: '#F97316', glow: '#FDBA74' },
  reversal: { main: '#C084FC', accent: '#A855F7', glow: '#D8B4FE' },
}

const segmentEmojis: Record<SpinnerCategory, string> = {
  reward: '🎁',
  punishment: '📖',
  reversal: '🔮',
}

const effectiveWeights = computed<Record<SpinnerCategory, number>>(() => {
  return props.overrideWeights ?? props.config.weights
})

function weightedPickCategory(): SpinnerCategory {
  const w = effectiveWeights.value
  const total = w.reward + w.punishment + w.reversal
  if (total <= 0) return 'reward'
  const r = Math.random() * total
  if (r < w.reward) return 'reward'
  if (r < w.reward + w.punishment) return 'punishment'
  return 'reversal'
}

function pickItem(category: SpinnerCategory): SpinnerItem {
  const items = props.config.items.filter(i => i.category === category)
  if (items.length === 0) return props.config.items[Math.floor(Math.random() * props.config.items.length)]
  return items[Math.floor(Math.random() * items.length)]
}

function spin() {
  if (isSpinning.value) return
  isSpinning.value = true
  showResult.value = false
  showResultCard.value = false
  resultItem.value = null

  const chosenCategory = weightedPickCategory()
  const chosen = pickItem(chosenCategory)

  const seg = segments.find(s => s.category === chosenCategory)!
  const targetMid = (seg.startDeg + seg.endDeg) / 2
  const pointerTarget = 360 - targetMid + (Math.random() - 0.5) * 80

  const spins = 5 + Math.floor(Math.random() * 3)
  const targetAngle = spins * 360 + pointerTarget

  rotation.value += targetAngle

  setTimeout(() => {
    isSpinning.value = false
    resultItem.value = chosen
    showResult.value = true
    setTimeout(() => { showResultCard.value = true }, 300)
    emit('result', {
      item: chosen,
      targetGroupId: props.targetGroup?.id,
      mode: props.targetGroup?.mode,
    })
  }, 3800)
}

function reset() {
  showResult.value = false
  showResultCard.value = false
  resultItem.value = null
}

function spinAgain() {
  reset()
  nextTick(() => spin())
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180
  const endRad = ((endAngle - 90) * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const largeArc = endAngle - startAngle > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

function labelPos(startDeg: number, endDeg: number, radius: number) {
  const mid = (startDeg + endDeg) / 2
  const rad = ((mid - 90) * Math.PI) / 180
  return { x: 250 + radius * Math.cos(rad), y: 250 + radius * Math.sin(rad) }
}

const weightPercents = computed(() => {
  const w = effectiveWeights.value
  const t = w.reward + w.punishment + w.reversal
  if (t <= 0) return { reward: 0, punishment: 0, reversal: 0 }
  return {
    reward: Math.round((w.reward / t) * 100),
    punishment: Math.round((w.punishment / t) * 100),
    reversal: Math.round((w.reversal / t) * 100),
  }
})

const headlineTitle = computed(() => props.title ?? '🎡 命運轉盤')
const headlineSubtitle = computed(() => {
  if (props.subtitle) return props.subtitle
  if (props.targetGroup) {
    return props.targetGroup.mode === 'help'
      ? '為落後的小組帶來逆轉的機會！'
      : '領先的小組要面對命運的挑戰！'
  }
  return '看看命運會帶來什麼驚喜吧！'
})
</script>

<template>
  <Teleport to="body">
    <!-- Outer scrollable layer：讓內容過高時可整頁下拉，避免按鈕被裁切 -->
    <div class="fixed inset-0 z-[200] bg-gradient-to-br from-indigo-900/95 via-purple-900/95 to-pink-900/95 backdrop-blur-sm overflow-y-auto">
      <!-- Close button (sticky at top-right) -->
      <button
        @click="emit('close')"
        class="fixed top-5 right-5 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl flex items-center justify-center cursor-pointer transition-all z-50 backdrop-blur"
      >
        ✕
      </button>

      <!-- Background decorations -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div v-for="i in 20" :key="i" class="floating-star" :style="{
          top: (Math.random() * 100) + '%',
          left: (Math.random() * 100) + '%',
          animationDelay: (Math.random() * 4) + 's',
          fontSize: (12 + Math.random() * 16) + 'px',
        }">{{ ['✨', '⭐', '🌟', '💫', '🎀'][i % 5] }}</div>
      </div>

      <!-- Inner container：用 min-h-full + flex 居中，讓不會溢出時保持垂直置中，溢出時可滾動 -->
      <div class="relative z-10 min-h-full flex items-center justify-center py-10 px-4">
        <div class="flex flex-col items-center gap-5 w-full max-w-2xl">

          <!-- Title -->
          <div class="text-center">
            <h1 class="text-3xl md:text-5xl font-black text-white drop-shadow-lg tracking-wide">
              {{ headlineTitle }}
            </h1>
            <p class="text-white/70 text-sm md:text-base mt-2">{{ headlineSubtitle }}</p>
          </div>

          <!-- Target group banner（平衡掉落時才會顯示） -->
          <div
            v-if="targetGroup"
            class="flex items-center gap-3 px-4 py-2.5 rounded-2xl border backdrop-blur-md"
            :style="{
              backgroundColor: (targetGroup.color ?? '#fbbf24') + '22',
              borderColor: (targetGroup.color ?? '#fbbf24') + '88',
            }"
          >
            <img
              v-if="targetGroup.avatar"
              :src="targetGroup.avatar"
              :alt="`${targetGroup.name} 頭像`"
              class="w-10 h-10 rounded-full object-cover border-2 border-white/70"
            />
            <div class="text-left">
              <p class="text-[11px] uppercase tracking-wider text-white/60 font-semibold">
                {{ targetGroup.mode === 'help' ? '🎯 救援目標' : '⚔️ 挑戰目標' }}
              </p>
              <p class="text-white text-base md:text-lg font-extrabold">
                {{ targetGroup.name }}
              </p>
            </div>
          </div>

          <!-- Wheel area -->
          <div class="relative" :class="{ 'pointer-events-none': isSpinning }">
            <!-- Pointer -->
            <div class="absolute -top-2 left-1/2 -translate-x-1/2 z-30 drop-shadow-lg">
              <div class="w-0 h-0 border-l-[18px] border-r-[18px] border-t-[36px] border-l-transparent border-r-transparent border-t-yellow-300 filter drop-shadow-[0_3px_6px_rgba(0,0,0,0.3)]" />
              <div class="w-3 h-3 rounded-full bg-yellow-300 mx-auto -mt-1" />
            </div>

            <!-- Outer glow ring -->
            <div
              class="absolute inset-0 rounded-full"
              :class="{ 'animate-pulse': isSpinning }"
              style="box-shadow: 0 0 60px 15px rgba(251, 191, 36, 0.3); border-radius: 50%; margin: -15px;"
            />

            <!-- The Wheel -->
            <div
              class="wheel-disc"
              :style="{ transform: `rotate(${rotation}deg)` }"
              :class="{ spinning: isSpinning }"
            >
              <svg width="500" height="500" viewBox="0 0 500 500" class="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] md:w-[400px] md:h-[400px] lg:w-[480px] lg:h-[480px]">
                <!-- Outer border ring -->
                <circle cx="250" cy="250" r="248" fill="none" stroke="white" stroke-width="4" opacity="0.3" />
                <circle cx="250" cy="250" r="240" fill="#1e1b4b" />

                <!-- Segments -->
                <g v-for="seg in segments" :key="seg.category">
                  <path
                    :d="describeArc(250, 250, 235, seg.startDeg, seg.endDeg)"
                    :fill="segmentColors[seg.category].main"
                    stroke="white"
                    stroke-width="3"
                  />
                  <!-- Accent inner arc for depth -->
                  <path
                    :d="describeArc(250, 250, 160, seg.startDeg + 5, seg.endDeg - 5)"
                    :fill="segmentColors[seg.category].accent"
                    opacity="0.3"
                  />
                </g>

                <!-- Segment labels -->
                <g v-for="seg in segments" :key="'label-' + seg.category">
                  <text
                    :x="labelPos(seg.startDeg, seg.endDeg, 140).x"
                    :y="labelPos(seg.startDeg, seg.endDeg, 140).y - 15"
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="48"
                    class="select-none"
                  >{{ segmentEmojis[seg.category] }}</text>
                  <text
                    :x="labelPos(seg.startDeg, seg.endDeg, 140).x"
                    :y="labelPos(seg.startDeg, seg.endDeg, 140).y + 35"
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="28"
                    font-weight="900"
                    fill="white"
                    class="select-none"
                    style="text-shadow: 0 2px 4px rgba(0,0,0,0.3)"
                  >{{ SPINNER_CATEGORY_CONFIG[seg.category].label }}</text>
                  <text
                    :x="labelPos(seg.startDeg, seg.endDeg, 140).x"
                    :y="labelPos(seg.startDeg, seg.endDeg, 140).y + 62"
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="16"
                    font-weight="700"
                    fill="white"
                    opacity="0.7"
                    class="select-none"
                  >{{ weightPercents[seg.category] }}%</text>
                </g>

                <!-- Center hub -->
                <circle cx="250" cy="250" r="50" fill="#fbbf24" stroke="#f59e0b" stroke-width="4" />
                <circle cx="250" cy="250" r="40" fill="#fcd34d" />
                <text x="250" y="250" text-anchor="middle" dominant-baseline="central" font-size="32" class="select-none">🎡</text>

                <!-- Decorative dots on dividers -->
                <circle v-for="seg in segments" :key="'dot-' + seg.category"
                  :cx="250 + 220 * Math.cos(((seg.startDeg - 90) * Math.PI) / 180)"
                  :cy="250 + 220 * Math.sin(((seg.startDeg - 90) * Math.PI) / 180)"
                  r="8" fill="white" opacity="0.8"
                />
              </svg>
            </div>
          </div>

          <!-- Spin button / Result -->
          <div class="flex flex-col items-center gap-4 min-h-[160px] w-full">
            <Transition name="result-pop" mode="out-in">
              <!-- Result card -->
              <div v-if="showResult && resultItem && showResultCard" key="result" class="result-card-container">
                <div
                  class="result-card"
                  :style="{ borderColor: segmentColors[resultItem.category].accent, backgroundColor: segmentColors[resultItem.category].glow + '30' }"
                >
                  <span
                    class="category-badge"
                    :style="{ backgroundColor: segmentColors[resultItem.category].accent }"
                  >
                    {{ segmentEmojis[resultItem.category] }} {{ SPINNER_CATEGORY_CONFIG[resultItem.category].label }}
                  </span>
                  <div class="text-5xl mt-2">{{ resultItem.emoji }}</div>
                  <h3 class="text-2xl md:text-3xl font-black text-white mt-3">{{ resultItem.label }}</h3>
                  <p class="text-sm md:text-base text-white/80 mt-2 text-center max-w-xs leading-relaxed">{{ resultItem.description }}</p>
                  <div
                    v-if="targetGroup"
                    class="mt-4 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2"
                    :style="{ backgroundColor: (targetGroup.color ?? '#fbbf24') + '40', color: 'white' }"
                  >
                    <img v-if="targetGroup.avatar" :src="targetGroup.avatar" alt="" class="w-5 h-5 rounded-full object-cover" />
                    <span>由 {{ targetGroup.name }} 接受</span>
                  </div>
                </div>
                <div class="flex gap-3 mt-5">
                  <button
                    @click="spinAgain"
                    class="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-bold cursor-pointer backdrop-blur border border-white/20 transition-all active:scale-95"
                  >
                    🔄 再轉一次
                  </button>
                  <button
                    @click="emit('close')"
                    class="px-6 py-3 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-2xl font-bold cursor-pointer shadow-lg hover:scale-105 transition-all active:scale-95"
                  >
                    ✓ 確認
                  </button>
                </div>
              </div>

              <!-- Spin button -->
              <div v-else key="button" class="flex flex-col items-center gap-3">
                <button
                  @click="spin"
                  :disabled="isSpinning"
                  class="spin-button"
                  :class="{ 'opacity-70 cursor-not-allowed': isSpinning }"
                >
                  <span v-if="isSpinning" class="flex items-center gap-2">
                    <span class="animate-spin inline-block">🎡</span> 旋轉中...
                  </span>
                  <span v-else>👆 點我轉動！</span>
                </button>
                <p v-if="!isSpinning" class="text-white/50 text-xs">點擊上方按鈕或轉盤開始</p>
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.wheel-disc {
  width: fit-content;
  height: fit-content;
  border-radius: 50%;
  cursor: pointer;
}

.wheel-disc.spinning {
  transition: transform 3.8s cubic-bezier(0.13, 0.7, 0.11, 1);
}

.wheel-disc:not(.spinning) {
  transition: none;
}

.spin-button {
  padding: 16px 48px;
  background: linear-gradient(135deg, #fbbf24, #f97316, #ec4899);
  color: white;
  font-weight: 900;
  font-size: 1.5rem;
  border-radius: 9999px;
  box-shadow: 0 10px 40px rgba(236, 72, 153, 0.4), 0 4px 15px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.2s;
  animation: btnPulse 2s infinite;
  border: 3px solid rgba(255, 255, 255, 0.3);
}

.spin-button:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 15px 50px rgba(236, 72, 153, 0.5), 0 6px 20px rgba(0, 0, 0, 0.3);
}

.spin-button:active:not(:disabled) {
  transform: scale(0.95);
}

@keyframes btnPulse {
  0%, 100% { box-shadow: 0 10px 40px rgba(236, 72, 153, 0.4); }
  50% { box-shadow: 0 10px 50px rgba(236, 72, 153, 0.6), 0 0 0 8px rgba(236, 72, 153, 0.1); }
}

.result-card-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 36px;
  border-radius: 24px;
  border: 3px solid;
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.05);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  animation: cardBounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.category-badge {
  color: white;
  font-weight: 800;
  font-size: 14px;
  padding: 6px 16px;
  border-radius: 999px;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.2);
}

@keyframes cardBounce {
  from { opacity: 0; transform: scale(0.5) translateY(30px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.result-pop-enter-active { transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
.result-pop-leave-active { transition: all 0.2s ease-in; }
.result-pop-enter-from { opacity: 0; transform: scale(0.8) translateY(20px); }
.result-pop-leave-to { opacity: 0; transform: scale(0.9) translateY(-10px); }

.floating-star {
  position: absolute;
  animation: floatStar 5s ease-in-out infinite;
  opacity: 0.5;
}

@keyframes floatStar {
  0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.3; }
  50% { transform: translateY(-15px) rotate(10deg); opacity: 0.7; }
}
</style>
