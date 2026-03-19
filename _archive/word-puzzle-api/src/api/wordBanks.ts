import type { Env } from "../index";
import { generateId, jsonResponse } from "../index";

export async function handleWordBanks(
  request: Request,
  env: Env,
  path: string,
  method: string
): Promise<Response> {
  const idMatch = path.match(/^\/api\/word-banks\/([^/]+)$/);
  const bankId = idMatch?.[1];

  // GET /api/word-banks
  if (method === "GET" && !bankId) {
    const banks = await env.DB.prepare("SELECT * FROM word_banks ORDER BY created_at DESC").all();
    const result = [];
    for (const bank of banks.results) {
      const items = await env.DB.prepare(
        "SELECT * FROM word_bank_items WHERE bank_id = ?"
      ).bind(bank.id).all();
      result.push({ ...bank, items: items.results });
    }
    return jsonResponse(result, 200, env);
  }

  // GET /api/word-banks/:id
  if (method === "GET" && bankId) {
    const bank = await env.DB.prepare("SELECT * FROM word_banks WHERE id = ?").bind(bankId).first();
    if (!bank) return jsonResponse({ error: "Not found" }, 404, env);
    const items = await env.DB.prepare(
      "SELECT * FROM word_bank_items WHERE bank_id = ?"
    ).bind(bankId).all();
    return jsonResponse({ ...bank, items: items.results }, 200, env);
  }

  // POST /api/word-banks
  if (method === "POST" && !bankId) {
    const body = await request.json() as { name: string; items?: { text: string; definition?: string; source?: string; difficulty?: number }[] };
    const id = generateId();
    await env.DB.prepare(
      "INSERT INTO word_banks (id, name) VALUES (?, ?)"
    ).bind(id, body.name).run();

    if (body.items?.length) {
      const stmt = env.DB.prepare(
        "INSERT INTO word_bank_items (id, bank_id, text, definition, source, difficulty) VALUES (?, ?, ?, ?, ?, ?)"
      );
      const batch = body.items.map((item) =>
        stmt.bind(generateId(), id, item.text, item.definition || "", item.source || "", item.difficulty || 1)
      );
      await env.DB.batch(batch);
    }

    return jsonResponse({ id, name: body.name }, 201, env);
  }

  // PUT /api/word-banks/:id
  if (method === "PUT" && bankId) {
    const body = await request.json() as { name?: string; items?: { id?: string; text: string; definition?: string; source?: string; difficulty?: number }[] };

    if (body.name) {
      await env.DB.prepare("UPDATE word_banks SET name = ? WHERE id = ?").bind(body.name, bankId).run();
    }

    if (body.items) {
      await env.DB.prepare("DELETE FROM word_bank_items WHERE bank_id = ?").bind(bankId).run();
      if (body.items.length > 0) {
        const stmt = env.DB.prepare(
          "INSERT INTO word_bank_items (id, bank_id, text, definition, source, difficulty) VALUES (?, ?, ?, ?, ?, ?)"
        );
        const batch = body.items.map((item) =>
          stmt.bind(item.id || generateId(), bankId, item.text, item.definition || "", item.source || "", item.difficulty || 1)
        );
        await env.DB.batch(batch);
      }
    }

    return jsonResponse({ success: true }, 200, env);
  }

  // DELETE /api/word-banks/:id
  if (method === "DELETE" && bankId) {
    await env.DB.prepare("DELETE FROM word_bank_items WHERE bank_id = ?").bind(bankId).run();
    await env.DB.prepare("DELETE FROM word_banks WHERE id = ?").bind(bankId).run();
    return jsonResponse({ success: true }, 200, env);
  }

  return jsonResponse({ error: "Method not allowed" }, 405, env);
}
