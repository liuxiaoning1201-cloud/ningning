export const onRequestGet: PagesFunction<{}, '/', {
  user: { id: string; email: string; name: string; role: string } | null;
}> = async (context) => {
  const user = context.data.user;
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return Response.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      displayName: user.name,
      role: user.role,
    },
  });
};
