/**
 * GET /api/cantonese/audio/<r2-key>
 *
 * 反向代理 R2 音頻，避免直接暴露 R2 公共 URL，便於日後加私有 token / 統計。
 * 不要求登入（已登入用戶生成的音頻其他用戶也能播放，因為內容本身不敏感）。
 */
import type { YueyuEnv } from '../_shared';

export const onRequestGet: PagesFunction<YueyuEnv> = async (context) => {
  const { request, env } = context;
  if (!env.YUEYU_AUDIO) {
    return new Response('R2 not configured', { status: 503 });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/cantonese\/audio\//, '');
  if (!path || !path.startsWith('tts/')) {
    return new Response('Not found', { status: 404 });
  }

  const obj = await env.YUEYU_AUDIO.get(decodeURIComponent(path));
  if (!obj) return new Response('Not found', { status: 404 });

  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'audio/mpeg',
      'Cache-Control': 'public, max-age=2592000, immutable',
      'Content-Length': String(obj.size),
    },
  });
};
