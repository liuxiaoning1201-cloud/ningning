import { verifyJwt } from '../../shared/jwt';

const COOKIE_NAME = 'zy_token';
const COOKIE_MAX_AGE = 7 * 86400;

const ALLOWED_HOSTS = new Set([
  'qingyiu.com',
  'www.qingyiu.com',
]);

function safeNext(raw: string | null, fallbackOrigin: string): string {
  const fallback = `${fallbackOrigin}/`;
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return fallback;
    }
    if (!ALLOWED_HOSTS.has(u.hostname) && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return fallback;
    }
    return u.href;
  } catch {
    return fallback;
  }
}

async function readToken(request: Request): Promise<{ token: string; next: string | null }> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const body = await request.json() as { token?: string; next?: string };
    return { token: String(body.token || ''), next: body.next || null };
  }
  const form = await request.formData();
  return {
    token: String(form.get('token') || ''),
    next: form.get('next') ? String(form.get('next')) : null,
  };
}

export const onRequestPost: PagesFunction<{
  JWT_SECRET: string;
}> = async (context) => {
  const { token, next } = await readToken(context.request);
  if (!token) {
    return Response.json({ error: 'token required' }, { status: 400 });
  }

  const secret = context.env.JWT_SECRET || 'dev-secret';
  const payload = await verifyJwt(token, secret);
  if (!payload) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const here = new URL(context.request.url).origin;
  const dest = safeNext(next, here);
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;

  const wantsJson = (context.request.headers.get('accept') || '').includes('application/json')
    && !(context.request.headers.get('content-type') || '').includes('application/x-www-form-urlencoded');

  if (wantsJson) {
    return Response.json(
      { ok: true },
      { headers: { 'Set-Cookie': cookie } },
    );
  }

  return new Response(null, {
    status: 302,
    headers: {
      'Set-Cookie': cookie,
      Location: dest,
    },
  });
};
