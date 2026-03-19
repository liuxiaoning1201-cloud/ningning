import { createJwt } from '../../shared/jwt';
import { resolveRemoteRole } from '../../shared/remoteRole';

const COOKIE_NAME = 'zy_token';
const COOKIE_MAX_AGE = 7 * 86400;

interface GooglePayload {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
  aud?: string;
}

async function verifyGoogleToken(idToken: string, clientId: string): Promise<GooglePayload | null> {
  try {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) return null;
    const payload = await res.json() as GooglePayload;
    if (clientId && payload.aud !== clientId) return null;
    return payload;
  } catch {
    return null;
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export const onRequestPost: PagesFunction<{
  DB: D1Database;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
}> = async (context) => {
  const body = await context.request.json() as { credential?: string };
  if (!body.credential) {
    return Response.json({ error: 'credential required' }, { status: 400 });
  }

  const google = await verifyGoogleToken(body.credential, context.env.GOOGLE_CLIENT_ID || '');
  if (!google) {
    return Response.json({ error: 'Invalid Google token' }, { status: 401 });
  }

  const existing = await context.env.DB.prepare('SELECT id FROM users WHERE google_id = ?')
    .bind(google.sub)
    .first<{ id: string }>();

  if (existing) {
    await context.env.DB.prepare(
      `UPDATE users SET email = ?, name = ?, avatar_url = ?, last_login_at = datetime('now') WHERE google_id = ?`,
    )
      .bind(google.email, google.name || google.email, google.picture || null, google.sub)
      .run();
  } else {
    const userId = generateId();
    await context.env.DB.prepare(
      `INSERT INTO users (id, google_id, email, name, avatar_url, last_login_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(userId, google.sub, google.email, google.name || google.email, google.picture || null)
      .run();
  }

  const user = await context.env.DB.prepare(
    'SELECT id, email, name, avatar_url FROM users WHERE google_id = ?',
  ).bind(google.sub).first<{ id: string; email: string; name: string; avatar_url: string | null }>();

  if (!user) {
    return Response.json({ error: 'Failed to create user' }, { status: 500 });
  }

  const role = await resolveRemoteRole(context.env.DB, user.email);
  const secret = context.env.JWT_SECRET || 'dev-secret';
  const jwt = await createJwt(
    { sub: user.id, email: user.email, name: user.name, role },
    secret,
    COOKIE_MAX_AGE,
  );

  const cookie = `${COOKIE_NAME}=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  const userPayload = {
    id: user.id,
    email: user.email,
    displayName: user.name,
    avatarUrl: user.avatar_url,
    role,
  };

  return Response.json(
    { token: jwt, user: userPayload },
    { headers: { 'Set-Cookie': cookie } },
  );
};
