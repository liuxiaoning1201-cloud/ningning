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
import { readiness } from '@/lib/charData';
import { useWordbooks } from '@/stores/wordbooks';

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
  take,
  move,
  rotate,
  scale,
  removeSelected,
  clear,
  check,
} = usePuzzle({ snap: false });

const pouchOpen = ref(false);
const showResult = ref(false);
const revealed = ref(false);
const index = ref(0);

/** 挑戰模式靠位置比對，待核的字也能玩，只是不判筆畫種類。 */
const chars = computed(() => books.activeChars.filter((c) => readiness(c) !== 'missing'));
const current = computed(() => chars.value[index.value] ?? '');

async function loadCurrent() {
  revealed.value = false;
  showResult.value = false;
  if (current.value) await setChar(current.value);
}

onMounted(loadCurrent);
watch(current, loadCurrent);
watch(chars, () => {
  if (index.value >= chars.value.length) index.value = 0;
});

function step(delta: number) {
  if (!chars.value.length) return;
  index.value = (index.value + delta + chars.value.length) % chars.value.length;
}

function submit() {
  check();
  showResult.value = true;
  if (result.value && !result.value.passed) revealed.value = true;
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
      <div v-if="!chars.length" class="card">
        <p class="hint">字簿「{{ books.active?.name ?? '未選擇' }}」裡沒有可用的字。</p>
        <button class="btn btn-sky btn-sm" style="margin-top: 10px" @click="router.push('/teacher')">去選字</button>
      </div>

      <div v-else class="play">
        <!-- 左欄：題目與規則 -->
        <div class="stack">
          <div class="card">
            <div class="card-title">
              <span>{{ books.active?.name }}</span>
              <span class="pill">{{ index + 1 }} / {{ chars.length }}</span>
            </div>
            <p style="font-family: var(--font-title); font-size: 3.4rem; text-align: center; line-height: 1.1">
              {{ current }}
            </p>
            <div class="row" style="justify-content: center">
              <button class="btn btn-ghost btn-sm" @click="step(-1)">上一個</button>
              <button class="btn btn-sky btn-sm" @click="step(1)">下一個字</button>
            </div>
          </div>

          <div class="card">
            <div class="card-title">怎麼算分</div>
            <p class="hint">
              沒有吸附、沒有鎖筆順，全部自己擺。按「拼好了」會分三項算：
              <strong>種類</strong>有沒有用對物品、<strong>筆順</strong>放下的次序、<strong>位置</strong>擺得準不準。
              種類與位置都對才算過關，筆順分另外顯示。
            </p>
          </div>
        </div>

        <!-- 中欄：米字格與工具欄 -->
        <div class="play-center">
          <MiZiGrid
            :pieces="pieces"
            :slots="slots"
            :show-slots="revealed"
            :selected-id="selectedId"
            :popped-id="poppedId"
            @move="move($event.id, $event.x, $event.y)"
            @select="selectedId = $event"
          />

          <ObjectToolbar
            :available="available"
            :has-selection="!!selectedId"
            @take="take($event.strokeId, $event.variantKey)"
            @rotate="rotate($event)"
            @scale="scale($event)"
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

        <!-- 右欄：字卡。逐筆物品清單先藏起來，否則等於送答案 -->
        <div class="stack">
          <CharCard v-if="data" :data="data" :show-stroke-list="revealed" />
          <p v-else-if="loading" class="card hint">正在取筆順資料…</p>
          <p v-else-if="error" class="card hint">{{ error }}</p>
        </div>
      </div>
    </div>

    <MascotHint :mood="mascotMood" />

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
