import type { MiddlewareUser } from '../../_middleware';
import { buildSessionJson, listSessionsForHost } from '../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../lib/sessionAuth';

/** 教師：列出自己主持的進行中／等待中場次（不依賴班級 API） */
export const onRequestGet: PagesFunction<{
  DB: D1Database;
}, '/api/teacher/sessions', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();
  if (authed.role !== 'teacher') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await listSessionsForHost(context.env.DB, authed.id);
  const out = [];
  for (const row of rows) {
    out.push(await buildSessionJson(context.env.DB, row, authed));
  }
  return Response.json(out);
};
