import type { MiddlewareUser } from '../../../_middleware';
import { buildSessionJson, listSessionsForClass } from '../../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../../lib/sessionAuth';

export const onRequestGet: PagesFunction<{
  DB: D1Database;
}, '/api/classes/:classId/sessions', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();

  const classId = (context.params as Record<string, string | undefined>).classId;
  if (!classId) {
    return Response.json({ error: 'classId required' }, { status: 400 });
  }

  const rows = await listSessionsForClass(context.env.DB, classId);
  const out = [];
  for (const row of rows) {
    out.push(await buildSessionJson(context.env.DB, row, authed));
  }
  return Response.json(out);
};
