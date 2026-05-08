# 字字珠璣 · 中文連字棋

> 把五子棋與中文教學結合的可組合棋類遊戲。

針對小學生的中文學習工具，**五子棋只是其中一種規則組合**。本 App 把規則
拆成「內容形態 × 連線長度 × 勝負類型」三個正交維度，老師可任意組合，
為不同年級、不同教學目標選擇最適合的玩法。

## 內建 6 個課堂模板

| 模板 | 內容 | 連線長度 | 勝負 | 推薦年級 |
|---|---|---|---|---|
| 📜 成語搶答 | 成語 | 4 | 拼出整條成語勝 | 3–6 |
| 🎯 答題五子 | 自由 | 5 | 先 5 連勝 | 1–6 |
| 🌙 五言詩接龍 | 五言詩 | 5 | 拼出完整詩句勝 | 3–6 |
| 🍃 七言詩接龍 | 七言詩 | 7 | 拼出完整詩句勝 | 5–6 |
| 💬 句子接龍 | 句子 | 動態 | 拼出完整句勝 | 3–6 |
| ⚡ 連得多者勝 | 自由 | 5 | 5 分鐘內 N 連多者勝 | 3–6 |

## 技術棧

- Vue 3 + TypeScript + Vite + Pinia + vue-router
- 後端：[`workers/zizi-zhuji/`](../../workers/zizi-zhuji/) Cloudflare Worker + Durable Object
  - 房間用 6 位 joinCode 識別，與「中文填字接龍」習慣一致
  - WebSocket 即時同步，落子權威驗證

## 開發

```bash
npm install
npm run dev      # 前端 :5176

# 後端（另開一個 terminal）
cd ../../workers/zizi-zhuji
npm install
npm run dev      # Worker 預設 :8787
```

第一次進入「設定」(右下角) 將 API 設為 `http://localhost:8787` 即可遠程對戰。

## 建置

```bash
npm run build
```

由根目錄 `scripts/build.mjs` 統一建置時，會輸出到 `dist/zizi/`，並由 `wrangler.jsonc` 部署至 Cloudflare Pages。

## 規則三維度

```
GameRule = {
  content:     "free" | "char" | "word" | "idiom" | "poem-5" | "poem-7" | "sentence"
  lineLength:  number | "match-content"
  win:
    | { kind: "first";    n: number }
    | { kind: "count";    durationSec, lineLength }
    | { kind: "complete"; targetType: ContentType }
  placement:
    | { kind: "free" }
    | { kind: "qa"; difficulty: 1..5 }
}
```

老師可在「教師後台」自訂任意組合，存為新模板。

## 詞庫共用

沿用 [`apps/中文填字接龍`](../中文填字接龍/) 的 `WordBankItem` 格式，
之後若要 monorepo 共用，可抽出 `packages/chinese-wordbank/` 子包。
