export const onRequestGet: PagesFunction<{
  DB: D1Database;
}, '/', {
  user: { id: string; email: string; name: string; role: string } | null;
}> = async (context) => {
  const user = context.data.user;
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const row = await context.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at, last_login_at FROM users WHERE id = ?'
  ).bind(user.id).first();

  if (!row) {
    return Response.json({ error: 'User not found' }, { status: 404 });
  }

  return Response.json({ user: { ...row, role: user.role } });
};
