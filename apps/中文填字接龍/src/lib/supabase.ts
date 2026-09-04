/**
 * Supabase client for Auth, Database, Realtime.
 * Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env to enable.
 */

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

let client: unknown = null;

export async function getSupabaseClient(): Promise<unknown> {
  if (!supabaseConfigured) return null;
  if (client) return client;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(url!, anonKey!);
    return client;
  } catch {
    return null;
  }
}

export async function signInWithEmail(email: string, password: string): Promise<{ error: Error | null }> {
  const supabase = await getSupabaseClient();
  if (!supabase || typeof (supabase as { auth: { signInWithPassword: (o: object) => Promise<unknown> } }).auth?.signInWithPassword !== "function") {
    return { error: new Error("Supabase 未設定") };
  }
  try {
    const { error } = await (supabase as { auth: { signInWithPassword: (o: object) => Promise<{ error: Error | null }> } }).auth.signInWithPassword({ email, password });
    return { error: error ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<{ error: Error | null }> {
  const supabase = await getSupabaseClient();
  if (!supabase || typeof (supabase as { auth: { signUp: (o: object) => Promise<unknown> } }).auth?.signUp !== "function") {
    return { error: new Error("Supabase 未設定") };
  }
  try {
    const { error } = await (supabase as { auth: { signUp: (o: object) => Promise<{ error: Error | null }> } }).auth.signUp({ email, password });
    return { error: error ?? null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseClient();
  if (supabase && typeof (supabase as { auth: { signOut: () => Promise<void> } }).auth?.signOut === "function") {
    await (supabase as { auth: { signOut: () => Promise<void> } }).auth.signOut();
  }
}

export async function getCurrentUser(): Promise<{ id: string; email?: string } | null> {
  const supabase = await getSupabaseClient();
  if (!supabase || typeof (supabase as { auth: { getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }> } }).auth?.getUser !== "function") {
    return null;
  }
  const { data } = await (supabase as { auth: { getUser: () => Promise<{ data: { user: { id: string; email?: string } | null } }> } }).auth.getUser();
  return data?.user ?? null;
}
