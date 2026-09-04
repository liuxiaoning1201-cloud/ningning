import { createJwt } from "../../shared/jwt";
import { resolveRemoteRole } from "../../shared/remoteRole";

const COOKIE_NAME = "zy_token";
const COOKIE_MAX_AGE = 7 * 86400;

export const onRequestPost: PagesFunction<{
  JWT_SECRET: string;
  DB: D1Database;
}> = async (context) => {
  const body = await context.request.json() as { displayName?: string; email?: string };
  const displayName = String(body.displayName || "").trim();
  const email = String(body.email || "").trim();

  if (!displayName || !email) {
    return Response.json({ error: "displayName and email required" }, { status: 400 });
  }

  const secret = context.env.JWT_SECRET || "dev-secret";
  const userId = `demo:${email}`;
  const role = await resolveRemoteRole(context.env.DB, email);
  const jwt = await createJwt(
    { sub: userId, email, name: displayName, role },
    secret,
    COOKIE_MAX_AGE,
  );

  const cookie = `${COOKIE_NAME}=${jwt}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  const user = { id: userId, email, displayName, avatarUrl: null as string | null, role };

  return Response.json(
    { token: jwt, user },
    { headers: { "Set-Cookie": cookie } },
  );
};
