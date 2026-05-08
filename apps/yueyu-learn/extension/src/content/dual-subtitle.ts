/**
 * 雙軌字幕疊加：在視頻原字幕上方添加一條粵語口語對照軌。
 *
 * 策略：
 *   1. 用 Shadow DOM 隔離樣式
 *   2. 容器掛在 body（fixed 定位 + transform 對齊）而不是視頻容器內，
 *      避免某些站點的字幕被站點 CSS 覆蓋；同時避開全屏切換的 stacking context 問題
 *   3. 每次 caption change 時 重新計算定位
 */
import type { TranslateResult } from '@yueyu/shared/types';
import type { SiteAdapter } from './site-adapters';

export class DualSubtitleOverlay {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private enabled = true;
  private adapter: SiteAdapter;
  private lastShown: TranslateResult | null = null;

  constructor(adapter: SiteAdapter) {
    this.adapter = adapter;
  }

  mount() {
    if (this.host) return;
    const host = document.createElement('div');
    host.id = 'yueyu-dual-subtitle';
    host.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 2147483646;
      left: 0; top: 0; right: 0;
      display: none;
    `;
    this.host = host;
    this.shadow = host.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `
      <style>${CSS}</style>
      <div class="wrap">
        <div class="cantonese-line"></div>
        <div class="jyutping-line"></div>
      </div>
    `;
    document.body.appendChild(host);

    // 監聽全屏切換以重新定位
    document.addEventListener('fullscreenchange', () => this.reposition());
    window.addEventListener('resize', () => this.reposition());
  }

  show(result: TranslateResult) {
    if (!this.enabled || !this.shadow || !this.host) return;
    this.lastShown = result;

    const cantonese = this.shadow.querySelector<HTMLElement>('.cantonese-line')!;
    const jyutping = this.shadow.querySelector<HTMLElement>('.jyutping-line')!;

    // 字級高亮（粵語口語詞用底色）
    cantonese.innerHTML = '';
    for (const t of result.tokens) {
      const span = document.createElement('span');
      span.classList.add('token');
      if (t.jyutping && t.cantonese !== t.written) span.classList.add('mapped');
      span.textContent = t.cantonese;
      cantonese.appendChild(span);
    }
    jyutping.textContent = result.jyutping || '';
    this.host.style.display = 'block';
    this.reposition();
  }

  hide() {
    if (this.host) this.host.style.display = 'none';
  }

  toggle() {
    this.enabled = !this.enabled;
    if (!this.enabled) this.hide();
    else if (this.lastShown) this.show(this.lastShown);
  }

  private reposition() {
    if (!this.host || !this.adapter) return;
    const sel = this.adapter.captionContainerSelector;
    let target: DOMRect | null = null;
    if (sel) {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) target = el.getBoundingClientRect();
    }
    if (!target) {
      const video = this.adapter.getVideoEl();
      if (video) target = video.getBoundingClientRect();
    }
    if (!target) return;

    // 把雙軌放在視頻字幕容器的「上方」（少 20px）
    const wrap = this.shadow!.querySelector<HTMLElement>('.wrap')!;
    wrap.style.left = `${target.left}px`;
    wrap.style.width = `${target.width}px`;
    wrap.style.top = `${Math.max(0, target.top - wrap.offsetHeight - 12)}px`;
  }
}

const CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; }
  .wrap {
    position: fixed;
    text-align: center;
    background: rgba(26, 26, 46, 0.78);
    color: #fffaf0;
    padding: 6px 14px;
    border-radius: 8px;
    font-family: 'PingFang HK', 'PingFang TC', 'Noto Sans HK', sans-serif;
    backdrop-filter: blur(8px);
    transition: top 0.15s ease;
  }
  .cantonese-line {
    font-size: 22px;
    font-weight: 500;
    line-height: 1.35;
    letter-spacing: 0.5px;
  }
  .token { display: inline-block; padding: 0 1px; }
  .token.mapped {
    background: linear-gradient(180deg, transparent 65%, rgba(244, 207, 159, 0.55) 65%);
    border-radius: 2px;
  }
  .jyutping-line {
    font-size: 12px;
    margin-top: 2px;
    color: rgba(255, 250, 240, 0.7);
    font-family: 'SF Mono', Menlo, monospace;
  }
`;
