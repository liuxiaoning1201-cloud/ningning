export const onRequestGet: PagesFunction<{
  GOOGLE_CLIENT_ID: string;
}> = async (context) => {
  return Response.json({
    googleClientId: context.env.GOOGLE_CLIENT_ID || '',
  });
};
