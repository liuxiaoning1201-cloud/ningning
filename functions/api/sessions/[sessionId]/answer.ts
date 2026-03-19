import type { MiddlewareUser } from '../../../_middleware';
import { mergeAnswer } from '../../../lib/crosswordSessionDb';
import { toAuthed, unauthorized } from '../../../lib/sessionAuth';

export const onRequestPost: PagesFunction<{
  DB: D1Database;
}, '/api/sessions/:sessionId/answer', { user: MiddlewareUser | null }> = async (context) => {
  const authed = toAuthed(context.data.user);
  if (!authed) return unauthorized();

  const sessionId = (context.params as Record<string, string | undefined>).sessionId;
  if (!sessionId) {
    return Response.json({ error: 'sessionId required' }, { status: 400 });
  }

  let body: { cellKey?: string; value?: string };
  try {
    body = (await context.request.json()) as { cellKey?: string; value?: string };
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cellKey = String(body.cellKey ?? '');
  const value = String(body.value ?? '').trim();
  if (!cellKey) {
    return Response.json({ error: 'cellKey required' }, { status: 400 });
  }

  const ok = await mergeAnswer(context.env.DB, sessionId, authed.id, cellKey, value);
  return Response.json({ ok });
};
