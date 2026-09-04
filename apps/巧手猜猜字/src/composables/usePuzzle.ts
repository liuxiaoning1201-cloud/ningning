import { computed, ref, shallowRef } from 'vue';

import { STROKE_BY_ID } from '@/data/strokes';
import { loadChar } from '@/lib/charData';
import { judge, nearestSlot, requiredStrokeIds, slotsForChar } from '@/lib/geometry';
import { baseAngleFor, metricFor, pickVariant } from '@/lib/strokeMetrics';
import type { CharData, JudgeResult, Piece, StrokeId, StrokeSlot } from '@/types';

let seq = 0;
const nextPieceId = () => `p${(seq += 1)}`;

/**
 * 拼字的共用狀態：放件、拖動、旋轉、判定。
 * 練習模式開 snap（吸附＋鎖筆順），挑戰模式關掉，兩邊共用同一份幾何與判定。
 */
export function usePuzzle(options: { snap: boolean }) {
  const data = shallowRef<CharData | null>(null);
  const slots = ref<StrokeSlot[]>([]);
  const pieces = ref<Piece[]>([]);
  const selectedId = ref<string | null>(null);
  const poppedId = ref<string | null>(null);
  const result = ref<JudgeResult | null>(null);
  const loading = ref(false);
  const error = ref('');

  const available = computed<StrokeId[]>(() => {
    if (!data.value) return [];
    const ids = requiredStrokeIds(data.value) as StrokeId[];
    // 沒有筆畫標註的字（待核）就把 23 件全發出來，讓學生仍能自由拼
    if (!ids.length) return Object.keys(STROKE_BY_ID) as StrokeId[];
    return ids;
  });

  /** 練習模式已吸附的槽位。 */
  const takenSlots = computed(() => {
    const set = new Set<number>();
    for (const p of pieces.value) {
      if (p.slotIndex !== undefined) set.add(p.slotIndex);
    }
    return set;
  });

  /** 鎖筆順：從第 0 筆起，第一個還沒填的槽位。 */
  const nextSlotIndex = computed<number | null>(() => {
    if (!options.snap || !slots.value.length) return null;
    for (const slot of slots.value) {
      if (!takenSlots.value.has(slot.index)) return slot.index;
    }
    return null;
  });

  const nextSlot = computed(() =>
    nextSlotIndex.value === null ? null : slots.value[nextSlotIndex.value] ?? null
  );

  /** 練習模式工具欄只放行「當前這一筆」。 */
  const enabledOnly = computed<StrokeId | null>(() =>
    options.snap ? (nextSlot.value?.strokeId ?? null) : null
  );

  const doneCount = computed(() => takenSlots.value.size);
  const finished = computed(() => options.snap && nextSlotIndex.value === null && slots.value.length > 0);

  async function setChar(ch: string) {
    loading.value = true;
    error.value = '';
    result.value = null;
    pieces.value = [];
    selectedId.value = null;
    try {
      const loaded = await loadChar(ch);
      if (!loaded) {
        data.value = null;
        slots.value = [];
        error.value = `找不到「${ch}」的筆順資料`;
        return;
      }
      data.value = loaded;
      slots.value = slotsForChar(loaded);
    } finally {
      loading.value = false;
    }
  }

  function pop(id: string) {
    poppedId.value = id;
    window.setTimeout(() => {
      if (poppedId.value === id) poppedId.value = null;
    }, 520);
  }

  /**
   * 從工具欄拿一件物品放進格子。
   * 練習模式直接吸附到當前該寫的那一筆，位置、角度、長度一次對好，
   * 讓學生把注意力放在「這一筆是什麼、第幾筆寫」，而不是跟滑鼠搏鬥。
   */
  function take(strokeId: StrokeId, variantKey?: string, at?: { x: number; y: number }) {
    const drawScale = STROKE_BY_ID[strokeId].drawScale ?? 1;

    if (options.snap) {
      const slot = nextSlot.value;
      if (!slot || slot.strokeId !== strokeId) return null;
      const piece: Piece = {
        id: nextPieceId(),
        strokeId,
        // 學生沒特別挑朝向時，替他選最貼近這一筆角度的那一個（例如三點水的三顆點）
        variantKey: variantKey ?? pickVariant(strokeId, slot.angle),
        x: slot.cx,
        y: slot.cy,
        scale: slot.extent * drawScale,
        rot: slot.angle,
        seq: pieces.value.length,
        slotIndex: slot.index,
      };
      pieces.value.push(piece);
      selectedId.value = piece.id;
      pop(piece.id);
      return piece;
    }

    const piece: Piece = {
      id: nextPieceId(),
      strokeId,
      variantKey,
      x: at?.x ?? 0.5,
      y: at?.y ?? 0.5,
      // 一開始給典型大小、維持物品被畫出來的樣子，學生再自己轉與縮
      scale: metricFor(strokeId).extent * drawScale,
      rot: baseAngleFor(strokeId, variantKey),
      seq: pieces.value.length,
    };
    pieces.value.push(piece);
    selectedId.value = piece.id;
    pop(piece.id);
    return piece;
  }

  function move(id: string, x: number, y: number) {
    const piece = pieces.value.find((p) => p.id === id);
    if (!piece) return;

    if (options.snap) {
      // 吸附模式下只准回到自己的槽位，避免把已經對好的筆拖歪
      const own = piece.slotIndex !== undefined ? slots.value[piece.slotIndex] : null;
      if (own) {
        const near = nearestSlot([own], x, y, new Set());
        if (near) {
          piece.x = own.cx;
          piece.y = own.cy;
          return;
        }
      }
    }

    piece.x = x;
    piece.y = y;
  }

  function rotate(deg: number) {
    const piece = pieces.value.find((p) => p.id === selectedId.value);
    if (!piece) return;
    piece.rot = (piece.rot + deg) % 360;
  }

  function scale(factor: number) {
    const piece = pieces.value.find((p) => p.id === selectedId.value);
    if (!piece) return;
    piece.scale = Math.min(0.95, Math.max(0.06, piece.scale * factor));
  }

  function removeSelected() {
    const piece = pieces.value.find((p) => p.id === selectedId.value);
    if (!piece) return;
    pieces.value = pieces.value.filter((p) => p.id !== piece.id);
    // 重排 seq，讓筆順判定仍然對得上放置次序
    pieces.value.forEach((p, i) => {
      p.seq = i;
    });
    selectedId.value = null;
  }

  function clear() {
    pieces.value = [];
    selectedId.value = null;
    result.value = null;
  }

  function check(): JudgeResult | null {
    if (!data.value) return null;
    const r = judge(slots.value, pieces.value);
    result.value = r;
    return r;
  }

  return {
    data,
    slots,
    pieces,
    selectedId,
    poppedId,
    result,
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
    check,
  };
}
