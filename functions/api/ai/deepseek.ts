/**
 * 統一 DeepSeek 代理。
 *
 * 給平台內其他軟件使用：
 *   - 前端只打 /api/ai/deepseek
 *   - DeepSeek API Key 只從 Cloudflare Secret `DEEPSEEK_API_KEY` 讀取
 *   - 套用 Origin / Personal API Key / KV 限流保護
 *
 * 注意：此端點刻意保持 OpenAI Chat Completions 近似回應格式，
 * 方便把既有前端從直連 DeepSeek 遷移過來。
 */
import type { YueyuPagesFn } from '../cantonese/_shared';
import { errorJson, json, protect } from '../cantonese/_shared';

type ChatRole = 'system' | 'user' | 'assistant';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

interface DeepSeekProxyRequest {
  app?: string;
  model?: string;
  messages?: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type?: 'json_object' };
}

const ALLOWED_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner']);
const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 12000;
const MAX_TOKENS = 2500;

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'deepseek',
    requireAuth: false,
    ipPerMinute: 20,
    ipPerDay: 200,
    userPerDay: 300,
    globalPerDay: 20000,
  });
  if (guard instanceof Response) return guard;

  const env = context.env;
  if (!env.DEEPSEEK_API_KEY) {
    return errorJson(503, 'llm_not_configured', '伺服器未設定 DeepSeek 密鑰');
  }

  const body = (await context.request.json().catch(() => null)) as DeepSeekProxyRequest | null;
  if (!body || !Array.isArray(body.messages)) {
    return errorJson(400, 'invalid_body', '請提供 messages 陣列');
  }

  const messages = normalizeMessages(body.messages);
  if (messages instanceof Response) return messages;

  const model = body.model && ALLOWED_MODELS.has(body.model)
    ? body.model
    : (env.DEEPSEEK_MODEL || 'deepseek-chat');

  const maxTokens = clampNumber(body.max_tokens, 32, MAX_TOKENS, 800);
  const temperature = clampNumber(body.temperature, 0, 1.5, 0.7);

  const upstreamBody: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (body.response_format?.type === 'json_object') {
    upstreamBody.response_format = { type: 'json_object' };
  }

  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const endpoint = `${baseUrl}/v1/chat/completions`;

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify(upstreamBody),
    });
  } catch {
    return errorJson(502, 'llm_network_error', 'DeepSeek 連線失敗，請稍後再試');
  }

  const text = await upstream.text();
  if (!upstream.ok) {
    return errorJson(upstream.status, 'llm_error', 'DeepSeek 回應錯誤', {
      detail: text.slice(0, 300),
    });
  }

  await guard.commitUsage();

  // 原樣返回 DeepSeek JSON 結構，但不包含任何密鑰。
  try {
    return json(JSON.parse(text));
  } catch {
    return errorJson(502, 'llm_bad_json', 'DeepSeek 回應格式錯誤');
  }
};

function normalizeMessages(messages: ChatMessage[]): ChatMessage[] | Response {
  if (messages.length === 0 || messages.length > MAX_MESSAGES) {
    return errorJson(400, 'invalid_messages', `messages 數量必須介乎 1-${MAX_MESSAGES}`);
  }

  let total = 0;
  const normalized: ChatMessage[] = [];
  for (const msg of messages) {
    if (!msg || !['system', 'user', 'assistant'].includes(msg.role)) {
      return errorJson(400, 'invalid_role', 'message.role 只可為 system/user/assistant');
    }
    const content = String(msg.content || '').trim();
    if (!content) {
      return errorJson(400, 'empty_content', 'message.content 不可為空');
    }
    total += content.length;
    if (total > MAX_CONTENT_CHARS) {
      return errorJson(413, 'content_too_large', `總輸入不可超過 ${MAX_CONTENT_CHARS} 字`);
    }
    normalized.push({ role: msg.role, content });
  }

  return normalized;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}
