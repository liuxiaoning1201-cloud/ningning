import { verifyJwt } from '../shared/jwt';

const COOKIE_NAME = 'zy_token';

interface ContextData {
  user: { id: string; email: string; name: string } | null;
}

export const onRequest: PagesFunction<{
  JWT_SECRET: string;
}, '/', ContextData> = async (context) => {
  const cookie = context.request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];

  let user: ContextData['user'] = null;
  if (token && context.env.JWT_SECRET) {
    const payload = await verifyJwt(token, context.env.JWT_SECRET);
    if (payload) {
      user = {
        id: payload.sub as string,
        email: payload.email as string,
        name: payload.name as string,
      };
    }
  }

  context.data.user = user;
  return context.next();
};
