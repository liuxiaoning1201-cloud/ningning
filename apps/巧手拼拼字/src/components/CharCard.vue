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
  /** 老師可點清單改物品 */
  editable?: boolean;
  /** 老師改過、已被鎖定的筆畫索引 */
  lockedIndexes?: number[];
}>();

const emit = defineEmits<{
  revise: [index: number];
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
  () => [props.data.char, props.data.strokes.length] as const,
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

    <div class="charcard-stage-wrap">
      <div ref="stage" class="charcard-stage" />
      <button class="charcard-play" type="button" title="再看一次筆順" aria-label="再看一次筆順" @click="replay">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="12" fill="currentColor" />
          <path
            d="M10 8.2c0-.7.8-1.1 1.4-.7l6.1 3.8c.6.4.6 1.2 0 1.6l-6.1 3.8c-.6.4-1.4 0-1.4-.7V8.2Z"
            fill="#fff"
          />
        </svg>
      </button>
    </div>
    <p class="charcard-hint">
      筆順依香港《小學學習字詞表》／《常用字字形表》
      <template v-if="editable">。點清單可改這一筆的物品。</template>
    </p>

    <div v-if="showStrokeList" ref="listBox" class="stroke-list-box">
      <ol class="stroke-list">
        <li
          v-for="(id, i) in data.strokeTypes"
          :key="i"
          :class="{
            'is-done': i < (doneCount ?? 0),
            'is-next': i === (doneCount ?? 0),
            'is-locked': lockedIndexes?.includes(i),
            'is-edit': editable,
          }"
        >
          <button
            v-if="editable"
            class="stroke-list-btn"
            type="button"
            :title="`改第 ${i + 1} 筆`"
            @click="emit('revise', i)"
          >
            <span class="idx">{{ i + 1 }}</span>
            <img v-if="id" :src="strokeImage(id)" :alt="STROKE_BY_ID[id].objectName" />
            <span>{{ strokeName(id) }}</span>
            <span v-if="id" style="color: var(--ink-faint)">{{ STROKE_BY_ID[id].objectName }}</span>
            <span v-if="lockedIndexes?.includes(i)" class="pill pill-ready">已改</span>
          </button>
          <template v-else>
            <span class="idx">{{ i + 1 }}</span>
            <img v-if="id" :src="strokeImage(id)" :alt="STROKE_BY_ID[id].objectName" />
            <span>{{ strokeName(id) }}</span>
            <span v-if="id" style="color: var(--ink-faint)">{{ STROKE_BY_ID[id].objectName }}</span>
          </template>
        </li>
      </ol>
    </div>
  </div>
</template>
