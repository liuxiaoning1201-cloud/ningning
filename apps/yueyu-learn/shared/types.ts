/**
 * 粵語學習插件 — 雙端共享類型。
 * 與後端 functions/api/cantonese/* 共用倉庫頂層的 shared/cantoneseTypes.ts，
 * 確保前後端一致，避免重複維護。
 */
export type {
  TokenMapping,
  TranslateResult,
  TranslateRequest,
  TranslateResponse,
  TtsRequest,
  TtsResponse,
  VocabEntry,
  VocabListResponse,
  SrsState,
  OcrRequest,
  OcrResponse,
} from '../../../shared/cantoneseTypes';

/** 後端統一錯誤響應 body 形狀（不要與 api-client 的 ApiError class 混淆） */
export interface ApiErrorBody {
  error: string;
  message?: string;
  retryAfter?: number;
}
