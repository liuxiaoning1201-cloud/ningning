# fruit-cn-game（Worker）

提供：

- `POST /api/tts` — 代理訊飛流式語音合成 WebSocket，回傳 **MP3**。
- `POST /api/create-room` — 建立多人房間（詞包 JSON 存入 Durable Object）。
- `GET /api/room-info?id=` — 房間摘要。
- `GET /ws?room=ROOMID` — WebSocket，訊息見下方。

## Secrets（生產環境）

```bash
wrangler secret put IFLYTEK_APP_ID
wrangler secret put IFLYTEK_API_KEY
wrangler secret put IFLYTEK_API_SECRET
```

本地開發使用專案目錄下的 `.dev.vars`（同上鍵名）。

## WebSocket 協議（簡化版）

客戶端 → 伺服器：

- `{ "type": "join", "playerId": "...", "name": "..." }`
- `{ "type": "score", "delta": number }`（伺服器會節流）

伺服器 → 客戶端：

- `{ "type": "joined", "playerId": "...", "words": [...] | null }`
- `{ "type": "state", "players": { ... } }`
- `{ "type": "score", "playerId": "...", "score": number, "players": { ... } }`

## 部署

```bash
npm install
# 與 Pages 專案同倉庫時請指定設定檔，避免讀到上層 wrangler.jsonc：
npx wrangler deploy --config ./wrangler.toml
```

部署後將 Worker 路由綁到與前端相同的 origin（或 Pages Functions 反代），以便瀏覽器同源呼叫 `/api/*` 與 `/ws`。
