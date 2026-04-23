# 捏水果學中文

課堂用手勢（拇指＋食指捏合）對準掉落的水果，捏爆後朗讀詞語；支援教師自訂詞表（CSV／Excel／貼上），普通話／粵語朗讀走 Cloudflare Worker 代理的**訊飛語音**（未配置時自動改用瀏覽器語音備援）。

## 本地開發

需要**同時**跑前端與 Worker（API／WebSocket）：

```bash
# 終端 1 — Worker（預設 http://127.0.0.1:8787）
cd workers/fruit-cn-game && npm install && npx wrangler dev

# 終端 2 — Vite（會把 /api、/ws 代理到 8787）
cd apps/手勢切水果學中文 && npm install && npm run dev
```

瀏覽器開發站（通常為 `http://localhost:5173`）。請使用 **HTTPS 或 localhost** 才能開鏡頭。

### 訊飛鑰匙（選填）

在 `workers/fruit-cn-game/` 建立 `.dev.vars`（勿提交 Git）：

```
IFLYTEK_APP_ID=你的AppID
IFLYTEK_API_KEY=你的ApiKey
IFLYTEK_API_SECRET=你的ApiSecret
```

可選發音人（視控制台已開通的音庫為準）：

```
IFLYTEK_VCN_MANDARIN=xiaoyan
IFLYTEK_VCN_CANTONESE=（粵語發音人 vcn，須自行在控制台確認）
```

## 建置

```bash
cd apps/手勢切水果學中文 && npm run build
```

產物在 `dist/`。部署到 Cloudflare Pages 時，將 **Worker 網址**綁在同一網域或設定 `VITE_BASE_PATH`／反向代理，使前端能請求 **`/api/tts`**、**`/api/create-room`**、**`/ws`**。

## 技術說明

- MediaPipe Hands：經 CDN 載入全域 `Hands`（見 `index.html`），見官方方案限制。
- 詞表存放在瀏覽器 `localStorage`。
