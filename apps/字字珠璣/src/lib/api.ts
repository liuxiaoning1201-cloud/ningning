/**
 * 字字珠璣 API 客戶端：與 workers/zizi-zhuji（DO）通訊。
 *
 * 環境變數：
 *   VITE_ZIZI_API  — Worker URL（部署後設）。未設時預設使用同源 + /zizi/，
 *                    或開發模式下走 http://localhost:8787。
 */

const API_KEY = "zizi:apiUrl";
const PROFILE_KEY = "zizi:profile";

const DEFAULT_DEV_API = "http://localhost:8787";

export function getApiUrl(): string {
  const stored = localStorage.getItem(API_KEY) || import.meta.env.VITE_ZIZI_API || "";
  if (stored) return stored;
  if (import.meta.env.DEV) return DEFAULT_DEV_API;
  return "";
}

export function setApiUrl(url: string): void {
  localStorage.setItem(API_KEY, url);
}

export interface PlayerProfile {
  id: string;
  name: string;
}

export function getProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      if (parsed?.id && parsed?.name) return parsed;
    }
  } catch {
    /* ignore */
  }
  const fresh: PlayerProfile = {
    id: `p_${Math.random().toString(36).slice(2, 10)}`,
    name: "玩家",
  };
  localStorage.setItem(PROFILE_KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveProfile(p: PlayerProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

export interface CreateRoomBody {
  template: string;
  customRule?: import("@/lib/types").GameRule;
  customBoardSize?: number;
  customTurnSeconds?: number;
  customTexts?: string[];
}

export interface CreatedRoom {
  roomId: string;
  joinCode: string;
  templateId: string;
  templateName: string;
}

export async function createRoom(body: CreateRoomBody): Promise<CreatedRoom> {
  const base = getApiUrl();
  if (!base) throw new Error("尚未設定後端 API（VITE_ZIZI_API）");
  const profile = getProfile();
  const res = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      hostId: profile.id,
      hostName: profile.name,
    }),
  });
  if (!res.ok) throw new Error(`建立房間失敗：${res.status}`);
  return (await res.json()) as CreatedRoom;
}

export async function lookupRoomByCode(code: string): Promise<{
  exists: boolean;
  roomId?: string;
  templateName?: string;
  status?: string;
} | null> {
  const base = getApiUrl();
  if (!base) return null;
  const res = await fetch(`${base}/api/rooms/${encodeURIComponent(code)}`);
  if (!res.ok) return { exists: false };
  return (await res.json()) as { exists: boolean; roomId?: string };
}

export function connectGameWS(roomId: string): WebSocket | null {
  const base = getApiUrl();
  if (!base) return null;
  const profile = getProfile();
  const wsBase = base.replace(/^http/i, "ws");
  return new WebSocket(
    `${wsBase}/ws?room=${encodeURIComponent(roomId)}&playerId=${encodeURIComponent(profile.id)}&name=${encodeURIComponent(profile.name)}`
  );
}
