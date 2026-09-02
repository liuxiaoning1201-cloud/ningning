<script setup lang="ts">
import { computed } from 'vue';

import { useSettings } from '@/stores/settings';

/**
 * 奶茶小精靈。只喝采、不代答：絕不說「該用雨傘」，
 * 筆畫對照一律交給錦囊。老師設定頁不放牠。
 */
const props = defineProps<{
  mood: 'idle' | 'think' | 'cheer' | 'retry';
  message?: string;
}>();

const settings = useSettings();

const defaultMessage = computed(() => {
  switch (props.mood) {
    case 'think':
      return '慢慢來，先看看格子裡還缺哪一筆。';
    case 'cheer':
      return '拼得好！這個字站起來了。';
    case 'retry':
      return '差一點點，再看一次筆順就會了。';
    default:
      return '我陪你拼字。';
  }
});
</script>

<template>
  <div v-if="settings.state.mascot" class="mascot" aria-live="polite">
    <svg
      class="mascot-face"
      :class="{ 'is-cheer': mood === 'cheer', 'is-retry': mood === 'retry', 'is-think': mood === 'think' }"
      viewBox="0 0 72 86"
      width="56"
      height="66"
      role="img"
      aria-label="奶茶小精靈"
    >
      <!-- 吸管 -->
      <rect x="40" y="1" width="5.5" height="20" rx="2.4" fill="#5da648" />
      <rect x="41.2" y="3" width="1.6" height="16" rx="0.8" fill="#c8ecb6" opacity="0.7" />
      <!-- 杯蓋 -->
      <ellipse cx="36" cy="22" rx="23" ry="6.4" fill="#efe0b8" stroke="#5c4630" stroke-width="1.5" />
      <ellipse cx="36" cy="20.6" rx="16" ry="3.2" fill="#fff7e6" opacity="0.55" />
      <!-- 杯身：奶茶色 -->
      <path
        d="M16 22 L20.4 68 Q36 78 51.6 68 L56 22 Z"
        fill="#e8c49a"
        stroke="#5c4630"
        stroke-width="1.6"
      />
      <path d="M19.2 28 L22.8 64 Q36 72 49.2 64 L52.8 28 Z" fill="#f3d7b0" opacity="0.55" />
      <!-- 珍珠 -->
      <circle cx="28" cy="64" r="3" fill="#5a3a28" />
      <circle cx="37" cy="68" r="3.2" fill="#4a2f22" />
      <circle cx="45" cy="63" r="2.7" fill="#5a3a28" />
      <circle cx="31.5" cy="66.5" r="0.7" fill="#c9a07a" opacity="0.8" />
      <circle cx="40" cy="66.2" r="0.7" fill="#c9a07a" opacity="0.8" />
      <!-- 一對圓眼睛 -->
      <g class="mascot-eyes">
        <ellipse class="eye-white" cx="27" cy="38" rx="7.2" ry="8.2" fill="#fff" stroke="#5c4630" stroke-width="1.15" />
        <ellipse class="eye-white" cx="45" cy="38" rx="7.2" ry="8.2" fill="#fff" stroke="#5c4630" stroke-width="1.15" />
        <circle class="pupil" cx="28.4" cy="39.6" r="3.3" fill="#2c2418" />
        <circle class="pupil" cx="46.4" cy="39.6" r="3.3" fill="#2c2418" />
        <circle cx="26.4" cy="36.8" r="1.45" fill="#fff" />
        <circle cx="44.4" cy="36.8" r="1.45" fill="#fff" />
        <circle cx="29.4" cy="41.2" r="0.7" fill="#fff" opacity="0.85" />
        <circle cx="47.4" cy="41.2" r="0.7" fill="#fff" opacity="0.85" />
        <path d="M21 31.5 Q27 28.2 32.5 31.2" fill="none" stroke="#5c4630" stroke-width="1.15" stroke-linecap="round" />
        <path d="M39.5 31.2 Q45 28.2 51 31.5" fill="none" stroke="#5c4630" stroke-width="1.15" stroke-linecap="round" />
      </g>
      <!-- 臉紅 -->
      <ellipse cx="19.5" cy="48" rx="4.6" ry="2.3" fill="#f4a48c" opacity="0.78" />
      <ellipse cx="52.5" cy="48" rx="4.6" ry="2.3" fill="#f4a48c" opacity="0.78" />
      <path
        class="mouth mouth-ok"
        d="M30 50.5 Q36 55.5 42 50.5"
        fill="none"
        stroke="#5c4630"
        stroke-width="1.8"
        stroke-linecap="round"
      />
      <path
        class="mouth mouth-sad"
        d="M30 54 Q36 49.5 42 54"
        fill="none"
        stroke="#5c4630"
        stroke-width="1.8"
        stroke-linecap="round"
      />
    </svg>
    <div class="mascot-bubble">{{ message || defaultMessage }}</div>
  </div>
</template>
