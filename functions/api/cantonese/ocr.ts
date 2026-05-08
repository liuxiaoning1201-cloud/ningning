/**
 * POST /api/cantonese/ocr
 *
 * 接收用戶截圖（base64 data URL 或純 base64），用 Cloudflare Workers AI 的多模態
 * 模型抽取出字幕文字。前端拿到 lines 陣列後可選擇直接調 /api/cantonese/translate。
 *
 * 安全：必須登入；用戶日配額 50 次（OCR 比 LLM 貴）；圖片大小限制 2MB。
 */
import { errorJson, json, protect, type YueyuPagesFn } from './_shared';
import type { OcrRequest, OcrResponse } from '../../../shared/cantoneseTypes';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'ocr',
    ipPerMinute: 10,
    ipPerDay: 50,
    userPerDay: 50,
    globalPerDay: 5000,
  });
  if (guard instanceof Response) return guard;

  let body: OcrRequest;
  try {
    body = (await context.request.json()) as OcrRequest;
  } catch {
    return errorJson(400, 'invalid_json');
  }
  if (!body.image || typeof body.image !== 'string') {
    return errorJson(400, 'missing_image');
  }

  // 解析 data URL 或純 base64
  const m = body.image.match(/^data:image\/[a-z+]+;base64,(.+)$/i);
  const b64 = m ? m[1] : body.image;
  if (b64.length * 0.75 > MAX_IMAGE_BYTES) {
    return errorJson(413, 'image_too_large', '圖片不能超過 2MB');
  }

  if (!context.env.AI) {
    return errorJson(503, 'ocr_unavailable', 'OCR 服務尚未配置（需 Cloudflare Workers AI 綁定）');
  }

  // 解碼 base64 為 Uint8Array
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

  // 使用 LLaVA 多模態識別字幕
  let result: { description?: string } = {};
  try {
    result = (await context.env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: Array.from(bytes),
      prompt: '請僅輸出這張圖片中的中文字幕文字，每行一句，不要任何解說、引號、編號或標點修飾。如圖中沒有字幕，輸出空字串。',
      max_tokens: 256,
    })) as { description?: string };
  } catch (e) {
    void e;
    return errorJson(502, 'ocr_failed', 'OCR 服務暫時無法處理');
  }

  const text = (result.description || '').trim();
  const lines = text
    .split(/[\n\r]+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  await guard.commitUsage();

  const response: OcrResponse = { text, lines };
  return json(response);
};
