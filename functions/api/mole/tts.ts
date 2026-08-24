/**
 * POST /api/mole/tts
 *
 * 字詞地鼠戰讀音：微軟 Azure Neural TTS（普通話／粵語）。
 * 不依賴瀏覽器系統語音庫，全班聽到的是同一套微軟神經語音。
 *
 * body: { text: string, lang: 'zh-CN' | 'zh-HK' }
 * 成功：audio/mpeg
 */
import { errorJson, protect, type YueyuPagesFn } from '../cantonese/_shared';

const VOICES = {
  'zh-CN': { name: 'zh-CN-XiaoxiaoNeural', xmlLang: 'zh-CN' },
  'zh-HK': { name: 'zh-HK-HiuMaanNeural', xmlLang: 'zh-HK' },
} as const;

type TtsLang = keyof typeof VOICES;

const MAX_TEXT_LEN = 20;

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'mole-tts',
    requireAuth: false,
    ipPerMinute: 40,
    ipPerDay: 400,
    userPerDay: 400,
    globalPerDay: 30000,
  });
  if (guard instanceof Response) return guard;

  let body: { text?: unknown; lang?: unknown };
  try {
    body = (await context.request.json()) as { text?: unknown; lang?: unknown };
  } catch {
    return errorJson(400, 'invalid_json');
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) return errorJson(400, 'missing_text');
  if (text.length > MAX_TEXT_LEN) {
    return errorJson(400, 'text_too_long', `朗讀文本最長 ${MAX_TEXT_LEN} 字`);
  }

  const lang: TtsLang = body.lang === 'zh-HK' ? 'zh-HK' : 'zh-CN';
  const cacheKeyUrl = new Request(
    `https://mole-tts.internal/${lang}/${encodeURIComponent(text)}`,
  );

  const cache = caches.default;
  const cached = await cache.match(cacheKeyUrl);
  if (cached) return cached;

  const env = context.env;
  const audio =
    env.AZURE_TTS_KEY && env.AZURE_TTS_REGION
      ? await synthesizeAzure(env.AZURE_TTS_KEY, env.AZURE_TTS_REGION, text, lang)
      : await synthesizeEdge(text, lang);

  if ('error' in audio) {
    return errorJson(502, 'tts_failed', audio.error);
  }

  await guard.commitUsage();

  const response = new Response(audio.bytes, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=2592000',
    },
  });
  context.waitUntil(cache.put(cacheKeyUrl, response.clone()));
  return response;
};

async function synthesizeAzure(
  key: string,
  region: string,
  text: string,
  lang: TtsLang,
): Promise<{ bytes: ArrayBuffer } | { error: string }> {
  const voice = VOICES[lang];
  const ssml = buildSsml(text, voice.xmlLang, voice.name);
  try {
    const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        'User-Agent': 'qingyiu-mole/1.0',
      },
      body: ssml,
    });
    if (!res.ok) return { error: `TTS 服務回應 ${res.status}` };
    return { bytes: await res.arrayBuffer() };
  } catch {
    return { error: 'TTS 服務暫時無法連線' };
  }
}

/** Azure 未配置時，改走微軟 Edge 神經語音（同一套 Neural 聲線，仍非系統語音庫）。 */
async function synthesizeEdge(
  text: string,
  lang: TtsLang,
): Promise<{ bytes: ArrayBuffer } | { error: string }> {
  const voice = VOICES[lang];
  const ssml = buildSsml(text, voice.xmlLang, voice.name);
  try {
    const tokenRes = await fetch('https://edge.microsoft.com/translate/auth');
    if (!tokenRes.ok) return { error: '無法取得微軟語音權杖' };
    const token = (await tokenRes.text()).trim();
    if (!token) return { error: '微軟語音權杖無效' };

    const endpoints = [
      'https://eastus.tts.speech.microsoft.com/cognitiveservices/v1',
      'https://api.msedgeservices.com/tts/cognitiveservices/v1',
    ];
    for (const endpoint of endpoints) {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
        },
        body: ssml,
      });
      if (res.ok) return { bytes: await res.arrayBuffer() };
    }
    return { error: '微軟語音合成失敗' };
  } catch {
    return { error: '微軟語音服務暫時無法連線' };
  }
}

function buildSsml(text: string, xmlLang: string, voiceName: string): string {
  return `<speak version='1.0' xml:lang='${xmlLang}'>
  <voice name='${voiceName}'>
    <prosody rate='-8%'>${escapeXml(text)}</prosody>
  </voice>
</speak>`;
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
      default:
        return c;
    }
  });
}
