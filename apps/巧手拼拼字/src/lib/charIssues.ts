import { officialFitsGeometry, officialFitsReordered, officialStrokeTypes } from '@/lib/officialStrokes';
import { hasStrokeLayout } from '@/lib/strokeLayouts';
import { hasStrokeLocks } from '@/lib/strokeLocks';
import { walkingTailKind } from '@/lib/walkingRadical';
import type { CharData, StrokeId } from '@/types';

export type CharIssueKind = 'missing' | 'count' | 'conflict' | 'edited';

export interface CharIssue {
  char: string;
  kind: CharIssueKind;
  detail: string;
}

export function issueLabel(kind: CharIssueKind): string {
  switch (kind) {
    case 'missing':
      return '沒資料';
    case 'count':
      return '筆數';
    case 'conflict':
      return '對不上';
    default:
      return '已改';
  }
}

/**
 * 開源名稱裡還沒對上任何一筆路徑的那些。
 * 筆序不同但物品種類對得上（如「必」）不算衝突。
 */
export function unusedOfficialNames(char: string, types: (StrokeId | null)[]): StrokeId[] {
  const official = officialStrokeTypes(char);
  if (!official?.length) return [];
  const pool = types.filter((id): id is StrokeId => Boolean(id));
  const unused: StrokeId[] = [];
  for (const want of official) {
    if (!want) continue;
    const idx = pool.findIndex(
      (got) => got === want || officialFitsGeometry(got, want) || officialFitsReordered(got, want)
    );
    if (idx >= 0) pool.splice(idx, 1);
    else unused.push(want);
  }
  return unused;
}

/**
 * 走之底照字表算四筆（點、橫撇、撇、捺），開源名稱表只給三筆。
 * 差的就是那一撇，名稱因此整列往前挪一格、末尾多出一個對不上的名字，
 * 兩種現象同一個成因，都不必請老師看。
 */
function isWalkingFourChar(data: CharData, officialLength: number): boolean {
  if (officialLength !== data.medians.length - 1) return false;
  return walkingTailKind(data.strokeTypes) === 'four';
}

/** 認完之後，這個字要不要請老師看一眼。 */
export function inspectChar(data: CharData): CharIssue | null {
  const ch = data.char;
  if (hasStrokeLayout(ch) || hasStrokeLocks(ch)) {
    return { char: ch, kind: 'edited', detail: '老師改過筆畫' };
  }
  const official = officialStrokeTypes(ch);
  if (official?.length && official.length !== data.medians.length) {
    if (isWalkingFourChar(data, official.length)) return null;
    return {
      char: ch,
      kind: 'count',
      detail: `動畫 ${data.medians.length} 筆，名稱表 ${official.length} 筆`,
    };
  }
  const leftover = unusedOfficialNames(ch, data.strokeTypes);
  if (leftover.length) {
    return {
      char: ch,
      kind: 'conflict',
      detail: `有 ${leftover.length} 筆名稱對不上路徑`,
    };
  }
  return null;
}
