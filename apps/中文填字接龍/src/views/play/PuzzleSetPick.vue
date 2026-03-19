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
            <RouterLink :to="`/settings/puzzles/crossword/${set.id}`" class="btn btn-secondary btn-sm">✏️ 編輯</RouterLink>
            <button v-if="set.crossword" type="button" class="btn btn-secondary btn-sm" title="列印" @click="printPuzzle(set)">🖨️ 列印</button>
            <button type="button" class="btn btn-danger btn-sm" title="刪除" @click="deleteSet(set)">🗑️</button>
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
import type { DifficultyTier, PuzzleSet } from "@/lib/types";

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

/** 僅練習模式產生的題組（不含設定頁手動出題） */
const crosswordSets = computed(() =>
  puzzleSets.sets.filter((s) => s.type === "crossword" && s.source !== "manual")
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
    source: "practice" as const,
    crossword: puzzle,
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
  const puzzle = generateCrosswordPuzzle({
    items: itemsToUse,
    tier: autoTier.value,
    wordCount: undefined,
  });
  if (!puzzle) {
    alert("無法產生填字題，請確認所選詞句有可交叉的字。");
    return;
  }
  const set = {
    id: generateId(),
    title: `所選出題 · ${puzzle.levelTitle}`,
    type: "crossword" as const,
    createdAt: new Date().toISOString(),
    source: "practice" as const,
    crossword: puzzle,
  };
  puzzleSets.addSet(set);
  router.push(`/play/crossword/${set.id}`);
}

function deleteSet(set: PuzzleSet) {
  if (!confirm(`確定要刪除「${set.title}」？此操作無法復原。`)) return;
  puzzleSets.removeSet(set.id);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printPuzzle(set: PuzzleSet) {
  const c = set.crossword;
  if (!c?.grid) return;

  const rows = c.grid.length;
  const cols = c.grid[0]?.length ?? 0;

  // Build per-cell indicator map (same logic as CrosswordPlay)
  const indicators: Record<string, { hLabel?: string; vLabel?: string }> = {};
  const hClueMap = new Map<string, string>();
  const vClueMap = new Map<string, string>();
  for (const cl of c.horizontalClues) hClueMap.set(cl.id, cl.label);
  for (const cl of c.verticalClues) vClueMap.set(cl.id, cl.label);
  for (const w of c.words) {
    const key = `${w.startRow},${w.startCol}`;
    const cur = indicators[key] ?? {};
    if (w.direction === "horizontal") cur.hLabel = hClueMap.get(w.id) ?? cur.hLabel;
    else cur.vLabel = vClueMap.get(w.id) ?? cur.vLabel;
    indicators[key] = cur;
  }

  let cells = "";
  for (let r = 0; r < rows; r++) {
    for (let ci = 0; ci < cols; ci++) {
      const cell = c.grid[r]?.[ci];
      if (!cell) continue;
      const ind = indicators[`${r},${ci}`];
      let indHtml = "";
      if (ind) {
        indHtml = `<span class="ind">`;
        if (ind.hLabel) indHtml += `<span class="ih">${esc(ind.hLabel)}→</span>`;
        if (ind.vLabel) indHtml += `<span class="iv">${esc(ind.vLabel)}↓</span>`;
        indHtml += `</span>`;
      }
      if (cell.type === "block") cells += `<span class="c cb"></span>`;
      else if (cell.type === "given") cells += `<span class="c cg">${indHtml}<span class="cv">${esc(cell.value)}</span></span>`;
      else cells += `<span class="c ce">${indHtml}</span>`;
    }
  }

  let hClues = "";
  for (const h of c.horizontalClues) hClues += `<li><b class="lh">${esc(h.label)}.</b> ${esc(h.clue)}</li>`;
  let vClues = "";
  for (const v of c.verticalClues) vClues += `<li><b class="lv">${esc(v.label)}.</b> ${esc(v.clue)}</li>`;

  // 豎向格子(rows > cols*1.2)：提示在右側；方形格子：提示在下方
  const isTall = rows > cols * 1.2;

  const maxGridWidth = isTall ? 400 : 580;
  const sz = Math.min(32, Math.floor(maxGridWidth / Math.max(cols, 1)));
  const szPx = `${sz}px`;
  const charFontPx = Math.max(10, sz - 12);
  const indFontPx = Math.max(6, Math.floor(sz * 0.28));

  const wrapCss = isTall
    ? "display:flex;flex-direction:row;gap:14px;align-items:flex-start"
    : "display:flex;flex-direction:column;gap:10px;align-items:center";
  const cluesCss = isTall
    ? "flex:1;font-size:11px;line-height:1.55"
    : "width:100%;display:flex;gap:20px;font-size:11px;line-height:1.55";
  const clueColCss = isTall ? "" : "flex:1";

  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${esc(set.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;padding:0.8cm;background:#fff;color:#333}
h1{font-size:18px;text-align:center;margin-bottom:3px;color:#333}
.sub{text-align:center;color:#666;font-size:11px;margin-bottom:10px}
.wrap{${wrapCss}}
.grid{display:grid;gap:0;grid-template-columns:repeat(${cols},${szPx});grid-template-rows:repeat(${rows},${szPx});flex-shrink:0}
.c{position:relative;width:${szPx};height:${szPx};display:flex;align-items:flex-end;justify-content:center;
  font-weight:800;border:1.2px solid #888;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding-bottom:1px}
.cb{background:#eae6df;border-color:#c5bfb3}
.cg{background:#e8f4fd;border-color:#90c8f0}
.ce{background:#fffbf2;border:1.5px dashed #e0a050}
.cv{font-size:${charFontPx}px;color:#1a1a1a;z-index:1}
.ind{position:absolute;top:0;left:1px;display:flex;gap:1px;line-height:1;font-size:${indFontPx}px;font-weight:600;z-index:2}
.ih{color:#2563eb}
.iv{color:#dc2626}
.clues{${cluesCss}}
.clue-col{${clueColCss}}
.clues h3{font-size:12px;margin:0 0 3px;font-weight:700}
.clues ul{padding-left:16px;margin:0 0 8px}
.clues li{margin-bottom:1px}
.lh{color:#1d4ed8;font-weight:700}
.lv{color:#b91c1c;font-weight:700}
@media print{
  @page{size:A4;margin:0.6cm}
  body{padding:0.5cm}
}
</style></head><body>
<h1>${esc(set.title)}</h1>
<p class="sub">難度 ${c.difficulty} 星 · ${esc(c.levelTitle)}</p>
<div class="wrap">
<div class="grid">${cells}</div>
<div class="clues">
<div class="clue-col"><h3 style="color:#1d4ed8">→ 橫向提示</h3><ul>${hClues}</ul></div>
<div class="clue-col"><h3 style="color:#b91c1c">↓ 豎向提示</h3><ul>${vClues}</ul></div>
</div></div></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (!w) { alert("無法開啟列印頁面，請允許彈出視窗後重試。"); URL.revokeObjectURL(url); return; }
  w.addEventListener("afterprint", () => { w.close(); URL.revokeObjectURL(url); });
  w.onload = () => { setTimeout(() => w.print(), 300); };
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
</style>
