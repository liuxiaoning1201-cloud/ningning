/**
 * POST /api/cantonese/asr
 *
 * 粵語口語聽寫：接收短音頻 / 視頻片段，用 Workers AI Whisper 轉寫，
 * 再用 DeepSeek 做保守斷句、粵拼、書面意思和高頻詞拓展。
 *
 * 原則：
 *   - 音頻識別是主來源，字幕只可輔助理解，不可覆蓋聽到的口語。
 *   - 不做「書面語翻譯成口語」；只整理實際聽到的粵語對白。
 */
import { errorJson, json, protect, type YueyuEnv, type YueyuPagesFn } from './_shared';
import type { AsrRequest, AsrResponse, AsrSentence, AsrTerm } from '../../../shared/cantoneseTypes';

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const WHISPER_MODEL = '@cf/openai/whisper-large-v3-turbo';

interface WhisperResult {
  text?: string;
  transcription_info?: { language?: string };
  words?: Array<{ word?: string; start?: number; end?: number }>;
}

interface DeepseekResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

interface RefinePayload {
  sentences?: AsrSentence[];
  terms?: AsrTerm[];
}

export const onRequestPost: YueyuPagesFn = async (context) => {
  const guard = await protect(context, {
    bucket: 'asr',
    ipPerMinute: 6,
    ipPerDay: 40,
    userPerDay: 40,
    globalPerDay: 3000,
  });
  if (guard instanceof Response) return guard;

  let body: AsrRequest;
  try {
    body = (await context.request.json()) as AsrRequest;
  } catch {
    return errorJson(400, 'invalid_json');
  }

  if (!body.media || typeof body.media !== 'string') {
    return errorJson(400, 'missing_media', '請提供音頻或視頻片段');
  }
  if (body.subtitleHint && body.subtitleHint.length > 1000) {
    return errorJson(400, 'subtitle_too_long', '字幕輔助文字最長 1000 字');
  }
  if (!context.env.AI) {
    return errorJson(503, 'asr_unavailable', '語音識別服務尚未配置（需 Cloudflare Workers AI 綁定）');
  }

  const parsed = parseBase64Media(body.media);
  if ('error' in parsed) return parsed.error;
  if (parsed.bytes.length > MAX_MEDIA_BYTES) {
    return errorJson(413, 'media_too_large', '音頻/視頻片段不能超過 12MB，建議截取 10-30 秒');
  }

  const whisper = await transcribe(context.env, parsed.bytes);
  if ('error' in whisper) return errorJson(502, 'asr_failed', whisper.error);

  const rawText = normalizeTranscript(whisper.text || '');
  if (!rawText) {
    return errorJson(422, 'empty_transcript', '暫時未聽出清晰粵語對白，請換一段人聲更清楚的片段');
  }

  const refined = await refineCantonese(rawText, body.subtitleHint || '', context.env);
  const response: AsrResponse = refined ?? {
    rawText,
    sentences: [{ cantonese: rawText, confidence: 0.72 }],
    terms: [],
  };

  await guard.commitUsage();
  return json(response);
};

function parseBase64Media(input: string): { bytes: Uint8Array; mime?: string } | { error: Response } {
  const dataUrl = input.match(/^data:([^;]+);base64,(.+)$/i);
  const b64 = dataUrl ? dataUrl[2] : input;
  const mime = dataUrl?.[1];
  if (mime && !/^(audio|video)\//i.test(mime)) {
    return { error: errorJson(400, 'invalid_media_type', '只支援 audio/* 或 video/* 檔案') };
  }
  if (b64.length * 0.75 > MAX_MEDIA_BYTES) {
    return { error: errorJson(413, 'media_too_large', '音頻/視頻片段不能超過 12MB') };
  }
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes, mime };
  } catch {
    return { error: errorJson(400, 'invalid_base64', '音頻資料格式不正確') };
  }
}

async function transcribe(
  env: YueyuEnv,
  bytes: Uint8Array,
): Promise<{ text: string } | { error: string }> {
  try {
    const result = (await env.AI!.run(WHISPER_MODEL, {
      audio: Array.from(bytes),
      task: 'transcribe',
      language: 'zh',
    })) as WhisperResult;
    return { text: result.text || '' };
  } catch {
    return { error: '語音識別服務暫時無法處理這段音頻' };
  }
}

function normalizeTranscript(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[「」"]/g, '')
    .trim();
}

async function refineCantonese(
  rawText: string,
  subtitleHint: string,
  env: YueyuEnv,
): Promise<AsrResponse | null> {
  if (!env.DEEPSEEK_API_KEY) return null;

  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const prompt = `你是一位香港粵語口語聽寫校對員。請根據 Whisper 原始轉寫，保守整理成自然、生活化的粵語口語文字。

重要規則：
1. 主來源是「Whisper 原始轉寫」；「書面字幕提示」只可作語義參考，不可把字幕直接翻譯成粵語。
2. 保留地道口語字詞：唔、冇、喺、佢、咗、緊、啲、嘅、咩、乜嘢、點解、而家、噉、喎、啦、呀。
3. 不要逐字硬拆，不要讓句子像逐字蹦出來；請按自然說話節奏斷句。
4. 不確定的地方請保守，不要自行編造劇情或添加原音沒有的內容。
5. 找出句中 3-8 個高頻常見口語詞，每個詞給 2 個生活化粵語例句。例句要自然，可以朗讀。

Whisper 原始轉寫：
${rawText}

書面字幕提示（可選）：
${subtitleHint || '(無)'}

請輸出嚴格 JSON：
{
  "sentences": [
    {
      "cantonese": "實際聽到並整理後的粵語口語句子",
      "jyutping": "整句粵拼，可留空",
      "meaning": "書面/普通話意思",
      "confidence": 0.85
    }
  ],
  "terms": [
    {
      "term": "咗",
      "jyutping": "zo2",
      "meaning": "表示動作已完成",
      "note": "常放在動詞後面",
      "examples": [
        { "cantonese": "我食咗飯喇。", "jyutping": "ngo5 sik6 zo2 faan6 laa3", "meaning": "我吃過飯了。" },
        { "cantonese": "佢走咗好耐。", "jyutping": "keoi5 zau2 zo2 hou2 noi6", "meaning": "他走了很久。" }
      ]
    }
  ]
}`;

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          { role: 'system', content: '你只做粵語口語聽寫校對、粵拼和高頻詞教學。必須輸出 JSON。' },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 2600,
      }),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  try {
    const data = (await res.json()) as DeepseekResponse;
    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}') as RefinePayload;
    const sentences = Array.isArray(parsed.sentences)
      ? parsed.sentences.filter((s) => typeof s.cantonese === 'string' && s.cantonese.trim())
      : [];
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms.filter((t) => typeof t.term === 'string' && Array.isArray(t.examples))
      : [];
    if (!sentences.length) return null;
    return { rawText, sentences, terms };
  } catch {
    return null;
  }
}
