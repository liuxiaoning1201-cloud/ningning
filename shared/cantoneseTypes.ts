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

export interface AsrRequest {
  /** 單檔模式：audio/video data URL 或純 base64（後端會自動截短到 30 秒以內） */
  media?: string;
  /**
   * 分塊模式：前端已把音頻切成多段（每段 ≤ ~20 秒、16kHz 單聲道 WAV data URL），
   * 後端會依序送 Whisper、再合併文字。優先使用 `chunks`，與 `media` 二擇一。
   */
  chunks?: string[];
  /** 可選：畫面上原有書面字幕，只作語義輔助，不可覆蓋聽寫結果 */
  subtitleHint?: string;
  /** 可選：原始檔名，用於落地歷史記錄供日後查找 */
  fileName?: string;
  /** 可選：音頻總時長（前端 decode 後估算），落歷史用於展示 */
  durationSeconds?: number;
}

export interface AsrSentence {
  /** 實際聽到的粵語口語對白 */
  cantonese: string;
  /** 整句粵拼 */
  jyutping?: string;
  /** 書面意思 / 普通話意思 */
  meaning?: string;
  /** 0-1，模型對此句的保守信心評估 */
  confidence?: number;
}

export interface AsrTermExample {
  cantonese: string;
  jyutping?: string;
  meaning: string;
}

export interface AsrTerm {
  term: string;
  jyutping?: string;
  meaning: string;
  note?: string;
  examples: AsrTermExample[];
}

export interface AsrResponse {
  /** Whisper 原始輸出，方便用戶對照 */
  rawText: string;
  /** 經保守校準後的自然粵語口語句子 */
  sentences: AsrSentence[];
  /** 高頻口語詞拓展 */
  terms: AsrTerm[];
  /** 後端實際成功的 provider 名（可能多個 provider 串聯） */
  provider?: string;
  /** 服務端儲存的 session id，可用於日後從歷史調回 */
  sessionId?: string;
}

/** 歷史列表項：包含完整對白和高頻詞，方便前端離線重看 */
export interface AsrHistorySession {
  id: string;
  fileName?: string;
  rawText: string;
  sentences: AsrSentence[];
  terms: AsrTerm[];
  provider?: string;
  subtitleHint?: string;
  chunkCount?: number;
  durationSeconds?: number;
  createdAt: string;
}

export interface AsrHistoryResponse {
  sessions: AsrHistorySession[];
}
