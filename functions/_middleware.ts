import { verifyJwt } from '../shared/jwt';
import { isRemoteUserRole, resolveRemoteRole, type RemoteUserRole } from '../shared/remoteRole';

const COOKIE_NAME = 'zy_token';

export interface MiddlewareUser {
  id: string;
  email: string;
  name: string;
  role: RemoteUserRole;
}

interface ContextData extends Record<string, unknown> {
  user: MiddlewareUser | null;
}

export const onRequest: PagesFunction<{
  JWT_SECRET: string;
  DB: D1Database;
}, '/', ContextData> = async (context) => {
  let token: string | undefined;

  const cookie = context.request.headers.get('Cookie') || '';
  const cookieMatch = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (cookieMatch?.[1]) token = cookieMatch[1];

  const authHeader = context.request.headers.get('Authorization');
  if (!token && authHeader?.startsWith('Bearer ')) token = authHeader.slice(7);

  let user: MiddlewareUser | null = null;
  if (token && context.env.JWT_SECRET) {
    const payload = await verifyJwt(token, context.env.JWT_SECRET);
    if (payload) {
      let role: RemoteUserRole = 'guest';
      const fromJwt = payload.role;
      if (isRemoteUserRole(fromJwt)) {
        role = fromJwt;
      } else if (context.env.DB) {
        role = await resolveRemoteRole(context.env.DB, String(payload.email ?? ''));
      } else {
        const em = String(payload.email ?? '').toLowerCase();
        if (em.endsWith('@student.isf.edu.hk')) role = 'student';
      }
      user = {
        id: payload.sub as string,
        email: payload.email as string,
        name: (payload.name as string) || String(payload.email ?? ''),
        role,
      };
    }
  }

  context.data.user = user;
  return context.next();
};
