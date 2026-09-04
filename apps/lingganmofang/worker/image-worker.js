/**
 * 靈感魔方 · 文字生圖代理（Cloudflare Worker）
 *
 * 前端把 { prompt, seed } POST 到這個 Worker，Worker 用 Workers AI 生圖，
 * 可選擇存進 R2 並回傳公開 URL；否則直接回傳 base64 dataUrl。
 * API key / 模型留在伺服器端，前端不會接觸到。
 *
 * 部署：
 *   1) 安裝 wrangler：npm i -g wrangler
 *   2) 於本資料夾建立 wrangler.toml（見下方範例）
 *   3) wrangler deploy
 *   4) 把得到的網址填進 App 設定的「文字生圖代理端點」。
 *
 * wrangler.toml 範例：
 *   name = "lingganmofang-image"
 *   main = "image-worker.js"
 *   compatibility_date = "2026-01-01"
 *   [ai]
 *   binding = "AI"
 *   # 選用 R2（存圖、得到穩定 URL）：
 *   # [[r2_buckets]]
 *   # binding = "BUCKET"
 *   # bucket_name = "lingganmofang-illustrations"
 *   # [vars]
 *   # PUBLIC_BASE = "https://your-r2-public-domain"
 */

const MODEL = '@cf/black-forest-labs/flux-1-schnell';

// 兒童安全：基本敏感詞過濾（可再擴充）
const BLOCKLIST = ['blood', 'gore', 'weapon', 'gun', 'kill', 'nude', 'sexy', 'violence', '血腥', '暴力', '色情'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'POST') return json({ error: 'POST only' }, 405);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid json' }, 400); }

    let prompt = String(body.prompt || '').slice(0, 600);
    const seed = Number(body.seed) || Math.floor(Math.random() * 100000);

    // 安全過濾：命中黑名單就拒絕
    const lower = prompt.toLowerCase();
    if (BLOCKLIST.some((w) => lower.includes(w))) {
      return json({ error: 'unsafe prompt rejected' }, 400);
    }
    // 強制兒童繪本風格與安全約束
    prompt += ', children storybook illustration, gentle, wholesome, no text, safe for kids';

    try {
      const result = await env.AI.run(MODEL, { prompt, seed });
      // flux 回傳 base64 圖片字串
      const base64 = result.image || result;
      const dataUrl = 'data:image/png;base64,' + base64;

      // 若設定了 R2，存檔並回傳穩定 URL
      if (env.BUCKET && env.PUBLIC_BASE) {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
        const key = `illustrations/${Date.now()}-${seed}.png`;
        await env.BUCKET.put(key, bytes, { httpMetadata: { contentType: 'image/png' } });
        return json({ imageUrl: `${env.PUBLIC_BASE}/${key}`, seed });
      }

      return json({ dataUrl, seed });
    } catch (err) {
      return json({ error: 'generation failed', detail: String(err) }, 500);
    }
  },
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
