import type { MiddlewareUser } from '../../_middleware';
import { addParticipant, buildSessionJson, loadSessionByCode } from '../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../lib/sessionAuth';

export const onRequestPost: PagesFunction<{
  DB: D1Database;
}, '/', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();

  let body: { code?: string };
  try {
    body = (await context.request.json()) as { code?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const session = await loadSessionByCode(context.env.DB, String(body.code ?? ''));
  if (!session) {
    return Response.json({ error: 'SESSION_CODE_INVALID' }, { status: 404 });
  }
  if (session.status !== 'waiting') {
    return Response.json({ error: 'SESSION_NOT_JOINABLE' }, { status: 400 });
  }

  await addParticipant(context.env.DB, session, authed);
  const json = await buildSessionJson(context.env.DB, session, authed);
  return Response.json(json);
};
