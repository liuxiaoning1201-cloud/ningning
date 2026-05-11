/**
 * 粵語學習 API 共用工具：
 *   - 環境綁定型別
 *   - Origin / Referer 校驗
 *   - 多維限流（IP 分鐘 / IP 日 / 用戶日 / 全局日）
 *   - JWT 鑑權包裝
 *   - JSON 標準回應
 *
 * 重要：所有 LLM / TTS / OCR 端點都應通過 `protect()` 進入，這樣任何安全層都不可被遺漏。
 */
import type { MiddlewareUser } from '../../_middleware';

export interface YueyuEnv {
  /** 沿用倉庫 JWT 機制 */
  JWT_SECRET: string;
  DB: D1Database;

  /** DeepSeek API Key — 由 wrangler pages secret put 設置，永不進入 git */
  DEEPSEEK_API_KEY?: string;
  /** DeepSeek API 基礎 URL，預設 https://api.deepseek.com */
  DEEPSEEK_BASE_URL?: string;
  /** DeepSeek 模型名，預設 deepseek-chat */
  DEEPSEEK_MODEL?: string;

  /** Azure TTS Key */
  AZURE_TTS_KEY?: string;
  AZURE_TTS_REGION?: string;

  /** Cloudflare Turnstile secret，用於未登入流量人機驗證 */
  TURNSTILE_SECRET?: string;

  /** KV 命名空間：翻譯緩存 */
  YUEYU_TRANSLATE_KV?: KVNamespace;
  /** KV 命名空間：限流計數器 */
  YUEYU_RATE_LIMIT_KV?: KVNamespace;
  /** R2 桶：TTS 音頻緩存 */
  YUEYU_AUDIO?: R2Bucket;
  /** Cloudflare Workers AI（OCR 用） */
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}

export interface YueyuContext extends Record<string, unknown> {
  user: MiddlewareUser | null;
}

export type YueyuPagesFn = PagesFunction<YueyuEnv, '/', YueyuContext>;

/** 統一 JSON 回應 */
export function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...(init.headers ?? {}),
    },
  });
}

export function errorJson(status: number, error: string, message?: string, extra?: Record<string, unknown>): Response {
  return json({ error, message, ...extra }, { status });
}

/** 允許的 Web Origin */
const ALLOWED_WEB_ORIGINS = new Set([
  'https://zykongjian.com',
  'https://www.zykongjian.com',
  // 本地開發
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  // Capacitor iOS / Android 容器內 WebView
  'capacitor://localhost',
  'http://localhost',
  'https://localhost',
  'ionic://localhost',
]);

/** 校驗 Origin 是否為合法來源 */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_WEB_ORIGINS.has(origin)) return true;
  // Cloudflare Pages 預覽部署：<hash>.zykongjian.pages.dev
  if (/^https:\/\/([a-z0-9-]+\.)?zykongjian\.pages\.dev$/i.test(origin)) return true;
  // 擴展 Origin 形如 chrome-extension://<id>。MVP 階段允許任意擴展調用，
  // 後續發布到商店拿到正式 ID 後改為精確比對。
  if (/^chrome-extension:\/\/[a-z]{32}$/i.test(origin)) return true;
  if (/^moz-extension:\/\//.test(origin)) return true;
  return false;
}

/** Personal API Key 前綴。新格式 `zy_<32 隨機>`，方便將來掃描 git history */
export const PERSONAL_API_KEY_PREFIX = 'zy_';

interface ApiKeyRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  user_role: string | null;
  scopes: string;
  expires_at: string | null;
  revoked_at: string | null;
}

/**
 * 嘗試以 Personal API Key 認證。
 * 命中時：把使用者寫進 context.data.user，返回 user；否則返回 null。
 * 同時把 last_used_at 異步刷新一下。
 *
 * 註：此項目沒有獨立 users 表，user 信息在創建 API Key 時冗餘進此表。
 */
async function tryPersonalApiKey(
  request: Request,
  env: YueyuEnv,
): Promise<MiddlewareUser | null> {
  const auth = request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  const raw = auth.slice(7).trim();
  if (!raw.startsWith(PERSONAL_API_KEY_PREFIX)) return null;
  if (!env.DB) return null;

  const tokenHash = await sha256Hex(raw);
  const row = await env.DB.prepare(
    `SELECT id, user_id, user_email, user_name, user_role, scopes, expires_at, revoked_at
       FROM cantonese_api_keys
      WHERE token_hash = ?
      LIMIT 1`,
  )
    .bind(tokenHash)
    .first<ApiKeyRow>();

  if (!row) return null;
  if (row.revoked_at) return null;
  if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;

  // 異步刷新 last_used_at（不 await，不影響主流程）
  void env.DB.prepare(
    `UPDATE cantonese_api_keys SET last_used_at = datetime('now') WHERE id = ?`,
  )
    .bind(row.id)
    .run()
    .catch(() => {});

  const role: MiddlewareUser['role'] = isRemoteUserRoleString(row.user_role)
    ? (row.user_role as MiddlewareUser['role'])
    : 'guest';

  return {
    id: row.user_id,
    email: row.user_email || '',
    name: row.user_name || '',
    role,
  };
}

function isRemoteUserRoleString(v: unknown): boolean {
  return v === 'teacher' || v === 'student' || v === 'guest';
}

export interface ProtectOptions {
  /** 是否要求登入。預設 true */
  requireAuth?: boolean;
  /** 限流維度：對應的 KV 計數器 key 前綴（如 'translate' / 'tts' / 'ocr'） */
  bucket: string;
  /** 單 IP 每分鐘上限，預設 30 */
  ipPerMinute?: number;
  /** 單 IP 每日上限，預設 300 */
  ipPerDay?: number;
  /** 單用戶每日上限，預設 200 */
  userPerDay?: number;
  /** 全局每日上限，預設 50000（達到後對所有人都返回 503） */
  globalPerDay?: number;
}

interface ProtectResult {
  /** 後續處理可獲取的識別資訊 */
  ip: string;
  user: MiddlewareUser | null;
  origin: string;
  /** 用於計數遞增（業務成功後再 commit） */
  commitUsage: () => Promise<void>;
}

/**
 * 統一安全網關。把 Origin 校驗、JWT 鑑權、多維限流串成一條檢查鏈。
 * 業務代碼只要：
 *   const guard = await protect(context, { bucket: 'translate' });
 *   if (guard instanceof Response) return guard;  // 已被攔截
 *   ... 業務邏輯 ...
 *   await guard.commitUsage();  // 計入配額（建議放在實際扣費的 LLM 調用後）
 *   return json(result);
 */
export async function protect(
  context: Parameters<YueyuPagesFn>[0],
  opts: ProtectOptions,
): Promise<Response | ProtectResult> {
  const { request, env } = context;
  const origin = request.headers.get('Origin') || '';

  // ── 先嘗試 Personal API Key（給命令列 / 第三方軟件用） ──
  let user = context.data.user;
  let viaApiKey = false;
  if (!user) {
    const apiKeyUser = await tryPersonalApiKey(request, env);
    if (apiKeyUser) {
      user = apiKeyUser;
      context.data.user = apiKeyUser;
      viaApiKey = true;
    }
  }

  // ── Origin 校驗：API Key 模式下不檢查 Origin（命令列 curl 沒有 Origin） ──
  if (!viaApiKey && !isAllowedOrigin(origin)) {
    return errorJson(403, 'forbidden_origin', '此來源未獲授權呼叫粵語學習 API');
  }

  // ── 鑑權 ──
  const requireAuth = opts.requireAuth ?? true;
  if (requireAuth && !user) {
    return errorJson(
      401,
      'login_required',
      '請先登入再使用粵語學習功能（或在 Authorization 頭帶上個人 API Key）',
    );
  }

  // ── 限流 ──
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const minute = new Date().toISOString().slice(0, 16);

  const kv = env.YUEYU_RATE_LIMIT_KV;

  // 即便沒配 KV（比如本地開發未綁定），也要走完邏輯，只是不真的計數，避免本地阻斷開發
  if (kv) {
    const ipMinKey = `rl:${opts.bucket}:ip:m:${ip}:${minute}`;
    const ipDayKey = `rl:${opts.bucket}:ip:d:${ip}:${today}`;
    const userDayKey = user ? `rl:${opts.bucket}:u:d:${user.id}:${today}` : null;
    const globalDayKey = `rl:${opts.bucket}:g:d:${today}`;

    const [ipMin, ipDay, userDay, globalDay] = await Promise.all([
      kv.get(ipMinKey),
      kv.get(ipDayKey),
      userDayKey ? kv.get(userDayKey) : Promise.resolve(null),
      kv.get(globalDayKey),
    ]);

    const ipMinN = parseInt(ipMin || '0', 10);
    const ipDayN = parseInt(ipDay || '0', 10);
    const userDayN = parseInt(userDay || '0', 10);
    const globalDayN = parseInt(globalDay || '0', 10);

    const limits = {
      ipMin: opts.ipPerMinute ?? 30,
      ipDay: opts.ipPerDay ?? 300,
      userDay: opts.userPerDay ?? 200,
      globalDay: opts.globalPerDay ?? 50000,
    };

    if (globalDayN >= limits.globalDay) {
      return errorJson(503, 'global_quota_exceeded', '今日服務已達總額度上限，請明天再試');
    }
    if (ipMinN >= limits.ipMin) {
      return errorJson(429, 'ip_per_minute_exceeded', '請求太頻繁，請稍候再試', { retryAfter: 60 });
    }
    if (ipDayN >= limits.ipDay) {
      return errorJson(429, 'ip_per_day_exceeded', '今日來自此 IP 的請求已達上限', { retryAfter: 86400 });
    }
    if (user && userDayN >= limits.userDay) {
      return errorJson(429, 'user_per_day_exceeded', '今日個人額度已用完，明日將自動重置');
    }

    return {
      ip,
      user,
      origin,
      commitUsage: async () => {
        const incr = async (key: string, ttl: number) => {
          const cur = parseInt((await kv.get(key)) || '0', 10);
          await kv.put(key, String(cur + 1), { expirationTtl: ttl });
        };
        await Promise.all([
          incr(ipMinKey, 70),
          incr(ipDayKey, 86400),
          userDayKey ? incr(userDayKey, 86400) : Promise.resolve(),
          incr(globalDayKey, 86400),
        ]);
      },
    };
  }

  // KV 未配置時直接放行（僅本地）
  return {
    ip,
    user,
    origin,
    commitUsage: async () => {},
  };
}

/** SHA-256 → 十六進位字串 */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Cloudflare Turnstile 驗證（未登入流量用）。secret 未設置則跳過 */
export async function verifyTurnstile(token: string | undefined, env: YueyuEnv, ip: string): Promise<boolean> {
  if (!env.TURNSTILE_SECRET) return true; // 未啟用
  if (!token) return false;
  try {
    const form = new FormData();
    form.append('secret', env.TURNSTILE_SECRET);
    form.append('response', token);
    form.append('remoteip', ip);
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const data = (await res.json()) as { success?: boolean };
    return Boolean(data.success);
  } catch {
    return false;
  }
}
