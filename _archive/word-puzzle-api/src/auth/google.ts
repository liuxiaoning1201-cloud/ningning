import type { Env } from "../index";
import { createJwt, generateId, jsonResponse } from "../index";

export async function handleGoogleAuth(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { credential?: string };
  const credential = body.credential;

  if (!credential) {
    return jsonResponse({ error: "Missing credential" }, 400, env);
  }

  try {
    const googlePayload = await verifyGoogleToken(credential, env.GOOGLE_CLIENT_ID || "");
    if (!googlePayload) {
      return jsonResponse({ error: "Invalid Google token" }, 401, env);
    }

    const { sub: googleId, email, name, picture } = googlePayload;

    const userId = generateId();
    await env.DB.prepare(
      `INSERT INTO users (id, google_id, email, display_name, avatar_url)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(google_id) DO UPDATE SET
         email = excluded.email,
         display_name = excluded.display_name,
         avatar_url = excluded.avatar_url`
    ).bind(userId, googleId, email, name || email, picture || "").run();

    const user = await env.DB.prepare(
      "SELECT * FROM users WHERE google_id = ?"
    ).bind(googleId).first();

    if (!user) {
      return jsonResponse({ error: "Failed to create user" }, 500, env);
    }

    const secret = env.JWT_SECRET || "default-secret-change-me";
    const jwt = await createJwt(
      { sub: user.id as string, email: user.email as string, name: user.display_name as string },
      secret
    );

    return jsonResponse({
      token: jwt,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      },
    }, 200, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth failed";
    return jsonResponse({ error: message }, 500, env);
  }
}

async function verifyGoogleToken(
  token: string,
  clientId: string
): Promise<{ sub: string; email: string; name?: string; picture?: string } | null> {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (!response.ok) return null;

    const payload = await response.json() as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
      aud?: string;
    };

    if (clientId && payload.aud !== clientId) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    };
  } catch {
    return null;
  }
}
