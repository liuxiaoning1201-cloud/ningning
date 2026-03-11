<template>
  <div class="page">
    <h1 class="page-title">中文填字接龍</h1>
    <p class="muted">詞語、成語與語句練習，支援練習、本地對戰與遠程對戰。</p>
    <div class="card">
      <RouterLink to="/teacher" class="btn btn-primary" style="display: block; text-align: center; padding: 14px">
        教師後台 · 管理詞庫與出題
      </RouterLink>
    </div>
    <div class="card">
      <RouterLink to="/play" class="btn btn-secondary" style="display: block; text-align: center; padding: 14px">
        開始練習 · 選題作答
      </RouterLink>
    </div>
    <div class="card">
      <RouterLink to="/play/remote" class="btn btn-secondary" style="display: block; text-align: center; padding: 14px">
        遠程對戰 · 班級比賽
      </RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped>
.muted {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-bottom: 1rem;
}
</style>
