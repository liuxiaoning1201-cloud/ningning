# word-puzzle-api

Cloudflare Workers + D1 + Durable Objects 後端。

## 環境需求

- Node.js 20+（專案內有 `.nvmrc`，使用 nvm/fnm 時可執行 `fnm use` 或 `nvm use`）

## 安裝與開發

```bash
npm install
npm run dev          # 本地開發
npm run deploy       # 部署到 Cloudflare
npm run db:migrate   # 對 D1 執行 schema.sql
```

## 部署前設定

1. **登入 Cloudflare**（若尚未登入）  
   ```bash
   npx wrangler login
   ```

2. **設定 D1 資料庫**  
   編輯 `wrangler.toml`，將 `[[d1_databases]]` 的 `database_id` 改為你在 Cloudflare 建立的 D1 資料庫 ID。  
   建立資料庫：  
   ```bash
   npx wrangler d1 create word-puzzle-db
   ```  
   建立後會得到 `database_id`，貼回 `wrangler.toml` 即可。

## 常用指令

| 指令 | 說明 |
|------|------|
| `npx wrangler dev` | 本地開發伺服器 |
| `npx wrangler deploy` | 部署 |
| `npx wrangler d1 list` | 列出 D1 資料庫 |
| `npx wrangler whoami` | 檢查登入狀態 |
