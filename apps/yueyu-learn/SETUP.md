# 粵語學習插件 — API 加密配置完整指南（小白版）

> 假設您完全沒接觸過 Cloudflare、wrangler、命令列。我會把每一步拆到「不可能再小」。
>
> 跟著做下來大約 30–60 分鐘，最終結果：
> 1. 您的 DeepSeek API Key 安全存放在雲端的「保險箱」裡，永遠不會洩漏給任何人（包括我這個 AI）。
> 2. 網頁、Chrome 擴展、手機 APP 都能調用這套 API。
> 3. **以後您寫的任何軟件**（命令列腳本、自寫 APP、第三方插件）都能拿一把「個人 API Key」來調用同一套 API。

---

## 一、先理解「後端在哪」

您之前部署的網站 `zykongjian.com` 是放在 **Cloudflare Pages** 上面。Cloudflare 是一家美國的雲服務商（類似阿里雲、騰訊雲），它免費送您：

| 資源 | 用途 | 在哪查看 |
| --- | --- | --- |
| **Pages**（網頁部署） | 跑您的網站 | [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages |
| **Pages Functions**（後端） | 跑 `/api/...` 接口 | 同上，跟 Pages 在一起 |
| **D1**（資料庫） | 存生詞本、API Keys 等 | Workers & Pages → D1 |
| **KV**（鍵值庫） | 存翻譯緩存、限流計數器 | Workers & Pages → KV |
| **R2**（檔案存儲） | 存 TTS 生成的音頻 | R2 |
| **Workers AI**（AI 模型） | 截圖 OCR | AI |
| **Secrets**（密鑰保險箱） | 存 DeepSeek、Azure 等 API Key | Pages 項目 → Settings → Environment variables |

> 簡單講：「後端」= 您的 zykongjian.com 加上一堆 `/api/cantonese/*` 接口，全都跑在 Cloudflare 機房裡。
>
> 您要做的只是「**告訴 Cloudflare 我有哪些 Key**」，從此這些 Key 只有 Cloudflare 自己看得到。

---

## 二、準備工具（一次性，10 分鐘）

### 2.1 確認您能登入 Cloudflare

打開 [dash.cloudflare.com](https://dash.cloudflare.com) 用您部署 `zykongjian.com` 時的同一個帳號登入。
左側菜單看到 **Workers & Pages**，點進去能看到 `zykongjian` 項目，就成功了。

### 2.2 確認電腦裝了 Node.js

打開「終端」（Mac：⌘+空格 搜「Terminal」；Windows：開始菜單搜「PowerShell」）：

```bash
node -v
```

看到 `v20.x.x` 或更高就 OK。看不到就去 [nodejs.org](https://nodejs.org) 下載「LTS 版」安裝。

### 2.3 進入專案目錄

```bash
cd /Users/liuxiaoning/Documents/ningning
```

之後所有命令都在這個目錄下執行。

### 2.4 用 wrangler 登入 Cloudflare

`wrangler` 是 Cloudflare 官方的命令列工具。先登入：

```bash
npx wrangler login
```

會自動打開瀏覽器，點 **Allow**。終端出現 `Successfully logged in.` 即成功。

> ⚠️ 如果系統說 `npx 不存在`，先執行 `npm install -g wrangler@latest`，再用 `wrangler login`。

---

## 三、申請 DeepSeek API Key（5 分鐘）

1. 訪問 <https://platform.deepseek.com>
2. 用您的郵箱註冊或登入
3. 左側菜單 **API Keys** → **Create new API Key**
4. 名稱填 `yueyu-learn`，**創建後立即複製出現的 sk-xxxx 字串**（只顯示一次！）
5. **記到您本人的密碼管理器**（1Password / Bitwarden / Apple 鑰匙串），千萬不要丟在 微信/QQ/郵箱

> ⚠️ **絕對不要把這個 sk-xxxx 貼進任何聊天視窗給任何人**（包括給我這個 AI 看）。
> 一旦貼出去就要立刻去 DeepSeek 後台 **Revoke** 並重新生成。

順便去 **Billing** 頁面儲值 ¥10–50，並設置「**單月支出告警**」（建議設 ¥30）。
這樣即使有人偷偷用您的 Key，最壞情況也只損失幾十塊就會被告警停用。

---

## 四、把 Key 鎖進 Cloudflare 保險箱（最關鍵的一步）

這個命令的意思是：「Cloudflare 我給你一個密鑰，名字叫 `DEEPSEEK_API_KEY`，請你存起來，**只有跑後端代碼時才能讀取**。」

```bash
npx wrangler pages secret put DEEPSEEK_API_KEY --project-name zykongjian
```

執行後會看到：

```text
✔ Enter a secret value: ***************
```

這時您把 DeepSeek 給的 `sk-xxxx` **整段貼進去**（在某些終端不會回顯星號或字符，這是正常的，**不要因為看不見就以為沒輸入**），然後按 Enter。

成功後看到：

```text
🌀 Creating the secret for the Pages project "zykongjian"
✨ Success! Uploaded secret DEEPSEEK_API_KEY
```

✅ 從這一刻起，您的 DeepSeek Key 已經在雲端保險箱裡了。

驗證：

```bash
npx wrangler pages secret list --project-name zykongjian
```

應該列出 `DEEPSEEK_API_KEY`，但**永遠看不到值本身**（這就是「保險箱」的意思）。

---

## 五、創建後端需要的雲資源（一次性，15 分鐘）

### 5.1 D1 資料庫遷移（建表）

```bash
# 應用粵語學習主表（生詞本、複習日誌、用量統計）
npx wrangler d1 execute ziyoukongjian-db --remote --file=migrations/0003_cantonese.sql

# 應用個人 API Keys 表
npx wrangler d1 execute ziyoukongjian-db --remote --file=migrations/0004_cantonese_apikeys.sql

# 應用 ASR 識別歷史表（粵語口語聽寫的「最近識別」面板用）
npx wrangler d1 execute ziyoukongjian-db --remote --file=migrations/0005_cantonese_asr_history.sql

# 順便把同樣的表結構建到本地（之後本地測試用）
npx wrangler d1 execute ziyoukongjian-db --local --file=migrations/0003_cantonese.sql
npx wrangler d1 execute ziyoukongjian-db --local --file=migrations/0004_cantonese_apikeys.sql
npx wrangler d1 execute ziyoukongjian-db --local --file=migrations/0005_cantonese_asr_history.sql
```

### 5.1.5 （強烈建議）配置 Groq Whisper 作為 ASR fallback

Cloudflare Workers AI Whisper 對單次請求 >2MB 會返回 `3006: Request is too large`。
即使前端已切塊壓縮，Groq 仍能作為穩定的第二防線（免費 14400 req/day、速度 10-50× realtime）。

```bash
# 1. 到 https://console.groq.com 註冊並創建 API Key（免費）
# 2. 注入到 Pages secret（永遠不會進 git）
npx wrangler pages secret put GROQ_API_KEY --project-name zykongjian
# 貼上 gsk_ 開頭的 Key，回車
```

驗證：
```bash
npx wrangler pages secret list --project-name zykongjian
# 應該同時看到 DEEPSEEK_API_KEY 與 GROQ_API_KEY
```

不配置也能跑（只用 Cloudflare Workers AI），但偶發 3006 沒辦法自動恢復。

每條成功會看到 `🌀 Executing on remote database... ✅`。

### 5.2 創建 KV 命名空間（緩存 + 限流）

```bash
npx wrangler kv namespace create YUEYU_TRANSLATE_KV
npx wrangler kv namespace create YUEYU_RATE_LIMIT_KV
```

每條會輸出類似：

```text
🌀 Creating namespace with title "YUEYU_TRANSLATE_KV"
✨ Success!
Add the following to your configuration file in your kv_namespaces array:
{ "binding": "YUEYU_TRANSLATE_KV", "id": "abc123def456..." }
```

**把兩個 id 各記下來**，下一步要填到 `wrangler.jsonc`。

### 5.3 創建 R2 桶（音頻緩存）

```bash
npx wrangler r2 bucket create yueyu-audio
```

看到 `Created bucket 'yueyu-audio'.` 即成功。

### 5.4 把上面 3 樣綁定寫進 `wrangler.jsonc`

打開項目根目錄的 `wrangler.jsonc`，把第 12-22 行**註釋掉的內容解開**，並把上面 5.2 拿到的兩個 id 填進去。改成這樣：

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "zykongjian",
  "pages_build_output_dir": "dist",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "ziyoukongjian-db",
      "database_id": "e934c3e9-1744-47ac-b016-785efb04941d"
    }
  ],
  "kv_namespaces": [
    { "binding": "YUEYU_TRANSLATE_KV", "id": "把 5.2 第一條輸出的 id 貼這裡" },
    { "binding": "YUEYU_RATE_LIMIT_KV", "id": "把 5.2 第二條輸出的 id 貼這裡" }
  ],
  "r2_buckets": [
    { "binding": "YUEYU_AUDIO", "bucket_name": "yueyu-audio" }
  ],
  "ai": { "binding": "AI" }
}
```

> 注意：第 11 行原本是 `]` 沒有逗號，現在後面要繼續加東西，記得在 `]` 後加一個 `,`。

---

## 六、申請 Azure TTS Key（10 分鐘，可暫時跳過）

> 跳過後 TTS 會自動 fallback 到瀏覽器內建的 Web Speech API（免費但音質一般）。
> 想要香港播音員級別的口音再回來做。

1. 訪問 [portal.azure.com](https://portal.azure.com)，用 Microsoft 帳號登入（沒有就現場註冊）
2. 創建免費試用訂閱（送 $200，且 Speech Services 有 F0 免費層每月 50 萬字符永久免費）
3. 上方搜索框搜 `Speech services`，點 **Create**
4. 區域選 `East Asia` 或 `Southeast Asia`，定價層選 **F0 (Free)**
5. 創建完成後進入資源 → 左側 **Keys and Endpoint**
6. 複製 **KEY 1** 與 **Region**

回到終端：

```bash
npx wrangler pages secret put AZURE_TTS_KEY --project-name zykongjian
# 貼入 KEY 1 後 Enter

npx wrangler pages secret put AZURE_TTS_REGION --project-name zykongjian
# 輸入 eastasia（或 southeastasia），Enter
```

---

## 七、申請 Cloudflare Turnstile（5 分鐘，可暫時跳過）

Turnstile 是 Cloudflare 的隱形人機驗證，比 Google reCAPTCHA 友好。
**只在您打算讓未登入用戶試用時才需要**。

1. [dash.cloudflare.com](https://dash.cloudflare.com) → 左側 **Turnstile** → **Add site**
2. Site name: `yueyu-learn`，Hostname: `zykongjian.com`，Widget Mode: **Invisible**
3. 創建完成 → 拿到 **Site Key**（公開）和 **Secret Key**（後端）

```bash
npx wrangler pages secret put TURNSTILE_SECRET --project-name zykongjian
# 貼入 Secret Key 後 Enter
```

Site Key 是公開的，可以放在前端代碼裡（後續配置時再說）。

---

## 八、本地調試（可選但推薦）

部署到雲端之前，先在自己電腦上跑一遍。

```bash
cp functions/.dev.vars.example functions/.dev.vars
```

用任何文本編輯器（VS Code / TextEdit）打開 `functions/.dev.vars`，把您剛才設置的 4 個 Key 填進去。例如：

```env
DEEPSEEK_API_KEY=sk-xxxxxxxx你的真實key
AZURE_TTS_KEY=xxxxxxxx
AZURE_TTS_REGION=eastasia
TURNSTILE_SECRET=0x4AAAAAAA你的secret
```

> 這個 `.dev.vars` 已經被 `.gitignore` 攔截，**永遠不會被提交上 git**。

驗證 git 確實忽略了它：

```bash
git check-ignore functions/.dev.vars
# 應輸出：functions/.dev.vars
```

啟動本地伺服器：

```bash
npm run build
npx wrangler pages dev dist
```

等到看見：

```text
[wrangler:inf] Ready on http://localhost:8788
```

打開 `http://localhost:8788/yueyu` 就是您的本地網頁。

---

## 九、部署到正式環境

```bash
npm run pages:deploy
```

等 1–2 分鐘看到 `✨ Deployment complete!`，您的 `zykongjian.com/yueyu` 就上線了。

---

## 十、驗證 API 加密是否正確

### 10.1 git 歷史掃描（確認沒有洩漏）

```bash
git log -p --all | grep -E "sk-[a-zA-Z0-9]{20,}" || echo "history clean"
grep -rE "sk-[a-zA-Z0-9]{20,}" --exclude-dir=node_modules --exclude-dir=.git . || echo "tree clean"
```

兩條命令都應該看到 `clean`。

如果看到了 `sk-` 開頭的真實 Key，**立刻去 DeepSeek 後台 Revoke 並重新生成**，然後重做第四步。

### 10.2 嘗試直接調用 DeepSeek API（應失敗）

```bash
curl -i https://zykongjian.com/api/cantonese/translate \
  -H "Content-Type: application/json" \
  -d '{"sentences":["你食咗飯未"]}'
```

預期：`403 forbidden_origin`。
**這說明您的 API 不會被陌生人通過 curl 偷偷調用 → DeepSeek Key 自動受保護**。

### 10.3 從正規 Web 訪問（應成功）

去 `https://zykongjian.com/yueyu` 登入後使用粘貼翻譯，能成功翻譯一句話即代表整條鏈路打通。

---

# 🔑 第二章：以後其他軟件如何調用這個 API？

> 您的需求：「我以後寫的軟件都可以調用這個加密的 API」。
>
> 解決方案：**個人 API Key**。系統裡每個用戶可以生成最多 5 把長期 Token（格式 `zy_xxxxx`），任何軟件（命令列腳本、Python 程式、自寫 APP、第三方插件）拿這把 Key 都能訪問完整 API。

## 為什麼這個方案安全？

| 方面 | 設計 |
| --- | --- |
| **真正的 DeepSeek Key 不會出現在外面** | DeepSeek Key 永遠只在 Cloudflare 後端使用。您給其他軟件的是「粵語學習 API Key」，跟 DeepSeek 沒有直接關係。 |
| **Key 在資料庫裡也是雜湊存儲** | 即使資料庫被讀，也無法還原原文。 |
| **可隨時撤銷單把 Key** | 例如您的某個腳本疑似洩漏，去儀表板按一下「撤銷」，那把 Key 立刻失效，不影響其他軟件。 |
| **配額共享（不被濫用）** | 所有 Key 加起來計入您的個人配額（每天 200 次），就算被偷了也不會無限刷您的錢。 |
| **可設置有效期** | 例如「我這個腳本只用 30 天」，到期自動失效。 |

## 1. 生成 Key

部署完成後：

1. 訪問 `https://zykongjian.com/yueyu`，登入
2. 左下/底部菜單 → **儀表板** → 滾動到「🔑 個人 API Keys」
3. 點進去 → 填名稱（例如「我的 Mac 命令列腳本」）→ 選範圍（建議全選）→ 可選有效期 → **生成新 Key**
4. **頁面會一次性顯示完整的 `zy_xxxxxxxx...`，立刻複製**（關閉頁面後再也看不到原文）

## 2. 在任何軟件中使用

只要在 HTTP 請求頭中加：

```text
Authorization: Bearer zy_xxxxxxxx你剛複製的key
```

### 範例：命令列 (curl)

```bash
curl https://zykongjian.com/api/cantonese/translate \
  -H "Authorization: Bearer zy_xxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"sentences":["你食咗飯未","佢屋企好遠"]}'
```

### 範例：Python

```python
import requests

YUEYU_KEY = "zy_xxxxxxxx"  # 從環境變數讀更安全：os.environ['YUEYU_KEY']

resp = requests.post(
    "https://zykongjian.com/api/cantonese/translate",
    headers={
        "Authorization": f"Bearer {YUEYU_KEY}",
        "Content-Type": "application/json",
    },
    json={"sentences": ["你食咗飯未", "佢屋企好遠"]},
)
print(resp.json())
```

### 範例：JavaScript / Node.js

```javascript
const res = await fetch('https://zykongjian.com/api/cantonese/translate', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.YUEYU_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sentences: ['你食咗飯未'] }),
})
console.log(await res.json())
```

### 範例：iOS / Android APP

在原生 APP 的 HTTP 客戶端加上同樣的 Header 即可。詳見 `apps/yueyu-learn/MOBILE.md`。

## 3. 可用的 API 端點

| 端點 | 方法 | 用途 |
| --- | --- | --- |
| `/api/cantonese/translate` | POST | 書面語 → 粵語口語翻譯 |
| `/api/cantonese/tts` | POST | 文字轉語音（zh-HK） |
| `/api/cantonese/ocr` | POST | 截圖識別字幕 |
| `/api/cantonese/vocab` | GET/POST/PATCH/DELETE | 生詞本管理 |

每個端點的請求/回應格式見 `shared/cantoneseTypes.ts`。

## 4. 安全使用 API Key 的鐵律

- ❌ **絕不**把 `zy_xxxxx` 寫死在前端 JavaScript / 公開 git 倉庫 / 截圖文章
- ❌ **絕不**透過微信、郵件、Slack、AI 聊天等管道發送
- ✅ 寫進**環境變數**（`.env` 文件 + `.gitignore`）
- ✅ 寫進**密碼管理器**（1Password、Bitwarden、Apple 鑰匙串）
- ✅ 命令列示範時只展示前 6 字符（`zy_a1b2c3...`）
- ✅ 定期輪替（建議每 90 天）
- ✅ 一旦疑似洩漏，立刻去儀表板**撤銷**

## 5. 如何查看用量？

- 個人額度：每天 200 次調用，每分鐘 30 次（可在 `_shared.ts` 調整）
- 全局：`https://zykongjian.com/api/cantonese/admin/usage?date=YYYY-MM-DD`（需 teacher 角色）
- DeepSeek 後台也能看到實際 Token 消費（從中能反查 LLM 的真實 cost）

---

## 十一、防盜檢查清單（部署前必看）

- [ ] DeepSeek Key 只用 `wrangler pages secret put` 設置
- [ ] `functions/.dev.vars` 不會被 git 追蹤（`git check-ignore` 驗證）
- [ ] `git log -p --all | grep "sk-..."` 無輸出
- [ ] 直接用 curl 調 `/api/cantonese/translate`（不帶 Auth）返回 403
- [ ] 帶 `Authorization: Bearer zy_xxx` 調 API 能成功
- [ ] DeepSeek 後台設了月度預算告警（建議 ¥30）
- [ ] Cloudflare Pages → Settings → Environment variables → Production 中有 `DEEPSEEK_API_KEY`（顯示為 `***`）

---

## 何時做哪一步？建議順序

| 順序 | 步驟 | 預估時間 | 完成標誌 |
| --- | --- | --- | --- |
| 1 | 第一、二章 | 15 分鐘 | wrangler 登入成功 |
| 2 | 第三章 申請 DeepSeek | 5 分鐘 | 拿到 sk- 開頭的 Key 並存入密碼管理器 |
| 3 | 第四章 上傳 Secret | 1 分鐘 | `wrangler pages secret list` 看到 DEEPSEEK_API_KEY |
| 4 | 第五章 創建資源 | 15 分鐘 | wrangler.jsonc 補全 + 表已建 |
| 5 | 第八章 本地測試 | 10 分鐘 | localhost:8788/yueyu 能粘貼翻譯成功 |
| 6 | 第九章 部署 | 2 分鐘 | zykongjian.com/yueyu 線上能用 |
| 7 | 第十章 驗證 | 5 分鐘 | 所有檢查項都過 |
| 8 | 第六章 Azure TTS | 10 分鐘 | 朗讀有香港播音員聲音 |
| 9 | 創建您第一把個人 API Key | 1 分鐘 | 成功用 curl 從命令列調通 |

每完成一步停下來打個 ✓，遇到任何錯誤直接把錯誤訊息貼回來給我看，我來協助 debug。

🎉 完成後，您就有了一套**自己掌控、永不洩漏 DeepSeek Key、可被任何軟件使用的粵語學習 API**。
