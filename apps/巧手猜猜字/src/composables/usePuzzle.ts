import { computed, ref, shallowRef } from 'vue';

import { loadChar } from '@/lib/charData';
import { judge, nearestSlot, requiredStrokeIds, slotsForChar, TOLERANCE } from '@/lib/geometry';
import { baseAngleFor, metricFor, objectScale, pickVariant } from '@/lib/strokeMetrics';
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
    return requiredStrokeIds(data.value) as StrokeId[];
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
   * 把一件物品放到格子上。
   * 練習模式要拖到「現在該寫的那一筆」附近、且種類對，才會黏住；
   * 拖錯種類或離槽位太遠，直接不黏。
   * 挑戰模式就放在鬆手的位置，學生再自己轉與縮。
   */
  function drop(
    strokeId: StrokeId,
    x: number,
    y: number,
    variantKey?: string
  ): { ok: boolean; reason?: 'kind' | 'pos' | 'done' } {
    if (options.snap) {
      const slot = nextSlot.value;
      if (!slot) return { ok: false, reason: 'done' };
      if (slot.strokeId && slot.strokeId !== strokeId) return { ok: false, reason: 'kind' };
      if (Math.hypot(slot.cx - x, slot.cy - y) > TOLERANCE.snap) return { ok: false, reason: 'pos' };

      const piece: Piece = {
        id: nextPieceId(),
        strokeId,
        variantKey: variantKey ?? pickVariant(strokeId, slot.angle),
        x: slot.cx,
        y: slot.cy,
        scale: objectScale(slot.extent, strokeId),
        rot: slot.angle,
        seq: pieces.value.length,
        slotIndex: slot.index,
      };
      pieces.value.push(piece);
      selectedId.value = piece.id;
      pop(piece.id);
      return { ok: true };
    }

    const piece: Piece = {
      id: nextPieceId(),
      strokeId,
      variantKey,
      x: Math.min(0.92, Math.max(0.08, x)),
      y: Math.min(0.92, Math.max(0.08, y)),
      // 先給偏小的尺寸，學生用＋放大；複合筆外框大，直接放上去會蓋住整格
      scale: Math.min(0.34, objectScale(metricFor(strokeId).extent, strokeId)),
      rot: baseAngleFor(strokeId, variantKey),
      seq: pieces.value.length,
    };
    pieces.value.push(piece);
    selectedId.value = piece.id;
    pop(piece.id);
    return { ok: true };
  }

  /** @deprecated 點擊工具欄改走 drop；保留給舊呼叫。 */
  function take(strokeId: StrokeId, variantKey?: string, at?: { x: number; y: number }) {
    return drop(strokeId, at?.x ?? 0.5, at?.y ?? 0.5, variantKey).ok ? pieces.value.at(-1) ?? null : null;
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
    piece.scale = Math.min(0.95, Math.max(0.05, piece.scale * factor));
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
    drop,
    move,
    rotate,
    scale,
    removeSelected,
    clear,
    check,
  };
}
