<script setup lang="ts">
import { computed } from 'vue';

import { STROKE_BY_ID, objectUrl, strokeImage } from '@/data/strokes';
import type { StrokeId } from '@/types';

const props = defineProps<{
  /** 工具欄只發這個字用得到的物件，其餘留在錦囊 */
  available: StrokeId[];
  /** 練習模式鎖筆順：只有這一筆可以拿 */
  enabledOnly?: StrokeId | null;
  /** 目前選中的物件，旋轉與縮放按鈕作用在它身上 */
  hasSelection?: boolean;
}>();

const emit = defineEmits<{
  (e: 'take', payload: { strokeId: StrokeId; variantKey?: string }): void;
  (e: 'rotate', deg: number): void;
  (e: 'scale', factor: number): void;
  (e: 'delete'): void;
  (e: 'clear'): void;
}>();

const items = computed(() =>
  props.available.map((id) => {
    const def = STROKE_BY_ID[id];
    return {
      id,
      def,
      disabled: props.enabledOnly ? props.enabledOnly !== id : false,
    };
  })
);

/** 點的三個朝向攤平出來，省得學生為了三點水一直按旋轉。 */
const dianVariants = computed(() => {
  if (!props.available.includes('dian')) return [];
  return STROKE_BY_ID.dian.variants ?? [];
});
</script>

<template>
  <div class="toolbar">
    <div class="tool-row">
      <button
        v-for="item in items"
        :key="item.id"
        class="tool-item"
        :disabled="item.disabled"
        :title="item.def.hint"
        @click="emit('take', { strokeId: item.id })"
      >
        <img :src="strokeImage(item.id)" :alt="item.def.objectName" />
        <span class="tool-label">{{ item.def.name }}</span>
      </button>
    </div>

    <template v-if="dianVariants.length">
      <div class="tool-divider" />
      <div class="tool-row">
        <button
          v-for="variant in dianVariants"
          :key="variant.key"
          class="tool-item"
          :disabled="enabledOnly ? enabledOnly !== 'dian' : false"
          :title="`點 · ${variant.label}`"
          @click="emit('take', { strokeId: 'dian', variantKey: variant.key })"
        >
          <img :src="objectUrl(variant.image)" :alt="`點 ${variant.label}`" />
          <span class="tool-label">點 {{ variant.label }}</span>
        </button>
      </div>
    </template>

    <div class="tool-divider" />

    <div class="tool-actions">
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="向左轉 15 度" @click="emit('rotate', -15)">
        ↺
      </button>
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="向右轉 15 度" @click="emit('rotate', 15)">
        ↻
      </button>
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="縮小" @click="emit('scale', 0.88)">
        －
      </button>
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="放大" @click="emit('scale', 1.14)">
        ＋
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="!hasSelection" @click="emit('delete')">拿走這件</button>
      <button class="btn btn-ghost btn-sm" @click="emit('clear')">全部清空</button>
    </div>
  </div>
</template>
