/**
 * 生詞本 CRUD：
 *   GET    /api/cantonese/vocab          列出當前用戶所有生詞
 *   POST   /api/cantonese/vocab          新增一條
 *   PATCH  /api/cantonese/vocab          更新（主要用於 SRS 評分）
 *   DELETE /api/cantonese/vocab?id=xxx   刪除
 *
 * 必須登入。資料以 user_id 隔離。
 */
import { errorJson, json, protect, type YueyuPagesFn } from './_shared';
import type { VocabEntry, VocabListResponse, SrsState } from '../../../shared/cantoneseTypes';

interface VocabRow {
  id: string;
  user_id: string;
  granularity: string;
  written: string;
  cantonese: string;
  jyutping: string | null;
  explanation: string | null;
  source_json: string | null;
  srs_json: string | null;
  created_at: string;
}

function rowToEntry(row: VocabRow): VocabEntry {
  return {
    id: row.id,
    granularity: (row.granularity as VocabEntry['granularity']) ?? 'sentence',
    written: row.written,
    cantonese: row.cantonese,
    jyutping: row.jyutping || undefined,
    explanation: row.explanation || undefined,
    source: row.source_json ? JSON.parse(row.source_json) : undefined,
    srs: row.srs_json ? (JSON.parse(row.srs_json) as SrsState) : undefined,
    createdAt: row.created_at,
  };
}

export const onRequestGet: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'vocab-read',
    ipPerMinute: 120,
    ipPerDay: 5000,
    userPerDay: 5000,
  });
  if (guard instanceof Response) return guard;

  const user = guard.user!;
  const rows = await context.env.DB.prepare(
    'SELECT id, user_id, granularity, written, cantonese, jyutping, explanation, source_json, srs_json, created_at FROM cantonese_vocab WHERE user_id = ? ORDER BY created_at DESC LIMIT 1000',
  )
    .bind(user.id)
    .all<VocabRow>();

  const entries = (rows.results ?? []).map(rowToEntry);
  const response: VocabListResponse = {
    entries,
    total: entries.length,
  };
  return json(response);
};

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'vocab-write',
    ipPerMinute: 60,
    ipPerDay: 1000,
    userPerDay: 500,
  });
  if (guard instanceof Response) return guard;

  const user = guard.user!;
  let body: Partial<VocabEntry>;
  try {
    body = (await context.request.json()) as Partial<VocabEntry>;
  } catch {
    return errorJson(400, 'invalid_json');
  }

  if (!body.written || !body.cantonese) {
    return errorJson(400, 'invalid_request', '缺少 written 或 cantonese 欄位');
  }
  if (body.written.length > 500 || body.cantonese.length > 500) {
    return errorJson(400, 'too_long', '單條最多 500 字');
  }

  const id = body.id || crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO cantonese_vocab (id, user_id, granularity, written, cantonese, jyutping, explanation, source_json, srs_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       granularity = excluded.granularity,
       written = excluded.written,
       cantonese = excluded.cantonese,
       jyutping = excluded.jyutping,
       explanation = excluded.explanation,
       source_json = excluded.source_json,
       srs_json = excluded.srs_json,
       updated_at = excluded.updated_at
     WHERE cantonese_vocab.user_id = excluded.user_id`,
  )
    .bind(
      id,
      user.id,
      body.granularity ?? 'sentence',
      body.written,
      body.cantonese,
      body.jyutping ?? null,
      body.explanation ?? null,
      body.source ? JSON.stringify(body.source) : null,
      body.srs ? JSON.stringify(body.srs) : null,
      now,
      now,
    )
    .run();

  await guard.commitUsage();

  const entry: VocabEntry = {
    id,
    granularity: body.granularity ?? 'sentence',
    written: body.written,
    cantonese: body.cantonese,
    jyutping: body.jyutping,
    explanation: body.explanation,
    source: body.source,
    srs: body.srs,
    createdAt: now,
  };
  return json(entry);
};

export const onRequestPatch: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'vocab-write',
    ipPerMinute: 120,
    ipPerDay: 2000,
    userPerDay: 1000,
  });
  if (guard instanceof Response) return guard;

  const user = guard.user!;
  let body: { id?: string; srs?: SrsState; cantonese?: string; written?: string };
  try {
    body = await context.request.json();
  } catch {
    return errorJson(400, 'invalid_json');
  }
  if (!body.id) return errorJson(400, 'missing_id');

  const existing = await context.env.DB.prepare(
    'SELECT id, user_id, granularity, written, cantonese, jyutping, explanation, source_json, srs_json, created_at FROM cantonese_vocab WHERE id = ? AND user_id = ?',
  )
    .bind(body.id, user.id)
    .first<VocabRow>();
  if (!existing) return errorJson(404, 'not_found');

  const newSrs = body.srs ? JSON.stringify(body.srs) : existing.srs_json;
  const newCantonese = body.cantonese ?? existing.cantonese;
  const newWritten = body.written ?? existing.written;

  await context.env.DB.prepare(
    'UPDATE cantonese_vocab SET srs_json = ?, written = ?, cantonese = ?, updated_at = ? WHERE id = ? AND user_id = ?',
  )
    .bind(newSrs, newWritten, newCantonese, new Date().toISOString(), body.id, user.id)
    .run();

  if (body.srs) {
    await context.env.DB.prepare(
      'INSERT INTO cantonese_review_log (user_id, vocab_id, quality, next_interval) VALUES (?, ?, ?, ?)',
    )
      .bind(user.id, body.id, 3, body.srs.intervalDays)
      .run();
  }

  await guard.commitUsage();

  const updated: VocabRow = {
    ...existing,
    srs_json: newSrs,
    written: newWritten,
    cantonese: newCantonese,
  };
  return json(rowToEntry(updated));
};

export const onRequestDelete: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'vocab-write',
    ipPerMinute: 60,
    ipPerDay: 500,
    userPerDay: 500,
  });
  if (guard instanceof Response) return guard;

  const user = guard.user!;
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');
  if (!id) return errorJson(400, 'missing_id');

  await context.env.DB.prepare('DELETE FROM cantonese_vocab WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  await guard.commitUsage();
  return json({ ok: true });
};
