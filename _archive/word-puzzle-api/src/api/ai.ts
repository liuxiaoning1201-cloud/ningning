import type { Env } from "../index";
import { generateId, jsonResponse } from "../index";

export async function handleAi(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { word: string };
  const word = body.word?.trim();

  if (!word) {
    return jsonResponse({ error: "Missing word" }, 400, env);
  }

  // Check D1 cache
  const cached = await env.DB.prepare(
    "SELECT explanation FROM ai_cache WHERE word_text = ?"
  ).bind(word).first();

  if (cached) {
    return jsonResponse(JSON.parse(cached.explanation as string), 200, env);
  }

  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "AI API key not configured" }, 503, env);
  }

  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "你是一位中文語文教師助手。請用繁體中文回答。" },
          {
            role: "user",
            content: `請解釋「${word}」這個詞語/成語。請用以下格式回答：\n意思：（簡明解釋）\n用法：（使用情境說明）\n例句：（造一個例句）`,
          },
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status}`);
    }

    const data = await response.json() as { choices: { message: { content: string } }[] };
    const content = data.choices?.[0]?.message?.content ?? "";

    const meaningMatch = content.match(/意思[：:]\s*(.+?)(?=\n|用法|$)/s);
    const usageMatch = content.match(/用法[：:]\s*(.+?)(?=\n|例句|$)/s);
    const exampleMatch = content.match(/例句[：:]\s*(.+?)$/s);

    const explanation = {
      word,
      meaning: meaningMatch?.[1]?.trim() ?? content.trim(),
      usage: usageMatch?.[1]?.trim() ?? "",
      example: exampleMatch?.[1]?.trim() ?? "",
    };

    // Cache to D1
    await env.DB.prepare(
      "INSERT OR REPLACE INTO ai_cache (id, word_text, explanation) VALUES (?, ?, ?)"
    ).bind(generateId(), word, JSON.stringify(explanation)).run();

    return jsonResponse(explanation, 200, env);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    return jsonResponse({ error: message }, 500, env);
  }
}
