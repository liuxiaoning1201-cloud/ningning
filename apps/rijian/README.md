# 日箋

鍵盤優先的個人待辦、每日記錄與隨想。桌面以 macOS App 運行為主。

## 開發

```bash
cd apps/rijian
npm install
npm run desktop
```

瀏覽器預覽：

```bash
npm run dev
```

打包 Mac App：

```bash
npm run desktop:build
```

產物在 `src-tauri/target/release/bundle/macos/日箋.app`。

## 快捷鍵

- `Cmd+N`：游標回到底部輸入（打開 App 後直接打字）
- `Cmd+Shift+Space`：全域隨手記（App 不在眼前時跳出；有字則不論送出或關閉都存進隨想）
- `Cmd+K`：命令面板
- `Cmd+Enter`：完成選中待辦
- `Cmd+1`～`4`：今日 / 隨想 / 稍後 / 清單

開發時（`npm run desktop`）系統裡看到的進程名是 **rijian**，不是「日箋」，也不會出現在「輔助使用」。全域快捷鍵走系統熱鍵，通常不必開那個權限。若要在 Dock 與權限清單看到「日箋」，請執行 `npm run desktop:build` 後打開 `日箋.app`。

資料存在本機 `localStorage`（鍵名 `rijian.v1`）。雲端同步尚未接入。
