# Google 登入錯誤：400 origin_mismatch（存取權遭封鎖）

代表「你現在開網站的網址」沒有在 Google Cloud 的 OAuth 用戶端裡登記為 **已授權的 JavaScript 來源**。

## 請在 Google Cloud Console 加入這些來源

1. 開啟 [Google Cloud Console → API 和服務 → 憑證](https://console.cloud.google.com/apis/credentials)
2. 點你的 **OAuth 2.0 用戶端 ID**（網頁應用程式類型）
3. 在 **已授權的 JavaScript 來源** 按 **新增 URI**，逐一加入（**不要**加路徑，不要加結尾斜線）：

| 請加入的 URI | 說明 |
|-------------|------|
| `https://zykongjian.pages.dev` | 正式站（字遊空間） |
| `https://www.zykongjian.pages.dev` | 若你曾用 www 開站（可選） |

若你還會用 **預覽網址**（每次部署不同子網域），Google **不支援**萬用字元 `*.pages.dev`，預覽網址需**每次**把完整網址加進去，例如：

- `https://04846793.zykongjian.pages.dev`

**本機開發**（可選）：

- `http://localhost:5173`
- `http://127.0.0.1:5173`

4. **儲存**，等待約 **1～5 分鐘** 後再試登入。

## 錯誤：401 deleted_client（OAuth client was deleted）

代表瀏覽器仍在使用 **已在 Google Cloud 刪除** 的舊「用戶端 ID」。

請檢查：

1. **Cloudflare Pages** → 專案 → **Settings** → **Environment variables**（建置變數）  
   若有 **`VITE_GOOGLE_CLIENT_ID`** 且仍是舊 ID → **刪除**或改成**目前**憑證頁上的新用戶端 ID，然後 **重新部署**。  
   （舊 ID 會被打進前端 JS，即使用戶端已刪除也會一直報錯。）
2. **Secrets** 裡的 **`GOOGLE_CLIENT_ID`** 必須與 Google Console **正在使用** 的那個用戶端 ID 一致。
3. 改完後請 **強制重新整理**（Ctrl+Shift+R / Cmd+Shift+R）或清除快取。

專案已改為：未設定 `VITE_GOOGLE_CLIENT_ID` 時，會向 **`/auth/config`** 取得 ID（與後端 Secret 一致），可避免打包進舊 ID。

## 常見錯誤

- 只加了 `http` 但網站是 `https` → 要改成 `https://...`
- 加了完整路徑如 `https://zykongjian.pages.dev/crossword` → **錯誤**，只要來源：`https://zykongjian.pages.dev`
- 舊專案網域是 `ziyoukongjian.pages.dev` 但現在用 `zykongjian.pages.dev` → **兩個都要各加一筆**（若仍會開舊網址）

## 已授權的重新導向 URI

若 Console 也有「已授權的重新導向 URI」，使用 **Google Identity Services（彈出式 / 按鈕登入）** 時，通常**不必**為此流程填重新導向；若被要求，可加上：

- `https://zykongjian.pages.dev`

（仍以 Console 畫面提示為準。）
