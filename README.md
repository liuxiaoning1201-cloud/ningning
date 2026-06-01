# 清沂遊

教育類互動遊戲平台，部署在 Cloudflare Pages。正式網址：**https://qingyiu.com**。命名取《論語・先進》曾點「浴乎沂，風乎舞雩，詠而歸」與陶淵明〈時運〉「悠想清沂」，寓「優遊詠歸、寓教於樂」之意。首頁採千里江山圖青綠山水風格。

域名遷移步驟見 [docs/域名遷移-qingyiu.com.md](docs/域名遷移-qingyiu.com.md)。

## 目錄結構

```
apps/           所有前端應用
functions/      Pages Functions 後端 API
shared/         前後端共用程式碼
scripts/        建置腳本
docs/           專案文件
_archive/       歸檔的舊程式碼
```

## 應用列表

| 應用 | 技術 | 說明 |
|------|------|------|
| 中文填字接龍 | Vue 3 | 詩句填字練習 |
| 班級守護隊 | Vue 3 | 班級管理與加減分 |
| 字詞地鼠戰 | HTML | 打地鼠式字詞練習 |
| 手勢點名 | HTML | 手勢互動點名系統 |
| 春江花月夜 | HTML | 手勢互動詩詞體驗 |
| poetpal | HTML | 穿越時空與詩人聊天 |

## 開發

```bash
npm run build          # 建置所有應用到 dist/
```

## 部署

推送到 `main` 分支會自動觸發 Cloudflare Pages 建置和部署。

`npm run build` 會一併輸出 `poetpal/`（詩友記）到 `dist/`；若線上曾出現詩友記 404，多半是舊版建置未包含該目錄，重新部署即可。
