<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
      <RouterLink to="/teacher/puzzles" class="btn btn-secondary">題組列表</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">📚 詞句庫</h1>
    <p class="muted">建立詞句庫後，即可用於填字出題或 Excel/CSV 匯入。</p>
    <p>
      <RouterLink to="/teacher/banks/new" class="btn btn-primary">新增詞句庫</RouterLink>
    </p>
    <div v-if="wordBanks.banks.length === 0" class="card">
      <p class="muted">尚無詞句庫，請點上方「新增詞句庫」。</p>
    </div>
    <ul v-else class="list">
      <li v-for="(bank, i) in wordBanks.banks" :key="bank.id" class="card animate-fade-in" :style="{ animationDelay: `${i * 0.08}s` }">
        <RouterLink :to="`/teacher/banks/${bank.id}`" class="bank-link">
          <span><strong>{{ bank.name }}</strong><span class="count-badge">{{ bank.items.length }} 詞</span></span>
          <span class="arrow">→</span>
        </RouterLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useWordBanksStore } from "@/stores/wordBanks";

const wordBanks = useWordBanksStore();
</script>

<style scoped>
.muted { color: var(--text-muted); margin-bottom: 1rem; }
.list { list-style: none; }
.list li { margin-bottom: 1rem; }
.bank-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: inherit;
  text-decoration: none;
}
.bank-link:hover { text-decoration: none; }
.arrow { color: #94a3b8; }
.count-badge {
  display: inline-block;
  background: rgba(255, 107, 138, 0.2);
  color: var(--primary);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  margin-left: 6px;
}
</style>
