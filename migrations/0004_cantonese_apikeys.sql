-- 個人 API Key 表：讓使用者為自己其他軟件（mobile APP、命令列腳本、第三方插件）
-- 申請一把長期 Token，調用粵語學習 API 時帶在 Authorization: Bearer 中。
--
-- 設計要點：
--   1. token 用 SHA-256 雜湊存儲（即使資料庫被讀也無法還原原文 Key）
--   2. prefix 明文保留，便於用戶在儀表板識別「這是哪一把」
--   3. 限流仍走 user_id 維度（與網頁登入用戶的配額共享，不會繞過）
--   4. 把 user_email / user_name / user_role 冗餘存放，避免依賴單獨的 users 表
--      （此項目沒有獨立的 users 表，使用者身份完全由 JWT 攜帶）

CREATE TABLE IF NOT EXISTS cantonese_api_keys (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  user_email   TEXT,
  user_name    TEXT,
  user_role    TEXT,
  name         TEXT NOT NULL,
  prefix       TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  scopes       TEXT NOT NULL DEFAULT 'translate,tts,ocr,vocab',
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  expires_at   TEXT,
  revoked_at   TEXT
);

CREATE INDEX IF NOT EXISTS idx_apikeys_user ON cantonese_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_apikeys_hash ON cantonese_api_keys(token_hash);
