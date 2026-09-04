<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import CharCard from '@/components/CharCard.vue';
import MascotHint from '@/components/MascotHint.vue';
import MiZiGrid from '@/components/MiZiGrid.vue';
import ObjectToolbar from '@/components/ObjectToolbar.vue';
import StrokePouch from '@/components/StrokePouch.vue';
import { usePuzzle } from '@/composables/usePuzzle';
import { strokeName } from '@/data/strokes';
import { canPlay, prefetchChars } from '@/lib/charData';
import { celebrateStars } from '@/lib/celebrate';
import { useWordbooks } from '@/stores/wordbooks';
import type { StrokeId } from '@/types';

const router = useRouter();
const books = useWordbooks();

const {
  data,
  slots,
  pieces,
  selectedId,
  poppedId,
  result,
  loading,
  error,
  available,
  setChar,
  drop,
  move,
  applyTransform,
  removeSelected,
  clear,
  check,
} = usePuzzle({ snap: false });

const pouchOpen = ref(false);
const showResult = ref(false);
const revealed = ref(false);
const index = ref(0);
const grid = ref<{ hitTest: (x: number, y: number) => { x: number; y: number; inside: boolean } | null } | null>(
  null
);

const chars = computed(() => books.activeChars.filter(canPlay));
const current = computed(() => chars.value[index.value] ?? '');

async function loadCurrent() {
  revealed.value = false;
  showResult.value = false;
  if (current.value) await setChar(current.value);
}

onMounted(loadCurrent);
watch(current, loadCurrent);
watch(
  chars,
  (list) => {
    if (index.value >= list.length) index.value = 0;
    prefetchChars(list);
  },
  { immediate: true }
);

function step(delta: number) {
  if (!chars.value.length) return;
  index.value = (index.value + delta + chars.value.length) % chars.value.length;
}

function submit() {
  check();
  showResult.value = true;
  if (result.value?.passed) celebrateStars();
  if (result.value && !result.value.passed) revealed.value = true;
}

function onToolDrop(payload: { strokeId: StrokeId; variantKey?: string; clientX: number; clientY: number }) {
  const hit = grid.value?.hitTest(payload.clientX, payload.clientY);
  if (!hit?.inside) return;
  drop(payload.strokeId, hit.x, hit.y, payload.variantKey);
}

const pct = (v: number) => Math.round(v * 100);

const mascotMood = computed(() => {
  if (!showResult.value) return 'think';
  return result.value?.passed ? 'cheer' : 'retry';
});
</script>

<template>
  <div class="page">
    <header class="page-head wrap">
      <button class="btn btn-ghost btn-sm" @click="router.push('/')">← 回首頁</button>
      <h1>挑戰模式</h1>
      <button class="btn btn-butter btn-sm" @click="pouchOpen = true">🎒 錦囊</button>
    </header>

    <div class="page-body wrap">
      <MascotHint :mood="mascotMood" />
      <div v-if="!chars.length" class="card">
        <p class="hint">字簿「{{ books.active?.name ?? '未選擇' }}」裡還沒有字。請老師在設定裡貼生字。</p>
      </div>

      <div v-else class="play">
        <div class="stack">
          <CharCard v-if="data" :data="data" :show-stroke-list="false" />
          <p v-else-if="loading" class="card hint">正在取筆順資料…</p>
          <p v-else-if="error" class="card hint">{{ error }}</p>
        </div>

        <!-- 中欄：米字格與工具欄 -->
        <div class="play-center">
          <MiZiGrid
            ref="grid"
            :pieces="pieces"
            :slots="slots"
            :show-slots="revealed"
            :selected-id="selectedId"
            :popped-id="poppedId"
            @move="move($event.id, $event.x, $event.y)"
            @select="selectedId = $event"
            @transform="applyTransform"
            @delete="removeSelected()"
          />

          <ObjectToolbar
            :available="available"
            :has-selection="!!selectedId"
            @drop="onToolDrop"
            @delete="removeSelected()"
            @clear="clear()"
          />

          <div class="row" style="justify-content: center">
            <button class="btn btn-mint" :disabled="!pieces.length" @click="submit">拼好了</button>
            <button class="btn btn-ghost btn-sm" @click="revealed = !revealed">
              {{ revealed ? '收起提示位置' : '看提示位置' }}
            </button>
          </div>
        </div>

        <div class="stack">
          <div class="card">
            <div class="card-title">
              <span>{{ books.active?.name }}</span>
              <span class="pill">{{ index + 1 }} / {{ chars.length }}</span>
            </div>
            <div class="row">
              <button class="btn btn-ghost btn-sm" @click="step(-1)">上一個</button>
              <button class="btn btn-sky btn-sm" @click="step(1)">下一個字</button>
            </div>
          </div>
          <div class="card">
            <div class="card-title">怎麼算分</div>
            <p class="hint">
              靠近正確位置時，物品會自動對齊那一筆的長短和角度。按「拼好了」會分三項算：
              <strong>種類</strong>有沒有用對物品、<strong>筆順</strong>放下的次序、<strong>位置</strong>擺得準不準。
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 結算 -->
    <div v-if="showResult && result" class="overlay" @click.self="showResult = false">
      <div class="overlay-card" style="max-width: 560px">
        <div class="overlay-head">
          <h2>{{ result.passed ? '拼好了！' : '再看一次筆順' }}</h2>
          <button class="btn btn-ghost btn-sm" @click="showResult = false">關閉</button>
        </div>

        <div class="score-rows">
          <div class="score-row">
            <span class="label">種類</span>
            <span class="score-bar"><span :style="{ width: `${pct(result.kindScore)}%` }" /></span>
            <span class="value">{{ pct(result.kindScore) }}%</span>
          </div>
          <div class="score-row">
            <span class="label">筆順</span>
            <span class="score-bar"><span :style="{ width: `${pct(result.orderScore)}%` }" /></span>
            <span class="value">{{ pct(result.orderScore) }}%</span>
          </div>
          <div class="score-row">
            <span class="label">位置</span>
            <span class="score-bar"><span :style="{ width: `${pct(result.placementScore)}%` }" /></span>
            <span class="value">{{ pct(result.placementScore) }}%</span>
          </div>
        </div>

        <div class="stroke-list-box is-result">
          <ol class="stroke-list">
            <li v-for="s in result.perStroke" :key="s.slotIndex">
              <span class="idx">{{ s.slotIndex + 1 }}</span>
              <span>{{ strokeName(s.strokeId) }}</span>
              <span style="margin-left: auto; font-size: 0.8rem">
                <template v-if="!s.kindOk">沒放這一筆</template>
                <template v-else>
                  {{ s.placementOk ? '位置對' : '位置歪了' }} ·
                  {{ s.orderOk ? '順序對' : '順序不對' }}
                </template>
              </span>
            </li>
          </ol>
        </div>

        <p v-if="result.extraPieceIds.length" class="hint" style="margin-top: 10px">
          多放了 {{ result.extraPieceIds.length }} 件物品。
        </p>

        <div class="row" style="margin-top: 14px">
          <button class="btn btn-sky" @click="showResult = false">繼續改</button>
          <button
            class="btn btn-mint"
            @click="
              showResult = false;
              clear();
              step(1);
            "
          >
            下一個字
          </button>
        </div>
      </div>
    </div>

    <div v-if="pouchOpen" class="overlay" @click.self="pouchOpen = false">
      <div class="overlay-card">
        <div class="overlay-head">
          <h2>🎒 錦囊 · 筆畫與物品對照</h2>
          <button class="btn btn-ghost btn-sm" @click="pouchOpen = false">關閉</button>
        </div>
        <StrokePouch />
      </div>
    </div>
  </div>
</template>
