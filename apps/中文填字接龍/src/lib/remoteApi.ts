/**
 * 遠程對戰 API：當已設定 API URL 時，以 REST 呼叫後端。
 * 未設定時由元件改用 remoteBackend store（示範模式）。
 */

import { getApiUrl, apiGet, apiPost, apiPut, apiDelete } from "./api";

export function isRemoteApiAvailable(): boolean {
  return !!getApiUrl();
}

/** 示範登入，回傳 { token, user }。可傳入 signal 以便逾時中止。 */
export async function authDemo(
  displayName: string,
  email: string,
  signal?: AbortSignal
): Promise<{ token: string; user: { id: string; email: string; displayName: string } }> {
  const base = getApiUrl();
  if (!base) throw new Error("API URL not set");
  const res = await fetch(`${base}/auth/demo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, email }),
    signal,
  });
  if (!res.ok) throw new Error("登入失敗");
  return res.json();
}

export async function getMyClassAndGroups(): Promise<{ class: { id: string; name: string; code: string }; groups: { id: string; name: string; memberEmails: string[] }[] } | null> {
  try {
    return await apiGet("/api/me/class-and-groups");
  } catch {
    return null;
  }
}

export async function joinClass(code: string): Promise<{ class: unknown; groups: unknown[] } | null> {
  try {
    return await apiPost("/api/classes/join", { code });
  } catch {
    return null;
  }
}

export async function getRoomsForClass(classId: string): Promise<{ id: string; puzzleTitle: string; status: string; members: unknown[] }[]> {
  try {
    const list = await apiGet<unknown[]>(`/api/classes/${classId}/rooms`);
    return Array.isArray(list) ? list as { id: string; puzzleTitle: string; status: string; members: unknown[] }[] : [];
  } catch {
    return [];
  }
}

export async function getSessionsForClass(classId: string): Promise<{ id: string; puzzleTitle: string; status: string; durationMinutes: number; participants: unknown[] }[]> {
  try {
    const list = await apiGet<unknown[]>(`/api/classes/${classId}/sessions`);
    return Array.isArray(list) ? list as { id: string; puzzleTitle: string; status: string; durationMinutes: number; participants: unknown[] }[] : [];
  } catch {
    return [];
  }
}

export async function joinRoom(roomId: string): Promise<{ id: string; puzzleId: string; puzzleTitle: string; puzzleSnapshot: unknown; status: string; members: unknown[]; sharedAnswers: Record<string, string> } | null> {
  try {
    return await apiPost(`/api/rooms/${roomId}/join`);
  } catch {
    return null;
  }
}

export async function getRoom(roomId: string): Promise<unknown | null> {
  try {
    return await apiGet(`/api/rooms/${roomId}`);
  } catch {
    return null;
  }
}

export async function startRoom(roomId: string, puzzleId?: string): Promise<boolean> {
  try {
    await apiPost(`/api/rooms/${roomId}/start`, { puzzleId });
    return true;
  } catch {
    return false;
  }
}

export async function endRoom(roomId: string): Promise<void> {
  try {
    await apiPost(`/api/rooms/${roomId}/end`);
  } catch {
    // ignore
  }
}

// ---------- 教師端 ----------
export async function createClass(name: string): Promise<{ id: string; name: string; code: string } | null> {
  try {
    return await apiPost("/api/classes", { name });
  } catch {
    return null;
  }
}

export async function getTeacherClass(): Promise<{ id: string; name: string; code: string } | null> {
  try {
    return await apiGet<{ id: string; name: string; code: string }>("/api/me/teacher-class");
  } catch {
    return null;
  }
}

export async function getGroupsByClassId(classId: string): Promise<{ id: string; name: string; memberEmails: string[] }[]> {
  try {
    const list = await apiGet<unknown[]>(`/api/classes/${classId}/groups`);
    return Array.isArray(list) ? list as { id: string; name: string; memberEmails: string[] }[] : [];
  } catch {
    return [];
  }
}

export async function createGroup(classId: string, name: string): Promise<{ id: string; name: string } | null> {
  try {
    return await apiPost(`/api/classes/${classId}/groups`, { name });
  } catch {
    return null;
  }
}

export async function updateGroupMembers(classId: string, groupId: string, memberEmails: string[]): Promise<void> {
  await apiPut(`/api/classes/${classId}/groups/${groupId}`, { memberEmails });
}

export async function removeGroup(classId: string, groupId: string): Promise<void> {
  await apiDelete(`/api/classes/${classId}/groups/${groupId}`);
}

export async function createRoom(body: {
  puzzleId: string;
  puzzleTitle: string;
  classId: string;
  groupId: string;
  puzzleSnapshot?: unknown;
}): Promise<{ id: string } | null> {
  try {
    return await apiPost("/api/rooms", body);
  } catch {
    return null;
  }
}

export async function createSession(body: {
  puzzleId: string;
  puzzleTitle: string;
  classId: string;
  durationMinutes: number;
  showHints: boolean;
  puzzleSnapshot?: unknown;
}): Promise<{ id: string } | null> {
  try {
    return await apiPost("/api/sessions", body);
  } catch {
    return null;
  }
}

// ---------- 場次 ----------
export async function getSession(sessionId: string): Promise<unknown | null> {
  try {
    return await apiGet(`/api/sessions/${sessionId}`);
  } catch {
    return null;
  }
}

export async function joinSession(sessionId: string): Promise<unknown | null> {
  try {
    return await apiPost(`/api/sessions/${sessionId}/join`);
  } catch {
    return null;
  }
}

export async function startSession(sessionId: string): Promise<boolean> {
  try {
    await apiPost(`/api/sessions/${sessionId}/start`);
    return true;
  } catch {
    return false;
  }
}

export async function setSessionAnswer(sessionId: string, cellKey: string, value: string): Promise<void> {
  await apiPost(`/api/sessions/${sessionId}/answer`, { cellKey, value });
}

export async function endSession(sessionId: string): Promise<void> {
  await apiPost(`/api/sessions/${sessionId}/end`);
}

export async function getRankings(sessionId: string): Promise<{ userId: string; displayName: string; score: number; timeMs: number }[]> {
  try {
    const list = await apiGet<unknown[]>(`/api/sessions/${sessionId}/rankings`);
    return Array.isArray(list) ? list as { userId: string; displayName: string; score: number; timeMs: number }[] : [];
  } catch {
    return [];
  }
}
