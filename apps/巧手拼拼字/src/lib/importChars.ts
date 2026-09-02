import { isHkChar } from '@/lib/charData';

const HAN = /\p{Script=Han}/u;

export function extractHan(text: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const ch of text) {
    if (!HAN.test(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

export function keepHkChars(chars: string[]): { accepted: string[]; rejected: string[] } {
  const accepted: string[] = [];
  const rejected: string[] = [];
  for (const ch of chars) {
    if (isHkChar(ch)) accepted.push(ch);
    else rejected.push(ch);
  }
  return { accepted, rejected };
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
}

async function inflateRaw(bytes: Uint8Array): Promise<string> {
  const copy = bytes.slice().buffer;
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new TextDecoder('utf-8').decode(await new Response(stream).arrayBuffer());
}

/** 只解我們要的那一個檔，給 .docx / .xlsx 用。 */
async function zipFile(buffer: ArrayBuffer, wanted: string): Promise<string | null> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = buffer.byteLength - 22;
  while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  if (eocd < 0) return null;

  const count = view.getUint16(eocd + 8, true);
  let cd = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let i = 0; i < count; i += 1) {
    const nameLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOff = view.getUint32(cd + 42, true);
    const name = decoder.decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    if (name === wanted) {
      const method = view.getUint16(localOff + 8, true);
      const ln = view.getUint16(localOff + 26, true);
      const le = view.getUint16(localOff + 28, true);
      const csize = view.getUint32(localOff + 18, true);
      const start = localOff + 30 + ln + le;
      const blob = bytes.subarray(start, start + csize);
      if (method === 0) return decoder.decode(blob);
      if (method === 8) return inflateRaw(blob);
      return null;
    }
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

interface WordbookLike {
  name?: string;
  chars?: unknown;
}

export interface ParsedImport {
  /** 若檔案本身就是字簿清單，就整本匯入 */
  books?: { name: string; chars: string[] }[];
  /** 單一份生字表 */
  chars: string[];
  suggestedName?: string;
}

function fromJson(text: string): ParsedImport {
  const parsed = JSON.parse(text) as { books?: WordbookLike[]; chars?: unknown; name?: string } | string[];
  if (Array.isArray(parsed)) {
    const chars = parsed.flatMap((v) => (typeof v === 'string' ? extractHan(v) : []));
    return { chars };
  }
  if (parsed && Array.isArray(parsed.books)) {
    const books = parsed.books
      .filter((b) => typeof b?.name === 'string')
      .map((b) => ({
        name: b.name as string,
        chars: extractHan(Array.isArray(b.chars) ? b.chars.join('') : String(b.chars ?? '')),
      }));
    return { books, chars: books.flatMap((b) => b.chars) };
  }
  const raw = parsed.chars;
  const chars = extractHan(Array.isArray(raw) ? raw.join('') : String(raw ?? text));
  return { chars, suggestedName: typeof parsed.name === 'string' ? parsed.name : undefined };
}

async function fromDocx(buffer: ArrayBuffer): Promise<string> {
  const xml = await zipFile(buffer, 'word/document.xml');
  if (!xml) throw new Error('讀不到 Word 內容，請另存成 .docx 或 .txt');
  return stripTags(xml);
}

async function fromXlsx(buffer: ArrayBuffer): Promise<string> {
  const xml = (await zipFile(buffer, 'xl/sharedStrings.xml')) ?? (await zipFile(buffer, 'xl/worksheets/sheet1.xml'));
  if (!xml) throw new Error('讀不到試算表內容，請另存成 CSV 或 TXT');
  return stripTags(xml);
}

/**
 * 從老師丟進來的檔案抽出漢字。
 * 支援 JSON 字簿、純文字、CSV、網頁、Word（.docx）、Excel（.xlsx）。
 */
export async function parseImportFile(file: File): Promise<ParsedImport> {
  const name = file.name.replace(/\.[^.]+$/, '');
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (ext === 'docx') {
    return { chars: extractHan(await fromDocx(await file.arrayBuffer())), suggestedName: name };
  }
  if (ext === 'xlsx' || ext === 'xlsm') {
    return { chars: extractHan(await fromXlsx(await file.arrayBuffer())), suggestedName: name };
  }

  const text = await file.text();
  if (ext === 'json') {
    const parsed = fromJson(text);
    return { ...parsed, suggestedName: parsed.suggestedName ?? name };
  }
  return { chars: extractHan(ext === 'html' || ext === 'htm' ? stripTags(text) : text), suggestedName: name };
}
