<script setup lang="ts">
import { useRouter } from 'vue-router';

import StrokePouch from '@/components/StrokePouch.vue';

const router = useRouter();
</script>

<template>
  <div class="page">
    <header class="page-head wrap">
      <button class="btn btn-ghost btn-sm" @click="router.push('/')">← 回首頁</button>
      <h1>筆畫圖鑑</h1>
    </header>

    <div class="page-body wrap">
      <StrokePouch />
    </div>
  </div>
</template>
