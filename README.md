# 字遊空間

教育類互動遊戲平台，部署在 Cloudflare Pages。

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
