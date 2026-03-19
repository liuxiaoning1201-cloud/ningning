import type { MiddlewareUser } from '../../_middleware';
import { buildSessionJson, loadSession } from '../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../lib/sessionAuth';

export const onRequestGet: PagesFunction<{
  DB: D1Database;
}, '/api/sessions/:sessionId', { user: MiddlewareUser | null }> = async (context) => {
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

  const json = await buildSessionJson(context.env.DB, row, authed);
  return Response.json(json);
};
