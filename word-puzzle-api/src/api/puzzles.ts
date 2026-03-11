import type { Env } from "../index";
import { generateId, jsonResponse } from "../index";

export async function handlePuzzles(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  const idMatch = path.match(/^\/api\/puzzles\/([^/]+)$/);
  const puzzleId = idMatch?.[1];

  // GET /api/puzzles
  if (method === "GET" && !puzzleId) {
    const puzzles = await env.DB.prepare(
      "SELECT * FROM puzzle_sets ORDER BY created_at DESC"
    ).all();
    return jsonResponse(puzzles.results.map((p) => ({
      ...p,
      gridJson: p.grid_json ? JSON.parse(p.grid_json as string) : null,
    })), 200, env);
  }

  // GET /api/puzzles/:id
  if (method === "GET" && puzzleId) {
    const puzzle = await env.DB.prepare(
      "SELECT * FROM puzzle_sets WHERE id = ?"
    ).bind(puzzleId).first();
    if (!puzzle) return jsonResponse({ error: "Not found" }, 404, env);
    return jsonResponse({
      ...puzzle,
      gridJson: puzzle.grid_json ? JSON.parse(puzzle.grid_json as string) : null,
    }, 200, env);
  }

  // POST /api/puzzles
  if (method === "POST" && !puzzleId) {
    const body = await request.json() as {
      title: string;
      type?: string;
      difficulty?: number;
      gridJson?: unknown;
    };
    const id = generateId();
    await env.DB.prepare(
      "INSERT INTO puzzle_sets (id, title, type, difficulty, grid_json) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      id,
      body.title,
      body.type || "crossword",
      body.difficulty || 1,
      body.gridJson ? JSON.stringify(body.gridJson) : null
    ).run();
    return jsonResponse({ id, title: body.title }, 201, env);
  }

  // PUT /api/puzzles/:id
  if (method === "PUT" && puzzleId) {
    const body = await request.json() as {
      title?: string;
      difficulty?: number;
      gridJson?: unknown;
    };
    const updates: string[] = [];
    const values: unknown[] = [];
    if (body.title) { updates.push("title = ?"); values.push(body.title); }
    if (body.difficulty) { updates.push("difficulty = ?"); values.push(body.difficulty); }
    if (body.gridJson !== undefined) { updates.push("grid_json = ?"); values.push(JSON.stringify(body.gridJson)); }

    if (updates.length > 0) {
      values.push(puzzleId);
      await env.DB.prepare(
        `UPDATE puzzle_sets SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...values).run();
    }
    return jsonResponse({ success: true }, 200, env);
  }

  // DELETE /api/puzzles/:id
  if (method === "DELETE" && puzzleId) {
    await env.DB.prepare("DELETE FROM puzzle_sets WHERE id = ?").bind(puzzleId).run();
    return jsonResponse({ success: true }, 200, env);
  }

  return jsonResponse({ error: "Method not allowed" }, 405, env);
}
