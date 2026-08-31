<script setup lang="ts">
import { computed } from 'vue';

import { useSettings } from '@/stores/settings';

/**
 * 檸檬茶小精靈。只喝采、不代答：絕不說「該用雨傘」，
 * 筆畫對照一律交給錦囊。老師設定頁不放牠。
 */
const props = defineProps<{
  mood: 'idle' | 'think' | 'cheer' | 'retry';
  message?: string;
}>();

const settings = useSettings();

const face = computed(() => {
  switch (props.mood) {
    case 'think':
      return '🧋';
    case 'cheer':
      return '🧋';
    case 'retry':
      return '🧋';
    default:
      return '🧋';
  }
});

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
    <div class="mascot-bubble">{{ message || defaultMessage }}</div>
    <div class="mascot-body" :class="{ 'is-cheer': mood === 'cheer' }">{{ face }}</div>
  </div>
</template>
