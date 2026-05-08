<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/" class="btn btn-secondary">← 首頁</RouterLink>
      <button v-if="crosswordSets.length > 0" type="button" class="btn btn-secondary" :class="{ active: showHistory }" @click="toggleHistory">
        📋 出題記錄 ({{ crosswordSets.length }})
      </button>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">📝 練習模式</h1>

    <!-- 出題記錄（移到上方，點開立即看見） -->
    <div v-if="showHistory" ref="historyPanelRef" class="card history-card" style="margin-bottom: 1rem">
      <div class="history-header">
        <h2 style="font-size: 1rem">📋 出題記錄</h2>
        <button type="button" class="btn btn-secondary btn-sm" @click="showHistory = false">收起</button>
      </div>
      <div v-if="crosswordSets.length === 0" class="empty-state">尚無記錄。</div>
      <ul v-else class="history-list">
        <li v-for="row in crosswordHistoryRows" :key="row.set.id" class="history-item">
          <span class="history-info">
            <strong>{{ row.set.title }}</strong>
            <span v-if="row.stats" class="history-stats">
              共 {{ row.stats.totalWords }} 題 ·
              縱橫交錯 <b class="stat-cross">{{ row.stats.crossedWords }}</b> ·
              孤立 <b :class="{ 'stat-bad': row.stats.isolatedWords > 0 }">{{ row.stats.isolatedWords }}</b> ·
              交叉率 {{ Math.round(row.stats.crossRate * 100) }}%
              <span class="history-grid">· {{ row.set.crossword?.grid.length }}×{{ row.set.crossword?.grid[0]?.length ?? 0 }} 格</span>
            </span>
          </span>
          <span class="actions">
            <RouterLink :to="`/play/crossword/${row.set.id}`" class="btn btn-primary btn-sm">▶ 練習</RouterLink>
            <button v-if="row.set.crossword" type="button" class="btn btn-secondary btn-sm" title="列印空白版" @click="printPuzzle(row.set, 'solve')">🖨 空白</button>
            <button v-if="row.set.crossword" type="button" class="btn btn-secondary btn-sm" title="列印解答版" @click="printPuzzle(row.set, 'answer')">🔑 解答</button>
            <RouterLink :to="`/settings/puzzles/crossword/${row.set.id}`" class="btn btn-secondary btn-sm">✏️</RouterLink>
            <button type="button" class="btn btn-danger btn-sm" title="刪除" @click="deleteSet(row.set)">🗑</button>
          </span>
        </li>
      </ul>
    </div>

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
          <input v-model.number="autoWordCount" type="number" min="0" :max="selectedBankItemCount" placeholder="建議 12-20" title="0=全部；詞越多 grid 越大，建議 12-20" style="width: 5rem; padding: 0.4rem; border: 1px solid var(--border); border-radius: var(--radius)" />
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
        <button type="button" class="btn btn-secondary" :disabled="!autoBankId || selectedItemIds.size === 0" title="僅使用上方勾選的詞句出題" @click="generateFromSelected">用所選句子出題</button>
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

      <!-- 連通性預覽：告訴使用者這組詞能不能縱橫交錯 -->
      <div v-if="connectivityPreview" class="conn-preview" :class="{
        'conn-good': connectivityPreview.largestRatio >= 0.8 && connectivityPreview.isolatedCount === 0,
        'conn-warn': connectivityPreview.largestRatio < 0.8 || connectivityPreview.isolatedCount > 0,
        'conn-bad': connectivityPreview.largestRatio < 0.5,
      }">
        <strong>🔗 詞集連通性</strong>
        <span>
          {{ connectivityPreview.totalWords }} 詞 ·
          {{ connectivityPreview.componentCount }} 個叢集 ·
          最大叢集 {{ connectivityPreview.largestSize }} 詞（{{ Math.round(connectivityPreview.largestRatio * 100) }}%）
          <span v-if="connectivityPreview.isolatedCount > 0">
            · 孤立詞 {{ connectivityPreview.isolatedCount }}
          </span>
        </span>
        <span v-if="connectivityPreview.largestRatio < 0.6" class="conn-hint">
          ⚠ 此詞集天生難以縱橫交錯，建議換詞或降低難度
        </span>
      </div>
    </div>

  </div>

</template>

<script setup lang="ts">
import { computed, nextTick, ref, watchEffect } from "vue";
import { useRouter } from "vue-router";
import { usePuzzleSetsStore, generateId } from "@/stores/puzzleSets";
import { useGameSessionStore } from "@/stores/gameSession";
import { useWordBanksStore } from "@/stores/wordBanks";
import {
  generateCrosswordPuzzle,
  analyzeConnectivity,
  computeCrosswordStats,
} from "@/lib/crosswordGenerator";
import { printCrosswordPuzzle } from "@/lib/printCrossword";
import type { DifficultyTier, PuzzleSet, WordBankItem } from "@/lib/types";
import { BUILTIN_CHENGYU_BANK_ID } from "@/data/defaultChengyuBank";

const router = useRouter();
const puzzleSets = usePuzzleSetsStore();
const gameSession = useGameSessionStore();
const wordBanks = useWordBanksStore();

const autoBankId = ref("");
const autoTier = ref<DifficultyTier>(1);
const autoWordCount = ref(15);
const showHistory = ref(false);
const historyPanelRef = ref<HTMLElement | null>(null);

function toggleHistory() {
  showHistory.value = !showHistory.value;
  if (showHistory.value) {
    nextTick(() => {
      historyPanelRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}
const selectedItemIds = ref<Set<string>>(new Set());
/** 排除已在出題記錄中使用過的詞句（不從詞庫刪除，僅本輪不選） */
const excludeUsedItems = ref(false);

watchEffect(() => {
  if (autoBankId.value) return;
  const builtIn = wordBanks.banks.find((b) => b.id === BUILTIN_CHENGYU_BANK_ID);
  autoBankId.value = builtIn?.id ?? wordBanks.banks[0]?.id ?? "";
});

const selectedBankItemCount = computed(() => {
  const bank = wordBanks.banks.find((b) => b.id === autoBankId.value);
  return bank?.items.length ?? 0;
});

const selectedBank = computed(() =>
  wordBanks.banks.find((b) => b.id === autoBankId.value) ?? null
);

/** 當前勾選/全部詞集的連通性預覽 */
const connectivityPreview = computed(() => {
  if (!selectedBank.value) return null;
  const items = selectedItemIds.value.size > 0
    ? selectedBank.value.items.filter((it) => selectedItemIds.value.has(it.id))
    : selectedBank.value.items;
  if (items.length < 2) return null;
  const report = analyzeConnectivity(items);
  return {
    totalWords: items.length,
    componentCount: report.components.length,
    largestSize: report.components[0]?.length ?? 0,
    largestRatio: report.largestComponentRatio,
    isolatedCount: report.isolatedItems.length,
  };
});

function toggleItem(id: string) {
  const s = new Set(selectedItemIds.value);
  if (s.has(id)) s.delete(id); else s.add(id);
  selectedItemIds.value = s;
}

/** 僅練習模式產生的題組（不含設定頁手動出題） */
const crosswordSets = computed(() =>
  puzzleSets.sets.filter((s) => s.type === "crossword" && s.source !== "manual")
);

/** 歷史列表預計算統計，避免 template 內多次呼叫 */
const crosswordHistoryRows = computed(() =>
  crosswordSets.value.map((s) => ({
    set: s,
    stats: s.crossword ? (s.crossword.stats ?? computeCrosswordStats(s.crossword)) : null,
  }))
);

function onHintsChange(e: Event) {
  const v = (e.target as HTMLInputElement).checked;
  gameSession.setSettings({ showHints: v });
}

/** 連通性預檢：詞集分裂時讓使用者意識到「天生無法縱橫交錯」 */
function precheckConnectivity(items: WordBankItem[]): { proceed: boolean } {
  if (items.length < 2) return { proceed: true };
  const report = analyzeConnectivity(items);
  const tierCfgHard = autoTier.value >= 4;
  // 最大連通分量佔比很低、或有孤立詞時才提示
  if (report.components.length > 1 && report.largestComponentRatio < 0.6) {
    const percent = Math.round(report.largestComponentRatio * 100);
    const compSummary = report.components
      .slice(0, 3)
      .map((c) => `${c.length} 個詞（例：${c.slice(0, 2).map((i) => i.text).join("、")}${c.length > 2 ? "…" : ""}）`)
      .join("\n  ");
    const msg = `⚠ 詞集分成 ${report.components.length} 個不相連叢集，最大叢集只佔 ${percent}%：\n  ${compSummary}\n\n${tierCfgHard
      ? "高難度模式只會採用能縱橫交錯的子集，其他詞會被排除。"
      : "出題時將無法全部縱橫交錯，部分詞會變成孤立填空。"}\n\n是否繼續？`;
    return { proceed: confirm(msg) };
  }
  if (report.isolatedItems.length > 0 && tierCfgHard) {
    const isoList = report.isolatedItems.map((i) => i.text).join("、");
    const msg = `⚠ 以下 ${report.isolatedItems.length} 個詞與其他詞完全無共字：\n  ${isoList}\n\n高難度模式會自動排除它們。是否繼續？`;
    return { proceed: confirm(msg) };
  }
  return { proceed: true };
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

  const subset =
    autoWordCount.value && autoWordCount.value > 0 && autoWordCount.value < itemsToUse.length
      ? itemsToUse
      : itemsToUse;
  if (!precheckConnectivity(subset).proceed) return;

  const result = generateCrosswordPuzzle({
    items: itemsToUse,
    tier: autoTier.value,
    wordCount: autoWordCount.value || undefined,
  });
  if (!result) {
    alert("無法產生填字題，請確認詞句庫有足夠詞條。");
    return;
  }
  if (result.warnings.length > 0) {
    alert(result.warnings.join("\n\n"));
  }
  const set = {
    id: generateId(),
    title: `隨機出題 · ${result.puzzle.levelTitle}`,
    type: "crossword" as const,
    createdAt: new Date().toISOString(),
    source: "practice" as const,
    crossword: result.puzzle,
  };
  puzzleSets.addSet(set);
  router.push(`/play/crossword/${set.id}`);
}

/** 僅用勾選的詞句出題（不隨機抽數量，全部選中的句子都放入，並盡量縱橫交錯） */
function generateFromSelected() {
  const bank = wordBanks.banks.find((b) => b.id === autoBankId.value);
  if (!bank || bank.items.length === 0) {
    alert("請選擇有詞條的詞句庫");
    return;
  }
  if (selectedItemIds.value.size === 0) {
    alert("請先勾選要使用的詞句");
    return;
  }
  const itemsToUse = bank.items.filter((it) => selectedItemIds.value.has(it.id));
  if (itemsToUse.length === 0) {
    alert("請至少勾選一個詞句");
    return;
  }

  if (!precheckConnectivity(itemsToUse).proceed) return;

  const result = generateCrosswordPuzzle({
    items: itemsToUse,
    tier: autoTier.value,
    wordCount: undefined,
  });
  if (!result) {
    alert("無法產生填字題，請確認所選詞句有可交叉的字。");
    return;
  }
  if (result.warnings.length > 0) {
    alert(result.warnings.join("\n\n"));
  }
  const set = {
    id: generateId(),
    title: `所選出題 · ${result.puzzle.levelTitle}`,
    type: "crossword" as const,
    createdAt: new Date().toISOString(),
    source: "practice" as const,
    crossword: result.puzzle,
  };
  puzzleSets.addSet(set);
  router.push(`/play/crossword/${set.id}`);
}


function deleteSet(set: PuzzleSet) {
  if (!confirm(`確定要刪除「${set.title}」？此操作無法復原。`)) return;
  puzzleSets.removeSet(set.id);
}

function printPuzzle(set: PuzzleSet, mode: "solve" | "answer" = "solve") {
  const c = set.crossword;
  if (!c?.grid) return;
  printCrosswordPuzzle(c, { title: set.title, mode });
}
</script>

<style scoped>
.empty-state { color: var(--text-muted); font-size: 0.9rem; padding: 0.5rem 0; text-align: center; }
.history-list { list-style: none; padding: 0; margin: 0; }
.history-item { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-bottom: 1px solid var(--border); flex-wrap: wrap; gap: 0.5rem; }
.history-item:last-child { border-bottom: none; }
.actions { display: flex; gap: 0.35rem; }
.btn-sm { padding: 0.3rem 0.7rem; font-size: 0.8rem; }
.btn-danger { background: #fecaca; color: #991b1b; border: 1px solid #f87171; }
.btn-danger:hover { background: #fca5a5; }
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

.conn-preview {
  margin-top: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius);
  font-size: 0.85rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 0.85rem;
  align-items: center;
  border: 1px solid var(--border);
  background: #f8f5ef;
}
.conn-preview.conn-good { background: #ecfdf5; border-color: #6ee7b7; color: #065f46; }
.conn-preview.conn-warn { background: #fef9c3; border-color: #fde047; color: #854d0e; }
.conn-preview.conn-bad  { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.conn-hint { font-weight: 600; }

.history-info { display: flex; flex-direction: column; gap: 0.15rem; }
.history-stats { font-size: 0.78rem; color: var(--text-muted); }
.history-stats .stat-cross { color: #059669; }
.history-stats .stat-bad { color: #b91c1c; }
.history-grid { color: #6b7280; }

.history-card {
  border: 2px solid var(--primary);
  background: #fef9f5;
  scroll-margin-top: 1rem;
}
.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}
.btn-secondary.active {
  background: #dbeafe;
  border-color: #60a5fa;
  color: #1d4ed8;
}
</style>
