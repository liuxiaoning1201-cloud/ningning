import bundled from '@/data/chars.json';
import hkCharset from '@/data/hkCharset.json';
import { fillStrokeTypes } from '@/lib/classifyStroke';
import { isStrokeId } from '@/data/strokes';
import type { CharData, Median, StrokeId } from '@/types';

/**
 * 字形筆順資料的取用層。
 *
 * 隨 app 一起打包的 chars.json 是製作期跑 scripts/gen-char-data.mjs 產生的，
 * 已核對的筆畫標註離線可用。老師臨時加的字若不在包裡，即時打 CDN，
 * 再用幾何規則自動判每一筆是哪一種物品——不必人工複核才能練。
 *
 * 來源順序：animCJK ZhHant（繁體、貼近港標）優先，makemeahanzi 備援。
 */

const BUNDLED = bundled as unknown as Record<string, CharData>;

const HK_CHARS = new Set((hkCharset as { chars: string }).chars);

const ZHHANT = (ch: string) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data-acjk@1.0.0/animCJK/ZhHant/${encodeURIComponent(ch)}.json`;
const MMAH = (ch: string) =>
  `https://cdn.jsdelivr.net/npm/hanzi-writer-data@latest/${encodeURIComponent(ch)}.json`;

const cache = new Map<string, CharData | null>();

/** 是否為香港《常用字字形表》收錄字。老師加字時用它擋掉非港標字。 */
export function isHkChar(ch: string): boolean {
  return HK_CHARS.has(ch);
}

export function hkCharsetSize(): number {
  return HK_CHARS.size;
}

/** 已隨 app 打包、可離線玩的字。 */
export function bundledChars(): string[] {
  return Object.keys(BUNDLED);
}

export function verifiedChars(): string[] {
  return Object.values(BUNDLED)
    .filter((c) => c.verified)
    .map((c) => c.char);
}

function sanitizeTypes(input: unknown, count: number): (StrokeId | null)[] {
  if (!Array.isArray(input) || input.length !== count) {
    return Array.from({ length: count }, () => null);
  }
  return input.map((v) => (isStrokeId(v) ? v : null));
}

/** 人工標註保留，缺的用幾何自動補齊，練習模式才能立刻鎖筆順。 */
function finish(data: CharData): CharData {
  return {
    ...data,
    strokeTypes: fillStrokeTypes(data.medians, data.strokeTypes),
  };
}

async function fetchRemote(ch: string): Promise<CharData | null> {
  for (const [source, url] of [
    ['ZhHant', ZHHANT(ch)],
    ['makemeahanzi', MMAH(ch)],
  ] as const) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw = (await res.json()) as { strokes?: string[]; medians?: Median[] };
      if (!raw.strokes?.length || raw.strokes.length !== raw.medians?.length) continue;
      return finish({
        char: ch,
        strokes: raw.strokes,
        medians: raw.medians,
        strokeTypes: sanitizeTypes(null, raw.strokes.length),
        source,
        verified: false,
      });
    } catch {
      // 換下一個來源
    }
  }
  return null;
}

export async function loadChar(ch: string): Promise<CharData | null> {
  if (cache.has(ch)) return cache.get(ch) ?? null;

  const local = BUNDLED[ch];
  if (local) {
    const data = finish({
      ...local,
      strokeTypes: sanitizeTypes(local.strokeTypes, local.strokes.length),
    });
    cache.set(ch, data);
    return data;
  }

  const remote = await fetchRemote(ch);
  cache.set(ch, remote);
  return remote;
}

export type CharReadiness = 'ready' | 'pending' | 'missing' | 'unknown';

/**
 * 一個字能不能拿來練：
 *   ready    本地已有筆順（含自動補上的筆畫種類）
 *   unknown  港標字，進入遊戲時再下載
 *   missing  不在港標、也沒有本地資料
 */
export function readiness(ch: string): CharReadiness {
  if (BUNDLED[ch]) return 'ready';
  if (isHkChar(ch)) return 'unknown';
  return 'missing';
}

/** 字簿裡的字只要不是明確缺失，就可以進練習／挑戰。 */
export function canPlay(ch: string): boolean {
  return readiness(ch) !== 'missing';
}

export function readinessLabel(state: CharReadiness): string {
  switch (state) {
    case 'ready':
    case 'pending':
    case 'unknown':
      return '可練習';
    default:
      return '沒有筆順資料';
  }
}
