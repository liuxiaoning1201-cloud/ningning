import { apiUrl } from '@/lib/api';
import type { LangRead } from '@/types/word';

/** 同一局內快取音訊 blob URL，降低重複請求 */
const blobCache = new Map<string, string>();

function cacheKey(text: string, lang: LangRead): string {
  return `${lang}::${text}`;
}

function revokeCache(key: string) {
  const url = blobCache.get(key);
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
  blobCache.delete(key);
}

export async function speakWithBackend(
  text: string,
  lang: LangRead,
  opts?: { preferBrowser?: boolean }
): Promise<{ ok: boolean; source: 'xfyun' | 'browser' | 'none'; error?: string }> {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, source: 'none', error: 'empty' };

  const key = cacheKey(trimmed, lang);
  if (!opts?.preferBrowser && blobCache.has(key)) {
    const blobUrl = blobCache.get(key)!;
    await playUrl(blobUrl);
    return { ok: true, source: 'xfyun' };
  }

  try {
    const res = await fetch(apiUrl('/api/tts'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed, lang }),
    });
    if (res.ok && res.headers.get('content-type')?.includes('audio')) {
      const buf = await res.arrayBuffer();
      const blob = new Blob([buf], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      if (blobCache.size > 80) {
        const first = blobCache.keys().next().value as string | undefined;
        if (first) revokeCache(first);
      }
      blobCache.set(key, url);
      await playUrl(url);
      return { ok: true, source: 'xfyun' };
    }
    const errBody = await res.json().catch(() => ({}));
    const fallback = (errBody as { fallback?: boolean }).fallback === true;
    if (fallback || opts?.preferBrowser) {
      const ok = await speakBrowser(trimmed, lang);
      return ok ? { ok: true, source: 'browser' } : { ok: false, source: 'none', error: 'browser-failed' };
    }
    return { ok: false, source: 'none', error: String((errBody as { error?: string }).error || res.status) };
  } catch (e) {
    const ok = await speakBrowser(trimmed, lang);
    return ok
      ? { ok: true, source: 'browser' }
      : { ok: false, source: 'none', error: e instanceof Error ? e.message : 'network' };
  }
}

function playUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('audio'));
    void a.play().catch(reject);
  });
}

function speakBrowser(text: string, lang: LangRead): Promise<boolean> {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) {
      resolve(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'cantonese' ? 'zh-HK' : 'zh-CN';
    u.rate = 0.95;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  });
}

export function clearSpeechCache() {
  for (const k of [...blobCache.keys()]) revokeCache(k);
}
