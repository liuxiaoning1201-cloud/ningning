const ALG = { name: 'HMAC', hash: 'SHA-256' } as const;

function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlEncode(obj: unknown): string {
  return btoa(JSON.stringify(obj))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(str: string): string {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

async function importKey(secret: string, usage: 'sign' | 'verify') {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    ALG,
    false,
    [usage],
  );
}

export async function createJwt(
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 7 * 86400,
): Promise<string> {
  const header = b64urlEncode({ alg: 'HS256', typ: 'JWT' });
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode({ ...payload, iat: now, exp: now + expiresInSeconds });

  const key = await importKey(secret, 'sign');
  const sig = await crypto.subtle.sign(ALG.name, key, new TextEncoder().encode(`${header}.${body}`));

  return `${header}.${body}.${b64url(sig)}`;
}

export async function verifyJwt(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;

    const key = await importKey(secret, 'verify');
    const sig = Uint8Array.from(b64urlDecode(signature), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify(ALG.name, key, sig, new TextEncoder().encode(`${header}.${payload}`));
    if (!valid) return null;

    const data = JSON.parse(b64urlDecode(payload));
    if (data.exp && Date.now() / 1000 > data.exp) return null;

    return data;
  } catch {
    return null;
  }
}
