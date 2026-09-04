import * as XLSX from "xlsx";

export const STORAGE_KEY_TEXT = "train-sort-bank-text";

export const DEMO_BANK = `春天來了/花兒/開了
小青蛙/跳進/池塘裡
我們/在教室裡/認真/讀書
秋天/的/葉子/黃了`;

/** 將多行文字解析為多關卡，每行用 / 分詞 */
export function parseSlashBank(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean)
    )
    .filter((words) => words.length >= 2);
}

/** Excel：每一列為一關，由左至右每格一詞；若整列只有一格且含 /，則再分詞 */
export async function parseExcelBank(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];

  const levels: string[][] = [];
  for (const row of rows) {
    if (!row || !row.length) continue;
    const cells = row
      .map((c) => String(c ?? "").trim())
      .filter((c) => c.length > 0);
    if (!cells.length) continue;
    if (cells.length === 1 && cells[0].includes("/")) {
      const parts = cells[0]
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean);
      if (parts.length >= 2) levels.push(parts);
    } else if (cells.length >= 2) {
      levels.push(cells);
    }
  }
  return levels;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
