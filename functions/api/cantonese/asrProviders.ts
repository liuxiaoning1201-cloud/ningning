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

// Cloudflare Workers AI 對 Whisper audio payload 的硬限制：社區實測 1MB 穩定、>2MB 開始 3006。
// 留一點安全邊際，1.6MB 為閾值；超過就直接讓 orchestrator 試下一家 provider（Groq）。
const CF_MAX_AUDIO_BYTES = 1.6 * 1024 * 1024;
// Groq 官方上限 25MB，留 1MB 作 multipart / 編碼 overhead
const GROQ_MAX_AUDIO_BYTES = 24 * 1024 * 1024;

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

/**
 * 單塊音頻輸入。
 * - `base64`：純 base64（已去掉 data URL 前綴）
 * - `mime`：原始 MIME 類型，幫助 Groq 等支援多容器的 provider 正確識別
 */
export interface AudioChunkInput {
  base64: string;
  mime?: string;
}

export interface AsrProvider {
  readonly name: string;
  isAvailable(env: YueyuEnv): boolean;
  transcribe(env: YueyuEnv, chunk: AudioChunkInput): Promise<AsrProviderOutcome>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider 1：Cloudflare Workers AI Whisper
// ─────────────────────────────────────────────────────────────────────────────

class CloudflareWhisperProvider implements AsrProvider {
  readonly name = 'cloudflare-whisper';

  isAvailable(env: YueyuEnv): boolean {
    return Boolean(env.AI);
  }

  async transcribe(env: YueyuEnv, chunk: AudioChunkInput): Promise<AsrProviderOutcome> {
    const { base64, mime } = chunk;

    // CF Whisper 在原始視頻容器（mp4/mov/webm）上經常無法抽音軌，
    // 直接讓 orchestrator 切下一家（Groq 內建 FFmpeg 可直接處理）。
    if (mime && /^video\//i.test(mime)) {
      return {
        error: `Cloudflare Workers AI 不支援直接識別 ${mime} 視頻容器（需要先在瀏覽器抽音軌）`,
        provider: this.name,
        retryable: true,
      };
    }

    // 預檢大小：超過 CF Whisper 的 payload 上限就直接返回可重試錯誤，
    // 讓 orchestrator 立刻切到下一家（通常是 Groq）。比實際請求再失敗快得多。
    const sizeBytes = Math.ceil(base64.length * 0.75);
    if (sizeBytes > CF_MAX_AUDIO_BYTES) {
      return {
        error: `音頻 ${(sizeBytes / 1024 / 1024).toFixed(2)}MB 超過 Cloudflare Workers AI ` +
          `${(CF_MAX_AUDIO_BYTES / 1024 / 1024).toFixed(1)}MB 上限（這是 Workers AI 的硬限制）`,
        provider: this.name,
        retryable: true,
      };
    }

    let lastError = '此片段暫時無法識別';
    let retryable = false;
    for (const model of CF_WHISPER_MODELS) {
      try {
        const result = (await env.AI!.run(model, {
          audio: base64,
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

  async transcribe(env: YueyuEnv, chunk: AudioChunkInput): Promise<AsrProviderOutcome> {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) {
      return { error: 'GROQ_API_KEY 未配置', provider: this.name, retryable: false };
    }

    const { base64, mime } = chunk;
    const sizeBytes = Math.ceil(base64.length * 0.75);
    if (sizeBytes > GROQ_MAX_AUDIO_BYTES) {
      return {
        error: `音頻 ${(sizeBytes / 1024 / 1024).toFixed(1)}MB 超過 Groq ` +
          `${(GROQ_MAX_AUDIO_BYTES / 1024 / 1024).toFixed(0)}MB 上限，請截短再試`,
        provider: this.name,
        retryable: false,
      };
    }

    try {
      const bytes = base64ToBytes(base64);
      const { filename, contentType } = pickGroqFilenameAndType(mime);
      const blob = new Blob([bytes], { type: contentType });

      const form = new FormData();
      form.append('file', blob, filename);
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

/**
 * Groq 的 Whisper API 需要從檔名/Content-Type 識別格式（內部走 FFmpeg）。
 * 我們依照 MIME 推斷最合適的副檔名，讓 Groq 知道如何 demux。
 * 支援格式：flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm
 */
function pickGroqFilenameAndType(mime?: string): { filename: string; contentType: string } {
  const m = (mime || '').toLowerCase();
  if (m.includes('flac')) return { filename: 'audio.flac', contentType: 'audio/flac' };
  if (m.includes('mp3') || m.includes('mpeg') || m.includes('mpga')) {
    return { filename: 'audio.mp3', contentType: 'audio/mpeg' };
  }
  if (m.includes('m4a') || m.includes('mp4a')) {
    return { filename: 'audio.m4a', contentType: 'audio/mp4' };
  }
  if (m.includes('mp4') || m.includes('quicktime') || m.includes('mov')) {
    // Groq 接受 mp4 視頻容器，內部會抽音軌
    return { filename: 'media.mp4', contentType: 'video/mp4' };
  }
  if (m.includes('ogg') || m.includes('opus')) {
    return { filename: 'audio.ogg', contentType: 'audio/ogg' };
  }
  if (m.includes('webm')) {
    return { filename: 'audio.webm', contentType: 'audio/webm' };
  }
  // 默認當作 WAV（我們前端切塊產出的就是 WAV）
  return { filename: 'audio.wav', contentType: 'audio/wav' };
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
  chunk: AudioChunkInput,
): Promise<{ text: string; provider: string } | { errors: string[]; allOnlySizeIssue: boolean }> {
  const providers = pickAsrProviders(env);
  const errors: string[] = [];
  let allOnlySizeIssue = true;
  for (const p of providers) {
    const r = await p.transcribe(env, chunk);
    if ('error' in r) {
      errors.push(`${r.provider}: ${r.error}`);
      // 只要有一個錯誤不是「換家就有救」的可重試錯誤，就不是純粹的容量問題
      if (!r.retryable) allOnlySizeIssue = false;
      continue;
    }
    return { text: r.text, provider: r.provider };
  }
  return { errors, allOnlySizeIssue };
}

/**
 * 識別多塊：每塊獨立走完所有 provider 試驗，全部塊都成功才算整體成功。
 * 任何一塊全部 provider 都失敗 → 整體失敗，附帶完整錯誤鏈方便排查。
 */
export async function transcribeAllChunks(
  env: YueyuEnv,
  chunks: AudioChunkInput[],
): Promise<
  | { text: string; providersUsed: string[] }
  | { error: string; hint?: 'needs_groq' | 'needs_smaller' }
> {
  const texts: string[] = [];
  const used = new Set<string>();
  for (let i = 0; i < chunks.length; i++) {
    const r = await transcribeOneChunk(env, chunks[i]);
    if ('errors' in r) {
      // 給上層一個 hint：是「裝 Groq 就好」還是「真的得改檔」
      const hint: 'needs_groq' | 'needs_smaller' | undefined =
        r.allOnlySizeIssue && !env.GROQ_API_KEY ? 'needs_groq'
        : r.allOnlySizeIssue ? 'needs_smaller'
        : undefined;
      return {
        error:
          `第 ${i + 1}/${chunks.length} 段識別失敗（已試 ${r.errors.length} 家 provider）：` +
          r.errors.join(' ｜ '),
        hint,
      };
    }
    if (r.text) texts.push(r.text);
    used.add(r.provider);
  }
  return { text: texts.join(' '), providersUsed: Array.from(used) };
}
