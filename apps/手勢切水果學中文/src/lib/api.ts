/**
 * API 與 WebSocket URL 工具：
 * - 開發時 `VITE_API_BASE` 空：走 Vite proxy `/api`, `/ws`
 * - 部署時 `VITE_API_BASE=https://xxx.workers.dev`：直接指向 Worker
 */

const RAW = (import.meta.env.VITE_API_BASE as string | undefined)?.trim() || '';
export const API_BASE = RAW.replace(/\/+$/, '');

/** 傳 '/api/tts' → 完整 URL */
export function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** 傳 '/ws?room=XYZ' → wss://worker/ws?room=XYZ 或同源 wss://... */
export function wsUrl(path: string): string {
  let host = window.location.host;
  let secure = window.location.protocol === 'https:';
  if (API_BASE) {
    try {
      const u = new URL(API_BASE);
      host = u.host;
      secure = u.protocol === 'https:';
    } catch {
      /* fall back to current origin */
    }
  }
  return `${secure ? 'wss:' : 'ws:'}//${host}${path.startsWith('/') ? path : `/${path}`}`;
}
