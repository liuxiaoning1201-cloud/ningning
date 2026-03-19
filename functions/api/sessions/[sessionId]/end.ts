import type { MiddlewareUser } from '../../../_middleware';
import { buildSessionJson, endSessionDb, loadSession } from '../../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../../lib/sessionAuth';

export const onRequestPost: PagesFunction<{
  DB: D1Database;
}, '/api/sessions/:sessionId/end', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();

  const sessionId = (context.params as Record<string, string | undefined>).sessionId;
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  const row = await loadSession(context.env.DB, sessionId);
  if (!row) {
    return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
  }

  const isHost = row.host_user_id === authed.id;
  const endsMs = row.ends_at ? new Date(row.ends_at).getTime() : 0;
  const timedOut = Boolean(endsMs && Date.now() > endsMs);

  if (!isHost) {
    if (!timedOut) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    const member = await context.env.DB.prepare(
      'SELECT 1 AS x FROM crossword_session_participants WHERE session_id = ? AND user_id = ?',
    )
      .bind(sessionId, authed.id)
      .first();
    if (!member) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  if (row.status === 'ended') {
    const updated = await loadSession(context.env.DB, sessionId);
    if (!updated) {
      return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
    }
    return Response.json(await buildSessionJson(context.env.DB, updated, authed));
  }

  await endSessionDb(context.env.DB, row);
  const updated = await loadSession(context.env.DB, sessionId);
  if (!updated) {
    return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
  }
  const json = await buildSessionJson(context.env.DB, updated, authed);
  return Response.json(json);
};
