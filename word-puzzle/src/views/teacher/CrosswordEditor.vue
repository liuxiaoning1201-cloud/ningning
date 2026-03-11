<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/teacher/puzzles" class="btn btn-secondary">← 題組列表</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">{{ isNew ? "✨ 新建填字接龍" : "✏️ 編輯填字接龍" }}</h1>

    <div class="card" style="margin-bottom: 1rem">
      <label style="display: block; margin-bottom: 0.5rem; font-weight: 500">題組標題</label>
      <input v-model="title" type="text" placeholder="例如：五年級論語填字接龍卡" style="width: 100%; padding: 0.5rem; border: 1px solid var(--border); border-radius: var(--radius)" />
    </div>

    <div class="card" style="margin-bottom: 1rem">
      <h2 style="font-size: 1rem; margin-bottom: 0.5rem">從詞句庫自動生成</h2>
      <p class="muted" style="margin-bottom: 0.5rem">選擇詞句庫與難度檔位，系統將自動排版並產生橫豎交叉填字題。</p>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center">
        <label>
          詞句庫
          <select v-model="selectedBankId" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); margin-left: 4px">
            <option value="">— 請選擇 —</option>
            <option v-for="b in wordBanks.banks" :key="b.id" :value="b.id">{{ b.name }}</option>
          </select>
        </label>
        <label>
          難度
          <select v-model.number="tier" style="padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); margin-left: 4px">
            <option :value="1">★ 入門</option>
            <option :value="2">★★ 初學</option>
            <option :value="3">★★★ 中等</option>
            <option :value="4">★★★★ 挑戰</option>
            <option :value="5">★★★★★ 大師</option>
          </select>
        </label>
        <label>
          用詞數量
          <input v-model.number="wordCount" type="number" min="0" placeholder="0=全部" style="width: 4rem; padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius); margin-left: 4px" />
        </label>
        <button type="button" class="btn btn-primary" :disabled="!selectedBankId" @click="generate">產生填字題</button>
      </div>
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

    <template v-if="puzzle">
      <div class="card" style="margin-bottom: 1rem">
        <p><strong>網格預覽</strong>（{{ puzzle.grid.length }}×{{ puzzle.grid[0]?.length ?? 0 }}）難度 {{ puzzle.difficulty }} 星 · {{ puzzle.levelTitle }}</p>
        <div
          class="grid-preview"
          :style="{ gridTemplateColumns: `repeat(${puzzle.grid[0]?.length ?? 0}, 2rem)` }"
        >
          <template v-for="(row, r) in puzzle.grid" :key="r">
            <template v-for="(cell, c) in row" :key="`${r}-${c}`">
              <span
                v-if="cell.type === 'block'"
                class="cell block"
              ></span>
              <span v-else-if="cell.type === 'given'" class="cell given">{{ cell.value }}</span>
              <span v-else class="cell blank">?</span>
            </template>
          </template>
        </div>
      </div>
      <div class="card" style="margin-bottom: 1rem">
        <strong>橫向提示</strong>
        <ul class="clue-list">
          <li v-for="h in puzzle.horizontalClues" :key="h.id">{{ h.label }}. {{ h.clue }}</li>
        </ul>
        <strong style="display: block; margin-top: 0.75rem">豎向提示</strong>
        <ul class="clue-list">
          <li v-for="v in puzzle.verticalClues" :key="v.id">{{ v.label }}. {{ v.clue }}</li>
        </ul>
      </div>
    </template>

    <div style="display: flex; gap: 0.5rem">
      <button type="button" class="btn btn-primary" :disabled="!puzzle" @click="save">儲存題組</button>
      <RouterLink to="/teacher/puzzles" class="btn btn-secondary">取消</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useWordBanksStore } from "@/stores/wordBanks";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { generateCrosswordPuzzle } from "@/lib/crosswordGenerator";
import type { CrosswordPuzzle, DifficultyTier } from "@/lib/types";

const route = useRoute();
const router = useRouter();
const wordBanks = useWordBanksStore();
const puzzleSets = usePuzzleSetsStore();

const setId = computed(() => route.params.setId as string);
const isNew = computed(() => setId.value === "new" || !setId.value);

const title = ref("");
const selectedBankId = ref("");
const tier = ref<DifficultyTier>(1);
const wordCount = ref(0);
const selectedItemIds = ref<Set<string>>(new Set());
const puzzle = ref<CrosswordPuzzle | null>(null);

const selectedBank = computed(() =>
  wordBanks.banks.find((b) => b.id === selectedBankId.value) ?? null
);

function toggleItem(id: string) {
  const s = new Set(selectedItemIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedItemIds.value = s;
}

watch(
  () => route.params.setId,
  (id) => {
    if (id && id !== "new") {
      const set = puzzleSets.sets.find((s) => s.id === id && s.type === "crossword");
      if (set?.crossword) {
        title.value = set.title;
        puzzle.value = set.crossword;
      }
    } else {
      title.value = "";
      puzzle.value = null;
      selectedBankId.value = "";
    }
  },
  { immediate: true }
);

function generate() {
  const bank = selectedBank.value;
  if (!bank || bank.items.length === 0) {
    alert("請選擇有詞條的詞句庫");
    return;
  }
  const itemsToUse = selectedItemIds.value.size > 0
    ? bank.items.filter((it) => selectedItemIds.value.has(it.id))
    : bank.items;
  if (itemsToUse.length === 0) {
    alert("請至少勾選一個詞句");
    return;
  }
  const result = generateCrosswordPuzzle({
    items: itemsToUse,
    tier: tier.value,
    wordCount: wordCount.value || undefined,
  });
  if (result) {
    puzzle.value = result;
  } else {
    alert("無法產生填字題，請確認詞句庫有足夠詞條。");
  }
}

function save() {
  const t = title.value.trim();
  if (!t) {
    alert("請輸入題組標題");
    return;
  }
  if (!puzzle.value) {
    alert("請先產生或載入填字題");
    return;
  }
  const set = {
    id: isNew.value ? generateId() : setId.value,
    title: t,
    type: "crossword" as const,
    createdAt: new Date().toISOString(),
    crossword: puzzle.value,
  };
  if (isNew.value) {
    puzzleSets.addSet(set);
  } else {
    puzzleSets.updateSet(set);
  }
  router.push("/teacher/puzzles");
}
</script>

<style scoped>
.muted { color: var(--text-muted); font-size: 0.9rem; }
.grid-preview { display: grid; gap: 2px; padding: 4px; border: 1px solid var(--border); border-radius: var(--radius); margin-top: 0.5rem; }
.cell { width: 2rem; height: 2rem; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; border-radius: 4px; }
.cell.block { background: var(--border); }
.cell.given { background: rgba(255, 107, 138, 0.25); font-weight: 700; color: var(--primary); }
.cell.blank { background: rgba(167, 139, 250, 0.2); color: var(--secondary); }
.clue-list { padding-left: 1.25rem; margin-top: 0.35rem; }
.clue-list li { margin-bottom: 0.25rem; }
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
