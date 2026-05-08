/**
 * POST /api/cantonese/tts
 *
 * 對任意文字（書面或粵語）合成語音。Azure TTS（zh-HK），帶 R2 強緩存。
 *
 * 客戶端調用後拿到 R2 公共 URL（或反向代理 URL），瀏覽器/擴展直接 audio.src 播放。
 *
 * 緩存策略：以 sha256(text + voice + speed) 為 key，第二次請求直接返回已有 URL。
 *
 * 兜底：若 Azure 未配置或失敗，返回 503 + fallbackUseWebSpeech，前端用瀏覽器原生 SpeechSynthesis 兜底。
 */
import { errorJson, json, protect, sha256Hex, type YueyuPagesFn, type YueyuEnv } from './_shared';
import type { TtsRequest, TtsResponse } from '../../../shared/cantoneseTypes';

const VOICES = {
  female: 'zh-HK-HiuMaanNeural',
  male: 'zh-HK-WanLungNeural',
} as const;

const SPEED_RATES = {
  slow: '-15%',
  normal: '+0%',
  fast: '+15%',
} as const;

const MAX_TEXT_LEN = 300;

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'tts',
    ipPerMinute: 30,
    ipPerDay: 200,
    userPerDay: 200,
    globalPerDay: 20000,
  });
  if (guard instanceof Response) return guard;

  let body: TtsRequest;
  try {
    body = (await context.request.json()) as TtsRequest;
  } catch {
    return errorJson(400, 'invalid_json');
  }
  if (!body.text || typeof body.text !== 'string') {
    return errorJson(400, 'missing_text');
  }
  if (body.text.length > MAX_TEXT_LEN) {
    return errorJson(400, 'text_too_long', `朗讀文本最長 ${MAX_TEXT_LEN} 字`);
  }
  const voice = body.voice ?? 'female';
  const speed = body.speed ?? 'normal';

  const env = context.env;
  const cacheKey = await sha256Hex(`${voice}|${speed}|${body.text}`);
  const r2Key = `tts/${cacheKey}.mp3`;

  // 先查 R2
  if (env.YUEYU_AUDIO) {
    const head = await env.YUEYU_AUDIO.head(r2Key);
    if (head) {
      const url = audioUrl(context.request, r2Key);
      const response: TtsResponse = { url, cached: true };
      return json(response);
    }
  }

  if (!env.AZURE_TTS_KEY || !env.AZURE_TTS_REGION) {
    return errorJson(503, 'tts_unavailable', 'Azure TTS 尚未配置，請使用瀏覽器內建朗讀', {
      fallbackUseWebSpeech: true,
    });
  }

  const audio = await synthesizeAzure(env, body.text, voice, speed);
  if ('error' in audio) {
    return errorJson(502, 'tts_failed', audio.error, { fallbackUseWebSpeech: true });
  }

  if (env.YUEYU_AUDIO) {
    await env.YUEYU_AUDIO.put(r2Key, audio.bytes, {
      httpMetadata: { contentType: 'audio/mpeg' },
    });
  }

  await guard.commitUsage();

  if (env.YUEYU_AUDIO) {
    const url = audioUrl(context.request, r2Key);
    const response: TtsResponse = { url, cached: false };
    return json(response);
  }

  // 未綁 R2 時直接返回音頻 base64（不推薦，但作為退路）
  const b64 = arrayBufferToBase64(audio.bytes);
  return json({
    url: `data:audio/mpeg;base64,${b64}`,
    cached: false,
  } satisfies TtsResponse);
};

/** 透過反向代理路徑訪問 R2 物件（避免直接暴露 R2 公共 URL） */
function audioUrl(req: Request, r2Key: string): string {
  const u = new URL(req.url);
  return `${u.origin}/api/cantonese/audio/${encodeURIComponent(r2Key)}`;
}

async function synthesizeAzure(
  env: YueyuEnv,
  text: string,
  voice: 'female' | 'male',
  speed: 'slow' | 'normal' | 'fast',
): Promise<{ bytes: ArrayBuffer } | { error: string }> {
  const region = env.AZURE_TTS_REGION!;
  const key = env.AZURE_TTS_KEY!;
  const ssml = `<speak version='1.0' xml:lang='zh-HK'>
  <voice name='${VOICES[voice]}'>
    <prosody rate='${SPEED_RATES[speed]}'>${escapeXml(text)}</prosody>
  </voice>
</speak>`;

  let res: Response;
  try {
    res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'yueyu-learn/0.1',
      },
      body: ssml,
    });
  } catch (e) {
    void e;
    return { error: 'TTS 服務暫時無法連線' };
  }
  if (!res.ok) {
    return { error: `TTS 服務回應 ${res.status}` };
  }
  const bytes = await res.arrayBuffer();
  return { bytes };
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
    }
    return c;
  });
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
