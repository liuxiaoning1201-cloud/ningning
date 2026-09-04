/**
 * 訊飛流式語音合成 WebSocket API（線上語音合成）
 * 文檔：https://www.xfyun.cn/doc/tts/online_tts/API.html
 */

const TTS_PATH = '/v2/tts';

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

async function hmacSha256Base64(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export async function assembleTtsAuthUrl(hostUrl, apiKey, apiSecret) {
  const ul = new URL(hostUrl);
  const date = new Date().toUTCString();
  const signString = [`host: ${ul.host}`, `date: ${date}`, `GET ${ul.pathname} HTTP/1.1`].join('\n');
  const signature = await hmacSha256Base64(apiSecret, signString);
  const authorizationOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = btoa(authorizationOrigin);
  const params = new URLSearchParams({
    authorization,
    date,
    host: ul.host,
  });
  return `${hostUrl}?${params.toString()}`;
}

function concatUint8(arrays) {
  let len = 0;
  arrays.forEach((a) => {
    len += a.length;
  });
  const out = new Uint8Array(len);
  let offset = 0;
  arrays.forEach((a) => {
    out.set(a, offset);
    offset += a.length;
  });
  return out;
}

function base64ToUint8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function waitWsOpen(ws, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('TTS_WS_TIMEOUT')), ms);
    ws.addEventListener(
      'open',
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
    ws.addEventListener(
      'error',
      () => {
        clearTimeout(t);
        reject(new Error('TTS_WS_OPEN_FAILED'));
      },
      { once: true }
    );
  });
}

/**
 * @param {{ IFLYTEK_APP_ID: string, IFLYTEK_API_KEY: string, IFLYTEK_API_SECRET: string, IFLYTEK_VCN_ZH?: string, IFLYTEK_VCN_YUE?: string, IFLYTEK_VCN_MANDARIN?: string, IFLYTEK_VCN_CANTONESE?: string }} env
 */
export async function synthesizeMp3(env, text, lang) {
  const appId = env.IFLYTEK_APP_ID;
  const apiKey = env.IFLYTEK_API_KEY;
  const apiSecret = env.IFLYTEK_API_SECRET;
  if (!appId || !apiKey || !apiSecret) {
    throw new Error('MISSING_IFLYTEK_SECRETS');
  }

  const vcn =
    lang === 'cantonese'
      ? env.IFLYTEK_VCN_YUE || env.IFLYTEK_VCN_CANTONESE || 'xiaoyan'
      : env.IFLYTEK_VCN_ZH || env.IFLYTEK_VCN_MANDARIN || 'xiaoyan';

  const url = await assembleTtsAuthUrl(`wss://tts-api.xfyun.cn${TTS_PATH}`, apiKey, apiSecret);
  const ws = new WebSocket(url);
  await waitWsOpen(ws, 15000);

  const payload = {
    common: { app_id: appId },
    business: {
      aue: 'lame',
      sfl: 1,
      vcn,
      speed: 52,
      volume: 50,
      pitch: 50,
      bgs: 0,
      tte: 'UTF8',
    },
    data: {
      status: 2,
      text: utf8ToBase64(text),
    },
  };

  const chunks = [];

  const body = await new Promise((resolve, reject) => {
    ws.addEventListener('message', (event) => {
      try {
        const j = JSON.parse(event.data);
        if (j.code !== 0) {
          reject(new Error(j.message || `TTS_ERR_${j.code}`));
          ws.close();
          return;
        }
        if (j.data?.audio) {
          chunks.push(base64ToUint8(j.data.audio));
        }
      } catch (err) {
        reject(err);
        ws.close();
      }
    });
    ws.addEventListener(
      'close',
      () => {
        if (chunks.length === 0) reject(new Error('TTS_EMPTY_AUDIO'));
        else resolve(concatUint8(chunks));
      },
      { once: true }
    );
    ws.addEventListener(
      'error',
      () => reject(new Error('TTS_WS_ERROR')),
      { once: true }
    );

    ws.send(JSON.stringify(payload));
    ws.send(JSON.stringify({ data: { status: 2 } }));
  });

  return body;
}
