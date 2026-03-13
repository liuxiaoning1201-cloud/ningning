<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">⚙️ 設定</h1>

    <!-- Difficulty -->
    <div class="card settings-card animate-fade-in">
      <h2 class="section-title">🎯 遊戲難度</h2>
      <p class="section-desc">選擇遊戲難度，影響填字格子大小與提示字比例。</p>
      <div class="difficulty-selector">
        <button
          v-for="d in 5"
          :key="d"
          class="star-btn"
          :class="{ active: gameSession.settings.difficulty >= d }"
          @click="setDifficulty(d)"
        >
          {{ gameSession.settings.difficulty >= d ? '★' : '☆' }}
        </button>
        <span class="difficulty-label">{{ difficultyLabel }}</span>
      </div>
    </div>

    <!-- Hints -->
    <div class="card settings-card animate-fade-in" style="animation-delay: 0.1s">
      <h2 class="section-title">💡 提示設定</h2>
      <label class="toggle-label">
        <input
          type="checkbox"
          :checked="gameSession.settings.showHints"
          @change="toggleHints"
        />
        <span>{{ gameSession.settings.showHints ? '顯示提示（開啟）' : '隱藏提示（關閉）' }}</span>
      </label>
      <p class="section-desc">開啟後，遊戲中將顯示橫向與豎向的詞語提示。</p>
    </div>

    <!-- Word banks -->
    <div class="card settings-card animate-fade-in" style="animation-delay: 0.2s">
      <h2 class="section-title">📚 詞庫管理</h2>
      <p class="section-desc">管理詞句庫，支援 TXT、CSV 和 Excel 格式匯入。</p>
      <div class="bank-actions">
        <RouterLink to="/settings/banks/new" class="btn btn-primary">➕ 新增詞庫</RouterLink>
        <label class="btn btn-secondary" style="cursor: pointer">
          📂 匯入詞庫
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            style="display: none"
            @change="onImportBank"
          />
        </label>
        <button v-if="wordBanks.banks.length > 0" type="button" class="btn btn-secondary" @click="aiExplainAll">
          🤖 AI 批量解讀
        </button>
      </div>
      <div v-if="aiProgress" class="ai-progress">
        {{ aiProgress }}
      </div>
      <div v-if="wordBanks.banks.length === 0" class="empty-state">
        尚無詞句庫，請新增或匯入。
      </div>
      <ul v-else class="bank-list">
        <li v-for="bank in wordBanks.banks" :key="bank.id" class="bank-item">
          <div class="bank-info">
            <strong>{{ bank.name }}</strong>
            <span class="badge">{{ bank.items.length }} 詞</span>
          </div>
          <div class="bank-actions-inline">
            <RouterLink :to="`/settings/banks/${bank.id}`" class="btn-icon" title="編輯">✏️</RouterLink>
            <button type="button" class="btn-icon danger" title="刪除" @click="deleteBank(bank.id)">🗑️</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Puzzle sets (inline management) -->
    <div class="card settings-card animate-fade-in" style="animation-delay: 0.3s">
      <h2 class="section-title">🧩 題組管理</h2>
      <p class="section-desc">管理已儲存的填字題組。</p>
      <div class="bank-actions">
        <RouterLink to="/settings/puzzles/crossword/new" class="btn btn-primary">➕ 新建填字題</RouterLink>
      </div>
      <div v-if="puzzleSets.sets.length === 0" class="empty-state">
        尚無題組。
      </div>
      <ul v-else class="bank-list">
        <li v-for="set in puzzleSets.sets" :key="set.id" class="bank-item">
          <div class="bank-info">
            <strong>{{ set.title }}</strong>
            <span class="badge">{{ set.type === 'crossword' ? '填字' : '數獨' }}</span>
          </div>
          <div class="bank-actions-inline">
            <RouterLink v-if="set.type === 'crossword'" :to="`/settings/puzzles/crossword/${set.id}`" class="btn-icon" title="編輯">✏️</RouterLink>
            <RouterLink v-if="set.type === 'crossword'" :to="`/play/crossword/${set.id}`" class="btn-icon" title="預覽">👁️</RouterLink>
            <button v-if="set.type === 'crossword' && set.crossword" type="button" class="btn-icon" title="列印 PDF" @click="printPuzzle(set)">🖨️</button>
            <button type="button" class="btn-icon danger" title="刪除" @click="removeSet(set.id)">🗑️</button>
          </div>
        </li>
      </ul>
    </div>
  </div>

  <!-- Hidden print area：左右排列，確保一頁內 -->
  <div v-if="printingSet" id="print-area" class="print-area">
    <h1 class="print-title">{{ printingSet.title }}</h1>
    <p class="print-subtitle" v-if="printingSet.crossword">
      難度 {{ printingSet.crossword.difficulty }} 星 · {{ printingSet.crossword.levelTitle }}
    </p>
    <template v-if="printingSet.crossword">
      <div class="print-body">
        <div
          class="print-grid-wrap"
          :style="{ gridTemplateColumns: `repeat(${printingSet.crossword.grid[0]?.length ?? 0}, 1.5rem)` }"
        >
          <template v-for="(row, r) in printingSet.crossword.grid" :key="r">
            <template v-for="(cell, c) in row" :key="`${r}-${c}`">
              <span v-if="cell.type === 'block'" class="print-cell print-block"></span>
              <span v-else-if="cell.type === 'given'" class="print-cell print-given">{{ cell.value }}</span>
              <span v-else class="print-cell print-blank"></span>
            </template>
          </template>
        </div>
        <div class="print-clues">
          <div class="print-clue-section">
            <strong style="color: #2563eb">→ 橫向提示</strong>
            <ul>
              <li v-for="h in printingSet.crossword.horizontalClues" :key="h.id">
                <span style="color: #2563eb; font-weight: 700">{{ h.label }}.</span> {{ h.clue }}
              </li>
            </ul>
          </div>
          <div class="print-clue-section">
            <strong style="color: #dc2626">↓ 豎向提示</strong>
            <ul>
              <li v-for="v in printingSet.crossword.verticalClues" :key="v.id">
                <span style="color: #dc2626; font-weight: 700">{{ v.label }}.</span> {{ v.clue }}
              </li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from "vue";
import { useGameSessionStore } from "@/stores/gameSession";
import { useWordBanksStore } from "@/stores/wordBanks";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { parseImportFile } from "@/lib/importExcel";
import { getAiExplanation } from "@/lib/aiExplain";
import type { PuzzleSet } from "@/lib/types";

const gameSession = useGameSessionStore();
const wordBanks = useWordBanksStore();
const puzzleSets = usePuzzleSetsStore();

const aiProgress = ref("");
const printingSet = ref<PuzzleSet | null>(null);

const difficultyLabels: Record<number, string> = {
  1: "1 星 · 入門（提示多）",
  2: "2 星 · 初學",
  3: "3 星 · 中等",
  4: "4 星 · 挑戰",
  5: "5 星 · 大師（提示少）",
};

const difficultyLabel = computed(() => {
  const d = gameSession.settings.difficulty;
  return difficultyLabels[d] ?? `${d} 星`;
});

function setDifficulty(d: number) {
  gameSession.setSettings({ difficulty: d });
}

function toggleHints(e: Event) {
  const checked = (e.target as HTMLInputElement).checked;
  gameSession.setSettings({ showHints: checked });
}

function deleteBank(id: string) {
  if (!confirm("確定要刪除這個詞句庫嗎？")) return;
  wordBanks.removeBank(id);
}

function removeSet(id: string) {
  if (!confirm("確定刪除此題組？")) return;
  puzzleSets.removeSet(id);
}

async function onImportBank(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const parsed = await parseImportFile(file);
  if (parsed.length === 0) {
    alert("未解析到任何詞條，請檢查檔案格式。");
    input.value = "";
    return;
  }
  const baseName = file.name.replace(/\.[^.]+$/, "") || "匯入詞庫";
  wordBanks.addBank({
    id: generateId(),
    name: baseName,
    items: parsed.map((row) => ({
      id: generateId(),
      text: row.text,
      definition: row.definition ?? "",
      source: row.source ?? "",
      difficulty: 1,
    })),
    createdAt: new Date().toISOString(),
  });
  alert(`已匯入「${baseName}」，共 ${parsed.length} 筆詞條。`);
  input.value = "";
}

async function aiExplainAll() {
  let total = 0;
  let done = 0;
  for (const bank of wordBanks.banks) {
    total += bank.items.filter((it) => it.text.trim() && !it.definition.trim()).length;
  }
  if (total === 0) {
    alert("所有詞條已有釋義，無需 AI 解讀。");
    return;
  }
  if (!confirm(`將為 ${total} 個尚無釋義的詞條進行 AI 解讀，是否繼續？`)) return;

  for (const bank of wordBanks.banks) {
    for (const item of bank.items) {
      if (!item.text.trim() || item.definition.trim()) continue;
      aiProgress.value = `AI 解讀中... ${done + 1}/${total}：${item.text}`;
      try {
        const result = await getAiExplanation(item.text.trim());
        item.definition = result.meaning;
        if (result.usage) item.definition += `（${result.usage}）`;
      } catch {}
      done++;
    }
    wordBanks.updateBank(bank);
  }
  aiProgress.value = "";
  alert(`AI 解讀完成，共處理 ${done} 個詞條。`);
}

async function printPuzzle(set: PuzzleSet) {
  printingSet.value = set;
  await nextTick();
  window.print();
  setTimeout(() => {
    printingSet.value = null;
  }, 500);
}
</script>

<style scoped>
.settings-card {
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 1.1rem;
  font-weight: 700;
  margin-bottom: 0.4rem;
  color: var(--text);
}

.section-desc {
  color: var(--text-muted);
  font-size: 0.9rem;
  margin-bottom: 0.75rem;
}

.difficulty-selector {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.star-btn {
  background: none;
  border: none;
  font-size: 1.8rem;
  cursor: pointer;
  color: #d1d5db;
  transition: color 0.15s, transform 0.15s;
  padding: 0;
  line-height: 1;
}

.star-btn.active {
  color: #f59e0b;
}

.star-btn:hover {
  transform: scale(1.2);
}

.difficulty-label {
  margin-left: 0.75rem;
  font-size: 0.95rem;
  color: var(--text-muted);
  font-weight: 500;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  cursor: pointer;
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

.toggle-label input[type="checkbox"] {
  width: 1.2rem;
  height: 1.2rem;
  accent-color: var(--primary);
  cursor: pointer;
}

.bank-actions {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.bank-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.bank-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}

.bank-item:last-child {
  border-bottom: none;
}

.bank-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.badge {
  background: var(--primary-light, #fce7f3);
  color: var(--primary);
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 600;
}

.bank-actions-inline {
  display: flex;
  gap: 0.35rem;
}

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.15rem;
  padding: 4px 6px;
  border-radius: var(--radius);
  transition: background 0.15s;
  text-decoration: none;
}

.btn-icon:hover {
  background: rgba(0, 0, 0, 0.06);
}

.btn-icon.danger:hover {
  background: #fee2e2;
}

.empty-state {
  color: var(--text-muted);
  font-size: 0.9rem;
  padding: 1rem 0;
  text-align: center;
}

.ai-progress {
  padding: 0.5rem 0.75rem;
  background: #FEF3C7;
  border-radius: 8px;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
  color: #92400E;
}

/* ── Print styles：左右排列，所有題目在一面內 ── */
.print-area {
  display: none;
}

.print-title {
  font-size: 1.35rem;
  font-weight: 700;
  text-align: center;
  margin-bottom: 0.2rem;
}

.print-subtitle {
  text-align: center;
  color: #666;
  font-size: 0.85rem;
  margin-bottom: 0.75rem;
}

.print-body {
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 1.25rem;
  max-width: 100%;
}

.print-grid-wrap {
  display: grid;
  gap: 0;
  flex-shrink: 0;
  width: fit-content;
}

.print-cell {
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  border: 1px solid #333;
}

.print-block {
  background: #ddd;
  border-color: #ddd;
}

.print-given {
  background: #f0f0f0;
}

.print-blank {
  background: white;
}

.print-clues {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.75rem;
  flex: 1;
  min-width: 0;
}

.print-clue-section {
  flex: none;
}

.print-clue-section ul {
  padding-left: 1rem;
  margin-top: 0.25rem;
}

.print-clue-section li {
  margin-bottom: 0.15rem;
}

@media print {
  body * {
    visibility: hidden !important;
  }
  .print-area,
  .print-area * {
    visibility: visible !important;
  }
  .print-area {
    display: block !important;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    padding: 1rem 1.2cm;
    background: white;
    z-index: 99999;
    overflow: hidden;
    page-break-inside: avoid;
    box-sizing: border-box;
  }
  .print-area .print-body {
    max-height: 100%;
    overflow: hidden;
  }
  .print-title { font-size: 1.2rem; margin-bottom: 0.15rem; }
  .print-subtitle { font-size: 0.8rem; margin-bottom: 0.5rem; }
  .print-cell {
    width: 1.35rem;
    height: 1.35rem;
    font-size: 0.7rem;
  }
  .print-clues { font-size: 0.7rem; }
  .print-clue-section li { margin-bottom: 0.1rem; }
}
</style>
