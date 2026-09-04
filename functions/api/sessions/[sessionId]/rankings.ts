import type { MiddlewareUser } from '../../../_middleware';
import { rankingsForSession } from '../../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../../lib/sessionAuth';

export const onRequestGet: PagesFunction<{
  DB: D1Database;
}, '/api/sessions/:sessionId/rankings', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();

  const sessionId = (context.params as Record<string, string | undefined>).sessionId;
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  const list = await rankingsForSession(context.env.DB, sessionId);
  return Response.json(list);
};
