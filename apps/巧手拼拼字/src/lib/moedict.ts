import { bundledChars, isHkChar } from '@/lib/charData';

/**
 * 萌典的字義與組詞。
 *
 * 端點都帶 `access-control-allow-origin: *`，跟現在直接打 jsDelivr 取筆順一樣，
 * 前端可以自己拿：
 *   /uni/{字}.json  教育部重編國語辭典（注音、詞性、釋義、例詞、部首、筆數）
 *   /c/{字}.json    兩岸詞典的英文對譯
 *   /uni/{詞}.json  點開某個組詞時的詞義
 *
 * 給小學生看，所以只取白話的 def 與「如：」例詞，完全不取文言引例（quote）；
 * 姓氏、人名、地名、譯音那幾條也跳掉。
 *
 * 組詞先從例詞抽——那是辭典自己給的搭配，最準；不夠四個才去自家
 * /api/dict/words 從萌典詞目索引補，並且只留港標字形表裡的字。
 *
 * 取回來的結果存 IndexedDB。離線或萌典掛掉時寧可拿舊的，也不要空卡。
 */

export interface CharSense {
  type?: string;
  def: string;
  examples: string[];
}

export interface CharGlossData {
  char: string;
  bopomofo: string[];
  radical?: string;
  strokeCount?: number;
  senses: CharSense[];
  /** 候選組詞，已過濾成港標字；顯示時再依字簿排序、截斷。 */
  words: string[];
  english: string[];
  fetchedAt: number;
}

const UNI = (text: string) => `https://www.moedict.tw/uni/${encodeURIComponent(text)}.json`;
const CEDICT = (text: string) => `https://www.moedict.tw/c/${encodeURIComponent(text)}.json`;
const WORDS_API = (ch: string, limit: number) =>
  `/api/dict/words?char=${encodeURIComponent(ch)}&limit=${limit}`;

const DICT_CACHE_DB = 'caicaizi_dict_cache_v1';
const STORE = 'gloss';
/** 辭典內容不常變，一個月夠了。過期也只是重取，不會清掉舊的。 */
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const MAX_SENSES = 3;
const MAX_DEF_LEN = 42;
const MAX_WORDS = 24;
const MAX_ENGLISH = 3;

interface UniRaw {
  title?: string;
  radical?: string;
  stroke_count?: number;
  heteronyms?: {
    bopomofo?: string;
    definitions?: { def?: string; example?: string[]; type?: string }[];
  }[];
}

interface CedictRaw {
  translation?: { English?: string[] };
}

interface WordsRaw {
  words?: string[];
}

const memory = new Map<string, CharGlossData>();
const wordSenses = new Map<string, CharSense[]>();
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DICT_CACHE_DB, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'char' });
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

async function readCached(ch: string): Promise<CharGlossData | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(ch);
      req.onsuccess = () => resolve((req.result as CharGlossData) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function writeCached(gloss: CharGlossData): Promise<void> {
  memory.set(gloss.char, gloss);
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(gloss);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function getJson<T>(url: string, timeoutMs = 6000): Promise<T | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** 姓氏、人名、地名、譯音那幾條對小學生沒用。 */
const SKIP_DEF = /^(姓|人名|地名|國名|山名|水名|譯音|二一四部首之一)/;

function tidyDef(text: string): string {
  const one = text.replace(/\s+/g, '');
  if (!one) return '';
  return one.length > MAX_DEF_LEN ? `${one.slice(0, MAX_DEF_LEN)}…` : one;
}

function tidyExample(text: string): string {
  return text.replace(/\s+/g, '').replace(/^如[：:]/, '');
}

/**
 * 只留「詞的例子」那種例句。
 * 辭典的 example 偶爾放整句古語（人：「己所不欲，勿施於人。」），
 * 給小學生看例詞就夠了。
 */
function isWordExample(line: string): boolean {
  const quoted = [...line.matchAll(QUOTED_ANY)].map((m) => m[1]);
  if (!quoted.length) return false;
  return quoted.every((word) => word.length <= 5);
}

function parseSenses(raw: UniRaw, limit = MAX_SENSES): CharSense[] {
  const senses: CharSense[] = [];
  for (const heteronym of raw.heteronyms ?? []) {
    for (const item of heteronym.definitions ?? []) {
      const def = tidyDef(item.def ?? '');
      if (!def || SKIP_DEF.test(def)) continue;
      senses.push({
        type: item.type,
        def,
        examples: (item.example ?? []).map(tidyExample).filter(isWordExample),
      });
      if (senses.length >= limit) return senses;
    }
  }
  return senses;
}

const QUOTED = /「([^」]{2,4})」/g;
const QUOTED_ANY = /「([^」]+)」/g;
const MAX_WORD_LEN = 4;

function isTeachableWord(word: string, ch: string): boolean {
  if (word.length < 2 || word.length > MAX_WORD_LEN || !word.includes(ch)) return false;
  return [...word].every((c) => isHkChar(c));
}

let primary: Set<string> | null = null;

/**
 * 詞目索引是照筆畫排的，沒有詞頻，「進尺」「水厄」這種也在裡面。
 * 補進來的詞要求每個字都在小學字包裡，才不會給學生看沒學過的詞。
 */
function isCommonWord(word: string, ch: string): boolean {
  if (!isTeachableWord(word, ch)) return false;
  if (!primary) primary = new Set(bundledChars());
  return [...word].every((c) => c === ch || primary!.has(c));
}

/**
 * 例詞是辭典自己給的搭配，最準，所以掃過每一條釋義（不只顯示的那三條）。
 * 「進」這樣就有前進、進攻、進門、引進、進貢、進取、進帳、進貨。
 */
function wordsFromExamples(ch: string, raw: UniRaw): string[] {
  const out: string[] = [];
  for (const heteronym of raw.heteronyms ?? []) {
    for (const item of heteronym.definitions ?? []) {
      for (const line of item.example ?? []) {
        for (const match of line.matchAll(QUOTED)) {
          const word = match[1];
          if (isTeachableWord(word, ch)) out.push(word);
        }
      }
    }
  }
  return out;
}

function dedupe(words: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const word of words) {
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
  }
  return out;
}

function isFresh(gloss: CharGlossData): boolean {
  return Date.now() - gloss.fetchedAt < MAX_AGE;
}

/**
 * 一個字的注音、釋義、組詞、英文。
 * 取不到就回 null（卡片整張不顯示）；有舊快取時寧可用舊的。
 */
export async function loadGloss(ch: string): Promise<CharGlossData | null> {
  const hit = memory.get(ch);
  if (hit && isFresh(hit)) return hit;

  const stored = await readCached(ch);
  if (stored) {
    memory.set(ch, stored);
    if (isFresh(stored)) return stored;
  }

  const [uni, cedict] = await Promise.all([getJson<UniRaw>(UNI(ch)), getJson<CedictRaw>(CEDICT(ch))]);
  if (!uni) return stored ?? null;

  const senses = parseSenses(uni);
  let words = dedupe(wordsFromExamples(ch, uni));
  if (words.length < 4) {
    const extra = await getJson<WordsRaw>(WORDS_API(ch, MAX_WORDS));
    const more = (extra?.words ?? []).filter((word) => isCommonWord(word, ch));
    words = dedupe([...words, ...more]);
  }

  const gloss: CharGlossData = {
    char: ch,
    bopomofo: dedupe((uni.heteronyms ?? []).map((h) => h.bopomofo ?? '').filter(Boolean)),
    radical: uni.radical,
    strokeCount: uni.stroke_count,
    senses,
    words: words.slice(0, MAX_WORDS),
    english: (cedict?.translation?.English ?? []).slice(0, MAX_ENGLISH),
    fetchedAt: Date.now(),
  };
  if (!gloss.senses.length && !gloss.words.length) return stored ?? null;
  await writeCached(gloss);
  return gloss;
}

/** 點開某個組詞時的詞義，最多兩條。 */
export async function loadWordGloss(word: string): Promise<CharSense[] | null> {
  const hit = wordSenses.get(word);
  if (hit) return hit;
  const raw = await getJson<UniRaw>(UNI(word));
  if (!raw) return null;
  const senses = parseSenses(raw).slice(0, 2);
  wordSenses.set(word, senses);
  return senses;
}

/**
 * 顯示用的排序：學生正在學的字組成的詞排前面，
 * 再來是以這個字開頭的詞、兩個字的詞。
 */
export function rankWords(words: string[], ch: string, familiar: Set<string>): string[] {
  if (!primary) primary = new Set(bundledChars());
  const known = (c: string) => c === ch || familiar.has(c) || primary!.has(c);
  const score = (word: string) => {
    let n = 0;
    if ([...word].every((c) => c === ch || familiar.has(c))) n -= 5;
    if (word.startsWith(ch)) n -= 2;
    if (word.length === 2) n -= 2;
    else if (word.length === 3) n -= 1;
    // 有沒學過的字（例詞裡偶爾出現「撈油水」這種）就排到最後
    if ([...word].some((c) => !known(c))) n += 6;
    return n;
  };
  return words
    .map((word, i) => ({ word, i, score: score(word) }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((item) => item.word);
}
