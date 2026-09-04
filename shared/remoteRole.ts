export type RemoteUserRole = 'teacher' | 'student' | 'guest';

export function isRemoteUserRole(v: unknown): v is RemoteUserRole {
  return v === 'teacher' || v === 'student' || v === 'guest';
}

/** 依電郵與 D1 教師白名單判定角色 */
export async function resolveRemoteRole(db: D1Database, email: string): Promise<RemoteUserRole> {
  const e = String(email || '')
    .trim()
    .toLowerCase();
  if (!e) return 'guest';
  const row = await db.prepare('SELECT 1 AS ok FROM teacher_accounts WHERE email = ?').bind(e).first<{ ok: number }>();
  if (row?.ok) return 'teacher';
  if (e.endsWith('@student.isf.edu.hk')) return 'student';
  return 'guest';
}
