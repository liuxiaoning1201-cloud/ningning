/**
 * 把填字題列印到 A4 紙：
 *   - 自動挑選縱向／橫向，取得「最大可讀格子尺寸」
 *   - 提示文字依方向放在右側或下方
 *   - 提供 min 格子尺寸保底，超大 grid 會被縮成「全字塊」但仍能列印（以便核對）
 *   - 開新分頁、加載完自動觸發列印
 */
import type { CrosswordPuzzle } from "@/lib/types";

export interface PrintOptions {
  title: string;
  /** 列印模式：solve = 可填寫的空白版；answer = 含解答 */
  mode?: "solve" | "answer";
}

/** A4 可印區（mm）：去掉 7mm 邊距 */
const A4_USABLE_PORTRAIT = { w: 196, h: 283 };
const A4_USABLE_LANDSCAPE = { w: 283, h: 196 };

/** 提示區預估佔用（mm） */
const CLUE_AREA_PORTRAIT_H = 90; // 提示在下方時佔的高度
const CLUE_AREA_LANDSCAPE_W = 95; // 提示在右側時佔的寬度

/** 格子尺寸範圍（mm） */
const MAX_CELL = 8;
const MIN_CELL = 3;

function chooseLayout(rows: number, cols: number): {
  orientation: "portrait" | "landscape";
  cellMM: number;
  cluesPosition: "below" | "right";
} {
  // 縱向：grid 在上、提示在下
  const portraitW = A4_USABLE_PORTRAIT.w;
  const portraitH = A4_USABLE_PORTRAIT.h - CLUE_AREA_PORTRAIT_H;
  const portraitCell = Math.min(portraitW / cols, portraitH / rows);

  // 橫向：grid 在左、提示在右
  const landscapeW = A4_USABLE_LANDSCAPE.w - CLUE_AREA_LANDSCAPE_W;
  const landscapeH = A4_USABLE_LANDSCAPE.h;
  const landscapeCell = Math.min(landscapeW / cols, landscapeH / rows);

  // 取格子較大的方向
  const useLandscape = landscapeCell > portraitCell;
  const rawCell = useLandscape ? landscapeCell : portraitCell;
  const cellMM = Math.max(MIN_CELL, Math.min(MAX_CELL, rawCell));

  return {
    orientation: useLandscape ? "landscape" : "portrait",
    cellMM,
    cluesPosition: useLandscape ? "right" : "below",
  };
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 列印一份填字題到新分頁。回傳 true 表示已開啟列印。 */
export function printCrosswordPuzzle(
  puzzle: CrosswordPuzzle,
  opts: PrintOptions
): boolean {
  const c = puzzle;
  if (!c?.grid || c.grid.length === 0) return false;

  const rows = c.grid.length;
  const cols = c.grid[0]?.length ?? 0;
  if (cols === 0) return false;

  const layout = chooseLayout(rows, cols);
  const sizeMM = layout.cellMM;
  // 字體大小：格子 0.55 倍，最小 6pt 確保可讀
  const charPt = Math.max(6, sizeMM * 1.6);
  const indPt = Math.max(4, sizeMM * 0.7);

  const showAnswer = opts.mode === "answer";

  // 構建格子標號 map（指示題號箭頭）
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

  // 構建格子 HTML
  let cellsHtml = "";
  for (let r = 0; r < rows; r++) {
    for (let ci = 0; ci < cols; ci++) {
      const cell = c.grid[r]?.[ci];
      if (!cell) { cellsHtml += `<span class="c cb"></span>`; continue; }
      const ind = indicators[`${r},${ci}`];
      let indHtml = "";
      if (ind) {
        indHtml = `<span class="ind">`;
        if (ind.hLabel) indHtml += `<span class="ih">${esc(ind.hLabel)}→</span>`;
        if (ind.vLabel) indHtml += `<span class="iv">${esc(ind.vLabel)}↓</span>`;
        indHtml += `</span>`;
      }
      if (cell.type === "block") {
        cellsHtml += `<span class="c cb"></span>`;
      } else if (cell.type === "given") {
        cellsHtml += `<span class="c cg">${indHtml}<span class="cv">${esc(cell.value)}</span></span>`;
      } else {
        // blank：solve 模式空白；answer 模式顯示正解
        if (showAnswer) {
          const ans = getAnswerChar(c, r, ci);
          cellsHtml += `<span class="c ca">${indHtml}<span class="cv">${esc(ans ?? "")}</span></span>`;
        } else {
          cellsHtml += `<span class="c ce">${indHtml}</span>`;
        }
      }
    }
  }

  let hCluesHtml = "";
  for (const h of c.horizontalClues) hCluesHtml += `<li><b class="lh">${esc(h.label)}.</b> ${esc(h.clue)}</li>`;
  let vCluesHtml = "";
  for (const v of c.verticalClues) vCluesHtml += `<li><b class="lv">${esc(v.label)}.</b> ${esc(v.clue)}</li>`;

  const wrapCss = layout.cluesPosition === "right"
    ? "display:flex;flex-direction:row;gap:6mm;align-items:flex-start"
    : "display:flex;flex-direction:column;gap:5mm;align-items:center";
  const cluesCss = layout.cluesPosition === "right"
    ? "flex:1;font-size:9pt;line-height:1.45"
    : `width:100%;display:flex;gap:8mm;font-size:9pt;line-height:1.45;max-height:${CLUE_AREA_PORTRAIT_H - 5}mm;overflow:hidden`;
  const clueColCss = layout.cluesPosition === "right" ? "" : "flex:1";

  const subtitle = `難度 ${c.difficulty} 星 · ${c.levelTitle}` +
    (showAnswer ? "（解答版）" : "") +
    ` · ${rows}×${cols}`;

  const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="UTF-8"><title>${esc(opts.title)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;color:#222;background:#fff}
  h1{font-size:14pt;text-align:center;margin-bottom:1mm}
  .sub{text-align:center;color:#666;font-size:9pt;margin-bottom:3mm}
  .wrap{${wrapCss}}
  .grid{display:grid;gap:0;grid-template-columns:repeat(${cols},${sizeMM}mm);grid-template-rows:repeat(${rows},${sizeMM}mm);flex-shrink:0}
  .c{position:relative;width:${sizeMM}mm;height:${sizeMM}mm;display:flex;align-items:flex-end;justify-content:center;font-weight:800;border:0.4pt solid #888;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding-bottom:0.3mm}
  .cb{background:#eae6df;border-color:#c5bfb3}
  .cg{background:#e8f4fd;border-color:#90c8f0}
  .ce{background:#fffbf2;border:0.5pt dashed #e0a050}
  .ca{background:#fff9d6;border:0.5pt solid #d4a76a}
  .cv{font-size:${charPt}pt;color:#1a1a1a;z-index:1;line-height:1}
  .ind{position:absolute;top:0.2mm;left:0.4mm;display:flex;gap:0.3mm;line-height:1;font-size:${indPt}pt;font-weight:600;z-index:2}
  .ih{color:#2563eb}
  .iv{color:#dc2626}
  .clues{${cluesCss}}
  .clue-col{${clueColCss}}
  .clues h3{font-size:10pt;margin:0 0 1mm;font-weight:700}
  .clues ul{padding-left:5mm;margin:0 0 3mm}
  .clues li{margin-bottom:0.3mm}
  .lh{color:#1d4ed8;font-weight:700}
  .lv{color:#b91c1c;font-weight:700}
  @page{size:A4 ${layout.orientation};margin:7mm}
</style></head><body>
<h1>${esc(opts.title)}</h1>
<p class="sub">${esc(subtitle)}</p>
<div class="wrap">
  <div class="grid">${cellsHtml}</div>
  <div class="clues">
    <div class="clue-col"><h3 style="color:#1d4ed8">→ 橫向提示</h3><ul>${hCluesHtml}</ul></div>
    <div class="clue-col"><h3 style="color:#b91c1c">↓ 豎向提示</h3><ul>${vCluesHtml}</ul></div>
  </div>
</div></body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (!w) {
    alert("無法開啟列印頁面，請允許彈出視窗後重試。");
    URL.revokeObjectURL(url);
    return false;
  }
  w.addEventListener("afterprint", () => {
    w.close();
    URL.revokeObjectURL(url);
  });
  w.onload = () => {
    setTimeout(() => w.print(), 300);
  };
  return true;
}

function getAnswerChar(p: CrosswordPuzzle, r: number, c: number): string | null {
  for (const w of p.words) {
    if (w.direction === "horizontal") {
      if (r === w.startRow && c >= w.startCol && c < w.startCol + w.text.length) {
        return w.text[c - w.startCol] ?? null;
      }
    } else {
      if (c === w.startCol && r >= w.startRow && r < w.startRow + w.text.length) {
        return w.text[r - w.startRow] ?? null;
      }
    }
  }
  return null;
}
