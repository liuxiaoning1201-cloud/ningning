<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/teacher" class="btn btn-secondary">詞句庫</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">🧩 題組列表</h1>
    <p class="muted">可匯出 JSON 供學生匯入練習。</p>
    <p>
      <RouterLink to="/teacher/puzzles/crossword/new" class="btn btn-primary">新建 · 填字接龍</RouterLink>
    </p>
    <div v-if="puzzleSets.sets.length === 0" class="card">尚無題組。</div>
    <ul v-else class="list">
      <li v-for="(set, i) in puzzleSets.sets" :key="set.id" class="card card-row animate-fade-in" :style="{ animationDelay: `${i * 0.08}s` }">
        <span><strong>{{ set.title }}</strong> {{ set.type === "crossword" ? "填字接龍" : "數獨" }}</span>
        <span class="actions">
          <RouterLink v-if="set.type === 'crossword'" :to="`/teacher/puzzles/crossword/${set.id}`" class="btn btn-secondary">編輯</RouterLink>
          <RouterLink v-if="set.type === 'crossword'" :to="`/play/crossword/${set.id}`" class="btn btn-secondary">預覽</RouterLink>
          <button type="button" class="btn btn-secondary" @click="exportSet(set)">匯出</button>
          <button type="button" class="btn btn-danger" @click="removeSet(set.id)">刪除</button>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import type { PuzzleSet } from "@/lib/types";

const puzzleSets = usePuzzleSetsStore();

function exportSet(set: PuzzleSet) {
  const blob = new Blob([JSON.stringify(set, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `題組-${set.title}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function removeSet(id: string) {
  if (!confirm("確定刪除此題組？")) return;
  puzzleSets.removeSet(id);
}
</script>

<style scoped>
.muted { color: var(--text-muted); margin-bottom: 1rem; }
.list { list-style: none; }
.list li { margin-bottom: 1rem; }
.card-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
</style>
