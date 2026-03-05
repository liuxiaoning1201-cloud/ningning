/**
 * 詩人的朋友圈 - 主應用邏輯
 */
(function() {
  const API_BASE_KEY = 'poets_api_base';
  const MOMENTS_KEY = 'poets_moments';

  let currentAuthor = null;
  let chatHistory = [];
  let moments = [];

  // 取得作者簡稱（用於頭像）
  function getAuthorShortName(name) {
    return name.length >= 2 ? name.slice(-1) : name;
  }

  // 篩選作者
  function getFilteredAuthors(stageFilter) {
    if (!stageFilter) return AUTHORS;
    const stage = parseInt(stageFilter, 10);
    return AUTHORS.filter(a => a.works.some(w => w.stage === stage));
  }

  // 渲染作者列表
  function renderAuthorList(containerId, stageFilter, onClick) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const authors = getFilteredAuthors(stageFilter);
    container.innerHTML = authors.map(a => `
      <div class="author-card" data-id="${a.id}">
        <div class="author-avatar">${getAuthorShortName(a.name)}</div>
        <div class="name">${a.name}</div>
        <div class="era">${a.era}</div>
      </div>
    `).join('');
    container.querySelectorAll('.author-card').forEach(card => {
      card.addEventListener('click', () => onClick(card.dataset.id));
    });
  }

  // 頁面切換
  function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const page = document.getElementById('page-' + pageId);
    const tab = document.querySelector(`.nav-tab[data-page="${pageId}"]`);
    if (page) page.classList.add('active');
    if (tab) tab.classList.add('active');
    document.getElementById('backBtn').classList.toggle('visible', pageId !== 'home');
  }

  // 導航
  document.querySelectorAll('.nav-tab, .home-card').forEach(el => {
    el.addEventListener('click', () => {
      const page = el.dataset.page;
      if (page) showPage(page);
    });
  });

  document.getElementById('backBtn').addEventListener('click', () => showPage('home'));

  // ========== 聊天功能 ==========
  function selectAuthor(authorId) {
    const author = AUTHORS.find(a => a.id === authorId);
    if (!author) return;
    currentAuthor = author;
    chatHistory = [];

    document.getElementById('chatHeader').style.display = 'flex';
    document.getElementById('chatInputArea').style.display = 'flex';
    document.getElementById('chatPlaceholder').style.display = 'none';
    document.getElementById('chatAvatar').textContent = getAuthorShortName(author.name);
    document.getElementById('chatAuthorName').textContent = author.name;
    document.getElementById('chatAuthorEra').textContent = `${author.era} · ${author.persona.split('，')[0]}`;

    const messagesEl = document.getElementById('chatMessages');
    messagesEl.innerHTML = '';
    addSystemMessage(messagesEl, `${author.name}：你好，我是${author.name}。關於我的作品與香港教育局建議篇章，有什麼想問的嗎？`);
  }

  function addSystemMessage(container, text) {
    const div = document.createElement('div');
    div.className = 'chat-msg author';
    div.innerHTML = `<div class="author-name">${currentAuthor.name}</div>${escapeHtml(text)}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addUserMessage(container, text) {
    const div = document.createElement('div');
    div.className = 'chat-msg user';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function addLoadingMessage(container) {
    const div = document.createElement('div');
    div.className = 'chat-msg author';
    div.id = 'chatLoading';
    div.innerHTML = '<div class="author-name">' + currentAuthor.name + '</div><span class="chat-loading">思考中...</span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const text = (input.value || '').trim();
    if (!text || !currentAuthor) return;

    const messagesEl = document.getElementById('chatMessages');
    addUserMessage(messagesEl, text);
    chatHistory.push({ role: 'user', content: text });
    input.value = '';

    const btn = document.getElementById('chatSendBtn');
    btn.disabled = true;
    addLoadingMessage(messagesEl);

    const apiBase = (document.getElementById('apiBaseUrl').value || '').trim();
    if (!apiBase) {
      removeLoading();
      addSystemMessage(messagesEl, '請先在左側設定 API 代理網址（例如 http://localhost:3001），並確保後端服務已啟動。');
      btn.disabled = false;
      return;
    }

    try {
      const systemPrompt = buildSystemPrompt(currentAuthor);
      const response = await fetch(apiBase + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: systemPrompt,
          messages: chatHistory
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const errMsg = data.error || (typeof data === 'string' ? data : '請求失敗');
        throw new Error(errMsg);
      }
      const reply = data.reply || data.content || '無法取得回覆。';
      chatHistory.push({ role: 'assistant', content: reply });
      removeLoading();
      addSystemMessage(messagesEl, reply);
    } catch (err) {
      removeLoading();
      let msg = err.message || '請檢查 API 設定與網路連線。';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        msg = '無法連線至後端，請確認：1) 後端已執行 node server.js  2) API 網址正確（http://localhost:3001）';
      }
      addSystemMessage(messagesEl, '回覆失敗：' + msg);
    }
    btn.disabled = false;
  }

  function removeLoading() {
    const el = document.getElementById('chatLoading');
    if (el) el.remove();
  }

  function buildSystemPrompt(author) {
    const worksText = author.works.map(w =>
      `【${w.title}】\n${w.content}`
    ).join('\n\n');
    return `你是【${author.name}】，【${author.era}】時期的文學家。
你的性格與風格：${author.persona}

以下是香港教育局建議篇章中與你有關的作品，請基於這些內容回答學生的問題，勿杜撰課本外的虛假資訊：

${worksText}

回答時請：
1. 以第一人稱、符合你人設的口吻回答
2. 若學生問及詩詞/文言意思、字詞解釋、寫作背景，請基於上述篇章準確回答
3. 若問題超出你的作品範圍，可禮貌說明並建議學生查閱相關篇章
4. 用語適宜中小學生理解，可適度用白話解釋文言`;
  }

  // 聊天事件
  document.getElementById('chatSendBtn').addEventListener('click', sendChatMessage);
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  document.getElementById('stageFilter').addEventListener('change', e => {
    renderAuthorList('authorList', e.target.value, selectAuthor);
  });

  // 測試連線
  document.getElementById('testConnectionBtn').addEventListener('click', async () => {
    const apiBase = (document.getElementById('apiBaseUrl').value || '').trim();
    const statusEl = document.getElementById('connectionStatus');
    if (!apiBase) {
      statusEl.textContent = '請先輸入 API 網址';
      statusEl.style.color = '#c45c5c';
      return;
    }
    statusEl.textContent = '連線中...';
    statusEl.style.color = 'inherit';
    try {
      const res = await fetch(apiBase + '/health');
      const data = await res.json();
      if (data.ok && data.hasKey) {
        statusEl.textContent = '✓ 連線成功，金鑰已載入';
        statusEl.style.color = '#2e7d32';
      } else if (data.ok && !data.hasKey) {
        statusEl.textContent = '⚠ 後端運行中，但未載入 API 金鑰';
        statusEl.style.color = '#ed6c02';
      } else {
        statusEl.textContent = '✗ 連線異常';
        statusEl.style.color = '#c45c5c';
      }
    } catch (err) {
      statusEl.textContent = '✗ 連線失敗：' + (err.message || '請確認後端已啟動');
      statusEl.style.color = '#c45c5c';
    }
  });

  // 載入時渲染作者
  renderAuthorList('authorList', '', selectAuthor);

  // API 網址：若透過 launch.js 啟動，使用同源 /api 代理，無需跨域
  const savedApi = localStorage.getItem(API_BASE_KEY);
  const apiInput = document.getElementById('apiBaseUrl');
  const defaultApi = (typeof location !== 'undefined' && location.origin && location.protocol !== 'file:')
    ? location.origin + '/api'  // 同源代理，一鍵啟動時自動連線
    : 'http://localhost:3001';
  apiInput.value = savedApi || defaultApi;
  apiInput.addEventListener('blur', e => {
    localStorage.setItem(API_BASE_KEY, e.target.value);
  });

  // ========== 朋友圈功能 ==========
  function loadMoments() {
    try {
      const raw = localStorage.getItem(MOMENTS_KEY);
      moments = raw ? JSON.parse(raw) : [];
    } catch (_) {
      moments = [];
    }
  }

  function saveMoments() {
    localStorage.setItem(MOMENTS_KEY, JSON.stringify(moments));
    renderMoments();
  }

  function renderMoments() {
    const container = document.getElementById('momentsList');
    const stageFilter = document.getElementById('momentsStageFilter').value;
    let list = [...moments].sort((a, b) => (b.time || 0) - (a.time || 0));
    if (stageFilter) {
      const stage = parseInt(stageFilter, 10);
      list = list.filter(m => {
        const author = AUTHORS.find(a => a.id === m.authorId);
        return author && author.works.some(w => w.stage === stage);
      });
    }
    container.innerHTML = list.map(m => {
      const author = AUTHORS.find(a => a.id === m.authorId) || { name: '佚名', era: '' };
      const likes = m.likes || [];
      const comments = m.comments || [];
      const isLiked = likes.includes('me');
      return `
        <div class="moment-card" data-id="${m.id}">
          <div class="moment-header">
            <div class="moment-avatar">${getAuthorShortName(author.name)}</div>
            <div>
              <div class="name">${author.name}</div>
              <div class="meta">${author.era} · ${formatTime(m.time)}</div>
            </div>
          </div>
          <div class="moment-content">${escapeHtml(m.content)}</div>
          <div class="moment-actions">
            <span class="moment-action like-btn ${isLiked ? 'liked' : ''}" data-id="${m.id}">❤️ ${likes.length}</span>
            <span class="moment-action comment-btn" data-id="${m.id}">💬 ${comments.length}</span>
            <span class="moment-action repost-btn" data-id="${m.id}">🔄 轉發</span>
            <span class="moment-action ask-btn" data-id="${m.id}">向TA提問</span>
          </div>
          ${comments.length ? `
            <div class="moment-comments">
              ${comments.map(c => {
                const ca = AUTHORS.find(a => a.id === c.authorId) || { name: '佚名' };
                return `<div class="moment-comment"><span class="author">${ca.name}：</span>${escapeHtml(c.text)}</div>`;
              }).join('')}
            </div>
          ` : ''}
        </div>
      `;
    }).join('') || '<p style="text-align:center;color:var(--accent-dark);padding:40px;">尚無動態，快來發第一條吧！</p>';

    container.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleLike(btn.dataset.id));
    });
    container.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', () => openCommentModal(btn.dataset.id));
    });
    container.querySelectorAll('.repost-btn').forEach(btn => {
      btn.addEventListener('click', () => openRepostModal(btn.dataset.id));
    });
    container.querySelectorAll('.ask-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const m = moments.find(x => x.id === btn.dataset.id);
        if (m) {
          selectAuthor(m.authorId);
          showPage('chat');
        }
      });
    });
  }

  let commentTargetId = null;

  function openCommentModal(momentId) {
    commentTargetId = momentId;
    const commentAuthorSelect = document.getElementById('commentAuthor');
    commentAuthorSelect.innerHTML = '<option value="">請選擇</option>';
    AUTHORS.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = `${a.name}（${a.era}）`;
      commentAuthorSelect.appendChild(opt);
    });
    document.getElementById('commentText').value = '';
    document.getElementById('commentModal').classList.add('active');
  }

  document.getElementById('commentCancel').addEventListener('click', () => {
    document.getElementById('commentModal').classList.remove('active');
    commentTargetId = null;
  });

  document.getElementById('commentSubmit').addEventListener('click', () => {
    if (!commentTargetId) return;
    const m = moments.find(x => x.id === commentTargetId);
    const authorId = document.getElementById('commentAuthor').value;
    const text = (document.getElementById('commentText').value || '').trim();
    if (!authorId || !text) {
      alert('請選擇作者並輸入評論');
      return;
    }
    m.comments = m.comments || [];
    m.comments.push({ authorId, text });
    document.getElementById('commentModal').classList.remove('active');
    commentTargetId = null;
    saveMoments();
  });

  function openRepostModal(momentId) {
    const m = moments.find(x => x.id === momentId);
    if (!m) return;
    const author = AUTHORS.find(a => a.id === m.authorId);
    const authorName = author ? author.name : '佚名';
    postAuthorSelect.value = 'sushi'; // 預設蘇軾轉發
    document.getElementById('postContent').value = `「${m.content}」\n—— 轉發自 ${authorName}`;
    document.getElementById('postModal').classList.add('active');
  }

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分鐘前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小時前';
    return d.toLocaleDateString('zh-Hant');
  }

  function toggleLike(momentId) {
    const m = moments.find(x => x.id === momentId);
    if (!m) return;
    m.likes = m.likes || [];
    const idx = m.likes.indexOf('me');
    if (idx >= 0) m.likes.splice(idx, 1);
    else m.likes.push('me');
    saveMoments();
  }

  // 發文
  const postAuthorSelect = document.getElementById('postAuthor');
  const postAuthorHint = document.getElementById('postAuthorHint');
  AUTHORS.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.id;
    opt.textContent = `${a.name}（${a.era}）`;
    postAuthorSelect.appendChild(opt);
  });
  postAuthorSelect.addEventListener('change', () => {
    const a = AUTHORS.find(x => x.id === postAuthorSelect.value);
    postAuthorHint.textContent = a ? '可引用：' + a.works.map(w => w.title).join('、') : '';
  });

  document.getElementById('postBtn').addEventListener('click', () => {
    document.getElementById('postModal').classList.add('active');
    document.getElementById('postContent').value = '';
  });

  document.getElementById('postCancel').addEventListener('click', () => {
    document.getElementById('postModal').classList.remove('active');
  });

  // 簡易語言規範檢查
  const SENSITIVE_WORDS = ['髒話', '粗口']; // 可擴充
  function checkContent(content) {
    const lower = content.toLowerCase();
    for (const w of SENSITIVE_WORDS) {
      if (content.includes(w)) return { ok: false, msg: '內容含不當用詞，請修改後再發送。' };
    }
    if (content.length > 500) return { ok: false, msg: '內容過長，請精簡至 500 字以內。' };
    return { ok: true };
  }

  document.getElementById('postSubmit').addEventListener('click', () => {
    const authorId = postAuthorSelect.value;
    const content = (document.getElementById('postContent').value || '').trim();
    if (!authorId || !content) {
      alert('請選擇作者並輸入內容');
      return;
    }
    const check = checkContent(content);
    if (!check.ok) {
      alert(check.msg);
      return;
    }
    moments.push({
      id: 'm_' + Date.now(),
      authorId,
      content,
      time: Date.now(),
      likes: [],
      comments: []
    });
    document.getElementById('postModal').classList.remove('active');
    saveMoments();
  });

  document.getElementById('momentsStageFilter').addEventListener('change', renderMoments);

  // 初始化
  loadMoments();
  renderMoments();
})();
