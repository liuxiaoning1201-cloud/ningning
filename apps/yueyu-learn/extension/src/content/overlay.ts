/**
 * 浮卡控制器：用 Shadow DOM 隔離樣式（避免被 YouTube 樣式污染）。
 * 包含原句、粵語口語、字對字映射、粵拼、解釋、朗讀、收藏。
 */
import type { TranslateResult } from '@yueyu/shared/types'
import { ExtensionApi } from '../lib/api'

interface SourceCtx {
  site: string
  title: string
  timestampSec: number
  url: string
}

export class OverlayController {
  private root: HTMLDivElement | null = null
  private shadow: ShadowRoot | null = null
  private hidden = false

  mount() {
    if (this.root) return
    const host = document.createElement('div')
    host.id = 'yueyu-overlay-host'
    host.style.cssText = `
      position: fixed; right: 20px; bottom: 110px;
      width: 380px; max-width: calc(100vw - 40px);
      z-index: 2147483647;
      pointer-events: auto;
      font-family: 'PingFang HK', 'PingFang TC', 'Noto Sans HK', sans-serif;
    `
    this.root = host
    this.shadow = host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>${OVERLAY_CSS}</style>
      <div class="card hidden" data-state="empty">
        <div class="topbar">
          <div class="title">🎙️ 粵語對照</div>
          <div class="actions">
            <button class="btn-mini" data-action="speak" title="朗讀">▶</button>
            <button class="btn-mini" data-action="favorite" title="收藏">☆</button>
            <button class="btn-mini" data-action="hide" title="收起">×</button>
          </div>
        </div>
        <div class="written"></div>
        <div class="cantonese-row">
          <div class="cantonese"></div>
          <div class="jyutping"></div>
        </div>
        <div class="explanation"></div>
        <div class="hint"></div>
      </div>
    `
    document.body.appendChild(host)

    // 委派事件
    this.shadow.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const action = target.dataset.action
      if (action === 'hide') this.hide()
      else if (action === 'speak') this.speakCurrent()
      else if (action === 'favorite') this.favoriteCurrent()
      else if (target.classList.contains('token')) {
        const text = target.dataset.cantonese || target.textContent || ''
        if (text) ExtensionApi.tts(text).then((r) => playUrl(r.url)).catch(() => speakWeb(text))
      }
    })

    this.makeDraggable(host)
  }

  private current: TranslateResult | null = null
  private currentCtx: SourceCtx | null = null

  show(result: TranslateResult, ctx: SourceCtx) {
    if (!this.shadow || this.hidden) return
    this.current = result
    this.currentCtx = ctx
    const card = this.shadow.querySelector<HTMLDivElement>('.card')!
    card.classList.remove('hidden')
    card.dataset.state = 'ok'

    this.shadow.querySelector<HTMLElement>('.written')!.textContent = result.written
    this.shadow.querySelector<HTMLElement>('.jyutping')!.textContent = result.jyutping || ''
    const expl = this.shadow.querySelector<HTMLElement>('.explanation')!
    expl.textContent = result.explanation ? `💡 ${result.explanation}` : ''
    expl.style.display = result.explanation ? 'block' : 'none'

    const cantonese = this.shadow.querySelector<HTMLElement>('.cantonese')!
    cantonese.innerHTML = ''
    for (const t of result.tokens) {
      const span = document.createElement('span')
      span.classList.add('token')
      if (t.jyutping && t.cantonese !== t.written) span.classList.add('mapped')
      span.textContent = t.cantonese
      span.dataset.cantonese = t.cantonese
      span.dataset.jyutping = t.jyutping || ''
      span.title = t.jyutping ? `${t.cantonese} ${t.jyutping}${t.note ? '\n' + t.note : ''}` : ''
      cantonese.appendChild(span)
    }

    this.shadow.querySelector<HTMLElement>('.hint')!.textContent = ''
  }

  showHint(text: string, kind: 'login' | 'warn' | 'info' = 'info') {
    if (!this.shadow) return
    const hint = this.shadow.querySelector<HTMLElement>('.hint')!
    hint.textContent = text
    hint.dataset.kind = kind
  }

  hide() {
    this.hidden = true
    if (this.root) this.root.style.display = 'none'
  }

  toggleHidden() {
    this.hidden = !this.hidden
    if (this.root) this.root.style.display = this.hidden ? 'none' : 'block'
  }

  private async speakCurrent() {
    if (!this.current) return
    try {
      const r = await ExtensionApi.tts(this.current.cantonese)
      playUrl(r.url)
    } catch {
      speakWeb(this.current.cantonese)
    }
  }

  private async favoriteCurrent() {
    if (!this.current || !this.currentCtx) return
    try {
      await ExtensionApi.saveVocab({
        granularity: 'sentence',
        written: this.current.written,
        cantonese: this.current.cantonese,
        jyutping: this.current.jyutping,
        explanation: this.current.explanation,
        source: this.currentCtx,
      })
      this.flashAction('favorite', '★ 已收藏')
    } catch (err) {
      const e = err as Error & { status?: number }
      if (e.status === 401) {
        this.showHint('請先登入 qingyiu.com', 'login')
      } else {
        this.showHint('收藏失敗，請稍後再試', 'warn')
      }
    }
  }

  private flashAction(action: 'favorite' | 'speak', text: string) {
    if (!this.shadow) return
    const btn = this.shadow.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)
    if (!btn) return
    const orig = btn.textContent
    btn.textContent = text
    btn.style.background = '#4a8e6f'
    btn.style.color = 'white'
    setTimeout(() => {
      btn.textContent = orig
      btn.style.background = ''
      btn.style.color = ''
    }, 1500)
  }

  private makeDraggable(host: HTMLDivElement) {
    let dragging = false
    let startX = 0, startY = 0, origX = 0, origY = 0
    host.addEventListener('mousedown', (e) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'BUTTON' || target.classList.contains('token')) return
      dragging = true
      startX = e.clientX; startY = e.clientY
      const rect = host.getBoundingClientRect()
      origX = rect.left; origY = rect.top
      host.style.transition = 'none'
    })
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      host.style.left = `${origX + dx}px`
      host.style.top = `${origY + dy}px`
      host.style.right = ''
      host.style.bottom = ''
    })
    window.addEventListener('mouseup', () => { dragging = false })
  }
}

function playUrl(url: string) {
  const audio = new Audio(url)
  audio.play().catch(() => {})
}

function speakWeb(text: string) {
  if (!('speechSynthesis' in window)) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'zh-HK'
  window.speechSynthesis.speak(u)
}

const OVERLAY_CSS = `
  :host { all: initial; display: block; }
  * { box-sizing: border-box; }
  .card {
    background: #fffaf0;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 14px;
    padding: 12px 14px;
    box-shadow: 0 12px 40px rgba(26, 26, 46, 0.18);
    color: #1a1a2e;
    font-size: 14px;
    line-height: 1.5;
    cursor: move;
    backdrop-filter: blur(10px);
  }
  .card.hidden { display: none; }
  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .title {
    font-weight: 600;
    font-size: 12px;
    color: #6b7280;
  }
  .actions { display: flex; gap: 4px; }
  .btn-mini {
    border: none;
    background: rgba(0, 0, 0, 0.05);
    color: #1a1a2e;
    width: 24px; height: 24px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
    font-family: inherit;
  }
  .btn-mini:hover { background: rgba(0,0,0,0.1); }
  .written {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 4px;
    line-height: 1.4;
  }
  .cantonese-row {
    background: rgba(244, 207, 159, 0.4);
    border-radius: 8px;
    padding: 8px 10px;
  }
  .cantonese {
    font-size: 16px;
    font-weight: 500;
    line-height: 1.55;
    word-break: break-word;
  }
  .token { display: inline-block; cursor: pointer; padding: 0 1px; }
  .token.mapped {
    background: linear-gradient(180deg, transparent 65%, rgba(212, 82, 77, 0.25) 65%);
    border-radius: 2px;
  }
  .token:hover { background: rgba(212, 82, 77, 0.18); }
  .jyutping {
    font-size: 11px;
    color: #6b7280;
    font-family: 'SF Mono', Menlo, monospace;
    margin-top: 4px;
    line-height: 1.4;
  }
  .explanation {
    font-size: 11px;
    color: #6b7280;
    font-style: italic;
    margin-top: 6px;
  }
  .hint {
    font-size: 11px;
    margin-top: 6px;
  }
  .hint[data-kind="login"] { color: #d4524d; }
  .hint[data-kind="warn"] { color: #b45309; }
  .hint[data-kind="info"] { color: #6b7280; }
`
