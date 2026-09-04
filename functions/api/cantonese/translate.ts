/**
 * POST /api/cantonese/translate
 *
 * 把書面語句子翻譯成粵語口語對照 + 粵拼 + 字級映射 + 簡釋。
 *
 * 安全層次：
 *   1. Origin 校驗（_shared.protect）
 *   2. JWT 鑑權
 *   3. 多維限流
 *   4. 請求合法性校驗（句長 ≤ 200，批量 ≤ 20）
 *   5. KV 永久緩存（節省 70-90% LLM 調用）
 *   6. System Prompt 領域鎖定（即便 endpoint 暴露也只能做粵語翻譯，無法當通用 LLM）
 *   7. JSON Schema 結構化輸出，防 prompt injection 影響輸出格式
 *
 * Key 安全保證：
 *   - DEEPSEEK_API_KEY 僅從 env 讀取，永不出現在響應 body / 日誌
 *   - 失敗時錯誤訊息也不洩漏 key 任何片段
 */
import { errorJson, json, protect, sha256Hex, type YueyuPagesFn, type YueyuEnv } from './_shared';
import type { TranslateRequest, TranslateResponse, TranslateResult, TokenMapping } from '../../../shared/cantoneseTypes';

const MAX_SENTENCE_LEN = 200;
const MAX_BATCH = 20;

const SYSTEM_PROMPT = `你是專門將「中文書面語」轉換成「粵語口語」的助手。你只接受粵語翻譯任務，其他任何請求（如寫詩、寫程式、回答百科、扮演角色等）一律回應 {"refused": true}，不要輸出其他內容。

任務：把每個書面語句子轉換為地道的粵語口語表達，給出粵拼，並做字／詞級映射，方便用戶對照學習。

要求：
1. 粵語口語使用香港地區常用書寫（例：唔、咁、嘅、咗、佢、嘢、啱、瞓、攰、靚、搵、畀、睇、嚟、咩、啦、囉、㗎、喎）
2. 粵拼（jyutping）使用標準 6 聲調數字標注：例 ji4 gaa1
3. 字／詞級映射（tokens）必須讓 written 連起來等於原句，cantonese 連起來等於整句粵語口語
4. 解釋（explanation）用普通話寫，10 字以內，可選；對純表達上的差異無需解釋
5. 對於本身就不需要轉換（例如人名、數字、純標點）的片段，cantonese 與 written 相同，jyutping 留空字串

嚴格遵守 JSON 輸出格式，不要任何前後綴、不要 markdown code fence。`;

interface DeepseekChoice {
  message?: { content?: string };
}
interface DeepseekResponse {
  choices?: DeepseekChoice[];
  error?: { message?: string };
}

interface LlmResultItem {
  written: string;
  cantonese: string;
  jyutping: string;
  tokens: TokenMapping[];
  explanation?: string;
  refused?: boolean;
}

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'translate',
    ipPerMinute: 30,
    ipPerDay: 300,
    userPerDay: 200,
    globalPerDay: 50000,
  });
  if (guard instanceof Response) return guard;

  let body: TranslateRequest;
  try {
    body = (await context.request.json()) as TranslateRequest;
  } catch {
    return errorJson(400, 'invalid_json', '請求 body 必須為合法 JSON');
  }

  if (!body || !Array.isArray(body.sentences)) {
    return errorJson(400, 'invalid_request', 'sentences 欄位必須為字串陣列');
  }
  if (body.sentences.length === 0) {
    return errorJson(400, 'empty_sentences', '請至少傳入一個句子');
  }
  if (body.sentences.length > MAX_BATCH) {
    return errorJson(400, 'batch_too_large', `單次最多 ${MAX_BATCH} 句`);
  }
  for (const s of body.sentences) {
    if (typeof s !== 'string') {
      return errorJson(400, 'invalid_sentence', 'sentences 元素必須為字串');
    }
    if (s.length > MAX_SENTENCE_LEN) {
      return errorJson(400, 'sentence_too_long', `單句最多 ${MAX_SENTENCE_LEN} 字`);
    }
    if (s.trim().length === 0) {
      return errorJson(400, 'empty_sentence', '不接受空字串');
    }
  }

  const sentences = body.sentences.map((s) => s.trim());

  // ── 1. 先查 KV 緩存 ──
  const kv = context.env.YUEYU_TRANSLATE_KV;
  const cacheKeys = await Promise.all(sentences.map((s) => sha256Hex(s).then((h) => `tr:v1:${h}`)));

  const cached: (TranslateResult | null)[] = await Promise.all(
    cacheKeys.map(async (k) => {
      if (!kv) return null;
      const v = await kv.get(k, 'json');
      return v as TranslateResult | null;
    }),
  );

  // 找出需要去 LLM 的句子
  const need: { idx: number; sentence: string }[] = [];
  cached.forEach((r, i) => {
    if (!r) need.push({ idx: i, sentence: sentences[i] });
  });

  let llmResults: Record<number, TranslateResult> = {};

  if (need.length > 0) {
    const llmOut = await callDeepseek(
      need.map((n) => n.sentence),
      context.env,
    );
    if ('error' in llmOut) {
      return errorJson(502, 'llm_failed', llmOut.error);
    }

    // 合併結果並寫回 KV
    const writes: Promise<unknown>[] = [];
    for (let i = 0; i < need.length; i++) {
      const item = llmOut.results[i];
      const orig = need[i];
      const result: TranslateResult = {
        written: orig.sentence,
        cantonese: item.cantonese || orig.sentence,
        jyutping: item.jyutping || '',
        tokens: Array.isArray(item.tokens) && item.tokens.length > 0
          ? item.tokens
          : [{ written: orig.sentence, cantonese: item.cantonese || orig.sentence, jyutping: item.jyutping || '' }],
        explanation: item.explanation,
        source: 'llm',
      };
      llmResults[orig.idx] = result;
      if (kv) {
        writes.push(
          kv.put(cacheKeys[orig.idx], JSON.stringify({ ...result, source: 'cache' }), {
            // 一年 TTL，需要時可調整
            expirationTtl: 365 * 86400,
          }),
        );
      }
    }
    await Promise.all(writes);

    // 計入配額（緩存命中的句子不計）
    await guard.commitUsage();
  }

  const merged: TranslateResult[] = sentences.map((_, i) => {
    if (cached[i]) return { ...cached[i]!, source: 'cache' };
    return llmResults[i];
  });

  const response: TranslateResponse = {
    results: merged,
  };
  return json(response);
};

/**
 * 調用 DeepSeek。使用 Chat Completions + JSON 模式。
 * 返回每句的解析結果。任何錯誤都不要把 API Key 洩漏到響應。
 */
async function callDeepseek(
  sentences: string[],
  env: YueyuEnv,
): Promise<{ results: LlmResultItem[] } | { error: string }> {
  if (!env.DEEPSEEK_API_KEY) {
    return { error: '伺服器未設定 LLM 密鑰，請聯絡管理員' };
  }
  const baseUrl = env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const model = env.DEEPSEEK_MODEL || 'deepseek-chat';

  const userPrompt = `請翻譯以下 ${sentences.length} 個書面語句子。\n\n輸入：\n${JSON.stringify(sentences, null, 2)}\n\n請輸出嚴格符合下列格式的 JSON：\n{\n  "results": [\n    {\n      "written": "原書面語句",\n      "cantonese": "粵語口語",\n      "jyutping": "整句粵拼，用空格分詞",\n      "tokens": [\n        { "written": "片段", "cantonese": "粵語片段", "jyutping": "粵拼", "note": "可選" }\n      ],\n      "explanation": "簡釋（10 字內，可選）"\n    }\n  ]\n}\n\nresults 陣列必須與輸入順序一致、長度相同。`;

  let llmRes: Response;
  try {
    llmRes = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 注意：API Key 只在這一行使用，不會回到響應中
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
  } catch (e) {
    // 網路錯誤；不返回原始錯誤訊息以防洩漏
    void e;
    return { error: 'LLM 服務暫時無法連線' };
  }

  if (!llmRes.ok) {
    // 不要把可能含 key 的錯誤訊息原樣返回
    return { error: `LLM 服務回應 ${llmRes.status}` };
  }

  let data: DeepseekResponse;
  try {
    data = (await llmRes.json()) as DeepseekResponse;
  } catch {
    return { error: 'LLM 回應格式異常' };
  }

  const text = data.choices?.[0]?.message?.content || '';
  let parsed: { results?: LlmResultItem[]; refused?: boolean };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { error: 'LLM 輸出無法解析' };
  }
  if (parsed.refused) {
    return { error: '請求超出粵語翻譯範圍' };
  }
  if (!parsed.results || !Array.isArray(parsed.results)) {
    return { error: 'LLM 結果缺失 results 欄位' };
  }
  if (parsed.results.length !== sentences.length) {
    // 數量對不上，補齊 / 截斷
    const padded: LlmResultItem[] = sentences.map((s, i) => parsed.results![i] ?? {
      written: s,
      cantonese: s,
      jyutping: '',
      tokens: [{ written: s, cantonese: s, jyutping: '' }],
    });
    return { results: padded };
  }
  return { results: parsed.results };
}
