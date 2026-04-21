<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG, RARITY_CONFIG, type RewardCard, type RewardDraw } from '../types'
import ScoreReveal from '../components/ScoreReveal.vue'
import CardDraw from '../components/CardDraw.vue'
import Confetti from '../components/Confetti.vue'

const store = useClassStore()
const router = useRouter()
const route = useRoute()

const lessonId = computed(() => String(route.params.lessonId ?? ''))
const lesson = computed(() => store.getLessonById(lessonId.value))

type Stage = 'reveal' | 'drawIntro' | 'draw' | 'applied' | 'noWinner'
const stage = ref<Stage>('reveal')

const confettiRef = ref<InstanceType<typeof Confetti> | null>(null)
const confettiActive = ref(false)

const groupScores = computed(() => {
  if (!lesson.value) return []
  return store.groups.map(g => ({
    group: g,
    score: lesson.value!.groupScores?.[g.id] ?? 0,
  }))
})

const winnerIds = computed(() => lesson.value?.winningGroupIds ?? [])

const winnerGroups = computed(() =>
  winnerIds.value.map(id => store.getGroupById(id)).filter(Boolean) as NonNullable<ReturnType<typeof store.getGroupById>>[]
)

// 當冠軍有多組時，依序輪流抽卡
const currentWinnerIdx = ref(0)
const currentWinnerGroup = computed(() => winnerGroups.value[currentWinnerIdx.value])
const currentAnimal = computed(() => currentWinnerGroup.value?.animal ?? 'owl')

// 候選卡片（3 張隨機）
const candidates = ref<RewardCard[]>([])
const revealedDraw = ref<RewardDraw | null>(null)
const allDraws = ref<RewardDraw[]>([])

function generateCandidates() {
  const cards = new Set<RewardCard>()
  let attempts = 0
  while (cards.size < 3 && attempts < 30) {
    cards.add(store.drawRandomCard())
    attempts++
  }
  candidates.value = Array.from(cards).sort(() => Math.random() - 0.5).slice(0, 3)
}

function handleRevealDone() {
  if (winnerIds.value.length === 0) {
    stage.value = 'noWinner'
    return
  }
  confettiActive.value = true
  // 放一發煙火
  nextTick(() => {
    confettiRef.value?.burst(120, { x: window.innerWidth / 2, y: window.innerHeight / 3 })
  })
  setTimeout(() => {
    stage.value = 'drawIntro'
  }, 1200)
}

function startDraw() {
  generateCandidates()
  stage.value = 'draw'
}

function handleCardRevealed(card: RewardCard) {
  if (!currentWinnerGroup.value || !lesson.value) return
  const draw = store.recordDraw(lesson.value.id, currentWinnerGroup.value.id, card)
  revealedDraw.value = draw
  // 傳說卡再放一次煙火
  if (card.rarity === 'legendary') {
    setTimeout(() => {
      confettiRef.value?.burst(150, { x: window.innerWidth / 2, y: window.innerHeight / 2 })
    }, 400)
  }
}

function applyDraw() {
  if (!revealedDraw.value) return
  store.applyRewardDraw(revealedDraw.value.id)
  allDraws.value.push(revealedDraw.value)
  // 繼續下一組？
  if (currentWinnerIdx.value + 1 < winnerGroups.value.length) {
    currentWinnerIdx.value += 1
    revealedDraw.value = null
    generateCandidates()
  } else {
    stage.value = 'applied'
  }
}

function skipApply() {
  if (!revealedDraw.value) return
  // 不套用，直接記錄但不生效（保留 draw，applied=false）
  allDraws.value.push(revealedDraw.value)
  if (currentWinnerIdx.value + 1 < winnerGroups.value.length) {
    currentWinnerIdx.value += 1
    revealedDraw.value = null
    generateCandidates()
  } else {
    stage.value = 'applied'
  }
}

function goBack() {
  router.push({ name: 'classroom' })
}

function viewReview() {
  router.push({ name: 'lessons' })
}

onMounted(() => {
  if (!lesson.value) {
    router.replace({ name: 'classroom' })
  }
})
</script>

<template>
  <div class="fixed inset-0 overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
    <!-- Background stars -->
    <div class="absolute inset-0 opacity-30">
      <div v-for="i in 30" :key="i" class="star" :style="{
        top: (Math.random() * 100) + '%',
        left: (Math.random() * 100) + '%',
        animationDelay: (Math.random() * 3) + 's',
      }">✨</div>
    </div>

    <!-- Top bar -->
    <div class="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
      <button
        @click="goBack"
        class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-full backdrop-blur transition-colors cursor-pointer"
      >
        ← 返回課堂
      </button>
      <span v-if="lesson" class="text-white/80 text-sm">
        📖 {{ lesson.subject }} · 結算
      </span>
      <button
        @click="viewReview"
        class="px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-full backdrop-blur transition-colors cursor-pointer"
      >
        📊 查看回顧
      </button>
    </div>

    <!-- Content -->
    <div class="w-full h-full flex items-center justify-center p-8 relative z-10">

      <!-- Stage: reveal scores -->
      <ScoreReveal
        v-if="stage === 'reveal'"
        :scores="groupScores"
        @done="handleRevealDone"
      />

      <!-- Stage: drawIntro (invite to draw) -->
      <div v-else-if="stage === 'drawIntro'" class="flex flex-col items-center gap-6 text-center animate-fadeIn">
        <div class="flex items-center gap-3">
          <span class="text-7xl animate-bounce-slow">👑</span>
        </div>
        <h2 class="text-4xl font-extrabold text-white drop-shadow-lg">
          冠軍：
          <span
            v-for="(g, idx) in winnerGroups"
            :key="g.id"
            class="inline-flex items-center gap-2"
            :style="{ color: ANIMAL_CONFIG[g.animal].lightColor }"
          >
            {{ idx > 0 ? ' / ' : '' }}
            <img :src="ANIMAL_CONFIG[g.animal].avatar" :alt="`${g.name} 頭像`" class="w-10 h-10 rounded-full object-cover border-2 border-white/70" />
            {{ g.name }}
          </span>
        </h2>
        <p class="text-lg text-white/80">{{ winnerGroups.length > 1 ? '平手！每組輪流抽卡獲得獎勵' : '可以抽一張獎勵卡！' }}</p>
        <button
          @click="startDraw"
          class="mt-4 px-8 py-4 bg-gradient-to-r from-yellow-400 to-pink-500 text-white font-extrabold text-lg rounded-full shadow-xl hover:scale-105 transition-transform cursor-pointer pulse-btn"
        >
          🎴 開始抽卡
        </button>
      </div>

      <!-- Stage: draw card -->
      <div v-else-if="stage === 'draw'" class="flex flex-col items-center gap-8 w-full animate-fadeIn">
        <CardDraw
          v-if="!revealedDraw && currentWinnerGroup"
          :candidates="candidates"
          :group-name="currentWinnerGroup.name"
          :group-avatar="ANIMAL_CONFIG[currentAnimal].avatar"
          :group-color="ANIMAL_CONFIG[currentAnimal].color"
          @revealed="handleCardRevealed"
        />

        <!-- After card revealed: confirm -->
        <div v-if="revealedDraw && currentWinnerGroup" class="flex flex-col items-center gap-5 animate-fadeIn">
          <div
            class="result-card"
            :style="{
              backgroundColor: RARITY_CONFIG[revealedDraw.card.rarity].bg,
              borderColor: RARITY_CONFIG[revealedDraw.card.rarity].border,
            }"
          >
            <span
              class="rarity-badge"
              :style="{ backgroundColor: RARITY_CONFIG[revealedDraw.card.rarity].color }"
            >
              {{ RARITY_CONFIG[revealedDraw.card.rarity].label }}
            </span>
            <div class="text-8xl my-4">{{ revealedDraw.card.emoji }}</div>
            <h3 class="text-3xl font-extrabold" :style="{ color: RARITY_CONFIG[revealedDraw.card.rarity].color }">
              {{ revealedDraw.card.name }}
            </h3>
            <p class="text-sm text-stone-600 mt-2 max-w-xs text-center">
              {{ revealedDraw.card.description }}
            </p>
          </div>
          <div class="text-white/80 text-sm mb-1">
            <template v-if="revealedDraw.card.effect.type === 'stamp'">
              🎖 點擊套用後，{{ currentWinnerGroup.name }}每位成員加蓋 {{ revealedDraw.card.effect.count }} 個印章
            </template>
            <template v-else-if="revealedDraw.card.effect.type === 'bonusPoints'">
              🎟 點擊套用後，{{ currentWinnerGroup.name }}下節課開始時會自動獲得 +{{ revealedDraw.card.effect.points }} 分
            </template>
            <template v-else-if="revealedDraw.card.effect.type === 'badge'">
              🏅 點擊套用後，{{ currentWinnerGroup.name }}獲得「{{ revealedDraw.card.effect.badgeName }}」徽章
            </template>
            <template v-else-if="revealedDraw.card.effect.type === 'privilege'">
              🎁 特權獎勵：{{ revealedDraw.card.effect.name }}（由老師當場兌現）
            </template>
            <template v-else>
              ❓ 神秘獎勵，老師自由發揮！
            </template>
          </div>
          <div class="flex gap-3">
            <button
              @click="skipApply"
              class="px-5 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-medium cursor-pointer backdrop-blur"
            >
              跳過
            </button>
            <button
              @click="applyDraw"
              class="px-8 py-2.5 bg-gradient-to-r from-emerald-400 to-teal-500 text-white rounded-xl text-sm font-bold shadow-lg hover:scale-105 transition-transform cursor-pointer"
            >
              ✓ 套用獎勵
            </button>
          </div>
        </div>
      </div>

      <!-- Stage: applied -->
      <div v-else-if="stage === 'applied'" class="flex flex-col items-center gap-6 animate-fadeIn text-center">
        <div class="text-8xl animate-bounce-slow">🎉</div>
        <h2 class="text-4xl font-extrabold text-white drop-shadow-lg">本堂課完成！</h2>
        <p class="text-white/80 max-w-md">獎勵已發放，下節課開始時會自動套用加分券。記得表揚本堂課的冠軍組喔！</p>
        <div class="flex flex-wrap justify-center gap-3 mt-4 max-w-md">
          <div
            v-for="draw in allDraws"
            :key="draw.id"
            class="flex items-center gap-2 bg-white/10 backdrop-blur rounded-xl px-4 py-2 border border-white/20"
          >
            <span class="text-2xl">{{ draw.card.emoji }}</span>
            <div class="text-left">
              <p class="text-xs text-white/60">
                <img
                  :src="ANIMAL_CONFIG[store.getGroupById(draw.groupId)?.animal ?? 'owl'].avatar"
                  :alt="`${store.getGroupById(draw.groupId)?.name ?? '小組'} 頭像`"
                  class="inline-block w-4 h-4 rounded-full object-cover align-text-bottom mr-1"
                />
                {{ store.getGroupById(draw.groupId)?.name }}
              </p>
              <p class="text-sm font-bold text-white">{{ draw.card.name }}</p>
            </div>
          </div>
        </div>
        <div class="flex gap-3 mt-6">
          <button
            @click="goBack"
            class="px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium cursor-pointer backdrop-blur"
          >
            回到課堂
          </button>
          <button
            @click="viewReview"
            class="px-6 py-3 bg-gradient-to-r from-yellow-400 to-pink-500 text-white rounded-xl font-bold shadow-lg cursor-pointer"
          >
            📊 查看課堂回顧
          </button>
        </div>
      </div>

      <!-- Stage: noWinner (all zero) -->
      <div v-else class="flex flex-col items-center gap-6 animate-fadeIn text-center">
        <div class="text-7xl">🌙</div>
        <h2 class="text-3xl font-bold text-white drop-shadow">本堂課沒有得分</h2>
        <p class="text-white/70 max-w-md">沒有小組獲得正分，不抽卡。下堂課再加油吧！</p>
        <button
          @click="goBack"
          class="mt-4 px-6 py-3 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium cursor-pointer backdrop-blur"
        >
          回到課堂
        </button>
      </div>
    </div>

    <!-- Confetti -->
    <Confetti
      ref="confettiRef"
      :active="confettiActive && (stage === 'drawIntro' || stage === 'applied')"
      :rate="stage === 'applied' ? 80 : 40"
    />
  </div>
</template>

<style scoped>
.animate-fadeIn {
  animation: fadeIn 0.6s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-bounce-slow {
  animation: bounce 1.5s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}

.star {
  position: absolute;
  font-size: 16px;
  animation: twinkle 3s infinite;
}

@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
}

.pulse-btn {
  animation: pulseBtn 2s infinite;
}

@keyframes pulseBtn {
  0%, 100% { box-shadow: 0 10px 30px rgba(236, 72, 153, 0.4); }
  50% { box-shadow: 0 10px 40px rgba(236, 72, 153, 0.7), 0 0 0 10px rgba(236, 72, 153, 0.1); }
}

.result-card {
  position: relative;
  background: white;
  border: 4px solid;
  border-radius: 24px;
  padding: 32px 48px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation: resultPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes resultPop {
  from { opacity: 0; transform: scale(0.6) rotate(-8deg); }
  to { opacity: 1; transform: scale(1) rotate(0); }
}

.rarity-badge {
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  color: white;
  font-weight: 800;
  font-size: 11px;
  padding: 4px 14px;
  border-radius: 999px;
  letter-spacing: 0.1em;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
</style>
