import { ExtensionApi } from './lib/api'

const listEl = document.getElementById('vocab-list')!
const statusEl = document.getElementById('status')!
const statusTextEl = document.getElementById('status-text')!

function showStatus(text: string, color = 'var(--accent)') {
  statusEl.style.display = 'block'
  statusTextEl.style.color = color
  statusTextEl.textContent = text
}

async function load() {
  try {
    const res = await ExtensionApi.listVocab()
    if (res.entries.length === 0) {
      listEl.innerHTML = `<div class="empty">📭 還沒收藏任何生詞<br/>邊睇 YouTube 邊點 ☆ 收藏即可</div>`
      return
    }
    listEl.innerHTML = res.entries.slice(0, 50).map((e) => `
      <div class="vocab-item">
        <div class="v-written">📖 ${escape(e.written)}</div>
        <div class="v-cantonese">${escape(e.cantonese)}</div>
        ${e.jyutping ? `<div class="v-jyutping">${escape(e.jyutping)}</div>` : ''}
      </div>
    `).join('')
  } catch (err) {
    const e = err as Error & { status?: number }
    if (e.status === 401) {
      showStatus('請先登入 qingyiu.com 才能查看生詞本', 'var(--accent)')
      listEl.innerHTML = `<div class="empty"><a href="https://qingyiu.com" target="_blank">點此登入 →</a></div>`
    } else {
      listEl.innerHTML = `<div class="empty">載入失敗：${escape(e.message || '網路錯誤')}</div>`
    }
  }
}

function escape(s: string) {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c] || c))
}

load()
