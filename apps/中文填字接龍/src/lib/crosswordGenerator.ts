/**
 * 填字生成器 v4：
 *   - tier 真正影響佈局策略（不只是挖空比例）
 *   - 評分以「交叉數 / 孤立詞數」為主，放詞數量為輔
 *   - 高難度禁用 forcePlace，放不下的詞主動排除並回報
 *   - 回傳真實統計，UI 可信任不再「數據不準」
 */

import { generateId } from "@/stores/puzzleSets";
import type { WordBankItem } from "@/lib/types";
import type {
  CrosswordPuzzle,
  CrosswordCell,
  CrosswordWord,
  CrosswordStats,
  DifficultyTier,
} from "@/lib/types";

export interface GeneratorInput {
  items: WordBankItem[];
  tier: DifficultyTier;
  wordCount?: number;
}

/** 生成器輸出（比舊版 `CrosswordPuzzle | null` 多帶統計與被放棄的詞） */
export interface GeneratorOutput {
  puzzle: CrosswordPuzzle;
  stats: CrosswordStats;
  /** 放不進去而被排除的詞文字（僅高難度模式會發生；低難度會 forcePlace） */
  droppedTexts: string[];
  /** 給使用者看的警示訊息（例：詞集連通性弱、已排除某些詞） */
  warnings: string[];
}

/** 連通性分析結果：判斷詞集能不能縱橫交錯 */
export interface ConnectivityReport {
  /** 每個連通分量（按大小倒序） */
  components: WordBankItem[][];
  /** 最大連通分量所佔比例（0–1），越大越容易排得密 */
  largestComponentRatio: number;
  /** 完全沒和其他詞共字的「雞肋詞」 */
  isolatedItems: WordBankItem[];
}

const TIER_TITLE: Record<DifficultyTier, string> = {
  1: "★ 入門",
  2: "★★ 初學",
  3: "★★★ 中等",
  4: "★★★★ 挑戰",
  5: "★★★★★ 大師",
};

interface TierConfig {
  /** 嘗試次數倍率（詞越多、tier 越高，嘗試越多） */
  attemptsMultiplier: number;
  /** 最多允許多少比例的孤立詞（達標才採用該佈局，超過則退化或丟棄詞再試）。0 = 絕不容許孤立詞 */
  maxIsolatedRatio: number;
  /** 每個詞最低交叉數要求（大師模式可設 2） */
  minCrossingsPerWord: number;
  /** 交叉加權（評分權重） */
  crossingWeight: number;
  /** 孤立詞懲罰權重 */
  isolationPenalty: number;
}

/**
 * 所有 tier 都允許「多叢集放置」（seed + cross）以最大化交叉率。
 * 難度差異主要體現在：
 *   - `maxIsolatedRatio`：高難度禁止孤立詞，找不到可完全交叉的佈局就會移除孤立詞
 *   - `minCrossingsPerWord`：大師模式要求每個詞 ≥ 2 交叉
 *   - `blanksForWord`：挖空比例隨 tier 遞增
 */
const TIER_CONFIG: Record<DifficultyTier, TierConfig> = {
  1: { attemptsMultiplier: 1,   maxIsolatedRatio: 1.0, minCrossingsPerWord: 0, crossingWeight: 200, isolationPenalty: 50   },
  2: { attemptsMultiplier: 1.5, maxIsolatedRatio: 0.5, minCrossingsPerWord: 0, crossingWeight: 300, isolationPenalty: 150  },
  3: { attemptsMultiplier: 2.5, maxIsolatedRatio: 0.2, minCrossingsPerWord: 1, crossingWeight: 450, isolationPenalty: 350  },
  4: { attemptsMultiplier: 5,   maxIsolatedRatio: 0,   minCrossingsPerWord: 1, crossingWeight: 600, isolationPenalty: 800  },
  5: { attemptsMultiplier: 10,  maxIsolatedRatio: 0,   minCrossingsPerWord: 2, crossingWeight: 800, isolationPenalty: 1200 },
};

/**
 * 每個詞要挖多少格為空。保證隨 tier 嚴格單調遞增（在長度允許範圍內）。
 * tier 1: ~30%，tier 5: 100%。
 */
function blanksForWord(len: number, tier: DifficultyTier): number {
  if (len <= 0) return 0;
  const ratios: Record<DifficultyTier, number> = {
    1: 0.30,
    2: 0.50,
    3: 0.70,
    4: 0.85,
    5: 1.0,
  };
  const raw: number[] = [1, 2, 3, 4, 5].map((t) =>
    Math.max(1, Math.min(len, Math.round(len * ratios[t as DifficultyTier])))
  );
  for (let i = 1; i < 5; i++) {
    if (raw[i] <= raw[i - 1] && raw[i - 1] < len) raw[i] = Math.min(len, raw[i - 1] + 1);
  }
  return raw[tier - 1];
}

interface PlacedWord {
  word: string;
  dir: "h" | "v";
  r: number;
  c: number;
  item: WordBankItem | undefined;
  /** 是否為 forcePlace 強制塞入（不算真實交叉） */
  forced?: boolean;
}

class VirtualGrid {
  private cells = new Map<string, string>();

  private k(r: number, c: number): string {
    return `${r},${c}`;
  }

  get(r: number, c: number): string | null {
    return this.cells.get(this.k(r, c)) ?? null;
  }

  set(r: number, c: number, ch: string): boolean {
    const existing = this.get(r, c);
    if (existing !== null && existing !== ch) return false;
    this.cells.set(this.k(r, c), ch);
    return true;
  }

  canPlace(word: string, r: number, c: number, dir: "h" | "v"): boolean {
    let hasOverlap = false;
    for (let k = 0; k < word.length; k++) {
      const cr = dir === "h" ? r : r + k;
      const cc = dir === "h" ? c + k : c;
      const existing = this.get(cr, cc);
      if (existing !== null) {
        if (existing !== word[k]) return false;
        hasOverlap = true;
      } else {
        if (dir === "h") {
          if (this.get(cr - 1, cc) !== null || this.get(cr + 1, cc) !== null) return false;
        } else {
          if (this.get(cr, cc - 1) !== null || this.get(cr, cc + 1) !== null) return false;
        }
      }
    }
    if (dir === "h") {
      if (this.get(r, c - 1) !== null) return false;
      if (this.get(r, c + word.length) !== null) return false;
    } else {
      if (this.get(r - 1, c) !== null) return false;
      if (this.get(r + word.length, c) !== null) return false;
    }
    return hasOverlap;
  }

  place(word: string, r: number, c: number, dir: "h" | "v") {
    for (let k = 0; k < word.length; k++) {
      const cr = dir === "h" ? r : r + k;
      const cc = dir === "h" ? c + k : c;
      this.set(cr, cc, word[k]);
    }
  }

  forcePlace(word: string, r: number, c: number, dir: "h" | "v") {
    for (let k = 0; k < word.length; k++) {
      const cr = dir === "h" ? r : r + k;
      const cc = dir === "h" ? c + k : c;
      this.cells.set(this.k(cr, cc), word[k]);
    }
  }

  getBounds(): { minR: number; maxR: number; minC: number; maxC: number } {
    let minR = Infinity,
      maxR = -Infinity,
      minC = Infinity,
      maxC = -Infinity;
    for (const key of this.cells.keys()) {
      const [r, c] = key.split(",").map(Number);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
    }
    if (minR === Infinity) return { minR: 0, maxR: 0, minC: 0, maxC: 0 };
    return { minR, maxR, minC, maxC };
  }

  countCells(): number {
    return this.cells.size;
  }
}

/** 詞集的共字連通分析：用於預警 + 高難度時挑選要丟棄的詞 */
export function analyzeConnectivity(items: WordBankItem[]): ConnectivityReport {
  const valid = items.filter((it) => it.text.trim().length > 0);
  const n = valid.length;
  if (n === 0) {
    return { components: [], largestComponentRatio: 0, isolatedItems: [] };
  }

  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const ci = new Set(valid[i].text.trim().split(""));
    for (let j = i + 1; j < n; j++) {
      const cj = valid[j].text.trim().split("");
      if (cj.some((ch) => ci.has(ch))) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const visited = new Array<boolean>(n).fill(false);
  const components: WordBankItem[][] = [];
  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    const stack = [i];
    const comp: WordBankItem[] = [];
    while (stack.length > 0) {
      const cur = stack.pop()!;
      if (visited[cur]) continue;
      visited[cur] = true;
      comp.push(valid[cur]);
      for (const nb of adj[cur]) if (!visited[nb]) stack.push(nb);
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);

  const isolatedItems: WordBankItem[] = [];
  for (let i = 0; i < n; i++) {
    if (adj[i].length === 0) isolatedItems.push(valid[i]);
  }

  return {
    components,
    largestComponentRatio: components.length > 0 ? components[0].length / n : 0,
    isolatedItems,
  };
}

/** 從已有的 puzzle 物件重新計算統計（舊資料沒有 stats 時可用） */
export function computeCrosswordStats(puzzle: CrosswordPuzzle): CrosswordStats {
  // 舊資料可能缺欄位；安全降級回傳 0
  if (!puzzle?.grid || !Array.isArray(puzzle.grid) || puzzle.grid.length === 0) {
    return {
      totalWords: 0, crossedWords: 0, isolatedWords: 0,
      crossingCells: 0, totalCells: 0, crossRate: 0,
      avgCrossPerWord: 0, density: 0,
    };
  }
  const words = Array.isArray(puzzle.words) ? puzzle.words : [];
  const rows = puzzle.grid.length;
  const cols = puzzle.grid[0]?.length ?? 0;
  const cellOwners = new Map<string, Set<"h" | "v">>();

  for (const w of words) {
    const d: "h" | "v" = w.direction === "horizontal" ? "h" : "v";
    for (let k = 0; k < w.text.length; k++) {
      const r = d === "h" ? w.startRow : w.startRow + k;
      const c = d === "h" ? w.startCol + k : w.startCol;
      const key = `${r},${c}`;
      if (!cellOwners.has(key)) cellOwners.set(key, new Set());
      cellOwners.get(key)!.add(d);
    }
  }

  let totalCells = 0;
  let crossingCells = 0;
  for (const [, dirs] of cellOwners) {
    totalCells++;
    if (dirs.size === 2) crossingCells++;
  }

  const perWordCrossings = words.map((w) => {
    const d: "h" | "v" = w.direction === "horizontal" ? "h" : "v";
    let cnt = 0;
    for (let k = 0; k < w.text.length; k++) {
      const r = d === "h" ? w.startRow : w.startRow + k;
      const c = d === "h" ? w.startCol + k : w.startCol;
      const owners = cellOwners.get(`${r},${c}`);
      if (owners && owners.size === 2) cnt++;
    }
    return cnt;
  });

  const totalWords = words.length;
  const crossedWords = perWordCrossings.filter((n) => n > 0).length;
  const isolatedWords = totalWords - crossedWords;

  return {
    totalWords,
    crossedWords,
    isolatedWords,
    crossingCells,
    totalCells,
    crossRate: totalCells > 0 ? crossingCells / totalCells : 0,
    avgCrossPerWord: totalWords > 0 ? (2 * crossingCells) / totalWords : 0,
    density: rows * cols > 0 ? totalCells / (rows * cols) : 0,
  };
}

/** 評估某個已排好的佈局（算 perWordCrossings / totalCrossings / isolatedCount） */
function evaluateLayout(placed: PlacedWord[]): {
  totalCrossings: number;
  crossedWords: number;
  isolatedWords: number;
  minPerWord: number;
} {
  const cellOwners = new Map<string, Set<"h" | "v">>();
  for (const pw of placed) {
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      const key = `${r},${c}`;
      if (!cellOwners.has(key)) cellOwners.set(key, new Set());
      cellOwners.get(key)!.add(pw.dir);
    }
  }
  let totalCrossings = 0;
  for (const [, dirs] of cellOwners) if (dirs.size === 2) totalCrossings++;

  const perWord = placed.map((pw) => {
    let cnt = 0;
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      const owners = cellOwners.get(`${r},${c}`);
      if (owners && owners.size === 2) cnt++;
    }
    return cnt;
  });
  const crossedWords = perWord.filter((n) => n > 0).length;
  const isolatedWords = placed.length - crossedWords;
  const minPerWord = perWord.length > 0 ? Math.min(...perWord) : 0;

  return { totalCrossings, crossedWords, isolatedWords, minPerWord };
}

export function generateCrosswordPuzzle(input: GeneratorInput): GeneratorOutput | null {
  const { items, tier } = input;
  const cfg = TIER_CONFIG[tier];

  let allItems = items.filter((it) => it.text.trim().length > 0);
  if (allItems.length === 0) return null;

  if (input.wordCount && input.wordCount > 0 && input.wordCount < allItems.length) {
    const shuffled = [...allItems].sort(() => Math.random() - 0.5);
    allItems = shuffled.slice(0, input.wordCount);
  }

  const warnings: string[] = [];

  // 嘗試從最大詞集開始排版；若不符合 tier 約束且禁用 forcePlace，
  // 逐步丟棄「共字最少 / 最難連接」的詞再試，直到達標或詞太少為止。
  // `runAttempts` 內部已經會在允許 forcePlace 時把多出的詞塞入，評估最終佈局。
  let candidates = rankByConnectivity(allItems);
  const droppedItems: WordBankItem[] = [];

  let best: AttemptResult | null = runShrinkLoop(candidates, cfg, tier, droppedItems);

  // 嚴格條件完全無解：大師模式 (★★★★★) 降級為挑戰級
  if (!best && cfg.minCrossingsPerWord > 1) {
    const relaxed: TierConfig = { ...cfg, minCrossingsPerWord: 1 };
    const droppedRelaxed: WordBankItem[] = [];
    best = runShrinkLoop(rankByConnectivity(allItems), relaxed, tier, droppedRelaxed);
    if (best) {
      warnings.push("詞集共字連通性不足以支持「每個詞至少 2 個交叉」的大師標準，已降級為挑戰級（每個詞至少 1 個交叉）。");
      droppedItems.length = 0;
      droppedItems.push(...droppedRelaxed);
    }
  }

  // 低難度/最後保底：允許放寬約束（仍會嘗試多叢集交叉，但接受孤立詞）
  if (!best && cfg.maxIsolatedRatio > 0) {
    const baseAttempts = allItems.length <= 20 ? 30 : 20;
    const attempts = Math.max(20, Math.round(baseAttempts * cfg.attemptsMultiplier));
    best = runAttempts(allItems, tier, cfg, attempts, /*lenient*/ true);
  }

  if (!best) return null;

  const { puzzle, stats } = buildPuzzle(best.placed, best.grid, tier);

  if (droppedItems.length > 0) {
    warnings.push(
      `已排除 ${droppedItems.length} 個無法與其他詞縱橫交錯的詞：${droppedItems.map((d) => d.text).join("、")}`
    );
  }

  return {
    puzzle,
    stats,
    droppedTexts: droppedItems.map((d) => d.text),
    warnings,
  };
}

/**
 * Shrink-loop 的核心：嘗試 → 失敗 → 動態移除「目前最孤立」的詞 → 重試
 * `candidates` 是調用者傳入的初始候選集（會被消耗）。
 * 移除策略：每輪重新計算「在當前 candidates 內的共字連接度」，移除得分最低者。
 *           這比固定排序更能在後期找到能交叉的最小子集。
 */
function runShrinkLoop(
  initial: WordBankItem[],
  cfg: TierConfig,
  tier: DifficultyTier,
  droppedOut: WordBankItem[]
): AttemptResult | null {
  let candidates = [...initial];
  const maxShrinkBudget = Math.min(20, candidates.length - 2);
  // 高難度禁止 forcePlace 替代品 → decay 不要太激進
  const decayFloor = cfg.maxIsolatedRatio === 0 ? 0.6 : 0.3;
  let shrinkRound = 0;

  while (candidates.length >= 2) {
    const baseAttempts =
      candidates.length <= 5 ? 80 :
      candidates.length <= 10 ? 50 :
      candidates.length <= 20 ? 30 :
      candidates.length <= 40 ? 20 : 15;
    const decay = Math.max(decayFloor, 1 - shrinkRound / Math.max(1, maxShrinkBudget));
    const attempts = Math.max(15, Math.round(baseAttempts * cfg.attemptsMultiplier * decay));

    const result = runAttempts(candidates, tier, cfg, attempts);
    if (result) return result;

    // 動態挑出「在當前候選內最孤立」的詞移除（而非固定排序的尾部）
    const dropIdx = pickLeastConnectedIdx(candidates);
    droppedOut.push(candidates[dropIdx]);
    candidates = candidates.filter((_, i) => i !== dropIdx);
    shrinkRound++;
  }
  return null;
}

function pickLeastConnectedIdx(items: WordBankItem[]): number {
  if (items.length === 0) return -1;
  let worstIdx = items.length - 1;
  let worstScore = Infinity;
  for (let i = 0; i < items.length; i++) {
    const ci = new Set(items[i].text.trim().split(""));
    let score = 0;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const cj = items[j].text.trim().split("");
      if (cj.some((ch) => ci.has(ch))) score++;
    }
    if (score < worstScore) {
      worstScore = score;
      worstIdx = i;
    }
  }
  return worstIdx;
}

/** 按「與其他詞的共字數」由高到低排序 —— 高連接度的詞優先保留 */
function rankByConnectivity(items: WordBankItem[]): WordBankItem[] {
  const n = items.length;
  const scores: number[] = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const ci = new Set(items[i].text.trim().split(""));
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const cj = items[j].text.trim().split("");
      for (const ch of cj) {
        if (ci.has(ch)) {
          scores[i]++;
          break;
        }
      }
    }
  }
  const indexed = items.map((it, i) => ({ it, s: scores[i], len: it.text.trim().length, rnd: Math.random() }));
  indexed.sort((a, b) => (b.s !== a.s ? b.s - a.s : b.len !== a.len ? b.len - a.len : a.rnd - b.rnd));
  return indexed.map((x) => x.it);
}

interface AttemptResult {
  placed: PlacedWord[];
  grid: VirtualGrid;
  score: number;
  totalCrossings: number;
  crossedWords: number;
  isolatedWords: number;
  minPerWord: number;
}

function runAttempts(
  itemSet: WordBankItem[],
  _tier: DifficultyTier,
  cfg: TierConfig,
  maxAttempts: number,
  lenient = false
): AttemptResult | null {
  let best: AttemptResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // 嘗試不同的起點與排序策略
    let order: WordBankItem[];
    if (attempt === 0) {
      order = [...itemSet].sort((a, b) => b.text.trim().length - a.text.trim().length);
    } else if (attempt % 3 === 1) {
      order = [...itemSet].sort(() => Math.random() - 0.5);
    } else {
      // 隨機換首詞，其餘按長度
      const rest = [...itemSet];
      const head = rest.splice(Math.floor(Math.random() * rest.length), 1)[0];
      rest.sort((a, b) => b.text.trim().length - a.text.trim().length);
      order = [head, ...rest];
    }
    const startDir: "h" | "v" = attempt % 2 === 0 ? "h" : "v";

    const { placed, grid } = tryPlace(order, startDir);
    if (placed.length === 0) continue;

    // 總是嘗試把剩下的詞以「多叢集」方式接上——能交叉就交叉，
    // 確實交叉不到的會成為孤立詞，由下面的 isolatedRatio 檢查決定是否採納。
    const placedIdSet = new Set(placed.map((p) => p.item?.id));
    const unplaced = itemSet.filter((x) => x.id && !placedIdSet.has(x.id));
    if (unplaced.length > 0) {
      tryAddCrossingsThenForce(grid, placed, unplaced);
    }

    const eval0 = evaluateLayout(placed);

    // 非 lenient 模式下的 tier 約束驗證（以最終佈局為準）
    if (!lenient) {
      const isolatedRatio = placed.length > 0 ? eval0.isolatedWords / placed.length : 0;
      if (isolatedRatio > cfg.maxIsolatedRatio) continue;

      // minCrossingsPerWord：只檢查非孤立詞（孤立詞已由 isolatedRatio 處理）
      if (cfg.minCrossingsPerWord > 1) {
        const cellOwners = buildCellOwners(placed);
        let perWordOk = true;
        for (const pw of placed) {
          const c = countCrossings(pw, cellOwners);
          if (c > 0 && c < cfg.minCrossingsPerWord) {
            perWordOk = false;
            break;
          }
        }
        if (!perWordOk) continue;
      }
    }

    const bounds = grid.getBounds();
    const w = bounds.maxC - bounds.minC + 1;
    const h = bounds.maxR - bounds.minR + 1;
    const area = w * h;
    const aspectPenalty = Math.abs(w - h) * 3;

    const score =
      eval0.totalCrossings * cfg.crossingWeight +
      eval0.crossedWords * 60 -
      eval0.isolatedWords * cfg.isolationPenalty -
      area -
      aspectPenalty +
      placed.length * 40; // 輕度獎勵放更多詞（但遠小於交叉權重）

    if (!best || score > best.score) {
      best = {
        placed,
        grid,
        score,
        totalCrossings: eval0.totalCrossings,
        crossedWords: eval0.crossedWords,
        isolatedWords: eval0.isolatedWords,
        minPerWord: eval0.minPerWord,
      };
    }
  }

  return best;
}

function buildCellOwners(placed: PlacedWord[]): Map<string, Set<"h" | "v">> {
  const owners = new Map<string, Set<"h" | "v">>();
  for (const pw of placed) {
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      const key = `${r},${c}`;
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key)!.add(pw.dir);
    }
  }
  return owners;
}

function countCrossings(pw: PlacedWord, owners: Map<string, Set<"h" | "v">>): number {
  let cnt = 0;
  for (let k = 0; k < pw.word.length; k++) {
    const r = pw.dir === "h" ? pw.r : pw.r + k;
    const c = pw.dir === "h" ? pw.c + k : pw.c;
    const os = owners.get(`${r},${c}`);
    if (os && os.size === 2) cnt++;
  }
  return cnt;
}

function tryPlace(itemsInOrder: WordBankItem[], startDir: "h" | "v" = "h"): {
  placed: PlacedWord[];
  grid: VirtualGrid;
} {
  const grid = new VirtualGrid();
  const placed: PlacedWord[] = [];

  const charIndex = new Map<string, { pw: PlacedWord; pi: number }[]>();
  function addToIndex(pw: PlacedWord) {
    for (let pi = 0; pi < pw.word.length; pi++) {
      const ch = pw.word[pi];
      if (!charIndex.has(ch)) charIndex.set(ch, []);
      charIndex.get(ch)!.push({ pw, pi });
    }
  }

  if (itemsInOrder.length === 0) return { placed, grid };

  const first = itemsInOrder[0];
  const firstWord = first.text.trim();
  if (firstWord.length === 0) return { placed, grid };

  const firstPw: PlacedWord = { word: firstWord, dir: startDir, r: 0, c: 0, item: first };
  grid.place(firstWord, 0, 0, startDir);
  placed.push(firstPw);
  addToIndex(firstPw);

  let remaining = itemsInOrder.slice(1);
  for (let round = 0; round < 6; round++) {
    const stillRemaining: WordBankItem[] = [];
    for (const item of remaining) {
      const word = item.text.trim();
      if (word.length === 0) continue;

      const curBounds = grid.getBounds();
      let bestCandidate: {
        r: number;
        c: number;
        dir: "h" | "v";
        crossings: number;
        area: number;
        aspectPenalty: number;
      } | null = null;

      for (let wi = 0; wi < word.length; wi++) {
        const ch = word[wi];
        const entries = charIndex.get(ch);
        if (!entries) continue;

        for (const { pw, pi } of entries) {
          const dirs: ("h" | "v")[] = pw.dir === "h" ? ["v", "h"] : ["h", "v"];

          for (const newDir of dirs) {
            let newR: number, newC: number;
            if (newDir === "v") {
              newR = pw.dir === "h" ? pw.r - wi : pw.r + pi - wi;
              newC = pw.dir === "h" ? pw.c + pi : pw.c;
            } else {
              newR = pw.dir === "v" ? pw.r + pi : pw.r;
              newC = pw.dir === "v" ? pw.c - wi : pw.c + pi - wi;
            }

            if (!grid.canPlace(word, newR, newC, newDir)) continue;

            let crossings = 0;
            for (let k = 0; k < word.length; k++) {
              const cr = newDir === "h" ? newR : newR + k;
              const cc = newDir === "h" ? newC + k : newC;
              if (grid.get(cr, cc) === word[k]) crossings++;
            }

            const endR = newDir === "v" ? newR + word.length - 1 : newR;
            const endC = newDir === "h" ? newC + word.length - 1 : newC;
            const newMinR = Math.min(curBounds.minR, newR);
            const newMaxR = Math.max(curBounds.maxR, endR);
            const newMinC = Math.min(curBounds.minC, newC);
            const newMaxC = Math.max(curBounds.maxC, endC);
            const w = newMaxC - newMinC + 1;
            const h = newMaxR - newMinR + 1;
            const area = w * h;
            const aspectPenalty = Math.abs(w - h);

            const isBetter =
              !bestCandidate ||
              crossings > bestCandidate.crossings ||
              (crossings === bestCandidate.crossings && area < bestCandidate.area) ||
              (crossings === bestCandidate.crossings &&
                area === bestCandidate.area &&
                aspectPenalty < bestCandidate.aspectPenalty);

            if (isBetter) {
              bestCandidate = { r: newR, c: newC, dir: newDir, crossings, area, aspectPenalty };
            }
          }
        }
      }

      if (bestCandidate) {
        grid.place(word, bestCandidate.r, bestCandidate.c, bestCandidate.dir);
        const pw: PlacedWord = {
          word,
          dir: bestCandidate.dir,
          r: bestCandidate.r,
          c: bestCandidate.c,
          item,
        };
        placed.push(pw);
        addToIndex(pw);
      } else if (round < 5) {
        stillRemaining.push(item);
      }
    }
    remaining = stillRemaining;
    if (remaining.length === 0) break;
  }

  return { placed, grid };
}

/** 低難度（允許 forcePlace）：
 *  1. 對每個未放詞嘗試與「已放置」交叉
 *  2. 沒有交叉的詞 → 試著從中選一個當新叢集種子，然後重複 1
 *  3. 直到沒有新詞能交叉時才把剩下的硬塞底部
 *
 *  相比舊版，本版會把「兩個叢集之間沒共字、但各自內部能交叉」的詞集
 *  佈局成多個小十字，顯著提升交叉率。
 */
function tryAddCrossingsThenForce(
  grid: VirtualGrid,
  placed: PlacedWord[],
  unplaced: WordBankItem[]
) {
  const charIndex = new Map<string, { pw: PlacedWord; pi: number }[]>();
  function addToIndex(pw: PlacedWord) {
    for (let pi = 0; pi < pw.word.length; pi++) {
      const ch = pw.word[pi];
      if (!charIndex.has(ch)) charIndex.set(ch, []);
      charIndex.get(ch)!.push({ pw, pi });
    }
  }
  for (const pw of placed) addToIndex(pw);

  function findCrossing(item: WordBankItem): {
    r: number; c: number; dir: "h" | "v"; crossings: number;
  } | null {
    const word = item.text.trim();
    if (word.length === 0) return null;
    let best: { r: number; c: number; dir: "h" | "v"; crossings: number } | null = null;
    for (let wi = 0; wi < word.length; wi++) {
      const entries = charIndex.get(word[wi]);
      if (!entries) continue;
      for (const { pw, pi } of entries) {
        for (const newDir of ["h", "v"] as const) {
          let newR: number, newC: number;
          if (newDir === "v") {
            newR = pw.dir === "h" ? pw.r - wi : pw.r + pi - wi;
            newC = pw.dir === "h" ? pw.c + pi : pw.c;
          } else {
            newR = pw.dir === "v" ? pw.r + pi : pw.r;
            newC = pw.dir === "v" ? pw.c - wi : pw.c + pi - wi;
          }
          if (!grid.canPlace(word, newR, newC, newDir)) continue;
          let crossings = 0;
          for (let k = 0; k < word.length; k++) {
            const cr = newDir === "h" ? newR : newR + k;
            const cc = newDir === "h" ? newC + k : newC;
            if (grid.get(cr, cc) === word[k]) crossings++;
          }
          if (!best || crossings > best.crossings) {
            best = { r: newR, c: newC, dir: newDir, crossings };
          }
        }
      }
    }
    return best;
  }

  let remaining = [...unplaced];

  while (remaining.length > 0) {
    // Phase 1: 反覆掃描，只要有任何詞能與現有 grid 交叉就放入
    let madeProgress = true;
    while (madeProgress) {
      madeProgress = false;
      const next: WordBankItem[] = [];
      for (const item of remaining) {
        const best = findCrossing(item);
        if (best) {
          grid.place(item.text.trim(), best.r, best.c, best.dir);
          const pw: PlacedWord = {
            word: item.text.trim(),
            dir: best.dir,
            r: best.r,
            c: best.c,
            item,
          };
          placed.push(pw);
          addToIndex(pw);
          madeProgress = true;
        } else {
          next.push(item);
        }
      }
      remaining = next;
    }

    if (remaining.length === 0) break;

    // Phase 2: 用剩下的詞開一個新叢集
    //   先選「在 remaining 中共字最多」的詞當種子，再依當前 grid 形狀決定放置位置：
    //   grid 較寬就向下開新叢集（h），較高就向右開新叢集（v），維持接近方形的整體外觀
    const seedIdx = pickBestSeed(remaining);
    const seed = remaining[seedIdx];
    remaining.splice(seedIdx, 1);

    const seedWord = seed.text.trim();
    const bounds = grid.getBounds();
    const empty = bounds.maxR === -Infinity;
    const curW = empty ? 0 : bounds.maxC - bounds.minC + 1;
    const curH = empty ? 0 : bounds.maxR - bounds.minR + 1;

    let seedR: number, seedC: number, seedDir: "h" | "v";
    if (empty) {
      seedR = 0; seedC = 0; seedDir = "h";
    } else if (curW >= curH) {
      // grid 已較寬：在下方開橫向叢集
      seedR = bounds.maxR + 3;
      seedC = bounds.minC;
      seedDir = "h";
    } else {
      // grid 已較高：在右側開縱向叢集
      seedR = bounds.minR;
      seedC = bounds.maxC + 3;
      seedDir = "v";
    }
    grid.forcePlace(seedWord, seedR, seedC, seedDir);
    const seedPw: PlacedWord = {
      word: seedWord,
      dir: seedDir,
      r: seedR,
      c: seedC,
      item: seed,
      // 叢集種子本身尚無交叉；若後續有詞來交叉就不再算 forced
      forced: true,
    };
    placed.push(seedPw);
    addToIndex(seedPw);
  }

  // Phase 2 的種子若已被後續詞交叉，應把 forced 標記撤銷
  recomputeForcedFlags(placed);
}

function pickBestSeed(items: WordBankItem[]): number {
  if (items.length === 0) return -1;
  let bestIdx = 0;
  let bestScore = -1;
  for (let i = 0; i < items.length; i++) {
    const ci = new Set(items[i].text.trim().split(""));
    let score = 0;
    for (let j = 0; j < items.length; j++) {
      if (i === j) continue;
      const cj = items[j].text.trim().split("");
      for (const ch of cj) if (ci.has(ch)) { score++; break; }
    }
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function recomputeForcedFlags(placed: PlacedWord[]) {
  const owners = buildCellOwners(placed);
  for (const pw of placed) {
    if (!pw.forced) continue;
    if (countCrossings(pw, owners) > 0) pw.forced = false;
  }
}

function buildPuzzle(
  placedWords: PlacedWord[],
  _grid: VirtualGrid,
  tier: DifficultyTier
): { puzzle: CrosswordPuzzle; stats: CrosswordStats } {
  const bounds = _grid.getBounds();
  const offsetR = -bounds.minR;
  const offsetC = -bounds.minC;

  for (const pw of placedWords) {
    pw.r += offsetR;
    pw.c += offsetC;
  }

  const contentRows = bounds.maxR - bounds.minR + 1;
  const contentCols = bounds.maxC - bounds.minC + 1;
  const rows = contentRows;
  const cols = contentCols;

  const sortedPlaced = [...placedWords].sort((a, b) =>
    a.r !== b.r ? a.r - b.r : a.c - b.c
  );

  const horizontalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const verticalClues: { id: string; label: string; clue: string; source: string }[] = [];
  const crosswordWords: CrosswordWord[] = [];

  const CN_NUMS = "一二三四五六七八九十";
  function getHLabel(idx: number): string {
    if (idx < 10) return CN_NUMS[idx];
    if (idx < 20) return "十" + (idx === 10 ? "" : CN_NUMS[idx - 10]);
    const tens = Math.floor(idx / 10);
    const ones = idx % 10;
    return (tens > 1 ? CN_NUMS[tens - 1] : "") + "十" + (ones > 0 ? CN_NUMS[ones - 1] : "");
  }

  for (let i = 0; i < sortedPlaced.length; i++) {
    const pw = sortedPlaced[i];
    const clueId = `c${i}`;
    const clueText = pw.item?.definition || pw.word.replace(/./g, "_");
    const source = pw.item?.source ? ` ${pw.item.source}` : "";

    if (pw.dir === "h") {
      horizontalClues.push({
        id: clueId,
        label: getHLabel(horizontalClues.length),
        clue: `${clueText}${source}`,
        source: pw.item?.source ?? "",
      });
    } else {
      verticalClues.push({
        id: clueId,
        label: String(verticalClues.length + 1),
        clue: `${clueText}${source}`,
        source: pw.item?.source ?? "",
      });
    }

    crosswordWords.push({
      id: clueId,
      text: pw.word,
      direction: pw.dir === "h" ? "horizontal" : "vertical",
      startRow: pw.r,
      startCol: pw.c,
      clue: pw.item?.definition || pw.word,
      source: pw.item?.source ?? "",
    });
  }

  const charMap = new Map<string, string>();
  const cellClueMap = new Map<string, string>();
  for (let wi = 0; wi < sortedPlaced.length; wi++) {
    const pw = sortedPlaced[wi];
    const clueId = `c${wi}`;
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      const key = `${r},${c}`;
      charMap.set(key, pw.word[k]);
      if (!cellClueMap.has(key)) cellClueMap.set(key, clueId);
    }
  }

  // 按詞決定空格位置：每詞空格數依 `blanksForWord(len, tier)` 計算（嚴格單調）
  const blankKeys = new Set<string>();
  for (const pw of sortedPlaced) {
    const positions: string[] = [];
    for (let k = 0; k < pw.word.length; k++) {
      const r = pw.dir === "h" ? pw.r : pw.r + k;
      const c = pw.dir === "h" ? pw.c + k : pw.c;
      positions.push(`${r},${c}`);
    }
    const blankCount = blanksForWord(pw.word.length, tier);
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    for (let j = 0; j < blankCount && j < shuffled.length; j++) {
      blankKeys.add(shuffled[j]);
    }
  }

  const puzzleGrid: CrosswordCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CrosswordCell[] = [];
    for (let c = 0; c < cols; c++) {
      const key = `${r},${c}`;
      const ch = charMap.get(key);
      if (!ch) {
        row.push({ type: "block" });
      } else if (blankKeys.has(key)) {
        row.push({ type: "blank", clueId: cellClueMap.get(key) ?? `c${r}-${c}` });
      } else {
        row.push({ type: "given", value: ch });
      }
    }
    puzzleGrid.push(row);
  }

  const puzzle: CrosswordPuzzle = {
    id: generateId(),
    grid: puzzleGrid,
    words: crosswordWords,
    horizontalClues,
    verticalClues,
    difficulty: tier,
    levelTitle: TIER_TITLE[tier],
  };
  const stats = computeCrosswordStats(puzzle);
  puzzle.stats = stats;
  return { puzzle, stats };
}
