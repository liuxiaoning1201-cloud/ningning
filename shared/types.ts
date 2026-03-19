export interface ZYUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
}
