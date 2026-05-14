/**
 * POST /api/cantonese/asr
 *
 * 粵語口語聽寫：接收短音頻 / 視頻片段，用 Workers AI Whisper 轉寫，
 * 再用 DeepSeek 做保守斷句、粵拼、書面意思和高頻詞拓展。
 *
 * 原則：
 *   - 音頻識別是主來源，字幕只可輔助理解，不可覆蓋聽到的口語。
 *   - 不做「書面語翻譯成口語」；只整理實際聽到的粵語對白。
 */
import { errorJson, json, protect, type YueyuEnv, type YueyuPagesFn } from './_shared';
import { transcribeAllChunks } from './asrProviders';
import type {
  AsrRequest,
  AsrResponse,
  AsrSentence,
  AsrTerm,
  AsrHistoryResponse,
  AsrHistorySession,
} from '../../../shared/cantoneseTypes';

// 單塊大小上限：Workers AI Whisper 在請求 >2MB 時會 3006: Request is too large。
// 前端會先把音頻壓成 16kHz 單聲道 WAV 並切成 ≤20s 一段，所以單塊不會超過 ~1MB。
const MAX_CHUNK_BYTES = 2 * 1024 * 1024;
// 全部塊加起來最大 20MB，防止有人傳整集電影
const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
const MAX_CHUNKS = 24; // 對應前端 24 × 20s = 8 分鐘上限

interface DeepseekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface RefinePayload {
  sentences?: AsrSentence[];
  terms?: AsrTerm[];
}

interface AsrHistoryRow {
  id: string;
  file_name: string | null;
  raw_text: string;
  sentences_json: string | null;
  terms_json: string | null;
  subtitle_hint: string | null;
  provider: string | null;
  chunk_count: number | null;
  duration_seconds: number | null;
  created_at: string;
}

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'asr',
    ipPerMinute: 6,
    ipPerDay: 40,
    userPerDay: 40,
    globalPerDay: 3000,
  });
  if (guard instanceof Response) return guard;

  let body: AsrRequest;
  try {
    body = (await context.request.json()) as AsrRequest;
  } catch {
    return errorJson(400, 'invalid_json');
  }

  if (body.subtitleHint && body.subtitleHint.length > 1000) {
    return errorJson(400, 'subtitle_too_long', '字幕輔助文字最長 1000 字');
  }
  if (!context.env.AI) {
    return errorJson(503, 'asr_unavailable', '語音識別服務尚未配置（需 Cloudflare Workers AI 綁定）');
  }

  // 收集所有分塊：優先用 chunks，否則退回到單塊 media
  const rawChunks: string[] = Array.isArray(body.chunks)
    ? body.chunks.filter((c): c is string => typeof c === 'string' && c.length > 0)
    : [];
  if (!rawChunks.length && typeof body.media === 'string' && body.media.length > 0) {
    rawChunks.push(body.media);
  }
  if (!rawChunks.length) {
    return errorJson(400, 'missing_media', '請提供音頻或視頻片段');
  }
  if (rawChunks.length > MAX_CHUNKS) {
    return errorJson(413, 'too_many_chunks', `音頻片段過多（>${MAX_CHUNKS}），請縮短到 ${MAX_CHUNKS * 20} 秒內`);
  }

  const base64Chunks: string[] = [];
  let totalBytes = 0;
  for (const chunk of rawChunks) {
    const parsed = parseBase64Media(chunk);
    if ('error' in parsed) return parsed.error;
    if (parsed.base64.length * 0.75 > MAX_CHUNK_BYTES) {
      return errorJson(
        413,
        'chunk_too_large',
        '單個音頻片段過大，請重新上傳（前端會自動切成小段）',
      );
    }
    totalBytes += parsed.base64.length * 0.75;
    if (totalBytes > MAX_TOTAL_BYTES) {
      return errorJson(413, 'media_too_large', '音頻總長過長，請縮短到 5 分鐘以內');
    }
    base64Chunks.push(parsed.base64);
  }

  const whisper = await transcribeAllChunks(context.env, base64Chunks);
  if ('error' in whisper) return errorJson(502, 'asr_failed', whisper.error);

  const rawText = normalizeTranscript(whisper.text || '');
  if (!rawText) {
    return errorJson(422, 'empty_transcript', '暫時未聽出清晰粵語對白，請換一段人聲更清楚的片段');
  }

  const refined = await refineCantonese(rawText, body.subtitleHint || '', context.env);
  const baseResponse: AsrResponse = refined ?? {
    rawText,
    sentences: [{ cantonese: rawText, confidence: 0.72 }],
    terms: [],
  };

  const providerName = whisper.providersUsed.join('+') || undefined;

  // 若用戶已登入，把這次識別結果落地，方便之後從歷史調回（無需重跑 Whisper）
  const sessionId = await saveAsrSession(context.env, guard.user?.id, {
    fileName: typeof body.fileName === 'string' ? body.fileName.slice(0, 200) : undefined,
    rawText,
    sentences: baseResponse.sentences,
    terms: baseResponse.terms,
    subtitleHint: body.subtitleHint || undefined,
    provider: providerName,
    chunkCount: base64Chunks.length,
    durationSeconds:
      typeof body.durationSeconds === 'number' && isFinite(body.durationSeconds)
        ? body.durationSeconds
        : undefined,
  });

  const response: AsrResponse = {
    ...baseResponse,
    provider: providerName,
    sessionId: sessionId ?? undefined,
  };

  await guard.commitUsage();
  return json(response);
};

/**
 * 識別歷史列表：返回當前用戶最近 30 條完整 session。
 * 未登入用戶會被 protect() 攔截（requireAuth=true 默認）。
 */
export const onRequestGet: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'asr-history',
    ipPerMinute: 60,
    ipPerDay: 1000,
    userPerDay: 1000,
  });
  if (guard instanceof Response) return guard;
  const user = guard.user!;

  if (!context.env.DB) {
    const empty: AsrHistoryResponse = { sessions: [] };
    return json(empty);
  }

  const rows = await context.env.DB.prepare(
    `SELECT id, file_name, raw_text, sentences_json, terms_json, subtitle_hint,
            provider, chunk_count, duration_seconds, created_at
       FROM cantonese_asr_sessions
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 30`,
  )
    .bind(user.id)
    .all<AsrHistoryRow>();

  const sessions: AsrHistorySession[] = (rows.results ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name || undefined,
    rawText: row.raw_text,
    sentences: safeJsonParseArray<AsrSentence>(row.sentences_json),
    terms: safeJsonParseArray<AsrTerm>(row.terms_json),
    subtitleHint: row.subtitle_hint || undefined,
    provider: row.provider || undefined,
    chunkCount: row.chunk_count ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    createdAt: row.created_at,
  }));

  return json({ sessions } satisfies AsrHistoryResponse);
};

/**
 * 刪除某條歷史記錄。前端「最近識別歷史」面板的清理按鈕用。
 */
export const onRequestDelete: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'asr-history',
    ipPerMinute: 60,
    ipPerDay: 500,
    userPerDay: 500,
  });
  if (guard instanceof Response) return guard;
  const user = guard.user!;

  if (!context.env.DB) return json({ ok: true });

  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorJson(400, 'missing_id');

  await context.env.DB.prepare(
    'DELETE FROM cantonese_asr_sessions WHERE id = ? AND user_id = ?',
  )
    .bind(id, user.id)
    .run();

  await guard.commitUsage();
  return json({ ok: true });
};

interface SaveAsrSessionInput {
  fileName?: string;
  rawText: string;
  sentences: AsrSentence[];
  terms: AsrTerm[];
  subtitleHint?: string;
  provider?: string;
  chunkCount?: number;
  durationSeconds?: number;
}

async function saveAsrSession(
  env: YueyuEnv,
  userId: string | undefined,
  input: SaveAsrSessionInput,
): Promise<string | null> {
  if (!userId || !env.DB) return null;
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO cantonese_asr_sessions
         (id, user_id, file_name, raw_text, sentences_json, terms_json,
          subtitle_hint, provider, chunk_count, duration_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
      .bind(
        id,
        userId,
        input.fileName || null,
        input.rawText,
        JSON.stringify(input.sentences),
        JSON.stringify(input.terms),
        input.subtitleHint || null,
        input.provider || null,
        input.chunkCount ?? null,
        input.durationSeconds ?? null,
      )
      .run();
    return id;
  } catch (e) {
    // 落庫失敗不阻塞主流程：用戶仍然能拿到識別結果，只是這次不出現在歷史
    console.warn('saveAsrSession failed', e);
    return null;
  }
}

function safeJsonParseArray<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

function parseBase64Media(input: string): { base64: string; mime?: string } | { error: Response } {
  const dataUrl = input.match(/^data:([^;]+);base64,(.+)$/i);
  const b64 = dataUrl ? dataUrl[2] : input;
  const mime = dataUrl?.[1];
  if (mime && !/^(audio|video)\//i.test(mime)) {
    return { error: errorJson(400, 'invalid_media_type', '只支援 audio/* 或 video/* 檔案') };
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(b64)) {
    return { error: errorJson(400, 'invalid_base64', '音頻資料格式不正確') };
  }
  return { base64: b64.replace(/\s+/g, ''), mime };
}

function normalizeTranscript(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[「」"]/g, '')
    .trim();
}

async function refineCantonese(
  rawText: string,
  subtitleHint: string,
  env: YueyuEnv,
): Promise<AsrResponse | null> {
  if (!env.DEEPSEEK_API_KEY) return null;

  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const prompt = `你是一位香港粵語口語聽寫校對員。請根據 Whisper 原始轉寫，保守整理成自然、生活化的粵語口語文字。

重要規則：
1. 主來源是「Whisper 原始轉寫」；「書面字幕提示」只可作語義參考，不可把字幕直接翻譯成粵語。
2. 保留地道口語字詞：唔、冇、喺、佢、咗、緊、啲、嘅、咩、乜嘢、點解、而家、噉、喎、啦、呀。
3. 不要逐字硬拆，不要讓句子像逐字蹦出來；請按自然說話節奏斷句。
4. 不確定的地方請保守，不要自行編造劇情或添加原音沒有的內容。
5. 找出句中 3-8 個高頻常見口語詞，每個詞給 2 個生活化粵語例句。例句要自然，可以朗讀。

Whisper 原始轉寫：
${rawText}

書面字幕提示（可選）：
${subtitleHint || '(無)'}

請輸出嚴格 JSON：
{
  "sentences": [
    {
      "cantonese": "實際聽到並整理後的粵語口語句子",
      "jyutping": "整句粵拼，可留空",
      "meaning": "書面/普通話意思",
      "confidence": 0.85
    }
  ],
  "terms": [
    {
      "term": "咗",
      "jyutping": "zo2",
      "meaning": "表示動作已完成",
      "note": "常放在動詞後面",
      "examples": [
        { "cantonese": "我食咗飯喇。", "jyutping": "ngo5 sik6 zo2 faan6 laa3", "meaning": "我吃過飯了。" },
        { "cantonese": "佢走咗好耐。", "jyutping": "keoi5 zau2 zo2 hou2 noi6", "meaning": "他走了很久。" }
      ]
    }
  ]
}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你只做粵語口語聽寫校對、粵拼和高頻詞教學。必須輸出 JSON。' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2600,
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  try {
    const data = (await res.json()) as DeepseekResponse;
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}') as RefinePayload;
    const sentences = Array.isArray(parsed.sentences)
      ? parsed.sentences.filter((s) => typeof s.cantonese === 'string' && s.cantonese.trim())
      : [];
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms.filter((t) => typeof t.term === 'string' && Array.isArray(t.examples))
      : [];
    if (!sentences.length) return null;
    return { rawText, sentences, terms };
  } catch {
    return null;
  }
}
