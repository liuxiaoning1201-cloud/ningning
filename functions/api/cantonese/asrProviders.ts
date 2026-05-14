/**
 * 粵語 ASR Provider 抽象層。
 *
 * 設計目標：把「具體用哪家語音識別」這件事從業務邏輯抽出來，
 * 讓上層 (`asr.ts`) 只關心「依序試 N 個 provider，第一個成功即返回」。
 *
 * 內建：
 *   - CloudflareWhisperProvider — 默認，免費 tier，跑在 Workers AI binding 上
 *   - GroqWhisperProvider       — 外部 fallback，免費 14400 req/day，速度極快
 *
 * 想加新 provider（Azure / SenseVoice 自部署 / OpenAI）只要實現 AsrProvider
 * interface 並登記到 `pickAsrProviders()` 的 registry 即可，業務代碼零改動。
 */
import type { YueyuEnv } from './_shared';

const CF_WHISPER_MODELS = [
  '@cf/openai/whisper-large-v3-turbo',
  '@cf/openai/whisper',
] as const;

interface CfWhisperResult {
  text?: string;
  transcription_info?: { language?: string };
}

export interface AsrProviderSuccess {
  text: string;
  provider: string;
}

export interface AsrProviderError {
  error: string;
  provider: string;
  /** 是否屬於「換 provider 就有救」的可重試錯誤（例如 3006、5xx、超時） */
  retryable: boolean;
}

export type AsrProviderOutcome = AsrProviderSuccess | AsrProviderError;

export interface AsrProvider {
  readonly name: string;
  isAvailable(env: YueyuEnv): boolean;
  transcribe(env: YueyuEnv, base64Audio: string): Promise<AsrProviderOutcome>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider 1：Cloudflare Workers AI Whisper
// ─────────────────────────────────────────────────────────────────────────────

class CloudflareWhisperProvider implements AsrProvider {
  readonly name = 'cloudflare-whisper';

  isAvailable(env: YueyuEnv): boolean {
    return Boolean(env.AI);
  }

  async transcribe(env: YueyuEnv, base64Audio: string): Promise<AsrProviderOutcome> {
    let lastError = '此片段暫時無法識別';
    let retryable = false;
    for (const model of CF_WHISPER_MODELS) {
      try {
        const result = (await env.AI!.run(model, {
          audio: base64Audio,
          task: 'transcribe',
          language: 'zh',
          vad_filter: true,
        })) as CfWhisperResult;
        return { text: (result.text || '').trim(), provider: this.name };
      } catch (e) {
        if (e instanceof Error && e.message) {
          lastError = e.message.slice(0, 200);
          if (/3006|too large|request size|rate limit|timeout/i.test(lastError)) {
            retryable = true;
          }
        }
        continue;
      }
    }
    return { error: lastError, provider: this.name, retryable };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider 2：Groq Whisper（OpenAI 兼容 API，但跑在 Groq 自家硬體上，極快）
//
// API 文檔：https://console.groq.com/docs/speech-to-text
// 模型：whisper-large-v3-turbo（默認）、whisper-large-v3
// 限制：單檔 25MB（我們前端已切到 ~640KB/塊，遠低於上限）
// ─────────────────────────────────────────────────────────────────────────────

class GroqWhisperProvider implements AsrProvider {
  readonly name = 'groq-whisper';

  isAvailable(env: YueyuEnv): boolean {
    return Boolean(env.GROQ_API_KEY);
  }

  async transcribe(env: YueyuEnv, base64Audio: string): Promise<AsrProviderOutcome> {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return { error: 'GROQ_API_KEY 未配置', provider: this.name, retryable: false };
    }

    try {
      const bytes = base64ToBytes(base64Audio);
      const blob = new Blob([bytes], { type: 'audio/wav' });

      const form = new FormData();
      form.append('file', blob, 'chunk.wav');
      form.append('model', env.GROQ_WHISPER_MODEL || 'whisper-large-v3-turbo');
      form.append('language', 'zh');
      form.append('temperature', '0');
      form.append('response_format', 'json');

      const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return {
          error: `Groq HTTP ${res.status}：${text.slice(0, 160)}`,
          provider: this.name,
          retryable: res.status >= 500 || res.status === 429,
        };
      }

      const data = (await res.json()) as { text?: string };
      return { text: (data.text || '').trim(), provider: this.name };
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 200) : 'Groq 調用失敗';
      return { error: msg, provider: this.name, retryable: true };
    }
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ─────────────────────────────────────────────────────────────────────────────
// 編排：根據環境變數 ASR_PROVIDER_ORDER 決定試的順序
// 默認：'cloudflare,groq'（先試免費 Workers AI、不行就 Groq）
// 想反過來：在 secret 設 `ASR_PROVIDER_ORDER=groq,cloudflare`
// 想完全停用某家：把它從列表移除
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, () => AsrProvider> = {
  cloudflare: () => new CloudflareWhisperProvider(),
  groq: () => new GroqWhisperProvider(),
};

export function pickAsrProviders(env: YueyuEnv): AsrProvider[] {
  const raw = env.ASR_PROVIDER_ORDER || 'cloudflare,groq';
  const order = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const providers: AsrProvider[] = [];
  for (const key of order) {
    const factory = REGISTRY[key];
    if (!factory) continue;
    const p = factory();
    if (p.isAvailable(env)) providers.push(p);
  }
  // 兜底：所有人都不可用時，仍把 Cloudflare 塞進去，
  // 由它在 transcribe() 內報出可診斷的錯誤訊息
  if (providers.length === 0) providers.push(new CloudflareWhisperProvider());
  return providers;
}

/**
 * 識別單塊：依序試所有 provider，第一個成功的即返回。
 * 失敗時返回每個 provider 的錯誤（方便診斷到底是哪一家壞了）。
 */
async function transcribeOneChunk(
  env: YueyuEnv,
  base64Audio: string,
): Promise<{ text: string; provider: string } | { errors: string[] }> {
  const providers = pickAsrProviders(env);
  const errors: string[] = [];
  for (const p of providers) {
    const r = await p.transcribe(env, base64Audio);
    if ('error' in r) {
      errors.push(`${r.provider}: ${r.error}`);
      continue;
    }
    return { text: r.text, provider: r.provider };
  }
  return { errors };
}

/**
 * 識別多塊：每塊獨立走完所有 provider 試驗，全部塊都成功才算整體成功。
 * 任何一塊全部 provider 都失敗 → 整體失敗，附帶完整錯誤鏈方便排查。
 */
export async function transcribeAllChunks(
  env: YueyuEnv,
  base64Chunks: string[],
): Promise<{ text: string; providersUsed: string[] } | { error: string }> {
  const texts: string[] = [];
  const used = new Set<string>();
  for (let i = 0; i < base64Chunks.length; i++) {
    const r = await transcribeOneChunk(env, base64Chunks[i]);
    if ('errors' in r) {
      return {
        error:
          `第 ${i + 1}/${base64Chunks.length} 段識別失敗（已嘗試 ${r.errors.length} 個 provider）：` +
          r.errors.join(' ｜ '),
      };
    }
    if (r.text) texts.push(r.text);
    used.add(r.provider);
  }
  return { text: texts.join(' '), providersUsed: Array.from(used) };
}
