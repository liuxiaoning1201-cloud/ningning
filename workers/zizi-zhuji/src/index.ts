/**
 * 字字珠璣 — Cloudflare Worker 入口。
 *
 * 端點：
 *   POST /api/rooms          建立房間
 *   GET  /api/rooms/:code    以 6 位 joinCode 查房間
 *   GET  /ws?room=ID         WebSocket 進入房間
 */

import { GameRoom } from "./gameRoom.js";
import { BUILTIN_TEMPLATES, getTemplate } from "./templates.js";

export { GameRoom };

interface Env {
  GAME_ROOM: DurableObjectNamespace;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

interface CreateRoomBody {
  template?: string;
  customRule?: import("../../../shared/zizizhujiTypes.js").GameRule;
  customBoardSize?: number;
  customTurnSeconds?: number;
  customTexts?: string[];
  hostId: string;
  hostName: string;
}

/** 6 位代碼 → roomId 對照（暫存於同一 DO，藉由唯一名字 "code-index"） */
async function allocCode(env: Env): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await codeExists(env, code))) return code;
  }
  throw new Error("JOIN_CODE_POOL_EXHAUSTED");
}

async function codeExists(env: Env, code: string): Promise<boolean> {
  const id = env.GAME_ROOM.idFromName(`code:${code}`);
  const stub = env.GAME_ROOM.get(id);
  const r = await stub.fetch(new Request("https://do/info"));
  if (!r.ok) return false;
  const data = (await r.json()) as { exists?: boolean };
  return Boolean(data.exists);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    if (url.pathname === "/api/templates" && request.method === "GET") {
      return json({ templates: BUILTIN_TEMPLATES });
    }

    if (url.pathname === "/api/rooms" && request.method === "POST") {
      let body: CreateRoomBody;
      try {
        body = (await request.json()) as CreateRoomBody;
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (!body.hostId || !body.hostName) {
        return json({ error: "hostId & hostName required" }, 400);
      }
      const tplId = body.template || "five-qa";
      const tpl = getTemplate(tplId);
      if (!tpl) return json({ error: "Unknown template" }, 400);

      const code = await allocCode(env);
      const id = env.GAME_ROOM.idFromName(`code:${code}`);
      const stub = env.GAME_ROOM.get(id);
      await stub.fetch(
        new Request("https://do/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template: tplId,
            customRule: body.customRule,
            customBoardSize: body.customBoardSize,
            customTurnSeconds: body.customTurnSeconds,
            customTexts: body.customTexts,
            hostId: body.hostId,
            hostName: body.hostName,
            joinCode: code,
          }),
        })
      );
      return json({
        roomId: `code:${code}`,
        joinCode: code,
        templateId: tplId,
        templateName: tpl.name,
      });
    }

    const codeMatch = url.pathname.match(/^\/api\/rooms\/(\d{6})$/);
    if (codeMatch && request.method === "GET") {
      const code = codeMatch[1];
      const id = env.GAME_ROOM.idFromName(`code:${code}`);
      const stub = env.GAME_ROOM.get(id);
      const r = await stub.fetch(new Request("https://do/info"));
      if (!r.ok) return json({ error: "Room not found" }, 404);
      const data = (await r.json()) as { exists?: boolean };
      if (!data.exists) return json({ error: "Room not found" }, 404);
      return json({ ...data, roomId: `code:${code}` });
    }

    if (url.pathname === "/ws") {
      const roomId = url.searchParams.get("room");
      if (!roomId) return new Response("Missing room", { status: 400 });
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response(
      JSON.stringify({
        name: "zizi-zhuji",
        endpoints: ["/api/templates", "/api/rooms", "/api/rooms/:code", "/ws?room=:roomId"],
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  },
};
