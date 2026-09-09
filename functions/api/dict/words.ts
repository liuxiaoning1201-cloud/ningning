/**
 * GET /api/dict/words?char=進&limit=12
 *
 * 從萌典的詞目索引挑出含這個字的詞，給「巧手拼拼字」的字義卡當組詞。
 *
 * 為什麼要走後端：索引檔（萌典兩岸詞典詞目）有 2.2 MB、十六萬條，
 * 不能讓學生的瀏覽器每次下載。這裡用 Workers 的 Cache API 存一個月，
 * 只回幾十個位元組的結果。
 *
 * 公開唯讀、無金鑰、無 LLM，所以不走粵語 API 那套鑑權與限流；
 * 只擋掉明顯的濫用：char 必須是單一漢字，limit 上限 30。
 */

const INDEX_URL = 'https://www.moedict.tw/a/index.json';
/** Cache API 的 key 必須是 URL，用一個假網域當命名空間。 */
const INDEX_CACHE_KEY = 'https://dict.qingyiu.internal/moedict-a-index-v1';
const INDEX_TTL = 60 * 60 * 24 * 30;
const HAN = /^[\u3400-\u9fff\uf900-\ufaff]$/;
const MAX_LIMIT = 30;
const MAX_WORD_LEN = 4;

/** 同一個 isolate 內重複請求就不用再解析 JSON。 */
let parsed: string[] | null = null;

function json(body: unknown, maxAge: number): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${maxAge}`,
    },
  });
}

async function loadIndex(): Promise<string[] | null> {
  if (parsed) return parsed;

  const cache = caches.default;
  const cacheKey = new Request(INDEX_CACHE_KEY);
  let res = await cache.match(cacheKey);

  if (!res) {
    const upstream = await fetch(INDEX_URL, { cf: { cacheTtl: INDEX_TTL } });
    if (!upstream.ok) return null;
    res = new Response(upstream.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': `public, max-age=${INDEX_TTL}`,
      },
    });
    await cache.put(cacheKey, res.clone());
  }

  const list = (await res.json()) as unknown;
  if (!Array.isArray(list)) return null;
  parsed = list.filter((item): item is string => typeof item === 'string');
  return parsed;
}

/** 以這個字開頭的詞先出，再來是兩個字的詞，其餘照索引順序。 */
function rank(word: string, ch: string): number {
  let score = 0;
  if (word.startsWith(ch)) score -= 2;
  if (word.length === 2) score -= 1;
  return score;
}

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const ch = url.searchParams.get('char') ?? '';
  if (!HAN.test(ch)) {
    return json({ error: 'char 必須是單一漢字' }, 0);
  }

  const asked = Number(url.searchParams.get('limit') ?? '12');
  const limit = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), MAX_LIMIT) : 12;

  const index = await loadIndex();
  if (!index) return json({ char: ch, words: [] }, 300);

  const hits = index
    .filter((word) => word.length >= 2 && word.length <= MAX_WORD_LEN && word.includes(ch))
    .map((word, i) => ({ word, i, score: rank(word, ch) }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, limit)
    .map((item) => item.word);

  return json({ char: ch, words: hits }, 86400);
};
