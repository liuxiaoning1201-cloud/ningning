-- 教師白名單（小寫電郵）
CREATE TABLE IF NOT EXISTS teacher_accounts (
  email TEXT PRIMARY KEY
);

-- 班級競賽場次（六位 join_code）
CREATE TABLE IF NOT EXISTS crossword_sessions (
  id TEXT PRIMARY KEY,
  join_code TEXT NOT NULL UNIQUE,
  mode TEXT NOT NULL DEFAULT 'practice' CHECK (mode IN ('practice', 'class')),
  class_id TEXT,
  puzzle_id TEXT NOT NULL,
  puzzle_title TEXT NOT NULL,
  puzzle_snapshot TEXT NOT NULL DEFAULT '{}',
  duration_minutes INTEGER NOT NULL DEFAULT 5,
  show_hints INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'ended')),
  host_user_id TEXT NOT NULL,
  host_name TEXT NOT NULL,
  started_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_crossword_sessions_host ON crossword_sessions(host_user_id);
CREATE INDEX IF NOT EXISTS idx_crossword_sessions_class ON crossword_sessions(class_id);
CREATE INDEX IF NOT EXISTS idx_crossword_sessions_code ON crossword_sessions(join_code);

CREATE TABLE IF NOT EXISTS crossword_session_participants (
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role_at_join TEXT NOT NULL DEFAULT 'guest' CHECK (role_at_join IN ('teacher', 'student', 'guest')),
  answers_json TEXT NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  finished_at TEXT,
  PRIMARY KEY (session_id, user_id),
  FOREIGN KEY (session_id) REFERENCES crossword_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_crossword_participants_session ON crossword_session_participants(session_id);
