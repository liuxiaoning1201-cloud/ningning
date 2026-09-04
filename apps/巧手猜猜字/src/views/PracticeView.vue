<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import CharCard from '@/components/CharCard.vue';
import MascotHint from '@/components/MascotHint.vue';
import MiZiGrid from '@/components/MiZiGrid.vue';
import ObjectToolbar from '@/components/ObjectToolbar.vue';
import StrokePouch from '@/components/StrokePouch.vue';
import { usePuzzle } from '@/composables/usePuzzle';
import { STROKE_BY_ID, strokeImage } from '@/data/strokes';
import { readiness } from '@/lib/charData';
import { useSettings } from '@/stores/settings';
import { useWordbooks } from '@/stores/wordbooks';

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
  take,
  move,
  rotate,
  scale,
  removeSelected,
  clear,
} = usePuzzle({ snap: true });

const pouchOpen = ref(false);
const index = ref(0);

/** 練習模式只收已核對的字：沒有筆畫標註就沒法鎖筆順。 */
const chars = computed(() => books.activeChars.filter((c) => readiness(c) === 'ready'));
const current = computed(() => chars.value[index.value] ?? '');

async function loadCurrent() {
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

const nextStrokeLabel = computed(() => {
  const id = enabledOnly.value;
  return id ? `${STROKE_BY_ID[id].name}（${STROKE_BY_ID[id].objectName}）` : '全部拼完了';
});

const mascotMessage = computed(() =>
  finished.value
    ? `「${current.value}」拼好了，再看一次筆順動畫吧。`
    : '照著亮起來的位置放，順序不會錯。'
);

const ghostPaths = computed(() => (settings.state.ghost && data.value ? data.value.strokes : []));
</script>

<template>
  <div class="page">
    <header class="page-head wrap">
      <button class="btn btn-ghost btn-sm" @click="router.push('/')">← 回首頁</button>
      <h1>練習模式</h1>
      <button class="btn btn-butter btn-sm" @click="pouchOpen = true">🎒 錦囊</button>
    </header>

    <div class="page-body wrap">
      <div v-if="!chars.length" class="card">
        <p class="hint">
          字簿「{{ books.active?.name ?? '未選擇' }}」裡沒有已核對筆順的字。練習模式要鎖筆順，只能用已核對的字。
        </p>
        <button class="btn btn-sky btn-sm" style="margin-top: 10px" @click="router.push('/teacher')">去選字</button>
      </div>

      <div v-else class="play">
        <!-- 左欄：進度、物品清單、顯示選項 -->
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
          </div>

          <div class="card">
            <div class="card-title">這個字用到的物品</div>
            <div class="tool-row">
              <div v-for="id in available" :key="id" style="width: 72px; text-align: center">
                <img
                  :src="strokeImage(id)"
                  :alt="STROKE_BY_ID[id].objectName"
                  style="width: 44px; height: 44px; object-fit: contain"
                />
                <div class="tool-label">{{ STROKE_BY_ID[id].name }}</div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-title">顯示</div>
            <label class="row" style="cursor: pointer">
              <input v-model="settings.state.ghost" type="checkbox" />
              <span class="hint">格子裡顯示淡淡的字影</span>
            </label>
            <label class="row" style="cursor: pointer; margin-top: 8px">
              <input v-model="settings.state.mascot" type="checkbox" />
              <span class="hint">顯示檸檬茶小精靈</span>
            </label>
          </div>
        </div>

        <!-- 中欄：米字格與工具欄 -->
        <div class="play-center">
          <MiZiGrid
            :pieces="pieces"
            :slots="slots"
            :next-slot-index="nextSlotIndex"
            :show-slots="true"
            :ghost-paths="ghostPaths"
            :selected-id="selectedId"
            :popped-id="poppedId"
            @move="move($event.id, $event.x, $event.y)"
            @select="selectedId = $event"
          />

          <ObjectToolbar
            :available="available"
            :enabled-only="enabledOnly"
            :has-selection="!!selectedId"
            @take="take($event.strokeId, $event.variantKey)"
            @rotate="rotate($event)"
            @scale="scale($event)"
            @delete="removeSelected()"
            @clear="clear()"
          />

          <p class="hint" style="text-align: center">
            工具欄只亮出「現在該寫的那一筆」，放下去會自動吸到正確位置與角度。
          </p>
        </div>

        <!-- 右欄：字卡與筆順動畫 -->
        <div class="stack">
          <CharCard v-if="data" :data="data" :done-count="doneCount" :show-stroke-list="true" />
          <p v-else-if="loading" class="card hint">正在取筆順資料…</p>
          <p v-else-if="error" class="card hint">{{ error }}</p>
        </div>
      </div>
    </div>

    <MascotHint :mood="finished ? 'cheer' : 'idle'" :message="mascotMessage" />

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
