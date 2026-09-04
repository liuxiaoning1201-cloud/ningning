<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { RARITY_CONFIG, type RewardCard, type RewardEffect, type RewardRarity } from '../types'

const store = useClassStore()

interface EditingCard {
  id?: string
  name: string
  emoji: string
  description: string
  rarity: RewardRarity
  effectType: RewardEffect['type']
  stampCount: number
  bonusPoints: number
  badgeName: string
  badgeEmoji: string
  privilegeName: string
}

function createEmptyEditing(): EditingCard {
  return {
    name: '',
    emoji: '🎁',
    description: '',
    rarity: 'common',
    effectType: 'stamp',
    stampCount: 1,
    bonusPoints: 3,
    badgeName: '',
    badgeEmoji: '🏅',
    privilegeName: '',
  }
}

const editing = ref<EditingCard | null>(null)
const showForm = computed(() => editing.value !== null)

function openNew() {
  editing.value = createEmptyEditing()
}

function openEdit(card: RewardCard) {
  const effect = card.effect
  editing.value = {
    id: card.id,
    name: card.name,
    emoji: card.emoji,
    description: card.description,
    rarity: card.rarity,
    effectType: effect.type,
    stampCount: effect.type === 'stamp' ? effect.count : 1,
    bonusPoints: effect.type === 'bonusPoints' ? effect.points : 3,
    badgeName: effect.type === 'badge' ? effect.badgeName : '',
    badgeEmoji: effect.type === 'badge' ? effect.badgeEmoji : '🏅',
    privilegeName: effect.type === 'privilege' ? effect.name : '',
  }
}

function closeForm() {
  editing.value = null
}

function buildEffect(e: EditingCard): RewardEffect {
  switch (e.effectType) {
    case 'stamp': return { type: 'stamp', count: Math.max(1, e.stampCount) }
    case 'bonusPoints': return { type: 'bonusPoints', points: Math.max(1, e.bonusPoints) }
    case 'badge': return { type: 'badge', badgeName: e.badgeName || '冠軍徽章', badgeEmoji: e.badgeEmoji || '🏅' }
    case 'privilege': return { type: 'privilege', name: e.privilegeName || '一次特權' }
    case 'mystery': return { type: 'mystery' }
  }
}

function saveCard() {
  const e = editing.value
  if (!e || !e.name.trim()) return
  const card: Omit<RewardCard, 'id'> = {
    name: e.name.trim(),
    emoji: e.emoji || '🎁',
    description: e.description.trim(),
    rarity: e.rarity,
    effect: buildEffect(e),
  }
  if (e.id) {
    store.updateRewardCard(e.id, card)
  } else {
    store.addRewardCard(card)
  }
  editing.value = null
}

function deleteCard(id: string) {
  if (window.confirm('確定刪除此獎勵卡？')) {
    store.removeRewardCard(id)
  }
}

function resetToDefault() {
  if (window.confirm('還原為預設獎勵卡池？您的自訂卡片將被覆蓋。')) {
    store.resetRewardPool()
  }
}

function effectSummary(card: RewardCard): string {
  const e = card.effect
  switch (e.type) {
    case 'stamp': return `每位成員 +${e.count} 印章`
    case 'bonusPoints': return `下節課 +${e.points} 分`
    case 'badge': return `獲得「${e.badgeName}」徽章`
    case 'privilege': return `特權：${e.name}`
    case 'mystery': return '神秘獎勵（老師決定）'
  }
}

const totalWeight = computed(() =>
  store.rewardPool.reduce((sum, c) => sum + (RARITY_CONFIG[c.rarity]?.weight ?? 10), 0)
)

function probability(card: RewardCard): string {
  const w = RARITY_CONFIG[card.rarity]?.weight ?? 10
  return totalWeight.value > 0 ? ((w / totalWeight.value) * 100).toFixed(1) : '0'
}
</script>

<template>
  <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
    <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
      <h2 class="text-lg font-semibold text-stone-700 flex items-center gap-2">
        <span>🎁</span> 獎勵卡池（下課抽卡）
      </h2>
      <div class="flex gap-2">
        <button
          @click="resetToDefault"
          class="px-4 py-2 bg-stone-100 text-stone-600 rounded-lg text-sm hover:bg-stone-200 transition-colors cursor-pointer"
        >
          還原預設
        </button>
        <button
          @click="openNew"
          class="px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors cursor-pointer"
        >
          ＋ 新增卡片
        </button>
      </div>
    </div>

    <p class="text-xs text-stone-500 mb-4 leading-relaxed">
      卡池中共有 {{ store.rewardPool.length }} 張卡。稀有度影響抽到機率：普通 60 / 稀有 30 / 傳說 10 的權重。
      下課結算時冠軍組會從卡池隨機抽出 3 張候選，由老師選其中一張翻開。
    </p>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="card in store.rewardPool"
        :key="card.id"
        class="rounded-xl p-3 border-2 relative group"
        :style="{
          backgroundColor: RARITY_CONFIG[card.rarity].bg,
          borderColor: RARITY_CONFIG[card.rarity].border,
        }"
      >
        <div class="flex items-start gap-3">
          <span class="text-4xl">{{ card.emoji }}</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="font-bold text-sm text-stone-700 truncate">{{ card.name }}</span>
              <span
                class="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                :style="{ backgroundColor: RARITY_CONFIG[card.rarity].color, color: 'white' }"
              >
                {{ RARITY_CONFIG[card.rarity].label }}
              </span>
            </div>
            <p class="text-xs text-stone-500 leading-snug mb-1">{{ card.description }}</p>
            <p class="text-[10px] font-semibold" :style="{ color: RARITY_CONFIG[card.rarity].color }">
              ⚡ {{ effectSummary(card) }}
            </p>
            <p class="text-[10px] text-stone-400 mt-0.5">抽到機率約 {{ probability(card) }}%</p>
          </div>
        </div>
        <div class="mt-2 flex justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <button
            @click="openEdit(card)"
            class="text-xs text-violet-600 hover:bg-violet-50 px-2 py-1 rounded cursor-pointer"
          >
            編輯
          </button>
          <button
            @click="deleteCard(card.id)"
            class="text-xs text-red-500 hover:bg-red-50 px-2 py-1 rounded cursor-pointer"
          >
            刪除
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Form Modal -->
    <Teleport to="body">
      <div
        v-if="showForm && editing"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        @click.self="closeForm"
      >
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-semibold text-stone-700 mb-4">
            {{ editing.id ? '編輯獎勵卡' : '新增獎勵卡' }}
          </h3>
          <div class="space-y-3">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-1">
                <label class="block text-xs text-stone-500 mb-1">圖示</label>
                <input
                  v-model="editing.emoji"
                  type="text"
                  maxlength="4"
                  class="w-full px-3 py-2 border border-stone-200 rounded-lg text-2xl text-center focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-xs text-stone-500 mb-1">卡片名稱</label>
                <input
                  v-model="editing.name"
                  type="text"
                  class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="例：印章雨"
                />
              </div>
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">說明</label>
              <textarea
                v-model="editing.description"
                rows="2"
                class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
                placeholder="簡短描述此卡片的獎勵內容"
              />
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">稀有度</label>
              <div class="flex gap-2">
                <button
                  v-for="(cfg, key) in RARITY_CONFIG"
                  :key="key"
                  @click="editing.rarity = key as RewardRarity"
                  class="flex-1 text-xs font-bold py-2 rounded-lg border-2 cursor-pointer transition-all"
                  :style="editing.rarity === key
                    ? { backgroundColor: cfg.color, color: 'white', borderColor: cfg.color }
                    : { backgroundColor: cfg.bg, color: cfg.color, borderColor: cfg.border }"
                >
                  {{ cfg.label }}（權重 {{ cfg.weight }}）
                </button>
              </div>
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">獎勵效果</label>
              <select
                v-model="editing.effectType"
                class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
              >
                <option value="stamp">🎖 印章（每人加蓋 N 個）</option>
                <option value="bonusPoints">🎟 下節課加分</option>
                <option value="badge">🏅 發放徽章</option>
                <option value="privilege">🎁 特權獎勵（老師口頭兌現）</option>
                <option value="mystery">❓ 神秘獎勵（老師自由發揮）</option>
              </select>
            </div>
            <div v-if="editing.effectType === 'stamp'">
              <label class="block text-xs text-stone-500 mb-1">每人印章數</label>
              <input
                v-model.number="editing.stampCount"
                type="number"
                min="1"
                class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div v-else-if="editing.effectType === 'bonusPoints'">
              <label class="block text-xs text-stone-500 mb-1">下節課加分</label>
              <input
                v-model.number="editing.bonusPoints"
                type="number"
                min="1"
                class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div v-else-if="editing.effectType === 'badge'" class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs text-stone-500 mb-1">徽章圖示</label>
                <input
                  v-model="editing.badgeEmoji"
                  type="text"
                  maxlength="4"
                  class="w-full px-3 py-2 border border-stone-200 rounded-lg text-xl text-center focus:outline-none focus:ring-2 focus:ring-violet-300"
                />
              </div>
              <div class="col-span-2">
                <label class="block text-xs text-stone-500 mb-1">徽章名稱</label>
                <input
                  v-model="editing.badgeName"
                  type="text"
                  class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                  placeholder="冠軍徽章"
                />
              </div>
            </div>
            <div v-else-if="editing.effectType === 'privilege'">
              <label class="block text-xs text-stone-500 mb-1">特權內容</label>
              <input
                v-model="editing.privilegeName"
                type="text"
                class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
                placeholder="例：自由選座位、免一次功課"
              />
            </div>
          </div>

          <div class="flex justify-end gap-2 mt-5">
            <button
              @click="closeForm"
              class="px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 rounded-xl cursor-pointer"
            >
              取消
            </button>
            <button
              @click="saveCard"
              :disabled="!editing.name.trim()"
              class="px-5 py-2 bg-violet-500 text-white rounded-xl text-sm font-bold hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>
