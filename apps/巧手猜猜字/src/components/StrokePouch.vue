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
const stage = ref<0 | 1 | 2 | 3 | 4>(0);

const list = computed<StrokeDef[]>(() => {
  let items: StrokeDef[] =
    filter.value === 'basic' ? BASIC_STROKES : filter.value === 'compound' ? COMPOUND_STROKES : [...BASIC_STROKES, ...COMPOUND_STROKES];
  if (stage.value !== 0) items = items.filter((s) => s.stage <= stage.value);
  return items;
});

const isHighlighted = (id: string) => !props.highlight?.length || props.highlight.includes(id);
</script>

<template>
  <div>
    <div class="atlas-tabs">
      <button class="btn btn-sm" :class="filter === 'all' ? 'btn-sky' : 'btn-ghost'" @click="filter = 'all'">
        全部 23 件
      </button>
      <button class="btn btn-sm" :class="filter === 'basic' ? 'btn-sky' : 'btn-ghost'" @click="filter = 'basic'">
        基本 6 件
      </button>
      <button class="btn btn-sm" :class="filter === 'compound' ? 'btn-sky' : 'btn-ghost'" @click="filter = 'compound'">
        複合 17 件
      </button>
      <span style="flex: 1" />
      <select v-model.number="stage" class="select" style="width: auto">
        <option :value="0">不限年級</option>
        <option :value="1">小一可用</option>
        <option :value="2">小二可用</option>
        <option :value="3">小三可用</option>
        <option :value="4">小四可用</option>
      </select>
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
        <div v-if="!compact" class="atlas-examples">小{{ s.stage }}起</div>
      </div>
    </div>

    <p v-if="!compact" class="hint" style="margin-top: 14px">
      一筆一物、一物一筆：一件物品終身只代表一個筆畫。帶鈎的幾筆靠材質分辨——雨傘是布、屋簷是瓦、長靴是皮、衣帽鈎是金屬、耳機是塑膠、豆芽是植物、湯匙是餐具。
      平撇、直撇、平捺、左頓點、右頓點沿用母筆畫同一件物品，只改擺放角度。
    </p>
  </div>
</template>
