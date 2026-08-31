<script setup lang="ts">
import { computed, ref } from 'vue';

import { STROKE_BY_ID, objectUrl, strokeImage } from '@/data/strokes';
import type { StrokeId } from '@/types';

const props = defineProps<{
  /** 這個字用得到的物件，其餘留在錦囊 */
  available: StrokeId[];
  /** 練習模式：當前該寫的那一筆，只作提示，不鎖死其他工具 */
  hintId?: StrokeId | null;
  /** 目前選中的物件，旋轉與縮放按鈕作用在它身上 */
  hasSelection?: boolean;
}>();

const emit = defineEmits<{
  (e: 'drop', payload: { strokeId: StrokeId; variantKey?: string; clientX: number; clientY: number }): void;
  (e: 'rotate', deg: number): void;
  (e: 'scale', factor: number): void;
  (e: 'delete'): void;
  (e: 'clear'): void;
}>();

const items = computed(() =>
  props.available.map((id) => ({
    id,
    def: STROKE_BY_ID[id],
    hint: props.hintId === id,
  }))
);

const dianVariants = computed(() => {
  if (!props.available.includes('dian')) return [];
  return STROKE_BY_ID.dian.variants ?? [];
});

const ghost = ref<{ x: number; y: number; src: string } | null>(null);
let drag: { strokeId: StrokeId; variantKey?: string; pointerId: number } | null = null;

function startDrag(event: PointerEvent, strokeId: StrokeId, variantKey?: string) {
  event.preventDefault();
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  drag = { strokeId, variantKey, pointerId: event.pointerId };
  ghost.value = {
    x: event.clientX,
    y: event.clientY,
    src: strokeImage(strokeId, variantKey),
  };
}

function moveDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId || !ghost.value) return;
  ghost.value = { ...ghost.value, x: event.clientX, y: event.clientY };
}

function endDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const payload = {
    strokeId: drag.strokeId,
    variantKey: drag.variantKey,
    clientX: event.clientX,
    clientY: event.clientY,
  };
  drag = null;
  ghost.value = null;
  emit('drop', payload);
}
</script>

<template>
  <div class="toolbar">
    <!-- 調整鈕永遠貼在格子底下，不要跟一排工具擠到最下面 -->
    <div class="tool-actions">
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="向左轉 15 度" @click="emit('rotate', -15)">
        ↺
      </button>
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="向右轉 15 度" @click="emit('rotate', 15)">
        ↻
      </button>
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="縮小" @click="emit('scale', 0.82)">
        －
      </button>
      <button class="btn btn-ghost btn-icon" :disabled="!hasSelection" title="放大" @click="emit('scale', 1.18)">
        ＋
      </button>
      <button class="btn btn-ghost btn-sm" :disabled="!hasSelection" @click="emit('delete')">拿走</button>
      <button class="btn btn-ghost btn-sm" @click="emit('clear')">清空</button>
    </div>

    <div class="tool-grid">
      <button
        v-for="item in items"
        :key="item.id"
        class="tool-item"
        :class="{ 'is-hint': item.hint }"
        :title="`${item.def.name}＝${item.def.objectName}。拖進米字格`"
        @pointerdown="startDrag($event, item.id)"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <img :src="strokeImage(item.id)" :alt="item.def.objectName" />
        <span class="tool-label">{{ item.def.name }}</span>
      </button>

      <button
        v-for="variant in dianVariants"
        :key="variant.key"
        class="tool-item"
        :class="{ 'is-hint': hintId === 'dian' }"
        :title="`點 · ${variant.label}`"
        @pointerdown="startDrag($event, 'dian', variant.key)"
        @pointermove="moveDrag"
        @pointerup="endDrag"
        @pointercancel="endDrag"
      >
        <img :src="objectUrl(variant.image)" :alt="`點 ${variant.label}`" />
        <span class="tool-label">點 {{ variant.label }}</span>
      </button>
    </div>
  </div>

  <img
    v-if="ghost"
    class="drag-ghost"
    :src="ghost.src"
    alt=""
    :style="{ left: `${ghost.x}px`, top: `${ghost.y}px` }"
  />
</template>
