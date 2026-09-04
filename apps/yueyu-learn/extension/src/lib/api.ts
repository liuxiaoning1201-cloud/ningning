import type {
  TranslateResponse,
  TtsResponse,
  VocabEntry,
  VocabListResponse,
} from '@yueyu/shared/types'

interface RpcResult<T> {
  ok: boolean
  status: number
  body: T | { error?: string; message?: string }
}

async function rpc<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await chrome.runtime.sendMessage({ type: 'rpc', path, init }) as RpcResult<T>
  if (!res.ok) {
    const body = res.body as { error?: string; message?: string }
    const err = new Error(body?.message || body?.error || `HTTP ${res.status}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res.body as T
}

export const ExtensionApi = {
  translate(sentences: string[]): Promise<TranslateResponse> {
    return rpc<TranslateResponse>('/api/cantonese/translate', {
      method: 'POST',
      body: JSON.stringify({ sentences, client: 'extension' }),
    })
  },
  tts(text: string, voice: 'female' | 'male' = 'female', speed: 'slow' | 'normal' | 'fast' = 'normal'): Promise<TtsResponse> {
    return rpc<TtsResponse>('/api/cantonese/tts', {
      method: 'POST',
      body: JSON.stringify({ text, voice, speed }),
    })
  },
  listVocab(): Promise<VocabListResponse> {
    return rpc<VocabListResponse>('/api/cantonese/vocab')
  },
  saveVocab(entry: Omit<VocabEntry, 'id' | 'createdAt'>): Promise<VocabEntry> {
    return rpc<VocabEntry>('/api/cantonese/vocab', {
      method: 'POST',
      body: JSON.stringify(entry),
    })
  },
}
