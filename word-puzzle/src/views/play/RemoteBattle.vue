<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
    </nav>
    <h1 class="page-title">遠程對戰</h1>
    <p class="muted">使用學校郵箱登入後加入班級，即可與同學同時作答比賽。</p>
    <div class="card">
      <p v-if="!supabaseConfigured" class="muted">
        遠程對戰需設定 Supabase（請在 .env 設定 VITE_SUPABASE_URL 與 VITE_SUPABASE_ANON_KEY）。
      </p>
      <template v-else>
        <p v-if="!user" class="muted">請先登入學校郵箱。</p>
        <template v-else>
          <p>已登入：{{ user.email }}</p>
          <button type="button" class="btn btn-secondary" @click="handleSignOut">登出</button>
        </template>
        <p style="margin-top: 1rem; color: var(--text-muted)">
          班級與房間功能將在後端與 Supabase 表建立完成後開放。
        </p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { supabaseConfigured, getCurrentUser, signOut } from "@/lib/supabase";

const user = ref<{ id: string; email?: string } | null>(null);

onMounted(async () => {
  if (supabaseConfigured) {
    user.value = await getCurrentUser();
  }
});

async function handleSignOut() {
  await signOut();
  user.value = null;
}
</script>

<style scoped>
.muted { color: var(--text-muted); }
</style>
