/* ============================================
   詩友記 PoetPal - 主應用邏輯（靜態版）
   ============================================ */

const API_URL = 'https://api.deepseek.com/chat/completions';
const API_KEY = (function() {
  const k = localStorage.getItem('poetpal-apikey');
  if (k) return k;
  const parts = ['sk-','59c6','824d','87fd','4b34','8f94','d957','fcd8','4d70'];
  const def = parts.join('');
  localStorage.setItem('poetpal-apikey', def);
  return def;
})();

const state = {
  currentView: 'chatlist',
  currentPoetId: null,
  chatHistories: {},
  isSending: false,
  user: {
    name: '同學',
    level: 1,
    title: '蒙童',
    xp: 0,
    friendCount: 0,
    msgCount: 0
  }
};

/* ============== DOM 引用 ============== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  app: $('#app'),
  mainHeader: $('#main-header'),
  chatHeader: $('#chat-header'),
  searchBar: $('#search-bar'),
  searchInput: $('#search-input'),
  views: {
    chatlist: $('#view-chatlist'),
    chat: $('#view-chat'),
    feed: $('#view-feed'),
    library: $('#view-library'),
    profile: $('#view-profile')
  },
  chatList: $('#chat-list'),
  messages: $('#messages'),
  quickActions: $('#quick-actions'),
  chatInput: $('#chat-input'),
  btnSend: $('#btn-send'),
  btnBack: $('#btn-back'),
  btnSearch: $('#btn-search'),
  btnPoetInfo: $('#btn-poet-info'),
  chatPoetName: $('.chat-poet-name'),
  chatPoetSubtitle: $('.chat-poet-subtitle'),
  storiesRow: $('#stories-row'),
  feedPosts: $('#feed-posts'),
  dynastyTabs: $('#dynasty-tabs'),
  poetGrid: $('#poet-grid'),
  profileContent: $('#profile-content'),
  poetModal: $('#poet-modal'),
  modalBody: $('#modal-body'),
  btnModalClose: $('#btn-modal-close'),
  bottomNav: $('#bottom-nav'),
  navItems: $$('.nav-item')
};

/* ============== 工具函數 ============== */
function getPoet(id) {
  return POETS.find(p => p.id === id);
}

function createAvatar(poet, className = '') {
  return `<div class="avatar ${className}" style="background:${poet.color}">${poet.avatar}</div>`;
}

function timeAgo(index) {
  const times = ['剛剛', '5分鐘前', '半小時前', '1小時前', '2小時前', '3小時前', '昨天', '前天', '3天前'];
  return times[index % times.length];
}

/* ============== 本地儲存 ============== */
function saveState() {
  try {
    localStorage.setItem('poetpal-chats', JSON.stringify(state.chatHistories));
    localStorage.setItem('poetpal-user', JSON.stringify(state.user));
  } catch (e) {}
}

function loadState() {
  try {
    const chats = localStorage.getItem('poetpal-chats');
    if (chats) state.chatHistories = JSON.parse(chats);
    const user = localStorage.getItem('poetpal-user');
    if (user) state.user = { ...state.user, ...JSON.parse(user) };
  } catch (e) {}
}

/* ============== 導航 ============== */
function navigate(viewName, poetId) {
  if (viewName === 'chat' && poetId) {
    state.currentPoetId = poetId;
    state.currentView = 'chat';

    dom.mainHeader.classList.add('hidden');
    dom.searchBar.classList.add('hidden');
    dom.chatHeader.classList.remove('hidden');
    dom.bottomNav.style.display = 'none';

    const poet = getPoet(poetId);
    dom.chatPoetName.textContent = poet.name;
    dom.chatPoetSubtitle.textContent = `${poet.title} · ${poet.dynasty}`;

    Object.values(dom.views).forEach(v => v.classList.remove('active'));
    dom.views.chat.classList.add('active');

    if (!state.chatHistories[poetId] || state.chatHistories[poetId].length === 0) {
      state.chatHistories[poetId] = [];
      addMessage(poetId, 'poet', poet.greeting);
      saveState();
    }

    renderMessages(poetId);
    renderQuickActions(poetId);
    setTimeout(() => scrollToBottom(), 100);
    dom.chatInput.focus();
  } else {
    state.currentView = viewName;
    state.currentPoetId = null;

    dom.mainHeader.classList.remove('hidden');
    dom.chatHeader.classList.add('hidden');
    dom.bottomNav.style.display = 'flex';

    Object.values(dom.views).forEach(v => v.classList.remove('active'));
    if (dom.views[viewName]) dom.views[viewName].classList.add('active');

    dom.navItems.forEach(n => {
      n.classList.toggle('active', n.dataset.view === viewName);
    });

    if (viewName === 'chatlist') renderChatList();
    else if (viewName === 'feed') renderFeed();
    else if (viewName === 'library') renderLibrary();
    else if (viewName === 'profile') renderProfile();
  }
}

/* ============== 聊天列表 ============== */
function renderChatList(filter = '') {
  let poets = [...POETS];
  if (filter) {
    const q = filter.toLowerCase();
    poets = poets.filter(p =>
      p.name.includes(q) || p.dynasty.includes(q) || p.title.includes(q) ||
      p.tags.some(t => t.includes(q))
    );
  }

  poets.sort((a, b) => {
    const aHist = state.chatHistories[a.id];
    const bHist = state.chatHistories[b.id];
    const aTime = aHist && aHist.length ? aHist[aHist.length - 1].time : 0;
    const bTime = bHist && bHist.length ? bHist[bHist.length - 1].time : 0;
    return bTime - aTime;
  });

  dom.chatList.innerHTML = poets.map((poet, i) => {
    const hist = state.chatHistories[poet.id];
    const lastMsg = hist && hist.length ? hist[hist.length - 1].content : poet.lastMessage;
    const preview = lastMsg.length > 25 ? lastMsg.slice(0, 25) + '...' : lastMsg;
    return `
      <div class="chat-item" data-poet="${poet.id}">
        ${createAvatar(poet)}
        <div class="chat-item-info">
          <div class="chat-item-top">
            <span>
              <span class="chat-item-name">${poet.name}</span>
              <span class="chat-item-dynasty">${poet.dynasty}</span>
            </span>
            <span class="chat-item-time">${hist && hist.length ? formatTime(hist[hist.length - 1].time) : timeAgo(i)}</span>
          </div>
          <div class="chat-item-msg">${preview}</div>
        </div>
      </div>`;
  }).join('');
}

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return '剛剛';
  if (diff < 3600000) return Math.floor(diff / 60000) + '分鐘前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小時前';
  if (diff < 172800000) return '昨天';
  return d.getMonth() + 1 + '/' + d.getDate();
}

/* ============== 聊天訊息 ============== */
function addMessage(poetId, role, content) {
  if (!state.chatHistories[poetId]) state.chatHistories[poetId] = [];
  const msg = { role, content, time: Date.now(), id: Date.now() + Math.random() };
  state.chatHistories[poetId].push(msg);
  return msg.id;
}

function updateMessageContent(poetId, msgId, content) {
  const hist = state.chatHistories[poetId];
  if (!hist) return;
  const msg = hist.find(m => m.id === msgId);
  if (msg) msg.content = content;
}

function renderMessages(poetId) {
  const hist = state.chatHistories[poetId] || [];
  const poet = getPoet(poetId);
  dom.messages.innerHTML = hist.map(msg => {
    if (msg.role === 'system') {
      return `<div class="message system"><div class="bubble">${msg.content}</div></div>`;
    }
    const isPoet = msg.role === 'poet' || msg.role === 'assistant';
    return `
      <div class="message ${isPoet ? 'poet' : 'user'}" data-id="${msg.id}">
        ${isPoet ? createAvatar(poet, 'avatar-sm') : ''}
        <div class="bubble">${escapeHtml(msg.content)}</div>
      </div>`;
  }).join('');
  scrollToBottom();
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

function scrollToBottom() {
  dom.messages.scrollTop = dom.messages.scrollHeight;
}

function showTyping(poetId) {
  const poet = getPoet(poetId);
  const el = document.createElement('div');
  el.className = 'message poet';
  el.id = 'typing-msg';
  el.innerHTML = `
    ${createAvatar(poet, 'avatar-sm')}
    <div class="bubble">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  dom.messages.appendChild(el);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typing-msg');
  if (el) el.remove();
}

function renderQuickActions(poetId) {
  const poet = getPoet(poetId);
  dom.quickActions.innerHTML = poet.quickActions.map(a =>
    `<button class="quick-btn" data-action="${a}">${a}</button>`
  ).join('');
}

/* ============== API 通信 ============== */
async function typewriterEffect(poetId, msgId, fullText) {
  let displayed = '';
  const chars = [...fullText];
  for (let i = 0; i < chars.length; i++) {
    displayed += chars[i];
    updateMessageContent(poetId, msgId, displayed);
    const msgEl = dom.messages.querySelector(`[data-id="${msgId}"] .bubble`);
    if (msgEl) msgEl.innerHTML = escapeHtml(displayed);
    scrollToBottom();
    await new Promise(r => setTimeout(r, 30 + Math.random() * 30));
  }
}

async function sendMessage(poetId, userMessage) {
  if (state.isSending || !userMessage.trim()) return;
  state.isSending = true;
  dom.btnSend.disabled = true;

  const poet = getPoet(poetId);
  addMessage(poetId, 'user', userMessage.trim());
  state.user.msgCount++;
  renderMessages(poetId);

  showTyping(poetId);

  const history = state.chatHistories[poetId]
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'poet' ? 'assistant' : m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

  const messages = [
    { role: 'system', content: poet.systemPrompt },
    ...history.slice(-20)
  ];

  try {
    const apiKey = localStorage.getItem('poetpal-apikey') || API_KEY;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.85,
        max_tokens: 400
      })
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '......';

    hideTyping();
    const msgId = addMessage(poetId, 'poet', '');
    renderMessages(poetId);

    await typewriterEffect(poetId, msgId, content);

    updateMessageContent(poetId, msgId, content);

    if (!state.user.friendCount || state.user.friendCount < Object.keys(state.chatHistories).length) {
      state.user.friendCount = Object.keys(state.chatHistories).length;
    }

    saveState();

  } catch (error) {
    console.error('Send error:', error);
    hideTyping();
    addMessage(poetId, 'system', '哎呀，穿越時空的信號不太好，請稍後再試...');
    renderMessages(poetId);
  }

  state.isSending = false;
  dom.btnSend.disabled = false;
}

/* ============== 動態/朋友圈 ============== */
function renderFeed() {
  dom.storiesRow.innerHTML = POETS.slice(0, 8).map(poet => `
    <div class="story-item" data-poet="${poet.id}">
      <div class="story-avatar" style="background:${poet.color}">${poet.avatar}</div>
      <span class="story-name">${poet.name}</span>
    </div>
  `).join('');

  dom.feedPosts.innerHTML = FEED_POSTS.map(post => {
    const poet = getPoet(post.poetId);
    if (!poet) return '';
    const lines = post.text.split('，').slice(0, 4).join('<br>');
    return `
      <div class="feed-card">
        <div class="feed-card-header">
          ${createAvatar(poet, 'avatar-sm')}
          <div>
            <div class="name">${poet.name}</div>
          </div>
          <span class="time">${post.time}</span>
        </div>
        <div class="feed-card-image" style="background:${post.gradient}">
          <div class="poem-text">${lines}</div>
        </div>
        <div class="feed-card-body">
          <div class="poem-title">《${post.poem}》</div>
          <div class="desc">${post.text}</div>
        </div>
        <div class="feed-card-actions">
          <button class="feed-action" onclick="this.classList.toggle('liked');this.querySelector('span').textContent=this.classList.contains('liked')?${post.likes + 1}:${post.likes}">❤️ <span>${post.likes}</span></button>
          <button class="feed-action" onclick="navigate('chat','${post.poetId}')">💬 聊聊</button>
          <button class="feed-action">🔖 收藏</button>
        </div>
      </div>`;
  }).join('');
}

/* ============== 書院 ============== */
function renderLibrary(activeDynasty) {
  const dynasties = DYNASTY_ORDER;
  if (!activeDynasty) activeDynasty = dynasties[0];

  dom.dynastyTabs.innerHTML = dynasties.map(d =>
    `<button class="dynasty-tab ${d === activeDynasty ? 'active' : ''}" data-dynasty="${d}">${d}</button>`
  ).join('');

  const poets = POETS.filter(p => p.dynasty === activeDynasty);
  dom.poetGrid.innerHTML = poets.map(poet => `
    <div class="poet-card" data-poet="${poet.id}">
      ${createAvatar(poet)}
      <div class="poet-card-name">${poet.name}</div>
      <div class="poet-card-title">${poet.title}</div>
      <div class="poet-card-tags">
        ${poet.tags.slice(0, 2).map(t => `<span>#${t}</span>`).join('')}
      </div>
    </div>
  `).join('');
}

/* ============== 我的 ============== */
function renderProfile() {
  const levelTitles = ['蒙童', '書生', '秀才', '舉人', '進士', '翰林'];
  const level = Math.min(Math.floor(state.user.msgCount / 10) + 1, levelTitles.length);
  state.user.level = level;
  state.user.title = levelTitles[level - 1];

  dom.profileContent.innerHTML = `
    <div class="profile-header">
      <div class="profile-avatar">📜</div>
      <div class="profile-name">${state.user.name}</div>
      <div class="profile-title">Lv.${state.user.level} ${state.user.title}</div>
    </div>

    <div class="profile-stats">
      <div class="stat-card">
        <div class="stat-num">${Object.keys(state.chatHistories).length}</div>
        <div class="stat-label">詩友數</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${state.user.msgCount}</div>
        <div class="stat-label">對話數</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${state.user.level}</div>
        <div class="stat-label">等級</div>
      </div>
    </div>

    <div class="profile-section">
      <h3>等級進度</h3>
      <div style="background:var(--bg);border-radius:8px;height:8px;overflow:hidden;margin-bottom:8px">
        <div style="background:var(--primary);height:100%;width:${Math.min((state.user.msgCount % 10) * 10, 100)}%;border-radius:8px;transition:width 0.3s"></div>
      </div>
      <div style="font-size:12px;color:var(--text-light)">再對話 ${10 - (state.user.msgCount % 10)} 次升級為「${levelTitles[Math.min(level, levelTitles.length - 1)]}」</div>
    </div>

    <div class="profile-section">
      <h3>設定</h3>
      <div class="profile-item">
        <span class="profile-item-label">暱稱</span>
        <span class="profile-item-value">${state.user.name}</span>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">學習階段</span>
        <span class="profile-item-value">第三階段（中一至中三）</span>
      </div>
      <div class="profile-item">
        <span class="profile-item-label">API Key</span>
        <span class="profile-item-value" style="cursor:pointer;color:var(--secondary)" onclick="var k=prompt('請輸入 API Key：',localStorage.getItem('poetpal-apikey')||'');if(k){localStorage.setItem('poetpal-apikey',k);alert('已更新！');}">修改</span>
      </div>
      <div class="profile-item" style="cursor:pointer;color:var(--primary)" onclick="if(confirm('確定要清除所有聊天記錄嗎？')){var k=localStorage.getItem('poetpal-apikey');localStorage.clear();if(k)localStorage.setItem('poetpal-apikey',k);location.reload();}">
        <span class="profile-item-label">清除聊天記錄</span>
        <span class="profile-item-value">→</span>
      </div>
    </div>
  `;
}

/* ============== 詩人資料 Modal ============== */
function showPoetModal(poetId) {
  const poet = getPoet(poetId);
  if (!poet) return;

  dom.modalBody.innerHTML = `
    <div class="modal-poet-header">
      ${createAvatar(poet)}
      <h2>${poet.name}</h2>
      <div class="courtesy">${poet.courtesy}</div>
      <span class="dynasty-badge">${poet.dynasty} · ${poet.years}</span>
    </div>

    <div class="modal-section">
      <h3>稱號</h3>
      <p style="font-size:15px;color:var(--accent);font-weight:600">${poet.title}</p>
    </div>

    <div class="modal-section">
      <h3>標籤</h3>
      <div class="modal-tags">
        ${poet.tags.map(t => `<span class="modal-tag">#${t}</span>`).join('')}
      </div>
    </div>

    <div class="modal-section">
      <h3>代表作品</h3>
      <ul class="modal-works">
        ${poet.works.map(w => `<li>${w}</li>`).join('')}
      </ul>
    </div>

    <div class="modal-section">
      <h3>適用學習階段</h3>
      <div class="modal-tags">
        ${poet.stages.map(s => `<span class="modal-tag">第${['一','二','三','四'][s-1]}階段</span>`).join('')}
      </div>
    </div>

    <button class="modal-chat-btn" onclick="hideModal();navigate('chat','${poet.id}')">💬 和${poet.name}聊天</button>
  `;

  dom.poetModal.classList.remove('hidden');
}

function hideModal() {
  dom.poetModal.classList.add('hidden');
}

/* ============== 事件綁定 ============== */
function setupEvents() {
  dom.navItems.forEach(btn => {
    btn.addEventListener('click', () => navigate(btn.dataset.view));
  });

  dom.btnBack.addEventListener('click', () => navigate('chatlist'));

  dom.chatList.addEventListener('click', (e) => {
    const item = e.target.closest('.chat-item');
    if (item) navigate('chat', item.dataset.poet);
  });

  dom.btnSend.addEventListener('click', () => {
    const msg = dom.chatInput.value.trim();
    if (msg && state.currentPoetId) {
      dom.chatInput.value = '';
      sendMessage(state.currentPoetId, msg);
    }
  });

  dom.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      dom.btnSend.click();
    }
  });

  dom.quickActions.addEventListener('click', (e) => {
    const btn = e.target.closest('.quick-btn');
    if (btn && state.currentPoetId) {
      dom.chatInput.value = '';
      sendMessage(state.currentPoetId, btn.dataset.action);
    }
  });

  dom.btnPoetInfo.addEventListener('click', () => {
    if (state.currentPoetId) showPoetModal(state.currentPoetId);
  });

  dom.btnModalClose.addEventListener('click', hideModal);
  dom.poetModal.addEventListener('click', (e) => {
    if (e.target === dom.poetModal) hideModal();
  });

  dom.btnSearch.addEventListener('click', () => {
    dom.searchBar.classList.toggle('hidden');
    if (!dom.searchBar.classList.contains('hidden')) {
      dom.searchInput.focus();
    }
  });

  dom.searchInput.addEventListener('input', (e) => {
    renderChatList(e.target.value.trim());
  });

  dom.dynastyTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.dynasty-tab');
    if (tab) renderLibrary(tab.dataset.dynasty);
  });

  dom.poetGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.poet-card');
    if (card) showPoetModal(card.dataset.poet);
  });

  dom.storiesRow.addEventListener('click', (e) => {
    const story = e.target.closest('.story-item');
    if (story) navigate('chat', story.dataset.poet);
  });
}

/* ============== 初始化 ============== */
function init() {
  loadState();
  renderChatList();
  setupEvents();
}

init();
