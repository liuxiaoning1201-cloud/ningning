import type { MiddlewareUser } from '../../../_middleware';
import { buildSessionJson, loadSession, startSessionDb } from '../../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../../lib/sessionAuth';

export const onRequestPost: PagesFunction<{
  DB: D1Database;
}, '/api/sessions/:sessionId/start', { user: MiddlewareUser | null }> = async (context) => {
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
  if (row.host_user_id !== authed.id) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const ok = await startSessionDb(context.env.DB, row);
  if (!ok) {
    return Response.json({ error: 'Already started' }, { status: 400 });
  }

  const updated = await loadSession(context.env.DB, sessionId);
  if (!updated) {
    return Response.json({ error: 'SESSION_NOT_FOUND' }, { status: 404 });
  }
  const json = await buildSessionJson(context.env.DB, updated, authed);
  return Response.json(json);
};
