/**
 * POST /api/image
 *
 * 文字生圖：用 Cloudflare Workers AI（FLUX.1 [schnell]）把一句話 / 一段提示詞
 * 變成一張兒童繪本插圖。給「靈感魔方」作品集的每一句生成對應插畫。
 *
 * 為何用 Workers AI：
 *   - 與站點同源（qingyiu.com 走 Cloudflare），不受地區 CDN 封鎖影響；
 *   - 已在 wrangler.jsonc 綁定 `AI`，無需額外金鑰；
 *   - flux-1-schnell 速度快、4 步即可出圖，適合課堂即時生成。
 *
 * 安全：套用統一 protect() 網關 + 較嚴的配額（生圖比 LLM 貴）。
 */
import { errorJson, json, protect, type YueyuPagesFn } from './cantonese/_shared';

const MAX_PROMPT_CHARS = 1500;

// 統一附加的風格與安全約束，確保產出穩定、貼合兒童繪本、無文字、安全。
const STYLE_SUFFIX =
  ', children storybook illustration, soft warm colors, cute, gentle, clean composition, ' +
  'no text, no words, no letters, safe for kids, wholesome';
const NEGATIVE =
  'text, words, letters, watermark, signature, scary, violence, gore, blood, nsfw, ugly, deformed, low quality';

// 風格切換（前端可傳 style: 'storybook' | 'anime' | 'watercolor'）
const STYLE_MAP: Record<string, string> = {
  storybook: STYLE_SUFFIX,
  watercolor: ', soft watercolor children illustration, warm pastel, dreamy, no text, safe for kids',
  anime: ', anime style illustration, cel shading, bright colors, studio ghibli inspired, no text, safe for kids',
  realistic: ', semi-realistic gentle illustration, cinematic soft light, detailed, no text, safe for kids',
};

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'image',
    requireAuth: false,
    ipPerMinute: 24,
    ipPerDay: 200,
    userPerDay: 300,
    globalPerDay: 4000,
  });
  if (guard instanceof Response) return guard;

  if (!context.env.AI) {
    return errorJson(503, 'image_unavailable', '生圖服務尚未配置（需 Cloudflare Workers AI 綁定）');
  }

  let body: { prompt?: string; style?: string; seed?: number } | null;
  try {
    body = (await context.request.json()) as typeof body;
  } catch {
    return errorJson(400, 'invalid_json');
  }
  const raw = (body?.prompt || '').toString().trim();
  if (!raw) return errorJson(400, 'missing_prompt', '請提供 prompt');
  if (raw.length > MAX_PROMPT_CHARS) return errorJson(413, 'prompt_too_large');

  const styleSuffix = STYLE_MAP[body?.style || 'storybook'] || STYLE_SUFFIX;
  // FLUX.1 [schnell] 不支援負向提示，故把要避免的內容直接寫進正向提示。
  const prompt = `${raw}${styleSuffix}. Avoid: ${NEGATIVE}`;

  let result: unknown;
  try {
    // flux-1-schnell 僅接受 prompt 與 steps(1-8)
    result = await context.env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt,
      steps: 6,
    });
  } catch (e) {
    void e;
    return errorJson(502, 'image_failed', '生圖服務暫時無法處理，請稍後再試');
  }

  // flux-1-schnell 回傳 { image: <base64 jpeg> }
  const b64 = (result as { image?: string })?.image;
  if (!b64 || typeof b64 !== 'string') {
    return errorJson(502, 'image_empty', '生圖服務未回傳影像');
  }

  await guard.commitUsage();

  return json({ imageUrl: `data:image/jpeg;base64,${b64}`, prompt });
};
