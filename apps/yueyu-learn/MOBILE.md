# 粵語學習 — 手機 APP 打包指南

> 本文檔指引你把 `web/` 網頁打包成 iOS / Android 原生 APP。
>
> 所有需要 Xcode / Android Studio 的步驟，必須在你本機完成。

---

## 路線圖

| 階段 | 形態 | 平台 | 工作量 |
| --- | --- | --- | --- |
| **A. PWA** | 網頁 + 桌面快捷方式 | 任何瀏覽器 | 已完成，零成本 |
| **B. Capacitor 套殼** | iOS / Android APP（內嵌 WebView） | iOS / Android | 需 Apple Dev / Google Play 帳號 |
| **C. 原生擴展** | iOS Share Extension + Android 浮窗 OCR | iOS / Android | 需 Xcode / Android Studio |

---

## A. PWA（已完成）

`web/` 內已加：
- `public/manifest.webmanifest`
- `public/sw.js`（離線緩存靜態資源 + 音頻緩存）
- `composables/usePwa.ts`（註冊 SW + 安裝橫幅）
- `index.html` `<link rel="manifest">`

部署後在 iOS Safari / Android Chrome 打開 `https://zykongjian.com/yueyu`，可「加到主屏幕」。

> ⚠️ **icons/ 資源還沒生成**，部署前用任意設計工具導出：
>
> ```text
> public/icons/
>   icon-192.png         192×192
>   icon-512.png         512×512
>   icon-512-maskable.png 512×512（中央 80% 安全區）
>   shortcut-translate.png 96×96
>   shortcut-vocab.png     96×96
>   shortcut-review.png    96×96
> ```

---

## B. Capacitor 套殼

### 1. 構建純路徑 web 包

Capacitor 不掛子路徑，網頁的 `BASE_URL` 要改回 `/`：

```bash
cd apps/yueyu-learn/web
VITE_BASE_PATH=/ npm run build
```

### 2. 安裝 Capacitor 並添加平台

```bash
cd apps/yueyu-learn/mobile
npm install
npm run sync:web                # 把 web/dist 拷貝到 mobile/www
npx cap add ios
npx cap add android
npx cap sync
```

### 3. 配置 API 地址

Capacitor 容器裡網頁 `fetch('/api/...')` 不會打到你的後端，需要：

**方法 A（推薦）**：把網頁所有 `/api` 請求改成完整域名 `https://zykongjian.com/api/...`，並在後端 `_shared.ts` 的 `ALLOW_ORIGINS` 中放行 `capacitor://localhost` 與 `http://localhost`。

**方法 B**：在 `capacitor.config.ts` 設置 `server.url = 'https://zykongjian.com/yueyu/'`，APP 直接以 zykongjian.com 為宿主。缺點：完全依賴在線。

> 已將 `useApi.ts` 預留 `import.meta.env.VITE_API_BASE`，正式打包時設 `VITE_API_BASE=https://zykongjian.com` 即可。

### 4. 打包 iOS / Android

```bash
npm run open:ios       # 打開 Xcode，Run / Archive
npm run open:android   # 打開 Android Studio，Build APK / Bundle
```

---

## C. 原生擴展

### C1. iOS Share Extension（接收截圖）

把 `mobile/ios-share-extension/` 內的檔案手動加進 Xcode：

1. 在 Xcode 中：**File → New → Target → Share Extension**
   - Product Name: `ShareExtension`
   - Bundle Identifier: `com.zykongjian.yueyu.ShareExtension`
2. 用 `mobile/ios-share-extension/ShareViewController.swift` 覆蓋自動生成的同名檔
3. 用 `mobile/ios-share-extension/Info.plist` 覆蓋
4. **Signing & Capabilities → + Capability → App Groups**：
   - 主 App 與 ShareExtension 都加 `group.com.zykongjian.yueyu`
5. **主 App → Signing & Capabilities → URL Types**：
   - URL Schemes: `yueyu`
6. 把 `mobile/native/ios/ShareInbox/ShareInboxPlugin.swift` 複製到 iOS 主 App target，加進 Xcode 編譯
7. 在 `App.swift` / `AppDelegate.swift` 註冊：

```swift
import Capacitor
// ...
override func application(_ application: UIApplication,
                          didFinishLaunchingWithOptions ...) -> Bool {
    CAPBridge.registerPluginInstance(ShareInboxPlugin())
    return true
}
```

完成後：在「相冊」/「截圖」中分享 → 出現「粵語學習」 → 點擊 → 自動跳到 OCR 頁。

### C2. Android 浮窗 OCR

把 `mobile/native/android/floating-ocr/` 中的兩個 Kotlin 檔加進 Android Studio：

1. 路徑：`android/app/src/main/java/com/zykongjian/yueyu/floating/`
2. `AndroidManifest.xml` 加：

```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION" />

<application ...>
    <service
        android:name=".floating.FloatingBubbleService"
        android:exported="false"
        android:foregroundServiceType="mediaProjection" />
</application>
```

3. `MainActivity.kt` 註冊插件：

```kotlin
import com.zykongjian.yueyu.floating.FloatingOcrPlugin

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        registerPlugin(FloatingOcrPlugin::class.java)
        super.onCreate(savedInstanceState)
    }
}
```

4. 在「儀表板」頁就能看到「🫧 浮窗 OCR」開關（僅 Android 原生 APP 內顯示）。

> ⚠️ **MediaProjection 截屏的完整鏈路**（小球 → broadcast → MainActivity 申請 MediaProjection → ImageReader 拿幀 → base64 送回 WebView）後續可實作；當前骨架已預留 `triggerScreenshot()` 廣播入口。

---

## 上架前 Checklist

- [ ] `icons/` 完整（192/512/maskable）
- [ ] App Store Connect / Play Console 已建項目
- [ ] APP 內所有 `/api/...` 改為絕對域名 `https://zykongjian.com/api/...`
- [ ] 後端 `ALLOW_ORIGINS` 補上 `capacitor://localhost`、`http://localhost`、`https://localhost`
- [ ] iOS：App Group + URL Type 配置完成
- [ ] iOS：Microphone / Photos 隱私描述
- [ ] Android：浮窗權限的引導文案
- [ ] Privacy Policy / Terms（重要：兩平台都會審）
