<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { strokeImage } from '@/data/strokes';
import { loadChar } from '@/lib/charData';
import { slotsForChar } from '@/lib/geometry';
import { fitToSlot, pieceLayer, renderRotation } from '@/lib/strokeMetrics';
import type { CharData, Piece } from '@/types';

/** 標題這五個字，用跟練習同一套物品與槽位拼出來。 */
const TITLE = ['巧', '手', '拼', '拼', '字'] as const;

interface LogoCell {
  char: string;
  key: string;
  pieces: Piece[];
  ghost: string[];
  wave: number;
}

const cells = ref<LogoCell[]>(
  TITLE.map((char, i) => ({ char, key: `${char}-${i}`, pieces: [], ghost: [], wave: 0 }))
);

const ghostViewBox = '0 0 1024 1024';
const ghostTransform = 'translate(0, 900) scale(1, -1)';

function piecesFrom(data: CharData): Piece[] {
  return slotsForChar(data).flatMap((slot, i) => {
    const id = slot.strokeId;
    if (!id) return [];
    const fit = fitToSlot(id, slot);
    return [
      {
        id: `${data.char}-${i}`,
        strokeId: id,
        variantKey: fit.variantKey,
        x: fit.x,
        y: fit.y,
        scale: fit.scale,
        scaleY: fit.scaleY,
        rot: fit.rot,
        seq: i,
        slotIndex: slot.index,
      },
    ];
  });
}

onMounted(() => {
  const pending = new Map<string, Promise<CharData | null>>();
  const load = (ch: string) => {
    const hit = pending.get(ch);
    if (hit) return hit;
    const job = loadChar(ch);
    pending.set(ch, job);
    return job;
  };
  TITLE.forEach((char, i) => {
    void load(char).then((data) => {
      const cell = cells.value[i];
      if (!cell || !data) return;
      cell.pieces = piecesFrom(data);
      cell.ghost = data.strokes.filter(Boolean);
    });
  });
});

function replay(index: number) {
  const cell = cells.value[index];
  if (!cell?.pieces.length) return;
  cell.wave += 1;
}

function wrapStyle(piece: Piece) {
  const w = piece.scale;
  const h = piece.scaleY ?? piece.scale;
  return {
    left: `${(piece.x - w / 2) * 100}%`,
    top: `${(piece.y - h / 2) * 100}%`,
    width: `${w * 100}%`,
    height: `${h * 100}%`,
    zIndex: pieceLayer(piece.strokeId, piece.slotIndex ?? piece.seq),
    animationDelay: `${piece.seq * 0.14}s`,
  };
}

function imgStyle(piece: Piece) {
  return { transform: `rotate(${renderRotation(piece.strokeId, piece.rot, piece.variantKey)}deg)` };
}
</script>

<template>
  <div class="home-logo">
    <h1 class="visually-hidden">巧手拼拼字</h1>
    <p class="visually-hidden">筷子、蠟燭、羽毛、雨傘這些生活物品，一筆一筆拼成標題這五個字。</p>
    <div class="home-logo-row" aria-hidden="true">
      <button
        v-for="(cell, i) in cells"
        :key="cell.key"
        class="home-logo-cell"
        type="button"
        :title="`點一下，「${cell.char}」會再拼一次`"
        @click="replay(i)"
      >
        <span v-if="!cell.pieces.length" class="home-logo-fallback">{{ cell.char }}</span>
        <svg class="grid-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect x="1" y="1" width="98" height="98" fill="none" stroke="var(--grid-line)" stroke-width="1.2" />
          <line x1="50" y1="1" x2="50" y2="99" stroke="var(--grid-guide)" stroke-width="0.8" stroke-dasharray="4 3" />
          <line x1="1" y1="50" x2="99" y2="50" stroke="var(--grid-guide)" stroke-width="0.8" stroke-dasharray="4 3" />
          <line x1="1" y1="1" x2="99" y2="99" stroke="var(--grid-guide)" stroke-width="0.6" stroke-dasharray="4 3" />
          <line x1="99" y1="1" x2="1" y2="99" stroke="var(--grid-guide)" stroke-width="0.6" stroke-dasharray="4 3" />
        </svg>
        <svg
          v-if="cell.ghost.length"
          class="grid-ghost"
          :viewBox="ghostViewBox"
          style="inset: 0; width: 100%; height: 100%"
        >
          <g :transform="ghostTransform">
            <path v-for="(d, gi) in cell.ghost" :key="gi" :d="d" fill="var(--ink)" />
          </g>
        </svg>
        <div
          v-for="piece in cell.pieces"
          :key="`${cell.wave}-${piece.id}`"
          class="piece-wrap home-logo-piece"
          :style="wrapStyle(piece)"
        >
          <img
            class="piece"
            :src="strokeImage(piece.strokeId, piece.variantKey)"
            :alt="piece.strokeId"
            draggable="false"
            :style="imgStyle(piece)"
          />
        </div>
      </button>
    </div>
  </div>
</template>
