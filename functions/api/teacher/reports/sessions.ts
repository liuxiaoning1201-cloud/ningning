import type { MiddlewareUser } from '../../../_middleware';
import { teacherReportsRecent } from '../../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../../lib/sessionAuth';

/** 教師監管：近期場次摘要（全站，僅教師） */
export const onRequestGet: PagesFunction<{
  DB: D1Database;
}, '/api/teacher/reports/sessions', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();
  if (authed.role !== 'teacher') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(context.request.url);
  const limit = Number(url.searchParams.get('limit') ?? '40');
  const list = await teacherReportsRecent(context.env.DB, limit);
  return Response.json(list);
};
