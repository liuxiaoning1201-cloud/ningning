import { handleGoogleAuth } from "./auth/google";
import { handleWordBanks } from "./api/wordBanks";
import { handlePuzzles } from "./api/puzzles";
import { handleAi } from "./api/ai";
import { handleRooms } from "./api/rooms";

export { GameRoom } from "./durable/GameRoom";

export interface Env {
  DB: D1Database;
  GAME_ROOM: DurableObjectNamespace;
  CORS_ORIGIN: string;
  GOOGLE_CLIENT_ID?: string;
  DEEPSEEK_API_KEY?: string;
  JWT_SECRET?: string;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function corsHeaders(env: Env): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": env.CORS_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jsonResponse(data: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...(env ? corsHeaders(env) : {}),
    },
  });
}

async function verifyJwt(token: string, secret: string): Promise<{ sub: string; email: string } | null> {
  try {
    const [headerB64, payloadB64, signatureB64] = token.split(".");
    if (!headerB64 || !payloadB64 || !signatureB64) return null;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

    const valid = await crypto.subtle.verify("HMAC", key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}

export async function createJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + 86400 * 7 };

  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = encode(header);
  const payloadB64 = encode(fullPayload);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  return `${headerB64}.${payloadB64}.${sigB64}`;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      if (path === "/auth/google" && method === "POST") {
        return handleGoogleAuth(request, env);
      }

      if (path.startsWith("/api/")) {
        if (path.startsWith("/api/word-banks")) {
          return handleWordBanks(request, env, path, method);
        }
        if (path.startsWith("/api/puzzles")) {
          return handlePuzzles(request, env, path, method);
        }
        if (path === "/api/ai/explain" && method === "POST") {
          return handleAi(request, env);
        }
        if (path.startsWith("/api/rooms")) {
          return handleRooms(request, env, path, method);
        }
      }

      if (path.startsWith("/ws/room/")) {
        const roomId = path.replace("/ws/room/", "");
        const id = env.GAME_ROOM.idFromName(roomId);
        const stub = env.GAME_ROOM.get(id);
        return stub.fetch(request);
      }

      return jsonResponse({ error: "Not found" }, 404, env);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Internal server error";
      return jsonResponse({ error: message }, 500, env);
    }
  },
};

export { generateId, corsHeaders, jsonResponse, verifyJwt };
