/**
 * MV3 Service Worker。
 * 主要職責：
 *   1. 轉發 content script 的 API 請求（避免在 youtube.com 域內走 CORS）
 *   2. 維護用戶登入態（透過讀取 zykongjian.com 的 cookie 也可，但 MV3 service worker 不直接訪問 cookie；
 *      簡化為：所有請求帶上 credentials: 'include'，由瀏覽器自動帶 zykongjian.com 的 cookie）
 *   3. 接收側邊欄的開關訊號
 */
import { API_BASE, CLIENT_TAG } from '../config'

interface RpcMsg {
  type: 'rpc'
  path: string
  init?: RequestInit
}

chrome.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  if (typeof msg !== 'object' || !msg) return false
  const m = msg as Partial<RpcMsg>
  if (m.type !== 'rpc' || !m.path) return false

  const url = `${API_BASE}${m.path}`
  fetch(url, {
    ...(m.init ?? {}),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Yueyu-Client': CLIENT_TAG,
      ...((m.init?.headers as Record<string, string>) ?? {}),
    },
  })
    .then(async (res) => {
      const text = await res.text()
      let body: unknown
      try { body = JSON.parse(text) } catch { body = text }
      sendResponse({ ok: res.ok, status: res.status, body })
    })
    .catch((err: Error) => {
      sendResponse({ ok: false, status: 0, body: { error: 'network_error', message: err.message } })
    })
  return true // 異步響應
})

// 點擊圖標時打開側邊欄
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id) {
    try {
      await chrome.sidePanel.open({ tabId: tab.id })
    } catch (e) {
      console.warn('Open side panel failed:', e)
    }
  }
})

// 安裝時設置默認側邊欄行為
if (chrome.sidePanel?.setPanelBehavior) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})
}
