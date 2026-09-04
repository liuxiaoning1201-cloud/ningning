import type { MiddlewareUser } from '../_middleware';
import type { AuthedUser } from './crosswordSessionDb';

export function toAuthed(user: MiddlewareUser | null): AuthedUser | null {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
