/**
 * GET /api/cantonese/admin/usage?date=2025-05-08
 *
 * 管理員查看指定日期（預設今天）的調用統計：
 *   - 全局：translate / tts / ocr / vocab-write 總調用次數
 *   - 用戶 Top 10
 *   - 異常 IP（單日 > 200 次）
 *
 * 僅限管理員 / 教師角色訪問（沿用 _middleware 的 role 識別）。
 */
import { errorJson, json, type YueyuPagesFn } from '../_shared';

interface UsageBucket {
  bucket: string;
  total: number;
  topUsers: { userId: string; count: number }[];
  topIps: { ip: string; count: number }[];
}

export const onRequestGet: YueyuPagesFn = async (context) => {
  const user = context.data.user;
  if (!user) return errorJson(401, 'login_required');
  if (user.role !== 'teacher' && user.email !== 'admin@zykongjian.com') {
    return errorJson(403, 'forbidden', '僅限管理員訪問');
  }

  const url = new URL(context.request.url);
  const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);

  const kv = context.env.YUEYU_RATE_LIMIT_KV;
  if (!kv) return errorJson(503, 'kv_not_configured');

  const buckets = ['translate', 'tts', 'ocr', 'vocab-write'];
  const result: UsageBucket[] = [];

  for (const bucket of buckets) {
    // 全局
    const total = parseInt((await kv.get(`rl:${bucket}:g:d:${date}`)) || '0', 10);

    // 列出今天該 bucket 所有用戶 / IP key（KV list）
    const userPrefix = `rl:${bucket}:u:d:`;
    const ipPrefix = `rl:${bucket}:ip:d:`;
    const userList = await kv.list({ prefix: userPrefix, limit: 200 });
    const ipList = await kv.list({ prefix: ipPrefix, limit: 200 });

    const userCounts: { userId: string; count: number }[] = [];
    for (const k of userList.keys) {
      const m = k.name.match(/^rl:[^:]+:u:d:([^:]+):(\d{4}-\d{2}-\d{2})$/);
      if (!m || m[2] !== date) continue;
      const count = parseInt((await kv.get(k.name)) || '0', 10);
      userCounts.push({ userId: m[1], count });
    }
    userCounts.sort((a, b) => b.count - a.count);

    const ipCounts: { ip: string; count: number }[] = [];
    for (const k of ipList.keys) {
      const m = k.name.match(/^rl:[^:]+:ip:d:([^:]+):(\d{4}-\d{2}-\d{2})$/);
      if (!m || m[2] !== date) continue;
      const count = parseInt((await kv.get(k.name)) || '0', 10);
      ipCounts.push({ ip: m[1], count });
    }
    ipCounts.sort((a, b) => b.count - a.count);

    result.push({
      bucket,
      total,
      topUsers: userCounts.slice(0, 10),
      topIps: ipCounts.slice(0, 10),
    });
  }

  return json({
    date,
    buckets: result,
    notes: [
      '本端點不會自動發送告警。若 translate.total 增長異常，請立即去 DeepSeek 後台 rotate Key。',
      'topIps 中 count > 200 的 IP 為異常流量，已被自動限流，但建議封鎖。',
    ],
  });
};
