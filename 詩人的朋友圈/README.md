# 詩人的朋友圈

基於香港教育局建議篇章的語文教育遊戲，學生可與 20 位古典文學作者聊天，或扮演他們發朋友圈。

## 功能

- **與作者聊天**：向李白、杜甫、蘇軾等作者提問，獲取詩詞與文言知識（需 LLM API）
- **作者朋友圈**：扮演作者發送日常動態，體驗古典文學之美
- **學習階段篩選**：小一至小三、小四至小六、中一至中三、中四至中六

## 使用方式

### 1. 直接開啟（僅朋友圈）

用瀏覽器開啟 `index.html`，即可使用「作者朋友圈」功能。發文、點贊、評論會儲存在瀏覽器本地。

### 2. 啟用聊天功能（DeepSeek API 已預設）

**方式一：Node 一鍵啟動（推薦）**

```bash
cd 詩人的朋友圈
node launch.js
```

**方式二：Flask 後端（Python）**

```bash
cd 詩人的朋友圈
pip install -r requirements.txt
python app.py
```

然後將 API 網址設為 `http://localhost:3001`。

**方式三：Python 代理（無 Node 時）**

1. 終端機一：`cd 詩人的朋友圈` → `python app.py`（或 `node server.js`）
2. 終端機二：`cd 詩人的朋友圈` → `python3 launch_with_proxy.py`
3. 瀏覽器開啟：`http://localhost:8080/詩人的朋友圈/index.html`

**方式四：僅網頁（無聊天）**

`python3 -m http.server 8080` 後開啟頁面，聊天會顯示錯誤提示。

### 3. 更換或設定 API 金鑰

編輯 `.env` 檔案，修改 `OPENAI_API_KEY`。若使用其他 LLM 服務，可同時修改：

```
OPENAI_API_BASE=https://api.deepseek.com/v1
OPENAI_API_KEY=你的金鑰
OPENAI_MODEL=deepseek-chat
```

## 20 位核心作者

孟子、莊子、司馬遷、曹植、諸葛亮、陶潛、王維、李白、杜甫、韓愈、柳宗元、劉禹錫、白居易、杜牧、范仲淹、歐陽修、王安石、蘇軾、李清照、辛棄疾

## 技術說明

- 前端：HTML + CSS + JavaScript，無需建置
- 後端：Node.js 原生 HTTP 模組，無額外依賴
- 資料：作者與建議篇章儲存於 `data/authors.js`
