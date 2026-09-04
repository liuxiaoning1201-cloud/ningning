<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import { strokeImage } from '@/data/strokes';
import { pieceLayer, renderRotation } from '@/lib/strokeMetrics';
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
  /** 拖錯時閃一下 */
  rejectTick?: number;
}>();

const emit = defineEmits<{
  (e: 'move', payload: { id: string; x: number; y: number }): void;
  (e: 'select', id: string | null): void;
  (e: 'transform', payload: { id: string; scale?: number; scaleY?: number; rot?: number }): void;
  (e: 'delete'): void;
}>();

type Drag =
  | { kind: 'move'; id: string }
  | {
      kind: 'resize';
      id: string;
      mode: 'se' | 'ne' | 'sw' | 'nw' | 'e' | 's';
      startDist: number;
      startW: number;
      startH: number;
    }
  | { kind: 'rotate'; id: string; startAngle: number; startRot: number };

const frame = ref<HTMLElement | null>(null);
const drag = ref<Drag | null>(null);

function toLocal(event: PointerEvent | DragEvent): { x: number; y: number } | null {
  const el = frame.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  };
}

function pieceBox(piece: Piece) {
  const w = piece.scale;
  const h = piece.scaleY ?? piece.scale;
  return { w, h, area: w * h };
}

function containsPoint(piece: Piece, x: number, y: number) {
  const { w, h } = pieceBox(piece);
  return x >= piece.x - w / 2 && x <= piece.x + w / 2 && y >= piece.y - h / 2 && y <= piece.y + h / 2;
}

function pickPieceAt(x: number, y: number): Piece | null {
  const hits = props.pieces.filter((piece) => containsPoint(piece, x, y));
  if (!hits.length) return null;
  hits.sort((a, b) => {
    const areaA = pieceBox(a).area;
    const areaB = pieceBox(b).area;
    if (Math.abs(areaA - areaB) > 0.002) return areaA - areaB;
    const da = Math.hypot(a.x - x, a.y - y);
    const db = Math.hypot(b.x - x, b.y - y);
    return da - db;
  });
  return hits[0];
}

function pointerAngle(piece: Piece, local: { x: number; y: number }) {
  return (Math.atan2(local.y - piece.y, local.x - piece.x) * 180) / Math.PI;
}

function clampSize(n: number) {
  return Math.min(1.08, Math.max(0.05, n));
}

function onFramePointerDown(event: PointerEvent) {
  if (props.readonly) return;
  const local = toLocal(event);
  if (!local) return;
  const hit = pickPieceAt(local.x, local.y);
  if (!hit) {
    emit('select', null);
    return;
  }
  emit('select', hit.id);
  drag.value = { kind: 'move', id: hit.id };
  frame.value?.setPointerCapture(event.pointerId);
}

function startResize(event: PointerEvent, mode: 'se' | 'ne' | 'sw' | 'nw' | 'e' | 's') {
  event.stopPropagation();
  const piece = selectedPiece.value;
  const local = toLocal(event);
  if (!piece || !local) return;
  const { w, h } = pieceBox(piece);
  drag.value = {
    kind: 'resize',
    id: piece.id,
    mode,
    startDist: Math.hypot(local.x - piece.x, local.y - piece.y) || 0.04,
    startW: w,
    startH: h,
  };
  frame.value?.setPointerCapture(event.pointerId);
}

function startRotate(event: PointerEvent) {
  event.stopPropagation();
  const piece = selectedPiece.value;
  const local = toLocal(event);
  if (!piece || !local || piece.strokeId === 'dian') return;
  drag.value = {
    kind: 'rotate',
    id: piece.id,
    startAngle: pointerAngle(piece, local),
    startRot: piece.rot,
  };
  frame.value?.setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  const current = drag.value;
  if (!current) return;
  const local = toLocal(event);
  if (!local) return;
  if (current.kind === 'move') {
    emit('move', {
      id: current.id,
      x: Math.min(1, Math.max(0, local.x)),
      y: Math.min(1, Math.max(0, local.y)),
    });
    return;
  }
  const piece = props.pieces.find((p) => p.id === current.id);
  if (!piece) return;
  if (current.kind === 'rotate') {
    const ang = pointerAngle(piece, local);
    emit('transform', { id: piece.id, rot: current.startRot + (ang - current.startAngle) });
    return;
  }
  if (current.mode === 'e') {
    emit('transform', {
      id: piece.id,
      scale: clampSize(Math.abs(local.x - piece.x) * 2),
      scaleY: current.startH,
    });
    return;
  }
  if (current.mode === 's') {
    emit('transform', {
      id: piece.id,
      scale: current.startW,
      scaleY: clampSize(Math.abs(local.y - piece.y) * 2),
    });
    return;
  }
  const dist = Math.hypot(local.x - piece.x, local.y - piece.y);
  const factor = dist / current.startDist;
  emit('transform', {
    id: piece.id,
    scale: clampSize(current.startW * factor),
    scaleY: clampSize(current.startH * factor),
  });
}

function onPointerUp() {
  drag.value = null;
}

function hitTest(clientX: number, clientY: number): { x: number; y: number; inside: boolean } | null {
  const el = frame.value;
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width;
  const y = (clientY - rect.top) / rect.height;
  return { x, y, inside: x >= 0 && x <= 1 && y >= 0 && y <= 1 };
}

defineExpose({ hitTest });

const rejecting = ref(false);
watch(
  () => props.rejectTick,
  (tick) => {
    if (!tick) return;
    rejecting.value = true;
    window.setTimeout(() => {
      rejecting.value = false;
    }, 420);
  }
);

const selectedPiece = computed(() => props.pieces.find((p) => p.id === props.selectedId) ?? null);

const xfStyle = computed(() => {
  const piece = selectedPiece.value;
  if (!piece) return {};
  const { w, h } = pieceBox(piece);
  return {
    left: `${(piece.x - w / 2) * 100}%`,
    top: `${(piece.y - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
  };
});

const ghostViewBox = '0 0 1024 1024';
const ghostTransform = 'translate(0, 900) scale(1, -1)';

const slotStyle = (slot: StrokeSlot) => {
  const w = slot.width || Math.max(slot.extent, 0.14);
  const h = slot.height || Math.max(slot.extent, 0.14);
  return {
    left: `${(slot.cx - w / 2) * 100}%`,
    top: `${(slot.cy - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
  };
};

const pieceWrapStyle = (piece: Piece) => {
  const w = piece.scale;
  const h = piece.scaleY ?? piece.scale;
  return {
    left: `${(piece.x - w / 2) * 100}%`,
    top: `${(piece.y - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    zIndex: pieceLayer(piece.strokeId, piece.slotIndex ?? piece.seq) + (piece.id === props.selectedId ? 50 : 0),
  };
};

const pieceImgStyle = (piece: Piece) => {
  if (piece.strokeId === 'dian') return { transform: 'none' };
  return {
    transform: `rotate(${renderRotation(piece.strokeId, piece.rot, piece.variantKey)}deg)`,
  };
};

const sortedPieces = computed(() => [...props.pieces].sort((a, b) => a.seq - b.seq));
</script>

<template>
  <div
    ref="frame"
    class="grid-frame"
    :class="{ 'is-reject': rejecting }"
    @pointerdown="onFramePointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
  >
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

    <div
      v-for="piece in sortedPieces"
      :key="piece.id"
      class="piece-wrap"
      :class="{
        'is-dian': piece.strokeId === 'dian',
        'just-placed': piece.id === poppedId,
        'is-dim': piece.id !== selectedId,
      }"
      :style="pieceWrapStyle(piece)"
    >
      <img
        class="piece"
        :class="{
          'is-selected': piece.id === selectedId,
          'is-dragging': drag?.kind === 'move' && drag.id === piece.id,
          'is-locked': readonly,
        }"
        :style="pieceImgStyle(piece)"
        :src="strokeImage(piece.strokeId, piece.variantKey)"
        :alt="piece.strokeId"
        draggable="false"
      />
    </div>

    <div v-if="selectedPiece && !readonly" class="xf" :style="xfStyle" @pointerdown.stop>
      <button
        class="xf-del"
        type="button"
        title="拿走"
        @click.stop="emit('delete')"
        @pointerdown.stop
      >
        ×
      </button>
      <button
        v-if="selectedPiece.strokeId !== 'dian'"
        class="xf-rot"
        type="button"
        title="拖動來轉角度"
        @pointerdown="startRotate"
      />
      <button class="xf-h xf-nw" type="button" title="等比例縮放" @pointerdown="startResize($event, 'nw')" />
      <button class="xf-h xf-ne" type="button" title="等比例縮放" @pointerdown="startResize($event, 'ne')" />
      <button class="xf-h xf-sw" type="button" title="等比例縮放" @pointerdown="startResize($event, 'sw')" />
      <button class="xf-h xf-se" type="button" title="等比例縮放" @pointerdown="startResize($event, 'se')" />
      <button class="xf-h xf-e" type="button" title="拉寬" @pointerdown="startResize($event, 'e')" />
      <button class="xf-h xf-s" type="button" title="拉高" @pointerdown="startResize($event, 's')" />
    </div>
  </div>
</template>
