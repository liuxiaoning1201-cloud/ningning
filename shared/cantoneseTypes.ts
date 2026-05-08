/**
 * 粵語學習功能 — 前後端共享的類型定義。
 * 後端 functions/api/cantonese/* 與前端 apps/yueyu-learn/* 都從此處導入。
 */

export interface TokenMapping {
  written: string;
  cantonese: string;
  jyutping?: string;
  note?: string;
}

export interface TranslateResult {
  written: string;
  cantonese: string;
  jyutping: string;
  tokens: TokenMapping[];
  explanation?: string;
  source: 'cache' | 'dict' | 'llm';
}

export interface TranslateRequest {
  sentences: string[];
  client?: 'web' | 'extension' | 'mobile';
}

export interface TranslateResponse {
  results: TranslateResult[];
  quotaRemaining?: number;
}

export interface TtsRequest {
  text: string;
  voice?: 'female' | 'male';
  speed?: 'slow' | 'normal' | 'fast';
}

export interface TtsResponse {
  url: string;
  cached: boolean;
}

export interface SrsState {
  repetitions: number;
  easiness: number;
  intervalDays: number;
  dueAt: string;
}

export interface VocabEntry {
  id: string;
  granularity: 'sentence' | 'phrase' | 'word';
  written: string;
  cantonese: string;
  jyutping?: string;
  explanation?: string;
  source?: {
    site?: string;
    title?: string;
    timestampSec?: number;
    url?: string;
  };
  createdAt: string;
  srs?: SrsState;
}

export interface VocabListResponse {
  entries: VocabEntry[];
  total: number;
}

export interface OcrRequest {
  image: string;
}

export interface OcrResponse {
  text: string;
  lines: string[];
}
