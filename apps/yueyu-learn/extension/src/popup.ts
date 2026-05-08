/**
 * Popup：兩個開關（悬浮卡 / 雙軌字幕）+ 快捷入口。
 * 與 content script 通過 chrome.tabs.sendMessage 通訊。
 */
const overlaySwitch = document.getElementById('overlay-switch') as HTMLInputElement
const dualSwitch = document.getElementById('dual-switch') as HTMLInputElement

async function init() {
  const stored = await chrome.storage.local.get(['showOverlay', 'showDualSubtitle'])
  overlaySwitch.checked = stored.showOverlay ?? true
  dualSwitch.checked = stored.showDualSubtitle ?? true
}

async function send(type: string) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type })
    } catch (e) {
      console.warn(`send ${type} failed`, e)
    }
  }
}

overlaySwitch.addEventListener('change', () => {
  void chrome.storage.local.set({ showOverlay: overlaySwitch.checked })
  void send('overlay:toggle')
})

dualSwitch.addEventListener('change', () => {
  void chrome.storage.local.set({ showDualSubtitle: dualSwitch.checked })
  void send('dual:toggle')
})

void init()
