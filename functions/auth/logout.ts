const COOKIE_NAME = 'zy_token';

export const onRequestPost: PagesFunction = async () => {
  const cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
};
