# 字字珠璣（Worker）

「字字珠璣」中文連字棋遠程對戰後端：以 Durable Object 維護房間狀態，
WebSocket 同步即時對局，支援 6 個內建模板（成語搶答 / 答題五子 /
五言詩接龍 / 七言詩接龍 / 句子接龍 / 連得多者勝），並可由教師自訂規則。

## 端點

- `POST /api/rooms` 建立房間，body：`{ template, customRule?, hostName, hostId? }`，回傳 `{ roomId, joinCode }`。
- `GET  /api/rooms/:code` 以 6 位 joinCode 查房間摘要。
- `GET  /ws?room=<roomId>&playerId=<id>&name=<name>` WebSocket 進房。

## DO 內部協議（WebSocket）

客戶端 → 伺服器：

- `{ type: "ready" }` 表態準備就緒
- `{ type: "place", r, c, qaAnswer? }` 嘗試落子（若 placement.qa，需提交 qaAnswer）
- `{ type: "declare-complete", lineCells: [{r,c}], targetText }` complete 模式宣告（含主題/句子/詩句）
- `{ type: "challenge" }` 質疑對手宣告
- `{ type: "draw-question" }` 抽答題卡（QA 模式）
- `{ type: "rematch" }` 對局結束後再來一局
- `{ type: "leave" }` 主動離開

伺服器 → 客戶端：

- `{ type: "snapshot", state }` 完整狀態快照（加入/重連必發）
- `{ type: "player-joined" | "player-left", players }` 成員變化
- `{ type: "turn", currentTurn, deadline? }` 輪次切換
- `{ type: "placed", r, c, by, ch?, scoreDelta }` 落子廣播
- `{ type: "question", question }` 私發題卡（僅當前回合玩家）
- `{ type: "complete-pending", lineCells, targetText, by }` 等待對方質疑
- `{ type: "win", winner, line, reason }` 對局結束
- `{ type: "error", message }`

## 部署

```bash
npm install
npx wrangler deploy --config ./wrangler.toml
```

部署後將 `https://zizi-zhuji.<account>.workers.dev` 設定為前端 `VITE_ZIZI_API`。
