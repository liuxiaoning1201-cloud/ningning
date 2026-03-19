import type { MiddlewareUser } from '../../_middleware';
import { createSessionRow } from '../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../lib/sessionAuth';

export const onRequestPost: PagesFunction<{
  DB: D1Database;
}, '/api/sessions', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();

  let body: Record<string, unknown>;
  try {
    body = (await context.request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const puzzleId = String(body.puzzleId ?? '').trim();
  if (!puzzleId) {
    return Response.json({ error: 'puzzleId required' }, { status: 400 });
  }

  try {
    const { id, join_code } = await createSessionRow(context.env.DB, authed, {
      puzzleId,
      puzzleTitle: String(body.puzzleTitle ?? '填字題'),
      classId: body.classId != null ? String(body.classId) : undefined,
      durationMinutes: Number(body.durationMinutes) || 5,
      showHints: Boolean(body.showHints),
      puzzleSnapshot: body.puzzleSnapshot,
      mode: body.mode != null ? String(body.mode) : undefined,
    });
    return Response.json({ id, joinCode: join_code });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'FORBIDDEN_CLASS_MODE') {
      return Response.json({ error: 'Only teachers can create class mode sessions' }, { status: 403 });
    }
    throw e;
  }
};
