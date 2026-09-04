<script setup lang="ts">
import { BASIC_STROKES, COMPOUND_STROKES, strokeImage } from '@/data/strokes';
import type { StrokeId } from '@/types';

defineProps<{
  current?: StrokeId | null;
  title?: string;
  hint?: string;
  allowClear?: boolean;
}>();

const emit = defineEmits<{
  pick: [id: StrokeId];
  clear: [];
  close: [];
}>();
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="overlay-card stroke-picker">
      <div class="overlay-head">
        <h2>{{ title ?? '改成哪一件物品？' }}</h2>
        <button class="btn btn-ghost btn-sm" type="button" @click="emit('close')">取消</button>
      </div>
      <p class="hint" style="margin-bottom: 12px">
        {{ hint ?? '改這一筆用哪一件物品。' }}
      </p>

      <div class="picker-section">基本 6 件</div>
      <div class="picker-grid">
        <button
          v-for="s in BASIC_STROKES"
          :key="s.id"
          type="button"
          class="picker-item"
          :class="{ 'is-on': current === s.id }"
          @click="emit('pick', s.id)"
        >
          <img :src="strokeImage(s.id)" :alt="s.objectName" />
          <span class="atlas-name">{{ s.name }}</span>
          <span class="atlas-object">{{ s.objectName }}</span>
        </button>
      </div>

      <div class="picker-section">複合 18 件</div>
      <div class="picker-grid">
        <button
          v-for="s in COMPOUND_STROKES"
          :key="s.id"
          type="button"
          class="picker-item"
          :class="{ 'is-on': current === s.id }"
          @click="emit('pick', s.id)"
        >
          <img :src="strokeImage(s.id)" :alt="s.objectName" />
          <span class="atlas-name">{{ s.name }}</span>
          <span class="atlas-object">{{ s.objectName }}</span>
        </button>
      </div>

      <button
        v-if="allowClear !== false"
        class="btn btn-ghost"
        style="width: 100%; margin-top: 14px"
        type="button"
        @click="emit('clear')"
      >
        還原這一筆的自動判斷
      </button>
    </div>
  </div>
</template>
