<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import CharCard from '@/components/CharCard.vue';
import MascotHint from '@/components/MascotHint.vue';
import MiZiGrid from '@/components/MiZiGrid.vue';
import ObjectToolbar from '@/components/ObjectToolbar.vue';
import StrokePouch from '@/components/StrokePouch.vue';
import { usePuzzle } from '@/composables/usePuzzle';
import { STROKE_BY_ID } from '@/data/strokes';
import { canPlay, prefetchChars } from '@/lib/charData';
import { inkStrokePaths } from '@/lib/strokeLayouts';
import { celebrateStars } from '@/lib/celebrate';
import { useSettings } from '@/stores/settings';
import { useWordbooks } from '@/stores/wordbooks';
import type { StrokeId } from '@/types';

const router = useRouter();
const books = useWordbooks();
const settings = useSettings();

const {
  data,
  slots,
  pieces,
  selectedId,
  poppedId,
  loading,
  error,
  available,
  enabledOnly,
  nextSlotIndex,
  doneCount,
  finished,
  setChar,
  drop,
  move,
  applyTransform,
  removeSelected,
  clear,
} = usePuzzle({ snap: true });

const pouchOpen = ref(false);
const index = ref(0);
const rejectTick = ref(0);
const rejectHint = ref('');
const grid = ref<{ hitTest: (x: number, y: number) => { x: number; y: number; inside: boolean } | null } | null>(
  null
);

const chars = computed(() => books.activeChars.filter(canPlay));
const current = computed(() => chars.value[index.value] ?? '');

async function loadCurrent() {
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
watch(finished, (ok) => {
  if (ok) celebrateStars();
});

function step(delta: number) {
  if (!chars.value.length) return;
  index.value = (index.value + delta + chars.value.length) % chars.value.length;
}

function onToolDrop(payload: { strokeId: StrokeId; variantKey?: string; clientX: number; clientY: number }) {
  const hit = grid.value?.hitTest(payload.clientX, payload.clientY);
  if (!hit?.inside) return;

  const placed = drop(payload.strokeId, hit.x, hit.y, payload.variantKey);
  if (placed.ok) {
    rejectHint.value = '';
    return;
  }
  rejectTick.value += 1;
  rejectHint.value =
    placed.reason === 'kind'
      ? '不是這一件，換一個再拖進來。'
      : placed.reason === 'pos'
        ? '拖到這一筆所在的位置才會黏住。'
        : '這一筆已經拼好了。';
}

const nextStrokeLabel = computed(() => {
  const id = enabledOnly.value;
  return id ? `${STROKE_BY_ID[id].name}（${STROKE_BY_ID[id].objectName}）` : '全部拼完了';
});

const mascotMessage = computed(() => {
  if (rejectHint.value) return rejectHint.value;
  if (finished.value) return `「${current.value}」拼好了，再看一次筆順動畫吧。`;
  return '依筆順，把物品拖到那一筆所在的位置；種類、位置、順序都對才會黏住。';
});

const ghostPaths = computed(() => (settings.state.ghost && data.value ? inkStrokePaths(data.value) : []));
</script>

<template>
  <div class="page">
    <header class="page-head wrap">
      <button class="btn btn-ghost btn-sm" @click="router.push('/')">← 回首頁</button>
      <h1>練習模式</h1>
      <button class="btn btn-butter btn-sm" @click="pouchOpen = true">🎒 錦囊</button>
    </header>

    <div class="page-body wrap">
      <MascotHint :mood="finished ? 'cheer' : rejectHint ? 'retry' : 'idle'" :message="mascotMessage" />
      <div v-if="!chars.length" class="card">
        <p class="hint">字簿「{{ books.active?.name ?? '未選擇' }}」裡還沒有字。請老師在設定裡貼生字。</p>
      </div>

      <div v-else class="play">
        <div class="stack">
          <CharCard
            v-if="data"
            :data="data"
            :done-count="doneCount"
            :show-stroke-list="true"
          />
          <p v-else-if="loading" class="card hint">正在取筆順資料…</p>
          <p v-else-if="error" class="card hint">{{ error }}</p>
        </div>

        <div class="play-center">
          <MiZiGrid
            ref="grid"
            :pieces="pieces"
            :slots="slots"
            :next-slot-index="nextSlotIndex"
            :show-slots="true"
            :ghost-paths="ghostPaths"
            :selected-id="selectedId"
            :popped-id="poppedId"
            :reject-tick="rejectTick"
            @move="move($event.id, $event.x, $event.y)"
            @select="selectedId = $event"
            @transform="applyTransform"
            @delete="removeSelected()"
          />

          <ObjectToolbar
            :available="available"
            :hint-id="enabledOnly"
            :has-selection="!!selectedId"
            @drop="onToolDrop"
            @delete="removeSelected()"
            @clear="clear()"
          />

          <p class="hint" style="text-align: center">
            從下面拖到那一筆的位置。種類、位置、順序都對才會黏住。
          </p>
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
            <div class="tool-divider" />
            <p class="hint">
              <strong>第 {{ Math.min(doneCount + 1, slots.length) }} 筆</strong>：{{ nextStrokeLabel }}
            </p>
            <p v-if="rejectHint" class="hint" style="color: var(--peach-deep); margin-top: 6px">{{ rejectHint }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="pouchOpen" class="overlay" @click.self="pouchOpen = false">
      <div class="overlay-card">
        <div class="overlay-head">
          <h2>🎒 錦囊 · 筆畫與物品對照</h2>
          <button class="btn btn-ghost btn-sm" @click="pouchOpen = false">關閉</button>
        </div>
        <StrokePouch :highlight="available" />
      </div>
    </div>
  </div>
</template>
