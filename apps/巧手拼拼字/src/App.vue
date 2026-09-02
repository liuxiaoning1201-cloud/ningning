<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue';

const failure = ref('');

onErrorCaptured((err) => {
  failure.value = err.message;
  return false;
});
</script>

<template>
  <div v-if="failure" class="page-body wrap" style="padding-top: 40px">
    <div class="card">
      <div class="card-title">出了點問題</div>
      <p class="hint">{{ failure }}</p>
      <button class="btn btn-sky btn-sm" style="margin-top: 12px" @click="failure = ''">再試一次</button>
    </div>
  </div>
  <RouterView v-else />
</template>
