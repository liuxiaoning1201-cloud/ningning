-- Users table (Google OAuth)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  google_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Word banks
CREATE TABLE IF NOT EXISTS word_banks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Word bank items
CREATE TABLE IF NOT EXISTS word_bank_items (
  id TEXT PRIMARY KEY,
  bank_id TEXT NOT NULL,
  text TEXT NOT NULL,
  definition TEXT DEFAULT '',
  source TEXT DEFAULT '',
  difficulty INTEGER DEFAULT 1,
  FOREIGN KEY (bank_id) REFERENCES word_banks(id) ON DELETE CASCADE
);

-- Puzzle sets
CREATE TABLE IF NOT EXISTS puzzle_sets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'crossword',
  difficulty INTEGER DEFAULT 1,
  grid_json TEXT,
  owner_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (owner_id) REFERENCES users(id)
);

-- Game rooms
CREATE TABLE IF NOT EXISTS game_rooms (
  id TEXT PRIMARY KEY,
  puzzle_id TEXT NOT NULL,
  host_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting',
  settings_json TEXT DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (puzzle_id) REFERENCES puzzle_sets(id),
  FOREIGN KEY (host_id) REFERENCES users(id)
);

-- Game scores
CREATE TABLE IF NOT EXISTS game_scores (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  time_ms INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (room_id) REFERENCES game_rooms(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- AI explanation cache
CREATE TABLE IF NOT EXISTS ai_cache (
  id TEXT PRIMARY KEY,
  word_text TEXT UNIQUE NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_word_bank_items_bank ON word_bank_items(bank_id);
CREATE INDEX IF NOT EXISTS idx_puzzle_sets_owner ON puzzle_sets(owner_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_scores_room ON game_scores(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_word ON ai_cache(word_text);
