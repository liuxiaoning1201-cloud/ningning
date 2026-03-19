# 遠程對戰 API 配置說明

## 零、自帶後端（本專案 server）

專案內含 **Node 後端**（`server/`），可本地或部署後當作遠程對戰 API 使用：

1. **安裝並啟動**  
   ```bash
   cd 中文填字接龍/server
   npm install
   npm run dev
   ```
   預設：http://localhost:3000

2. **設定 API 金鑰（選填）**  
   在 `server/` 下複製 `.env.example` 為 `.env`，設定 `API_KEY=sk-您提供的金鑰`。  
   目前後端僅讀取此變數備用（例如日後 AI 提示功能），不會對外發送。

3. **前端連到後端**  
   在「設定 → 遠程對戰 API」輸入 `http://localhost:3000`（或部署後的網址）並儲存，再使用「遠程對戰」的示範登入即可。

---

## 一、在哪裡設定

1. **設定頁**：進入「設定」→ 在「遠程對戰 API」區塊輸入後端網址 → 點「儲存」。會寫入瀏覽器 localStorage，僅影響目前裝置。
2. **環境變數**：在專案根目錄建立 `.env`（可複製 `.env.example` 並改名），填入 `VITE_API_URL` 後執行 `npm run build`，建置出的前端會預設使用該網址。

## 二、環境變數範例

複製 `.env.example` 為 `.env` 後編輯：

```env
# 遠程對戰後端 API 網址
VITE_API_URL=https://your-api.example.com

# Google 登入（後端有 /auth/google 時才需要）
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

- **VITE_API_URL**：後端根網址，不要結尾斜線。例如 `https://api.myapp.com`。  
  前端會請求：`{VITE_API_URL}/auth/google`、`{VITE_API_URL}/api/rooms`、`{VITE_API_URL}/api/classes` 等，以及 WebSocket `ws(s)://同主機/ws/room/:roomId`。
- **VITE_GOOGLE_CLIENT_ID**：若後端提供 Google 登入，在此填 Google OAuth 網頁應用程式用戶端 ID。

## 三、行為說明

- **未設定 API URL**：遠程對戰使用「示範模式」，班級、小組、房間、場次皆為本機模擬（localStorage），無需後端即可操作完整流程。
- **已設定 API URL**：前端會改打真實後端；後端需實作說明書中的 REST 與 WebSocket 規格（見 `遠程對戰說明書.md`）。

## 四、後端需提供的介面（參考）

與前端對接時，後端通常需提供：

- **登入**：`POST /auth/google`（body: `{ credential }`），回傳 `{ token, user }`。
- **班級／小組**：例如 `POST /api/classes`、`GET /api/classes/:code`、`POST /api/classes/:id/join`、`POST /api/classes/:classId/groups`、`GET /api/me/class-and-groups` 等（實際路徑以實作為準）。
- **房間**：`POST /api/rooms`（建立）、`GET /api/rooms/:id`、WebSocket `/ws/room/:roomId`（查詢參數帶 userId、name）。
- **場次**：例如 `POST /api/sessions`、`GET /api/sessions/:id`、`POST /api/sessions/:id/join` 等。

詳細請見 `遠程對戰說明書.md` 第七、十二章。
