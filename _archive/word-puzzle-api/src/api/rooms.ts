import type { Env } from "../index";
import { generateId, jsonResponse } from "../index";

export async function handleRooms(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  const idMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
  const roomId = idMatch?.[1];

  // GET /api/rooms
  if (method === "GET" && !roomId) {
    const rooms = await env.DB.prepare(
      "SELECT r.*, u.display_name as host_name FROM game_rooms r LEFT JOIN users u ON r.host_id = u.id WHERE r.status != 'ended' ORDER BY r.created_at DESC"
    ).all();
    return jsonResponse(rooms.results, 200, env);
  }

  // GET /api/rooms/:id
  if (method === "GET" && roomId) {
    const room = await env.DB.prepare(
      "SELECT r.*, u.display_name as host_name FROM game_rooms r LEFT JOIN users u ON r.host_id = u.id WHERE r.id = ?"
    ).bind(roomId).first();
    if (!room) return jsonResponse({ error: "Not found" }, 404, env);

    const scores = await env.DB.prepare(
      "SELECT s.*, u.display_name FROM game_scores s LEFT JOIN users u ON s.user_id = u.id WHERE s.room_id = ? ORDER BY s.score DESC"
    ).bind(roomId).all();

    return jsonResponse({ ...room, scores: scores.results }, 200, env);
  }

  // POST /api/rooms
  if (method === "POST" && !roomId) {
    const body = await request.json() as {
      puzzleId: string;
      hostId: string;
      settings?: Record<string, unknown>;
    };
    const id = generateId();
    await env.DB.prepare(
      "INSERT INTO game_rooms (id, puzzle_id, host_id, settings_json) VALUES (?, ?, ?, ?)"
    ).bind(id, body.puzzleId, body.hostId, JSON.stringify(body.settings || {})).run();
    return jsonResponse({ id, status: "waiting" }, 201, env);
  }

  // PUT /api/rooms/:id
  if (method === "PUT" && roomId) {
    const body = await request.json() as { status?: string };
    if (body.status) {
      await env.DB.prepare(
        "UPDATE game_rooms SET status = ? WHERE id = ?"
      ).bind(body.status, roomId).run();
    }
    return jsonResponse({ success: true }, 200, env);
  }

  // DELETE /api/rooms/:id
  if (method === "DELETE" && roomId) {
    await env.DB.prepare("DELETE FROM game_scores WHERE room_id = ?").bind(roomId).run();
    await env.DB.prepare("DELETE FROM game_rooms WHERE id = ?").bind(roomId).run();
    return jsonResponse({ success: true }, 200, env);
  }

  return jsonResponse({ error: "Method not allowed" }, 405, env);
}
