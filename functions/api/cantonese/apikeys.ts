/**
 * Personal API Keys 管理：
 *   POST   /api/cantonese/apikeys       — 創建一把（返回明文一次，之後只能再申請新 key）
 *   GET    /api/cantonese/apikeys       — 列表（不返回明文）
 *   DELETE /api/cantonese/apikeys?id=X  — 撤銷
 *
 * 必須登入 zykongjian.com 才能管理（即不允許「用 API Key 創建新的 API Key」）。
 */
import type { YueyuPagesFn } from './_shared'
import { errorJson, json, sha256Hex, PERSONAL_API_KEY_PREFIX } from './_shared'

interface ApiKeyRecord {
  id: string
  name: string
  prefix: string
  scopes: string
  created_at: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
}

const ALLOWED_SCOPES = ['translate', 'tts', 'ocr', 'vocab'] as const
const MAX_KEYS_PER_USER = 5

function generateRawToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${PERSONAL_API_KEY_PREFIX}${hex}`
}

function uuid(): string {
  return crypto.randomUUID()
}

export const onRequestGet: YueyuPagesFn = async (context) => {
  const user = context.data.user
  if (!user) return errorJson(401, 'login_required', '請先登入再管理 API Key')
  if (!context.env.DB) return errorJson(500, 'no_db', '資料庫未配置')

  const rows = await context.env.DB.prepare(
    `SELECT id, name, prefix, scopes, created_at, last_used_at, expires_at, revoked_at
       FROM cantonese_api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC`,
  )
    .bind(user.id)
    .all<ApiKeyRecord>()

  return json({ keys: rows.results || [] })
}

export const onRequestPost: YueyuPagesFn = async (context) => {
  const user = context.data.user
  if (!user) return errorJson(401, 'login_required', '請先登入再管理 API Key')
  if (!context.env.DB) return errorJson(500, 'no_db', '資料庫未配置')

  const body = (await context.request.json().catch(() => null)) as {
    name?: string
    scopes?: string[]
    expiresInDays?: number
  } | null
  if (!body) return errorJson(400, 'invalid_body', '請以 JSON 格式提交')

  const name = (body.name || '').trim()
  if (!name || name.length > 50) {
    return errorJson(400, 'invalid_name', 'name 必須 1-50 字')
  }

  const scopesArr = Array.isArray(body.scopes) ? body.scopes : ['translate', 'tts', 'ocr', 'vocab']
  const scopes = scopesArr
    .filter((s) => (ALLOWED_SCOPES as readonly string[]).includes(s))
    .join(',')
  if (!scopes) return errorJson(400, 'invalid_scopes', 'scopes 至少需 1 項')

  // 上限保護
  const countRow = await context.env.DB.prepare(
    `SELECT COUNT(*) as c FROM cantonese_api_keys WHERE user_id = ? AND revoked_at IS NULL`,
  )
    .bind(user.id)
    .first<{ c: number }>()
  if ((countRow?.c ?? 0) >= MAX_KEYS_PER_USER) {
    return errorJson(429, 'too_many_keys', `每位用戶最多只能持有 ${MAX_KEYS_PER_USER} 把有效 Key`)
  }

  let expiresAt: string | null = null
  if (typeof body.expiresInDays === 'number' && body.expiresInDays > 0) {
    const days = Math.min(365 * 2, Math.floor(body.expiresInDays))
    const dt = new Date(Date.now() + days * 86400_000)
    expiresAt = dt.toISOString().replace('T', ' ').slice(0, 19)
  }

  const raw = generateRawToken()
  const tokenHash = await sha256Hex(raw)
  const prefix = raw.slice(0, PERSONAL_API_KEY_PREFIX.length + 6) // zy_xxxxxx
  const id = uuid()

  await context.env.DB.prepare(
    `INSERT INTO cantonese_api_keys
       (id, user_id, user_email, user_name, user_role, name, prefix, token_hash, scopes, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, user.id, user.email, user.name, user.role, name, prefix, tokenHash, scopes, expiresAt)
    .run()

  return json({
    id,
    name,
    prefix,
    scopes,
    expiresAt,
    token: raw, // 明文，僅此一次返回
    notice: '請立即複製並安全保存此 Key，關閉此頁後將無法再次查看。',
  })
}

export const onRequestDelete: YueyuPagesFn = async (context) => {
  const user = context.data.user
  if (!user) return errorJson(401, 'login_required', '請先登入再管理 API Key')
  if (!context.env.DB) return errorJson(500, 'no_db', '資料庫未配置')

  const url = new URL(context.request.url)
  const id = url.searchParams.get('id') || ''
  if (!id) return errorJson(400, 'missing_id', '需提供 id')

  const result = await context.env.DB.prepare(
    `UPDATE cantonese_api_keys
       SET revoked_at = datetime('now')
     WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
  )
    .bind(id, user.id)
    .run()

  return json({ revoked: result.meta.changes ?? 0 })
}
