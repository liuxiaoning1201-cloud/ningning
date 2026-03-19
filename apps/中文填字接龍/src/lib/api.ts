const API_URL_KEY = "word-puzzle:apiUrl";
const JWT_KEY = "word-puzzle:jwt";
const USER_KEY = "word-puzzle:user";

export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

/** 開發模式下未設定時，自動使用本機後端，不需手動輸入 API */
const DEFAULT_DEV_API = "http://localhost:3000";

export function getApiUrl(): string {
  const stored = localStorage.getItem(API_URL_KEY) || import.meta.env.VITE_API_URL || "";
  if (stored) return stored;
  if (import.meta.env.DEV) return DEFAULT_DEV_API;
  /** 生產環境未設定時，使用當前網域（平台統一登入 + Pages Functions） */
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function setApiUrl(url: string): void {
  localStorage.setItem(API_URL_KEY, url);
}

export function getJwt(): string {
  return localStorage.getItem(JWT_KEY) || "";
}

export function setJwt(token: string): void {
  localStorage.setItem(JWT_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getSavedUser(): ApiUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveUser(user: ApiUser): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function isOnlineMode(): boolean {
  return !!getApiUrl();
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const baseUrl = getApiUrl();
  if (!baseUrl) throw new Error("API URL not configured");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };

  const jwt = getJwt();
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPut<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as Promise<T>;
}

export function connectWebSocket(roomId: string, userId: string, displayName: string): WebSocket | null {
  const baseUrl = getApiUrl();
  if (!baseUrl) return null;

  const wsUrl = baseUrl.replace(/^http/, "ws");
  const ws = new WebSocket(
    `${wsUrl}/ws/room/${roomId}?userId=${encodeURIComponent(userId)}&name=${encodeURIComponent(displayName)}`
  );
  return ws;
}
