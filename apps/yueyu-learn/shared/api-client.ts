/**
 * 雙端共享 API client。
 * 網頁直接走相對路徑；擴展走絕對 URL（指向生產環境或本地開發伺服器）。
 */
import type {
  TranslateRequest,
  TranslateResponse,
  TtsRequest,
  TtsResponse,
  AsrRequest,
  AsrResponse,
  VocabEntry,
  VocabListResponse,
} from './types';

export interface ApiClientOptions {
  /** API 基礎 URL，預設為相對路徑 '' */
  baseUrl?: string;
  /** 擴展端傳遞的可選 token（後續若改 Bearer 鑑權再啟用） */
  token?: string;
  /** 客戶端類型，用於後端配額分桶 */
  client?: 'web' | 'extension' | 'mobile';
}

export class CantoneseApi {
  private baseUrl: string;
  private token?: string;
  private client: 'web' | 'extension' | 'mobile';

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? '';
    this.token = options.token;
    this.client = options.client ?? 'web';
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string>) ?? {}),
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      credentials: 'include',
    });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = await res.text();
      }
      throw new ApiError(res.status, body);
    }
    return (await res.json()) as T;
  }

  translate(sentences: string[]): Promise<TranslateResponse> {
    const body: TranslateRequest = { sentences, client: this.client };
    return this.request<TranslateResponse>('/api/cantonese/translate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  tts(req: TtsRequest): Promise<TtsResponse> {
    return this.request<TtsResponse>('/api/cantonese/tts', {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  listVocab(): Promise<VocabListResponse> {
    return this.request<VocabListResponse>('/api/cantonese/vocab', {
      method: 'GET',
    });
  }

  saveVocab(entry: Omit<VocabEntry, 'id' | 'createdAt'>): Promise<VocabEntry> {
    return this.request<VocabEntry>('/api/cantonese/vocab', {
      method: 'POST',
      body: JSON.stringify(entry),
    });
  }

  deleteVocab(id: string): Promise<{ ok: true }> {
    return this.request<{ ok: true }>(
      `/api/cantonese/vocab?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }

  updateSrs(id: string, srs: VocabEntry['srs']): Promise<VocabEntry> {
    return this.request<VocabEntry>('/api/cantonese/vocab', {
      method: 'PATCH',
      body: JSON.stringify({ id, srs }),
    });
  }

  ocr(imageDataUrl: string): Promise<{ text: string; lines: string[] }> {
    return this.request('/api/cantonese/ocr', {
      method: 'POST',
      body: JSON.stringify({ image: imageDataUrl }),
    });
  }

  asr(payload: AsrRequest): Promise<AsrResponse> {
    return this.request('/api/cantonese/asr', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ── Personal API Keys 管理 ──
  listApiKeys(): Promise<{ keys: ApiKeyRecord[] }> {
    return this.request('/api/cantonese/apikeys');
  }

  createApiKey(payload: { name: string; scopes?: string[]; expiresInDays?: number }): Promise<ApiKeyCreateResponse> {
    return this.request('/api/cantonese/apikeys', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  revokeApiKey(id: string): Promise<{ revoked: number }> {
    return this.request(
      `/api/cantonese/apikeys?id=${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  prefix: string;
  scopes: string;
  expiresAt: string | null;
  /** 明文 Key，僅在創建時返回一次 */
  token: string;
  notice: string;
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : `HTTP ${status}`);
    this.status = status;
    this.body = body;
  }

  /** 是否為配額/限流錯誤，前端可給友好提示 */
  get isRateLimited() {
    return this.status === 429;
  }

  /** 是否需要登入 */
  get needsLogin() {
    return this.status === 401;
  }
}
