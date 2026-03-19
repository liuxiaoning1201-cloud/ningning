/**
 * 班級競賽場次：題組快照結構與計分（與本機 store.js 對齊）
 */

export interface PuzzleWord {
  text: string;
  direction: 'horizontal' | 'vertical';
  startRow: number;
  startCol: number;
}

export interface CrosswordSnapshot {
  words: PuzzleWord[];
  grid?: unknown;
  horizontalClues?: unknown[];
  verticalClues?: unknown[];
}

export function parseSnapshot(raw: string | null): CrosswordSnapshot | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as CrosswordSnapshot;
    if (!o || !Array.isArray(o.words)) return null;
    return o;
  } catch {
    return null;
  }
}

export function computeScoreFromAnswers(puzzle: CrosswordSnapshot, answers: Record<string, string>): number {
  let correct = 0;
  for (const w of puzzle.words) {
    const text = w.text ?? '';
    for (let i = 0; i < text.length; i++) {
      const r = w.direction === 'horizontal' ? w.startRow : w.startRow + i;
      const c = w.direction === 'horizontal' ? w.startCol + i : w.startCol;
      const key = `${r},${c}`;
      const ans = (answers[key] ?? '').trim();
      if (ans === (text[i] ?? '')) correct++;
    }
  }
  return correct;
}
