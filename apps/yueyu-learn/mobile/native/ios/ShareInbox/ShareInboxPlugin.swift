/*
 * 粵語學習 — Capacitor 自定義插件「ShareInbox」（iOS 端）
 *
 * 功能：在主 APP 啟動或從 ShareExtension URL Scheme 喚起時，
 *      把 App Group/incoming/ 下的截圖讀出來，轉成 base64 給網頁，
 *      網頁直接拿去調 OCR API（複用 web 端的 OCR 流程）。
 *
 * 用戶在 Xcode 中加入此檔到主 App target，並把目錄加進 podspec 自動載入。
 * 或者直接 import 這個檔案到 AppDelegate 的 capacitorPlugins 列表。
 */
import Foundation
import Capacitor

@objc(ShareInboxPlugin)
public class ShareInboxPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ShareInboxPlugin"
    public let jsName = "ShareInbox"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "consumePending", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearPending", returnType: CAPPluginReturnPromise),
    ]

    private let appGroupID = "group.com.zykongjian.yueyu"

    /// 讀取並消費 ShareExtension 寫入的截圖
    @objc func consumePending(_ call: CAPPluginCall) {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else {
            call.resolve(["images": []])
            return
        }

        let folder = containerURL.appendingPathComponent("incoming", isDirectory: true)
        let fm = FileManager.default
        let files = (try? fm.contentsOfDirectory(at: folder,
                                                 includingPropertiesForKeys: nil,
                                                 options: [.skipsHiddenFiles])) ?? []

        var images: [[String: Any]] = []
        for url in files where url.pathExtension.lowercased() == "jpg"
                              || url.pathExtension.lowercased() == "jpeg"
                              || url.pathExtension.lowercased() == "png" {
            if let data = try? Data(contentsOf: url) {
                let mime = url.pathExtension.lowercased() == "png" ? "image/png" : "image/jpeg"
                let dataUrl = "data:\(mime);base64,\(data.base64EncodedString())"
                images.append([
                    "filename": url.lastPathComponent,
                    "dataUrl": dataUrl,
                    "size": data.count,
                ])
                try? fm.removeItem(at: url)
            }
        }

        UserDefaults(suiteName: appGroupID)?.removeObject(forKey: "pendingShareFiles")
        call.resolve(["images": images])
    }

    @objc func clearPending(_ call: CAPPluginCall) {
        if let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) {
            let folder = containerURL.appendingPathComponent("incoming")
            try? FileManager.default.removeItem(at: folder)
        }
        UserDefaults(suiteName: appGroupID)?.removeObject(forKey: "pendingShareFiles")
        call.resolve()
    }
}
