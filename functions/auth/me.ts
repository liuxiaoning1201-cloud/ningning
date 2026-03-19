export const onRequestGet: PagesFunction<{}, '/', {
  user: { id: string; email: string; name: string } | null;
}> = async (context) => {
  const user = context.data.user;
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return Response.json({ user });
};
