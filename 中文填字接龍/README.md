# 中文填字接龍 · 詞語練習

Vue 3 填字接龍遊戲，支援中文字詞、成語與語句（如論語）練習，對齊「論語填字接龍卡」格式。

## 技術棧

- Vue 3 (Composition API) + TypeScript + Vite
- Vue Router 4、Pinia
- Excel/CSV 匯入（xlsx、papaparse）
- 選配：Supabase（遠程對戰、學校郵箱登入）

## 使用方式

```bash
npm install
npm run dev
```

瀏覽器開啟 http://localhost:5174（或終端顯示的網址）。建置產物：

```bash
npm run build
npm run preview
```

## 功能

- **首頁**：教師後台、開始練習、遠程對戰入口。
- **教師後台**
  - 詞句庫：新增/編輯、**Excel 或 CSV 匯入**（詞句、釋義、出處、難度 1–5）。
  - 題組列表：新建填字接龍、從詞句庫選擇難度檔（初學/小試/漸入佳境）**自動排版**產生橫豎交叉題、匯出 JSON。
- **開始練習**
  - 遊戲設定：難度篩選、是否顯示提示。
  - 選題後可「練習」或「本地對戰」（同機雙人輪流填格計分）。
- **遠程對戰**：設定 Supabase 後可登入學校郵箱，班級與房間功能需後端表建立後開放。

資料存於瀏覽器本地（localStorage）；題組可匯出/匯入 JSON 分享。

## 遠程對戰（選配）

在專案根目錄建立 `.env`：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

並安裝依賴（已含 `@supabase/supabase-js`）。遠程對戰頁面會顯示登入與班級說明。

## 參考格式

- 關卡與難度：關卡標題（如「第一關：初學入門」）、難度星級、出處（如《為政》）。
- 網格：橫排（A, B, C…）與豎排（一、二、三…）；格子分為「提示字（已填）」與「待填空格」。
- 提示：橫向/豎向提示含詞句與出處。
