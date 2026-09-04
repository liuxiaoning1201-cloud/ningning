# 字遊空間 → qingyiu.com 域名遷移

正式網址：**https://qingyiu.com**（請一律使用 HTTPS，勿用 `http://`）

站點仍部署在同一個 Cloudflare Pages 專案 `zykongjian`（專案名可不改，僅新增自訂網域）。

## 一、Cloudflare：綁定新域名

1. 登入 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Workers & Pages** → 專案 **zykongjian** → **Custom domains**
3. 點 **Set up a custom domain**，依序加入：
   - `qingyiu.com`
   - `www.qingyiu.com`（建議一併加，並在 DNS 設 www 轉到根域或同站）
4. 若域名尚未在 Cloudflare：
   - 在 **Websites** → **Add a site** 把 `qingyiu.com` 加進帳號
   - 到域名註冊商把 **Nameserver** 改成 Cloudflare 提供的那兩組
5. 等 DNS 生效（通常數分鐘～數小時），Custom domains 狀態變為 **Active**

### DNS 記錄（由 Pages 自動提示時照做即可）

| 類型 | 名稱 | 內容 |
|------|------|------|
| CNAME | `qingyiu.com` 或 `@` | `zykongjian.pages.dev`（以 Console 顯示為準） |
| CNAME | `www` | `zykongjian.pages.dev` 或根域 |

> 根域若不能用 CNAME，Cloudflare 會改用 **CNAME flattening** 或給你 A/AAAA 記錄，以畫面為準。

## 二、部署最新程式碼

程式已將 API、擴展、前端預設網域改為 `qingyiu.com`。推送 `main` 或本地執行：

```bash
npm run pages:deploy
```

## 三、Google 登入（必做）

見 [Google-OAuth-來源設定.md](./Google-OAuth-來源設定.md)。至少加入：

- `https://qingyiu.com`
- `https://www.qingyiu.com`

舊網域 `zykongjian.com` / `zykongjian.pages.dev` 可暫時保留，方便過渡。

## 四、Cloudflare Turnstile（若有開人機驗證）

1. [Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile) → 你的 Widget
2. **Hostname** 增加 `qingyiu.com`、`www.qingyiu.com`
3. 無需改 `TURNSTILE_SECRET`，除非新建了 Widget

## 五、舊域名 zykongjian.com（可選）

過渡期建議：

1. **Custom domains** 裡保留 `zykongjian.com`，不要立刻刪
2. 在 Cloudflare **Rules** → **Redirect Rules** 新增：
   - `zykongjian.com/*` → `https://qingyiu.com/$1`（301）
   - `www.zykongjian.com/*` → `https://qingyiu.com/$1`（301）

通知師生改用新網址；切換後需在新域名 **重新 Google 登入**（Cookie 按主機名隔離）。

## 六、驗收清單

- [ ] https://qingyiu.com 首頁（清沂遊）可開
- [ ] https://qingyiu.com/yueyu 粵語學習可開
- [ ] Google 登入成功
- [ ] 填字接龍 `/crossword`、班級守護隊等子應用資源無 404
- [ ] 瀏覽器擴展重新載入後，翻譯 / 生詞本 API 正常
- [ ] （可選）舊域名 301 到新域名

## 七、無需改動的部分

- Cloudflare Pages **專案名** `zykongjian`
- D1 / KV **binding** 名稱
- 手機 App 的 Bundle ID `com.zykongjian.yueyu`（與網域無關）
- `wrangler pages secret put ... --project-name zykongjian` 仍用原專案名
