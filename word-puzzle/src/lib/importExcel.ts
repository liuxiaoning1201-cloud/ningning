/**
 * 解析 Excel 或 CSV，產出詞條陣列。
 * 約定：第一欄詞句（必填）、第二欄釋義、第三欄出處、第四欄難度 1–5
 */
export interface ImportRow {
  text: string;
  definition?: string;
  source?: string;
  difficulty?: number;
}

export async function parseExcelOrCsv(file: File): Promise<ImportRow[]> {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".csv")) {
    return parseCsv(file);
  }
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    return parseExcel(file);
  }
  return [];
}

function parseCsv(file: File): Promise<ImportRow[]> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = (reader.result as string)?.replace(/\r\n/g, "\n").replace(/\r/g, "\n") ?? "";
      const rows: ImportRow[] = [];
      const lines = text.split("\n");
      for (const line of lines) {
        const parts = line.split(",").map((s) => s.trim());
        const textVal = parts[0]?.trim();
        if (!textVal) continue;
        const def = parts[1]?.trim() ?? "";
        const source = parts[2]?.trim() ?? "";
        const diff = parts[3]?.trim();
        const difficulty = diff ? parseInt(diff, 10) : 1;
        rows.push({
          text: textVal,
          definition: def || undefined,
          source: source || undefined,
          difficulty: Number.isNaN(difficulty) ? 1 : Math.min(5, Math.max(1, difficulty)),
        });
      }
      resolve(rows);
    };
    reader.readAsText(file, "UTF-8");
  });
}

async function parseExcel(file: File): Promise<ImportRow[]> {
  const XLSX = await import("xlsx");
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  if (!firstSheet) return [];
  const rows = XLSX.utils.sheet_to_json<string[]>(firstSheet, { header: 1, defval: "" }) as string[][];
  const result: ImportRow[] = [];
  for (const row of rows) {
    const textVal = (row[0] != null ? String(row[0]) : "").trim();
    if (!textVal) continue;
    const def = (row[1] != null ? String(row[1]) : "").trim();
    const source = (row[2] != null ? String(row[2]) : "").trim();
    const diff = row[3] != null ? parseInt(String(row[3]), 10) : 1;
    const difficulty = Number.isNaN(diff) ? 1 : Math.min(5, Math.max(1, diff));
    result.push({
      text: textVal,
      definition: def || undefined,
      source: source || undefined,
      difficulty,
    });
  }
  return result;
}
