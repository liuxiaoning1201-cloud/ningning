<script setup lang="ts">
import { computed, ref } from 'vue';

import { strokeImage } from '@/data/strokes';
import { TOLERANCE } from '@/lib/geometry';
import type { Piece, StrokeSlot } from '@/types';

const props = defineProps<{
  pieces: Piece[];
  slots?: StrokeSlot[];
  /** 練習模式：下一筆該填的槽位，會亮起來 */
  nextSlotIndex?: number | null;
  /** 顯示槽位虛線提示 */
  showSlots?: boolean;
  /** 淡淡的字影底稿，由每一筆的 SVG path 疊成 */
  ghostPaths?: string[];
  selectedId?: string | null;
  /** 唯讀：對戰的猜題方只看不動 */
  readonly?: boolean;
  /** 剛放好、要彈一下的物件 */
  poppedId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'move', payload: { id: string; x: number; y: number }): void;
  (e: 'select', id: string | null): void;
  (e: 'drop-new', payload: { x: number; y: number }): void;
}>();

const frame = ref<HTMLElement | null>(null);
const draggingId = ref<string | null>(null);

/** 事件座標 → 米字格內的 0–1 正規化座標。 */
function toLocal(event: PointerEvent | DragEvent): { x: number; y: number } | null {
  const el = frame.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function onPiecePointerDown(event: PointerEvent, piece: Piece) {
  if (props.readonly) return;
  event.stopPropagation();
  emit('select', piece.id);
  draggingId.value = piece.id;
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!draggingId.value) return;
  const local = toLocal(event);
  if (!local) return;
  emit('move', {
    id: draggingId.value,
    x: Math.min(1, Math.max(0, local.x)),
    y: Math.min(1, Math.max(0, local.y)),
  });
}

function onPointerUp() {
  draggingId.value = null;
}

function onFramePointerDown() {
  if (props.readonly) return;
  emit('select', null);
}

function onDrop(event: DragEvent) {
  if (props.readonly) return;
  event.preventDefault();
  const local = toLocal(event);
  if (!local) return;
  emit('drop-new', local);
}

const ghostViewBox = '0 0 1024 1024';

/** makemeahanzi 座標系要翻 y 才能疊在格子上。 */
const ghostTransform = 'translate(0, 900) scale(1, -1)';

const slotStyle = (slot: StrokeSlot) => {
  const size = TOLERANCE.distance * 2;
  return {
    left: `${(slot.cx - size / 2) * 100}%`,
    top: `${(slot.cy - size / 2) * 100}%`,
    width: `${size * 100}%`,
    height: `${size * 100}%`,
  };
};

const pieceStyle = (piece: Piece) => ({
  left: `${(piece.x - piece.scale / 2) * 100}%`,
  top: `${(piece.y - piece.scale / 2) * 100}%`,
  width: `${piece.scale * 100}%`,
  height: `${piece.scale * 100}%`,
  transform: `rotate(${piece.rot}deg)`,
  zIndex: piece.seq + 2,
});

const sortedPieces = computed(() => [...props.pieces].sort((a, b) => a.seq - b.seq));
</script>

<template>
  <div
    ref="frame"
    class="grid-frame"
    @pointerdown="onFramePointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dragover.prevent
    @drop="onDrop"
  >
    <!-- 米字格：外框、田字十字、再加兩條斜線 -->
    <svg class="grid-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <rect x="1" y="1" width="98" height="98" fill="none" stroke="var(--grid-line)" stroke-width="1.2" />
      <line x1="50" y1="1" x2="50" y2="99" stroke="var(--grid-guide)" stroke-width="0.8" stroke-dasharray="4 3" />
      <line x1="1" y1="50" x2="99" y2="50" stroke="var(--grid-guide)" stroke-width="0.8" stroke-dasharray="4 3" />
      <line x1="1" y1="1" x2="99" y2="99" stroke="var(--grid-guide)" stroke-width="0.6" stroke-dasharray="4 3" />
      <line x1="99" y1="1" x2="1" y2="99" stroke="var(--grid-guide)" stroke-width="0.6" stroke-dasharray="4 3" />
    </svg>

    <svg
      v-if="ghostPaths?.length"
      class="grid-ghost"
      :viewBox="ghostViewBox"
      style="inset: 0; width: 100%; height: 100%"
      aria-hidden="true"
    >
      <g :transform="ghostTransform">
        <path v-for="(d, i) in ghostPaths" :key="i" :d="d" fill="var(--ink)" />
      </g>
    </svg>

    <div
      v-for="slot in showSlots ? slots ?? [] : []"
      :key="`slot-${slot.index}`"
      class="grid-slot"
      :class="{ 'is-next': slot.index === nextSlotIndex }"
      :style="slotStyle(slot)"
    />

    <img
      v-for="piece in sortedPieces"
      :key="piece.id"
      class="piece"
      :class="{
        'is-selected': piece.id === selectedId,
        'is-dragging': piece.id === draggingId,
        'is-locked': readonly,
        'just-placed': piece.id === poppedId,
      }"
      :style="pieceStyle(piece)"
      :src="strokeImage(piece.strokeId, piece.variantKey)"
      :alt="piece.strokeId"
      draggable="false"
      @pointerdown="onPiecePointerDown($event, piece)"
    />
  </div>
</template>
