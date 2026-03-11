<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
    </nav>
    <h1 class="page-title">選擇題目</h1>
    <p class="muted">可匯入教師提供的 JSON 題組檔。</p>
    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">遊戲設定</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 1rem; align-items: center">
        <label>
          難度篩選
          <select :value="gameSession.settings.difficulty" style="margin-left: 4px; padding: 0.4rem" @change="onDifficultyChange">
            <option :value="1">1 星</option>
            <option :value="2">2 星</option>
            <option :value="3">3 星</option>
            <option :value="4">4 星</option>
            <option :value="5">5 星</option>
          </select>
        </label>
        <label style="display: flex; align-items: center; gap: 0.35rem">
          <input :checked="gameSession.settings.showHints" type="checkbox" @change="onHintsChange" />
          顯示提示
        </label>
      </div>
    </div>
    <div class="card" style="margin-bottom: 1rem">
      <label class="btn btn-secondary" style="cursor: pointer">
        匯入題目（JSON）
        <input type="file" accept=".json" style="display: none" @change="onImport" />
      </label>
    </div>
    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">依難度自動出題</h2>
      <p class="muted" style="margin-bottom: 0.5rem">從詞句庫依難度檔隨機產生一題，直接開始練習。</p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center">
        <label>
          詞句庫
          <select v-model="autoBankId" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius)">
            <option value="">— 請選擇 —</option>
            <option v-for="b in wordBanks.banks" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
        <label>
          難度檔
          <select v-model="autoTier" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius)">
            <option value="beginner">初學入門</option>
            <option value="intermediate">小試身手</option>
            <option value="advanced">漸入佳境</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary" :disabled="!autoBankId" @click="autoGenerate">隨機出題</button>
      </div>
    </div>
    <div v-if="crosswordSets.length === 0" class="card">
      尚無填字題組，請由教師後台建立或匯入 JSON。
    </div>
    <ul v-else class="list">
      <li v-for="set in crosswordSets" :key="set.id" class="card card-row">
        <span><strong>{{ set.title }}</strong> <span class="badge">填字接龍</span></span>
        <span class="actions">
          <RouterLink :to="`/play/crossword/${set.id}`" class="btn btn-primary">練習</RouterLink>
          <RouterLink :to="`/play/local/${set.id}`" class="btn btn-secondary">本地對戰</RouterLink>
        </span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import { useWordBanksStore } from "@/stores/wordBanks";
import { generateCrosswordPuzzle } from "@/lib/crosswordGenerator";
import type { PuzzleSet, DifficultyTier } from "@/lib/types";

const router = useRouter();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();
const wordBanks = useWordBanksStore();

const autoBankId = ref("");
const autoTier = ref<DifficultyTier>("beginner");

const crosswordSets = computed(() =>
  puzzleSets.sets.filter((s) => s.type === "crossword")
);

function saveSettings() {
  gameSession.setSettings({
    difficulty: gameSession.settings.difficulty,
    showHints: gameSession.settings.showHints,
  });
}

function onDifficultyChange(e: Event) {
  const v = Number((e.target as HTMLSelectElement).value);
  gameSession.setSettings({ difficulty: v });
}

function onHintsChange(e: Event) {
  const v = (e.target as HTMLInputElement).checked;
  gameSession.setSettings({ showHints: v });
}

function autoGenerate() {
  const bank = wordBanks.banks.find((b) => b.id === autoBankId.value);
  if (!bank || bank.items.length === 0) {
    alert("請選擇有詞條的詞句庫");
    return;
  }
  const puzzle = generateCrosswordPuzzle({
    items: bank.items,
    tier: autoTier.value,
  });
  if (!puzzle) {
    alert("無法產生填字題，請確認詞句庫有足夠詞條。");
    return;
  }
  const set = {
    id: generateId(),
    title: `隨機出題 · ${puzzle.levelTitle}`,
    type: "crossword" as const,
    createdAt: new Date().toISOString(),
    crossword: puzzle,
  };
  puzzleSets.addSet(set);
  router.push(`/play/crossword/${set.id}`);
}

function onImport(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string) as PuzzleSet;
      if (!data.id || !data.title || !data.type) {
        alert("無效的題組檔案");
        return;
      }
      const idx = puzzleSets.sets.findIndex((s) => s.id === data.id);
      if (idx >= 0) {
        puzzleSets.updateSet(data);
      } else {
        puzzleSets.addSet(data);
      }
      input.value = "";
    } catch {
      alert("無法解析 JSON");
    }
  };
  reader.readAsText(file);
}
</script>

<style scoped>
.muted { color: var(--text-muted); margin-bottom: 1rem; }
.list { list-style: none; }
.list li { margin-bottom: 0.5rem; }
.card-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
.actions { display: flex; gap: 0.35rem; }
.list a { color: inherit; text-decoration: none; }
.badge { font-size: 12px; color: var(--text-muted); margin-left: 6px; }
</style>
