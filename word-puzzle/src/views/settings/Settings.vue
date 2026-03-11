<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">⚙️ 遊戲設定</h1>

    <!-- Difficulty -->
    <div class="card settings-card animate-fade-in">
      <h2 class="section-title">🎯 遊戲難度</h2>
      <p class="section-desc">選擇遊戲難度，影響填字提示字的比例。</p>
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
      <p class="section-desc">管理你的詞句庫，支援 TXT、CSV 和 Excel 格式匯入。</p>
      <div class="bank-actions">
        <RouterLink to="/teacher/banks/new" class="btn btn-primary">➕ 新增詞庫</RouterLink>
        <label class="btn btn-secondary" style="cursor: pointer">
          📂 匯入詞庫
          <input
            type="file"
            accept=".xlsx,.xls,.csv,.txt"
            style="display: none"
            @change="onImportBank"
          />
        </label>
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
            <RouterLink :to="`/teacher/banks/${bank.id}`" class="btn-icon" title="編輯">✏️</RouterLink>
            <button type="button" class="btn-icon danger" title="刪除" @click="deleteBank(bank.id)">🗑️</button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Puzzle sets -->
    <div class="card settings-card animate-fade-in" style="animation-delay: 0.3s">
      <h2 class="section-title">🧩 題組管理</h2>
      <p class="section-desc">
        共有 <strong>{{ puzzleSets.sets.length }}</strong> 個題組。
      </p>
      <RouterLink to="/teacher/puzzles" class="btn btn-secondary">前往題組管理 →</RouterLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameSessionStore } from "@/stores/gameSession";
import { useWordBanksStore } from "@/stores/wordBanks";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { parseImportFile } from "@/lib/importExcel";

const gameSession = useGameSessionStore();
const wordBanks = useWordBanksStore();
const puzzleSets = usePuzzleSetsStore();

const difficultyLabels: Record<number, string> = {
  1: "1 星（最簡單）",
  2: "2 星（簡單）",
  3: "3 星（普通）",
  4: "4 星（困難）",
  5: "5 星（最困難）",
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
      difficulty: Math.min(5, Math.max(1, row.difficulty ?? 1)),
    })),
    createdAt: new Date().toISOString(),
  });
  alert(`已匯入「${baseName}」，共 ${parsed.length} 筆詞條。`);
  input.value = "";
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
</style>
