import type { RemoteUserRole } from '../../shared/remoteRole';
import { computeScoreFromAnswers, parseSnapshot, type CrosswordSnapshot } from '../../shared/crosswordSession';

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: RemoteUserRole;
}

export interface SessionRow {
  id: string;
  join_code: string;
  mode: string;
  class_id: string | null;
  puzzle_id: string;
  puzzle_title: string;
  puzzle_snapshot: string;
  duration_minutes: number;
  show_hints: number;
  status: string;
  host_user_id: string;
  host_name: string;
  started_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface ParticipantRow {
  session_id: string;
  user_id: string;
  display_name: string;
  email: string;
  role_at_join: string;
  answers_json: string;
  score: number;
  finished_at: string | null;
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function allocateJoinCode(db: D1Database): Promise<string> {
  for (let i = 0; i < 30; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const row = await db.prepare('SELECT 1 AS x FROM crossword_sessions WHERE join_code = ?').bind(code).first();
    if (!row) return code;
  }
  throw new Error('JOIN_CODE_POOL_EXHAUSTED');
}

function safeParseAnswers(json: string): Record<string, string> {
  try {
    const o = JSON.parse(json || '{}') as Record<string, string>;
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

export function participantToPublic(
  p: ParticipantRow,
  viewerId: string,
  viewerRole: RemoteUserRole,
  sessionStatus: string,
  puzzle: CrosswordSnapshot | null,
): {
  userId: string;
  displayName: string;
  email?: string;
  answers: Record<string, string>;
  score: number;
  finishedAt: string | null;
} {
  const answers = safeParseAnswers(p.answers_json);
  const isSelf = p.user_id === viewerId;
  const isTeacher = viewerRole === 'teacher';
  const ended = sessionStatus === 'ended';

  if (isTeacher || isSelf) {
    let score = p.score;
    if (puzzle && ended) {
      score = computeScoreFromAnswers(puzzle, answers);
    }
    return {
      userId: p.user_id,
      displayName: p.display_name,
      email: p.email,
      answers,
      score,
      finishedAt: p.finished_at,
    };
  }

  // 進行中：不暴露他人作答；結束後可見排行榜用的分數（無答案格子）
  if (ended && puzzle) {
    const score = computeScoreFromAnswers(puzzle, answers);
    return {
      userId: p.user_id,
      displayName: p.display_name,
      score,
      finishedAt: p.finished_at,
      answers: {},
    };
  }

  return {
    userId: p.user_id,
    displayName: p.display_name,
    answers: {},
    score: 0,
    finishedAt: null,
  };
}

export async function loadSession(db: D1Database, id: string): Promise<SessionRow | null> {
  return db.prepare('SELECT * FROM crossword_sessions WHERE id = ?').bind(id).first<SessionRow>();
}

export async function loadSessionByCode(db: D1Database, code: string): Promise<SessionRow | null> {
  const c = String(code || '').replace(/\D/g, '').slice(0, 6);
  if (c.length !== 6) return null;
  return db.prepare('SELECT * FROM crossword_sessions WHERE join_code = ?').bind(c).first<SessionRow>();
}

export async function listParticipants(db: D1Database, sessionId: string): Promise<ParticipantRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM crossword_session_participants WHERE session_id = ?')
    .bind(sessionId)
    .all<ParticipantRow>();
  return results ?? [];
}

export async function buildSessionJson(
  db: D1Database,
  row: SessionRow,
  viewer: AuthedUser | null,
): Promise<Record<string, unknown>> {
  const parts = await listParticipants(db, row.id);
  const puzzle = parseSnapshot(row.puzzle_snapshot);
  const viewerId = viewer?.id ?? '';
  const viewerRole = viewer?.role ?? 'guest';

  const participants = parts.map((p) => participantToPublic(p, viewerId, viewerRole, row.status, puzzle));

  let puzzleOut: unknown = null;
  try {
    puzzleOut = JSON.parse(row.puzzle_snapshot || 'null');
  } catch {
    puzzleOut = null;
  }

  return {
    id: row.id,
    joinCode: row.join_code,
    mode: row.mode,
    classId: row.class_id ?? '',
    puzzleId: row.puzzle_id,
    puzzleTitle: row.puzzle_title,
    puzzleSnapshot: puzzleOut,
    durationMinutes: row.duration_minutes,
    showHints: Boolean(row.show_hints),
    status: row.status,
    hostId: row.host_user_id,
    hostName: row.host_name,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    participants,
  };
}

export async function createSessionRow(
  db: D1Database,
  host: AuthedUser,
  body: {
    puzzleId: string;
    puzzleTitle: string;
    classId?: string;
    durationMinutes: number;
    showHints: boolean;
    puzzleSnapshot?: unknown;
    mode?: string;
  },
): Promise<{ id: string; join_code: string }> {
  const mode = body.mode === 'class' ? 'class' : 'practice';
  if (mode === 'class' && host.role !== 'teacher') {
    throw new Error('FORBIDDEN_CLASS_MODE');
  }

  const id = genId();
  const join_code = await allocateJoinCode(db);
  const snap = body.puzzleSnapshot !== undefined ? JSON.stringify(body.puzzleSnapshot) : '{}';
  const classId = body.classId && String(body.classId).trim() ? String(body.classId).trim() : null;

  await db
    .prepare(
      `INSERT INTO crossword_sessions (
        id, join_code, mode, class_id, puzzle_id, puzzle_title, puzzle_snapshot,
        duration_minutes, show_hints, status, host_user_id, host_name
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'waiting', ?, ?)`,
    )
    .bind(
      id,
      join_code,
      mode,
      classId,
      body.puzzleId,
      body.puzzleTitle || '填字題',
      snap,
      Math.max(1, Math.min(120, Number(body.durationMinutes) || 5)),
      body.showHints ? 1 : 0,
      host.id,
      host.name,
    )
    .run();

  return { id, join_code };
}

export async function addParticipant(
  db: D1Database,
  session: SessionRow,
  user: AuthedUser,
): Promise<void> {
  const exists = await db
    .prepare('SELECT 1 AS x FROM crossword_session_participants WHERE session_id = ? AND user_id = ?')
    .bind(session.id, user.id)
    .first();
  if (exists) return;

  await db
    .prepare(
      `INSERT INTO crossword_session_participants (session_id, user_id, display_name, email, role_at_join, answers_json, score)
       VALUES (?, ?, ?, ?, ?, '{}', 0)`,
    )
    .bind(session.id, user.id, user.name, user.email, user.role)
    .run();
}

export async function startSessionDb(db: D1Database, row: SessionRow): Promise<boolean> {
  if (row.status !== 'waiting') return false;
  const now = new Date();
  const end = new Date(now.getTime() + row.duration_minutes * 60 * 1000);
  await db
    .prepare(
      `UPDATE crossword_sessions SET status = 'playing', started_at = ?, ends_at = ? WHERE id = ? AND status = 'waiting'`,
    )
    .bind(now.toISOString(), end.toISOString(), row.id)
    .run();
  return true;
}

export async function endSessionDb(db: D1Database, row: SessionRow): Promise<void> {
  const puzzle = parseSnapshot(row.puzzle_snapshot);
  if (!puzzle) {
    await db.prepare(`UPDATE crossword_sessions SET status = 'ended', ends_at = ? WHERE id = ?`).bind(new Date().toISOString(), row.id).run();
    return;
  }

  const parts = await listParticipants(db, row.id);
  const now = new Date().toISOString();

  for (const p of parts) {
    const answers = safeParseAnswers(p.answers_json);
    const score = computeScoreFromAnswers(puzzle, answers);
    const finishedAt = p.finished_at ?? now;
    await db
      .prepare(
        `UPDATE crossword_session_participants SET score = ?, finished_at = COALESCE(finished_at, ?) WHERE session_id = ? AND user_id = ?`,
      )
      .bind(score, now, row.id, p.user_id)
      .run();
  }

  await db.prepare(`UPDATE crossword_sessions SET status = 'ended', ends_at = ? WHERE id = ?`).bind(now, row.id).run();
}

export async function mergeAnswer(
  db: D1Database,
  sessionId: string,
  userId: string,
  cellKey: string,
  value: string,
): Promise<boolean> {
  const row = await loadSession(db, sessionId);
  if (!row || row.status !== 'playing') return false;

  const p = await db
    .prepare('SELECT answers_json FROM crossword_session_participants WHERE session_id = ? AND user_id = ?')
    .bind(sessionId, userId)
    .first<{ answers_json: string }>();
  if (!p) return false;

  const answers = safeParseAnswers(p.answers_json);
  answers[cellKey] = value.slice(-1);

  await db
    .prepare('UPDATE crossword_session_participants SET answers_json = ? WHERE session_id = ? AND user_id = ?')
    .bind(JSON.stringify(answers), sessionId, userId)
    .run();
  return true;
}

export async function rankingsForSession(db: D1Database, sessionId: string): Promise<
  { userId: string; displayName: string; score: number; timeMs: number }[]
> {
  const row = await loadSession(db, sessionId);
  if (!row) return [];
  const puzzle = parseSnapshot(row.puzzle_snapshot);
  const parts = await listParticipants(db, sessionId);
  const started = row.started_at ? new Date(row.started_at).getTime() : 0;

  return parts
    .map((p) => {
      const answers = safeParseAnswers(p.answers_json);
      const score =
        row.status === 'ended' && puzzle
          ? computeScoreFromAnswers(puzzle, answers)
          : p.score;
      const timeMs =
        p.finished_at && started ? new Date(p.finished_at).getTime() - started : 0;
      return {
        userId: p.user_id,
        displayName: p.display_name,
        score,
        timeMs: Math.max(0, timeMs),
      };
    })
    .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
}

export async function listSessionsForClass(db: D1Database, classId: string): Promise<SessionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM crossword_sessions WHERE class_id = ? AND status IN ('waiting','playing') ORDER BY created_at DESC`,
    )
    .bind(classId)
    .all<SessionRow>();
  return results ?? [];
}

export async function listSessionsForHost(db: D1Database, hostUserId: string): Promise<SessionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM crossword_sessions WHERE host_user_id = ? AND status IN ('waiting','playing') ORDER BY created_at DESC`,
    )
    .bind(hostUserId)
    .all<SessionRow>();
  return results ?? [];
}

export async function teacherReportsRecent(db: D1Database, limit = 40): Promise<unknown[]> {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.join_code, s.puzzle_title, s.mode, s.status, s.created_at, s.host_name,
        (SELECT COUNT(*) FROM crossword_session_participants p WHERE p.session_id = s.id) AS participant_count
       FROM crossword_sessions s
       ORDER BY s.created_at DESC LIMIT ?`,
    )
    .bind(Math.min(200, Math.max(1, limit)))
    .all();
  return results ?? [];
}

export { genId };
