/*
 * 粵語學習 — iOS Share Extension（Swift）
 *
 * 在「相冊／截圖／其他 APP 截圖工具」中分享圖片時出現「粵語學習」入口，
 * 把圖片寫到 App Group 容器，並通過 URL Scheme 啟動主 APP 跳到 OCR 頁。
 *
 * ╔══ 用戶在 Xcode 中執行：═════════════════════════════════════════╗
 * ║ 1. File → New → Target → Share Extension（產品名 ShareExtension） ║
 * ║ 2. 把本檔覆蓋自動生成的 ShareViewController.swift                  ║
 * ║ 3. 在 Signing & Capabilities：                                    ║
 * ║      - 主 App 與 ShareExtension 都加 App Groups: group.com.zykongjian.yueyu ║
 * ║      - 主 App 加 URL Types: yueyu                                  ║
 * ║ 4. ShareExtension/Info.plist 設定 NSExtensionAttributes：           ║
 * ║      NSExtensionActivationSupportsImageWithMaxCount = 5            ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */
import UIKit
import Social
import UniformTypeIdentifiers
import MobileCoreServices

class ShareViewController: SLComposeServiceViewController {

    private let appGroupID = "group.com.zykongjian.yueyu"
    private let mainAppURLScheme = "yueyu"

    override func isContentValid() -> Bool {
        return true
    }

    override func didSelectPost() {
        guard let item = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = item.attachments else {
            self.completeRequest()
            return
        }

        let imageType = UTType.image.identifier
        let group = DispatchGroup()
        var savedFilenames: [String] = []

        for provider in attachments where provider.hasItemConformingToTypeIdentifier(imageType) {
            group.enter()
            provider.loadItem(forTypeIdentifier: imageType, options: nil) { (item, _) in
                defer { group.leave() }
                let data: Data?
                if let url = item as? URL {
                    data = try? Data(contentsOf: url)
                } else if let img = item as? UIImage {
                    data = img.jpegData(compressionQuality: 0.85)
                } else if let raw = item as? Data {
                    data = raw
                } else {
                    data = nil
                }
                guard let imgData = data,
                      let filename = self.writeToAppGroup(data: imgData) else { return }
                savedFilenames.append(filename)
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            self.recordIncomingFiles(savedFilenames)
            self.openMainApp()
            self.completeRequest()
        }
    }

    override func configurationItems() -> [Any]! {
        return []
    }

    // MARK: - App Group 寫入
    private func writeToAppGroup(data: Data) -> String? {
        guard let containerURL = FileManager.default.containerURL(
            forSecurityApplicationGroupIdentifier: appGroupID
        ) else { return nil }
        let folder = containerURL.appendingPathComponent("incoming", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let filename = "share-\(Int(Date().timeIntervalSince1970 * 1000)).jpg"
        let url = folder.appendingPathComponent(filename)
        do {
            try data.write(to: url)
            return filename
        } catch {
            print("ShareExt write failed: \(error)")
            return nil
        }
    }

    private func recordIncomingFiles(_ filenames: [String]) {
        let defaults = UserDefaults(suiteName: appGroupID)
        defaults?.set(filenames, forKey: "pendingShareFiles")
        defaults?.set(Date().timeIntervalSince1970, forKey: "pendingShareAt")
        defaults?.synchronize()
    }

    // MARK: - 啟動主 APP
    private func openMainApp() {
        guard let url = URL(string: "\(mainAppURLScheme)://share?source=ext") else { return }
        var responder: UIResponder? = self
        while let r = responder {
            if let app = r as? UIApplication {
                app.perform(#selector(UIApplication.open(_:options:completionHandler:)),
                            with: url, with: [:])
                return
            }
            responder = r.next
        }
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: [], completionHandler: nil)
    }
}
