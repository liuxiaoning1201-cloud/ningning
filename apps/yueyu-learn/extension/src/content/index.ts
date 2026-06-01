/**
 * 通用 Content Script：
 *   - 用站點適配器（YouTube / bilibili / TVB / myTV SUPER / Generic）抽象字幕讀取
 *   - 字幕變化 → 離線詞表先示意 → 後端 LLM 取最終結果
 *   - 同時更新「悬浮翻譯卡」與「雙軌字幕」兩個浮層
 *   - 透過 chrome.storage 持久化用戶偏好（雙軌開關、收藏的提示等）
 */
import { ExtensionApi } from '../lib/api'
import { OverlayController } from './overlay'
import { DualSubtitleOverlay } from './dual-subtitle'
import { detectAdapter } from './site-adapters'
import { lookupSentence, tokenizeByDict, tokensToCantonese, tokensToJyutping } from '@yueyu/shared/dict-lookup'
import type { TranslateResult } from '@yueyu/shared/types'

const adapter = detectAdapter()
const overlay = new OverlayController()
const dual = new DualSubtitleOverlay(adapter)

let lastText = ''
let debounceTimer: number | null = null
const DEBOUNCE_MS = 250

interface UserPrefs {
  showOverlay: boolean
  showDualSubtitle: boolean
}

let prefs: UserPrefs = { showOverlay: true, showDualSubtitle: true }

async function loadPrefs() {
  const stored = await chrome.storage.local.get(['showOverlay', 'showDualSubtitle'])
  prefs = {
    showOverlay: stored.showOverlay ?? true,
    showDualSubtitle: stored.showDualSubtitle ?? true,
  }
}

async function savePrefs() {
  await chrome.storage.local.set(prefs)
}

async function onSubtitleChange(text: string) {
  if (!text || text === lastText) return
  lastText = text

  // 離線詞表精確命中
  const exact = lookupSentence(text)
  const ctx = makeCtx()
  if (exact) {
    if (prefs.showOverlay) overlay.show(exact, ctx)
    if (prefs.showDualSubtitle) dual.show(exact)
    return
  }

  // 先用詞表分詞做佔位顯示
  const tokens = tokenizeByDict(text)
  const placeholder: TranslateResult = {
    written: text,
    cantonese: tokensToCantonese(tokens),
    jyutping: tokensToJyutping(tokens),
    tokens,
    source: 'dict',
  }
  if (prefs.showOverlay) overlay.show(placeholder, ctx)
  if (prefs.showDualSubtitle) dual.show(placeholder)

  // 後端 LLM 翻譯
  try {
    const res = await ExtensionApi.translate([text])
    const real = res.results[0]
    if (real && lastText === text) {
      if (prefs.showOverlay) overlay.show(real, ctx)
      if (prefs.showDualSubtitle) dual.show(real)
    }
  } catch (err) {
    const e = err as Error & { status?: number }
    if (e.status === 401) {
      overlay.showHint('需要先登入 qingyiu.com 才能使用完整翻譯', 'login')
    } else if (e.status === 429) {
      overlay.showHint('今日配額已用完，明天再試', 'warn')
    } else {
      console.warn('[yueyu] translate failed', e)
    }
  }
}

function makeCtx() {
  const video = adapter.getVideoEl()
  return {
    site: adapter.name,
    title: adapter.getTitle(),
    timestampSec: Math.floor(video?.currentTime ?? 0),
    url: location.href,
  }
}

function attachObserver() {
  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = window.setTimeout(() => {
      const text = adapter.getCaption()
      void onSubtitleChange(text)
    }, DEBOUNCE_MS)
  })
  observer.observe(document.body, { childList: true, subtree: true, characterData: true })
}

// 初始化
async function bootstrap() {
  await loadPrefs()
  if (prefs.showOverlay) overlay.mount()
  if (prefs.showDualSubtitle) dual.mount()
  attachObserver()
  console.log(`[yueyu] adapter = ${adapter.name}, overlay = ${prefs.showOverlay}, dual = ${prefs.showDualSubtitle}`)
}

void bootstrap()

// 響應 popup / sidepanel 命令
chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return
  if (msg.type === 'overlay:toggle') {
    prefs.showOverlay = !prefs.showOverlay
    if (prefs.showOverlay) overlay.mount()
    else overlay.hide()
    void savePrefs()
  } else if (msg.type === 'dual:toggle') {
    prefs.showDualSubtitle = !prefs.showDualSubtitle
    if (prefs.showDualSubtitle) {
      dual.mount()
      // 若有上一次字幕則重新顯示
    } else {
      dual.hide()
    }
    void savePrefs()
  } else if (msg.type === 'prefs:get') {
    return Promise.resolve(prefs)
  }
})
