-- 粵語 ASR 識別歷史
--
-- 用戶上傳並識別過的視頻 / 音頻片段，會落地到這張表，方便：
--   1. 「最近識別歷史」面板回顧
--   2. 不用重新跑 Whisper 就能反覆查看與朗讀
--   3. 後續可從歷史記錄一鍵把句子加進生詞本
--
-- 與 cantonese_vocab 解耦：歷史是「臨時記憶」，生詞本是「長期記憶」，
-- 用戶從歷史中挑出有價值的句子才會晉升到生詞本進入 SRS 複習流。

CREATE TABLE IF NOT EXISTS cantonese_asr_sessions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL,
  file_name        TEXT,
  raw_text         TEXT NOT NULL,             -- Whisper 原始轉寫
  sentences_json   TEXT,                       -- AsrSentence[] 經 DeepSeek 整理後
  terms_json       TEXT,                       -- AsrTerm[] 高頻口語詞拓展
  subtitle_hint    TEXT,                       -- 用戶上傳時提供的字幕輔助文字
  provider         TEXT,                       -- 實際成功的 ASR provider 名（含 fallback）
  chunk_count      INTEGER,                    -- 用戶這段音頻被切成幾塊處理
  duration_seconds REAL,                       -- 音頻時長（前端 decode 後估算）
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_asr_sessions_user_time
  ON cantonese_asr_sessions(user_id, created_at DESC);
