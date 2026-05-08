-- 粵語學習插件 — 生詞本 + 複習日誌
-- 與現有 users 表（已存在）關聯，由 functions/_middleware.ts 注入的 user.id 識別所有者。

CREATE TABLE IF NOT EXISTS cantonese_vocab (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  granularity TEXT NOT NULL DEFAULT 'sentence' CHECK (granularity IN ('sentence', 'phrase', 'word')),
  written TEXT NOT NULL,
  cantonese TEXT NOT NULL,
  jyutping TEXT,
  explanation TEXT,
  source_json TEXT,           -- JSON: { site, title, timestampSec, url }
  srs_json TEXT,              -- JSON: SrsState
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cantonese_vocab_user ON cantonese_vocab(user_id);
CREATE INDEX IF NOT EXISTS idx_cantonese_vocab_user_created ON cantonese_vocab(user_id, created_at DESC);

-- 複習日誌：記錄每次複習的評分與間隔，便於日後分析學習曲線
CREATE TABLE IF NOT EXISTS cantonese_review_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  vocab_id TEXT NOT NULL,
  quality INTEGER NOT NULL CHECK (quality BETWEEN 0 AND 5),
  prev_interval INTEGER,
  next_interval INTEGER,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (vocab_id) REFERENCES cantonese_vocab(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cantonese_review_user_time ON cantonese_review_log(user_id, reviewed_at DESC);

-- 簡易計量表：記錄每日 LLM / TTS / OCR 調用統計（供監控頁讀取）
CREATE TABLE IF NOT EXISTS cantonese_usage_daily (
  date TEXT NOT NULL,
  bucket TEXT NOT NULL,         -- 'translate' / 'tts' / 'ocr'
  user_id TEXT,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, bucket, user_id)
);
