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
  (e: 'rotate', deg: number): void;
  (e: 'scale', factor: number): void;
  (e: 'delete'): void;
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

/** 把螢幕座標換成格子裡的 0–1。工具欄拖放用這個判斷黏不黏。 */
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

const hudStyle = computed(() => {
  const piece = selectedPiece.value;
  if (!piece) return {};
  const h = piece.scaleY ?? piece.scale;
  return {
    left: `${piece.x * 100}%`,
    top: `${Math.min(92, (piece.y + h / 2) * 100 + 2)}%`,
  };
});

const ghostViewBox = '0 0 1024 1024';

/** makemeahanzi 座標系要翻 y 才能疊在格子上。 */
const ghostTransform = 'translate(0, 900) scale(1, -1)';

/** 槽位提示照這一筆真正要擺的物品大小畫。 */
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

/**
 * 物品圖已經畫成該筆畫的樣子，所以套上去的旋轉是「這一筆的角度 − 物品被畫出來的角度」。
 * 直接用 piece.rot 去轉，折角類的物件會整個轉歪。
 * 位置與大小在外層，旋轉在內層，彈跳動畫才不會把旋轉蓋掉。
 */
const pieceWrapStyle = (piece: Piece) => {
  const w = piece.scale;
  const h = piece.scaleY ?? piece.scale;
  return {
    left: `${(piece.x - w / 2) * 100}%`,
    top: `${(piece.y - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    zIndex: pieceLayer(piece.strokeId, piece.slotIndex ?? piece.seq),
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

    <div
      v-for="piece in sortedPieces"
      :key="piece.id"
      class="piece-wrap"
      :class="{
        'is-dian': piece.strokeId === 'dian',
        'just-placed': piece.id === poppedId,
      }"
      :style="pieceWrapStyle(piece)"
    >
      <img
        class="piece"
        :class="{
          'is-selected': piece.id === selectedId,
          'is-dragging': piece.id === draggingId,
          'is-locked': readonly,
        }"
        :style="pieceImgStyle(piece)"
        :src="strokeImage(piece.strokeId, piece.variantKey)"
        :alt="piece.strokeId"
        draggable="false"
        @pointerdown="onPiecePointerDown($event, piece)"
      />
    </div>

    <div
      v-if="selectedPiece && !readonly"
      class="piece-hud"
      :style="hudStyle"
      @pointerdown.stop
    >
      <button
        v-if="selectedPiece.strokeId !== 'dian'"
        type="button"
        title="左轉"
        @click.stop="emit('rotate', -15)"
      >
        ↺
      </button>
      <button
        v-if="selectedPiece.strokeId !== 'dian'"
        type="button"
        title="右轉"
        @click.stop="emit('rotate', 15)"
      >
        ↻
      </button>
      <button type="button" title="縮小" @click.stop="emit('scale', 0.82)">－</button>
      <button type="button" title="放大" @click.stop="emit('scale', 1.18)">＋</button>
      <button type="button" title="拿走" @click.stop="emit('delete')">✕</button>
    </div>
  </div>
</template>
