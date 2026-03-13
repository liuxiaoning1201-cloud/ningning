<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
      <button v-if="crosswordSets.length > 0" type="button" class="btn btn-secondary" @click="showHistory = !showHistory">
        📋 出題記錄 ({{ crosswordSets.length }})
      </button>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">📝 練習模式</h1>

    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">🎲 出題</h2>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center">
        <label>
          詞句庫
          <select v-model="autoBankId" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius)">
            <option value="">— 請選擇 —</option>
            <option v-for="b in wordBanks.banks" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
        <label>
          難度
          <select v-model.number="autoTier" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius)">
            <option :value="1">★ 入門</option>
            <option :value="2">★★ 初學</option>
            <option :value="3">★★★ 中等</option>
            <option :value="4">★★★★ 挑戰</option>
            <option :value="5">★★★★★ 大師</option>
          </select>
        </label>
        <label>
          用詞數量
          <input v-model.number="autoWordCount" type="number" min="0" :max="selectedBankItemCount" placeholder="0=全部" style="width: 4rem; padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius)" />
        </label>
        <label style="display: flex; align-items: center; gap: 0.35rem">
          <input v-model="excludeUsedItems" type="checkbox" />
          排除已出過題的詞句
        </label>
        <label style="display: flex; align-items: center; gap: 0.35rem">
          <input :checked="gameSession.settings.showHints" type="checkbox" @change="onHintsChange" />
          顯示提示
        </label>
        <button type="button" class="btn btn-primary" :disabled="!autoBankId" @click="autoGenerate">隨機出題</button>
      </div>

      <!-- Word selection checkboxes -->
      <div v-if="selectedBank && selectedBank.items.length > 0" style="margin-top: 0.75rem; border-top: 1px solid var(--border); padding-top: 0.75rem">
        <p style="font-size: 0.9rem; margin-bottom: 0.5rem"><strong>勾選要使用的詞句</strong>（不勾選則使用全部或按數量隨機）</p>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
          <label v-for="it in selectedBank.items" :key="it.id" class="word-check-label">
            <input type="checkbox" :checked="selectedItemIds.has(it.id)" @change="toggleItem(it.id)" />
            {{ it.text }}
          </label>
        </div>
      </div>
    </div>

    <!-- History modal -->
    <div v-if="showHistory" class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">📋 出題記錄</h2>
      <div v-if="crosswordSets.length === 0" class="empty-state">尚無記錄。</div>
      <ul v-else class="history-list">
        <li v-for="set in crosswordSets" :key="set.id" class="history-item">
          <span><strong>{{ set.title }}</strong></span>
          <span class="actions">
            <RouterLink :to="`/play/crossword/${set.id}`" class="btn btn-primary btn-sm">練習</RouterLink>
            <RouterLink :to="`/play/local/${set.id}`" class="btn btn-secondary btn-sm">本地對戰</RouterLink>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import { useWordBanksStore } from "@/stores/wordBanks";
import { generateCrosswordPuzzle } from "@/lib/crosswordGenerator";
import type { DifficultyTier } from "@/lib/types";

const router = useRouter();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();
const wordBanks = useWordBanksStore();

const autoBankId = ref("");
const autoTier = ref<DifficultyTier>(1);
const autoWordCount = ref(0);
const showHistory = ref(false);
const selectedItemIds = ref<Set<string>>(new Set());
/** 排除已在出題記錄中使用過的詞句（不從詞庫刪除，僅本輪不選） */
const excludeUsedItems = ref(false);

const selectedBankItemCount = computed(() => {
  const bank = wordBanks.banks.find((b) => b.id === autoBankId.value);
  return bank?.items.length ?? 0;
});

const selectedBank = computed(() =>
  wordBanks.banks.find((b) => b.id === autoBankId.value) ?? null
);

function toggleItem(id: string) {
  const s = new Set(selectedItemIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedItemIds.value = s;
}

const crosswordSets = computed(() =>
  puzzleSets.sets.filter((s) => s.type === "crossword")
);

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
  let itemsToUse = selectedItemIds.value.size > 0
    ? bank.items.filter((it) => selectedItemIds.value.has(it.id))
    : bank.items;
  if (excludeUsedItems.value && crosswordSets.value.length > 0) {
    const usedTexts = new Set(
      crosswordSets.value.flatMap((s) =>
        (s.crossword?.words ?? []).map((w) => w.text.trim())
      )
    );
    itemsToUse = itemsToUse.filter((it) => !usedTexts.has(it.text.trim()));
  }
  if (itemsToUse.length === 0) {
    alert(excludeUsedItems.value
      ? "已出過題的詞句已排除，目前沒有可用的詞句。可取消「排除已出過題的詞句」或新增詞句。"
      : "請至少選擇一個詞句");
    return;
  }
  const puzzle = generateCrosswordPuzzle({
    items: itemsToUse,
    tier: autoTier.value,
    wordCount: autoWordCount.value || undefined,
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
</script>

<style scoped>
.empty-state { color: var(--text-muted); font-size: 0.9rem; padding: 0.5rem 0; text-align: center; }
.history-list { list-style: none; padding: 0; margin: 0; }
.history-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 0.5rem; }
.history-item:last-child { border-bottom: none; }
.actions { display: flex; gap: 0.35rem; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
.word-check-label {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.6rem;
  background: #FFF8F0;
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.word-check-label:hover {
  border-color: var(--primary);
  background: #FFF0F3;
}
</style>
