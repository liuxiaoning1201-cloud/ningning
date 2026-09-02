<script setup lang="ts">
import { computed, ref } from 'vue';

import { BASIC_STROKES, COMPOUND_STROKES, strokeImage } from '@/data/strokes';
import type { StrokeDef } from '@/types';

/**
 * 筆畫圖鑑。同一個元件同時當首頁的「筆畫圖鑑」與遊戲中右上角的「錦囊」，
 * 兩邊看到的對照永遠一致。
 */
const props = defineProps<{
  /** 只highlight這個字用得到的物件 */
  highlight?: string[];
  compact?: boolean;
}>();

type Filter = 'all' | 'basic' | 'compound';
const filter = ref<Filter>('all');

const list = computed<StrokeDef[]>(() =>
  filter.value === 'basic' ? BASIC_STROKES : filter.value === 'compound' ? COMPOUND_STROKES : [...BASIC_STROKES, ...COMPOUND_STROKES]
);

const isHighlighted = (id: string) => !props.highlight?.length || props.highlight.includes(id);
</script>

<template>
  <div>
    <div class="atlas-tabs">
      <button class="btn btn-sm" :class="filter === 'all' ? 'btn-sky' : 'btn-ghost'" @click="filter = 'all'">
        全部 24 件
      </button>
      <button class="btn btn-sm" :class="filter === 'basic' ? 'btn-sky' : 'btn-ghost'" @click="filter = 'basic'">
        基本 6 件
      </button>
      <button class="btn btn-sm" :class="filter === 'compound' ? 'btn-sky' : 'btn-ghost'" @click="filter = 'compound'">
        複合 18 件
      </button>
    </div>

    <div class="atlas-grid">
      <div
        v-for="s in list"
        :key="s.id"
        class="atlas-item"
        :style="{ opacity: isHighlighted(s.id) ? 1 : 0.34 }"
      >
        <img class="atlas-img" :src="strokeImage(s.id)" :alt="s.objectName" />
        <div class="atlas-shape">{{ s.shape }}</div>
        <div class="atlas-name">{{ s.name }}</div>
        <div class="atlas-object">{{ s.objectName }}</div>
        <div v-if="!compact" class="atlas-examples">字例：{{ s.examples.join('、') }}</div>
      </div>
    </div>
  </div>
</template>
