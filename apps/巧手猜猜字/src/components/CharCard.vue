<script setup lang="ts">
import HanziWriter from 'hanzi-writer';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { STROKE_BY_ID, strokeImage, strokeName } from '@/data/strokes';
import type { CharData } from '@/types';

const props = defineProps<{
  data: CharData;
  /** 已完成的筆數，用來標示筆順清單 */
  doneCount?: number;
  /** 顯示逐筆的物品清單。挑戰模式要藏起來，否則等於送答案 */
  showStrokeList?: boolean;
}>();

const stage = ref<HTMLElement | null>(null);
const listBox = ref<HTMLElement | null>(null);
let writer: HanziWriter | null = null;

/**
 * 用自己的資料餵 hanzi-writer，不讓它去 CDN 抓內地筆順。
 * charDataLoader 直接回傳我們已經挑好來源的 strokes 與 medians。
 */
function mount() {
  const el = stage.value;
  if (!el) return;
  el.innerHTML = '';
  const size = el.clientWidth || 200;

  writer = HanziWriter.create(el, props.data.char, {
    width: size,
    height: size,
    padding: 8,
    showCharacter: false,
    showOutline: true,
    strokeColor: '#33403a',
    outlineColor: '#d8cdb4',
    radicalColor: '#5da648',
    strokeAnimationSpeed: 1,
    delayBetweenStrokes: 320,
    charDataLoader: () => ({
      strokes: props.data.strokes,
      medians: props.data.medians,
    }),
  });
  writer.animateCharacter();
}

function replay() {
  writer?.animateCharacter();
}

watch(
  () => props.data.char,
  () => mount(),
  { immediate: false }
);

watch(stage, (el) => {
  if (el) mount();
});

watch(
  () => props.doneCount,
  async () => {
    await nextTick();
    const box = listBox.value;
    const next = box?.querySelector<HTMLElement>('.is-next');
    if (!box || !next) return;
    const delta =
      next.getBoundingClientRect().top -
      box.getBoundingClientRect().top -
      box.clientHeight / 2 +
      next.getBoundingClientRect().height / 2;
    box.scrollBy({ top: delta, behavior: 'smooth' });
  }
);

onBeforeUnmount(() => {
  writer = null;
});
</script>

<template>
  <div class="charcard">
    <div class="card-title">
      <span>{{ data.char }} 的筆順</span>
    </div>

    <div ref="stage" class="charcard-stage" role="button" tabindex="0" @click="replay" @keyup.enter="replay" />
    <p class="charcard-hint">點一下字，再看一次筆順</p>
    <p class="charcard-hint">筆順依開源 animCJK 繁體（香港教育局字詞表為參考來源）</p>

    <div v-if="showStrokeList" ref="listBox" class="stroke-list-box">
      <ol class="stroke-list">
        <li
          v-for="(id, i) in data.strokeTypes"
          :key="i"
          :class="{ 'is-done': i < (doneCount ?? 0), 'is-next': i === (doneCount ?? 0) }"
        >
          <span class="idx">{{ i + 1 }}</span>
          <img v-if="id" :src="strokeImage(id)" :alt="STROKE_BY_ID[id].objectName" />
          <span>{{ strokeName(id) }}</span>
          <span v-if="id" style="color: var(--ink-faint)">{{ STROKE_BY_ID[id].objectName }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>
