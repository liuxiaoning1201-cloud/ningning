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
  selectedLibraryStage: 1,
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
    article: $('#view-article'),
    directory: $('#view-directory'),
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
  stageTabs: $('#stage-tabs'),
  articleList: $('#article-list'),
  articleReader: $('#article-reader'),
  dirSearch: $('#dir-search'),
  dirDynastyTabs: $('#dir-dynasty-tabs'),
  dirPoetGrid: $('#dir-poet-grid'),
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
    else if (viewName === 'library') renderLibrary(state.selectedLibraryStage);
    else if (viewName === 'directory') renderDirectory();
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
    triggerRandomRedPacket();

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
  const storyPoets = POETS.filter((_, i) => i < 12);
  dom.storiesRow.innerHTML = storyPoets.map(poet => `
    <div class="story-item" data-poet="${poet.id}">
      <div class="story-avatar" style="background:${poet.color}">${poet.avatar}</div>
      <span class="story-name">${poet.name}</span>
    </div>
  `).join('');

  dom.feedPosts.innerHTML = FEED_POSTS.map(post => {
    const poet = getPoet(post.poetId);
    if (!poet) return '';
    const lines = post.text.split('，').slice(0, 4).join('<br>');
    const repliesHtml = (post.replies || []).map(r => {
      const rp = getPoet(r.poetId);
      if (!rp) return '';
      return `<div class="feed-reply"><span class="feed-reply-name" style="color:${rp.color};cursor:pointer" onclick="navigate('chat','${r.poetId}')">${rp.name}</span>：${r.text}</div>`;
    }).join('');
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
        ${repliesHtml ? `<div class="feed-replies">${repliesHtml}</div>` : ''}
        <div class="feed-card-actions">
          <button class="feed-action" onclick="this.classList.toggle('liked');this.querySelector('span').textContent=this.classList.contains('liked')?${post.likes + 1}:${post.likes}">❤️ <span>${post.likes}</span></button>
          <button class="feed-action" onclick="navigate('chat','${post.poetId}')">💬 聊聊</button>
          <button class="feed-action">🔖 收藏</button>
        </div>
      </div>`;
  }).join('');
}

/* ============== 紅包問答 ============== */
function showRedPacket() {
  if (!POET_REDPACKETS || POET_REDPACKETS.length === 0) return;
  const idx = Math.floor(Math.random() * POET_REDPACKETS.length);
  const rp = POET_REDPACKETS[idx];
  const poet = getPoet(rp.poetId);
  const overlay = document.createElement('div');
  overlay.className = 'redpacket-overlay';
  overlay.innerHTML = `
    <div class="redpacket-card">
      <div class="redpacket-header">🧧 ${poet ? poet.name : '詩人'}的詩禮紅包</div>
      <div class="redpacket-question">${rp.question}</div>
      <input type="text" class="redpacket-input" placeholder="輸入你的答案⋯⋯" autofocus>
      <button class="redpacket-btn" onclick="checkRedPacket(this,'${rp.answer.replace(/'/g,"\\'")}','${rp.reward.replace(/'/g,"\\'")}')">拆紅包</button>
      <button class="redpacket-close" onclick="this.closest('.redpacket-overlay').remove()">先不了</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('.redpacket-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') overlay.querySelector('.redpacket-btn').click();
  });
}

function checkRedPacket(btn, answer, reward) {
  const overlay = btn.closest('.redpacket-overlay');
  const input = overlay.querySelector('.redpacket-input');
  const userAns = input.value.trim();
  if (!userAns) { input.focus(); return; }
  if (userAns.includes(answer) || answer.includes(userAns)) {
    state.user.xp = (state.user.xp || 0) + 10;
    state.user.msgCount += 2;
    saveState();
    overlay.querySelector('.redpacket-card').innerHTML = `
      <div class="redpacket-header" style="font-size:48px">🎉</div>
      <div class="redpacket-question">答對了！</div>
      <div style="margin:12px 0;font-size:16px;color:#e74c3c">${reward}</div>
      <button class="redpacket-btn" onclick="this.closest('.redpacket-overlay').remove()">收下</button>`;
  } else {
    overlay.querySelector('.redpacket-card').innerHTML = `
      <div class="redpacket-header" style="font-size:48px">😅</div>
      <div class="redpacket-question">差一點！正確答案是：</div>
      <div style="margin:12px 0;font-size:18px;font-weight:bold;color:var(--primary)">${answer}</div>
      <button class="redpacket-btn" onclick="this.closest('.redpacket-overlay').remove()">知道了</button>`;
  }
}

/* ============== 書院（文章展示）============== */
function renderLibrary(activeStage) {
  if (!activeStage) activeStage = state.selectedLibraryStage || 1;
  state.selectedLibraryStage = activeStage;
  const stageLabels = {1:'小一至小三',2:'小四至小六',3:'中一至中三',4:'中四至中六'};
  dom.stageTabs.innerHTML = [1,2,3,4].map(s =>
    `<button class="dynasty-tab ${s===activeStage?'active':''}" data-stage="${s}">第${['一','二','三','四'][s-1]}階段<span class="stage-sub">${stageLabels[s]}</span></button>`
  ).join('');

  const articles = ARTICLES.filter(a => a.stage === activeStage);
  dom.articleList.innerHTML = articles.map(a => `
    <div class="article-card" data-article="${a.id}">
      <div class="article-card-left">
        <div class="article-title-row">
          <span class="article-title">${a.title}</span>
          ${a.dse?'<span class="dse-badge">DSE</span>':''}
        </div>
        <div class="article-meta">${a.author}${a.dynasty?' · '+a.dynasty:''}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>`).join('');
}

/* ============== 文章閱讀器 ============== */
function openArticle(articleId) {
  const art = ARTICLES.find(a => a.id === articleId);
  if (!art) return;
  state.selectedLibraryStage = art.stage;
  state.currentView = 'article';
  dom.mainHeader.classList.add('hidden');
  dom.searchBar.classList.add('hidden');
  dom.chatHeader.classList.remove('hidden');
  dom.bottomNav.style.display = 'none';
  dom.chatPoetName.textContent = art.title;
  dom.chatPoetSubtitle.textContent = art.author + (art.dynasty ? ' · ' + art.dynasty : '');
  Object.values(dom.views).forEach(v => v.classList.remove('active'));
  dom.views.article.classList.add('active');

  let audioHtml = '';
  if (art.audioC || art.audioP || art.audioY) {
    audioHtml = '<div class="article-audio-row">';
    if (art.audioC) audioHtml += `<button class="audio-btn" data-src="${encodeURI(art.audioC)}" onclick="playArticleAudio(this,this.dataset.src)">🗣️ 粵語朗讀</button>`;
    if (art.audioP) audioHtml += `<button class="audio-btn" data-src="${encodeURI(art.audioP)}" onclick="playArticleAudio(this,this.dataset.src)">🗣️ 普通話朗讀</button>`;
    if (art.audioY) audioHtml += `<button class="audio-btn audio-btn-chant" data-src="${encodeURI(art.audioY)}" onclick="playArticleAudio(this,this.dataset.src)">🎵 粵語吟誦</button>`;
    audioHtml += '</div>';
  }

  let textHtml = '';
  if (art.text) {
    const parsed = parseAnnotatedText(art.text, art);
    textHtml = `<div class="article-text-container" onclick="dismissAnnotation(event)">
      <div class="article-text-body">${parsed}</div>
      <div class="annotation-bubble hidden" id="ann-bubble"></div>
    </div>`;
  }

  const ana = (typeof ANALYSIS !== 'undefined') ? ANALYSIS[art.id] : null;
  let analysisHtml = '';
  if (ana) {
    if (ana.authorIntro) {
      analysisHtml += `<div class="analysis-block"><h4 class="analysis-label">作者簡介</h4><div class="analysis-text">${formatAnalysis(ana.authorIntro)}</div></div>`;
    }
    if (ana.background) {
      analysisHtml += `<div class="analysis-block"><h4 class="analysis-label">背景資料</h4><div class="analysis-text">${formatAnalysis(ana.background)}</div></div>`;
    }
    if (ana.highlights) {
      analysisHtml += `<div class="analysis-block"><h4 class="analysis-label">賞析重點</h4><div class="analysis-text">${formatAnalysis(ana.highlights)}</div></div>`;
    }
  }

  dom.articleReader.innerHTML = `
    <div class="article-header-info">
      <h2 class="article-reader-title">${art.title}</h2>
      <div class="article-reader-meta">${art.author}${art.dynasty?' · '+art.dynasty:''}</div>
      ${audioHtml}
    </div>
    ${textHtml}
    <div class="article-actions-bar">
      ${art.poetId ? `<button class="article-action-link" onclick="navigate('chat','${art.poetId}')">💬 和${art.author}聊天</button>` : ''}
      <button class="article-action-link ai-interpret-btn" onclick="aiInterpret('${art.id}')">🤖 AI 解讀</button>
    </div>
    <div class="ai-result-panel hidden" id="ai-result-panel"></div>
    ${analysisHtml ? '<div class="article-analysis-section">' + analysisHtml + '</div>' : ''}`;
  dom.articleReader.scrollTop = 0;
}

function parseAnnotatedText(text, art) {
  let cleaned = text;
  if (art && art.title && art.author) {
    cleaned = cleaned.replace(new RegExp('^' + art.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/[（(].*/,'') + '[^\\n]*\\n' + art.author.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '\\n?'), '');
  }
  cleaned = cleaned.replace(/^\s*\n/, '');

  const annotate = s => s.replace(/\{([^|]+)\|([^}]+)\}/g,
    '<span class="keyword" onclick="toggleAnnotation(this,\'$2\',event)">$1</span>');

  const allLines = cleaned.split('\n');
  const plainAll = cleaned.replace(/\{([^|]+)\|[^}]*\}/g, '$1');
  const totalLen = plainAll.replace(/\n/g, '').length;
  const avgLen = allLines.reduce((s,l) => s + l.replace(/\{[^}]*\}/g,'').length, 0) / Math.max(allLines.length,1);
  const endsWithPunct = allLines.filter(l => /[。！？，；」』\n]$/.test(l.replace(/\{([^|]+)\|[^}]*\}/g,'$1').trim())).length;
  const punctRatio = endsWithPunct / Math.max(allLines.length,1);
  const isPoem = avgLen < 30 && allLines.length >= 3 && totalLen < 300 && punctRatio > 0.5;
  const cls = isPoem ? 'text-para text-verse' : 'text-para';

  if (cleaned.includes('\n\n')) {
    return cleaned.split('\n\n').map(para =>
      '<p class="' + cls + '">' + annotate(para.replace(/\n/g, '<br>')) + '</p>'
    ).join('');
  }
  const lines = allLines;
  if (isPoem) {
    return '<p class="text-verse">' + annotate(cleaned.replace(/\n/g, '<br>')) + '</p>';
  }
  const paras = [];
  let buf = [];
  for (const line of lines) {
    const raw = line.replace(/\{([^|]+)\|[^}]*\}/g, '$1').trim();
    if (buf.length > 0 && raw.length > 0 && /^[　「『]/.test(raw)) {
      paras.push(buf.join(''));
      buf = [line];
    } else if (buf.length > 0 && raw.length > 0 && buf[buf.length-1].replace(/\{([^|]+)\|[^}]*\}/g,'$1').trim().endsWith('。') && !raw.startsWith('」') && !raw.startsWith('』')) {
      paras.push(buf.join(''));
      buf = [line];
    } else {
      buf.push(line);
    }
  }
  if (buf.length) paras.push(buf.join(''));
  return paras.map(p => '<p class="text-para">' + annotate(p) + '</p>').join('');
}

function toggleAnnotation(el, def, e) {
  if (e) e.stopPropagation();
  const bubble = document.getElementById('ann-bubble');
  if (bubble.classList.contains('hidden') || bubble.dataset.word !== el.textContent) {
    bubble.innerHTML = `<strong>${el.textContent}</strong><br>${def}`;
    bubble.dataset.word = el.textContent;
    const rect = el.getBoundingClientRect();
    const container = el.closest('.article-text-container').getBoundingClientRect();
    bubble.style.top = (rect.top - container.top) + 'px';
    bubble.classList.remove('hidden');
  } else {
    bubble.classList.add('hidden');
  }
}

function dismissAnnotation(e) {
  const bubble = document.getElementById('ann-bubble');
  if (bubble && !bubble.classList.contains('hidden')) {
    if (!e.target.classList.contains('keyword')) {
      bubble.classList.add('hidden');
    }
  }
}

function playArticleAudio(btn, src) {
  const existing = document.getElementById('article-audio-player');
  if (existing) { existing.pause(); existing.remove(); }
  if (btn.classList.contains('playing')) {
    btn.classList.remove('playing');
    btn.textContent = btn.textContent.replace('⏸️','🗣️');
    return;
  }
  document.querySelectorAll('.audio-btn.playing').forEach(b => {
    b.classList.remove('playing');
    b.textContent = b.textContent.replace('⏸️','🗣️');
  });
  const audio = document.createElement('audio');
  audio.id = 'article-audio-player';
  audio.src = src;
  audio.style.display = 'none';
  document.body.appendChild(audio);
  audio.play().catch(() => {});
  btn.classList.add('playing');
  btn.textContent = btn.textContent.replace('🗣️','⏸️');
  audio.onended = () => {
    btn.classList.remove('playing');
    btn.textContent = btn.textContent.replace('⏸️','🗣️');
    audio.remove();
  };
}

/* ============== 名人堂（詩人檢索）============== */
function renderDirectory(activeDynasty, filter) {
  const dynasties = DYNASTY_ORDER;
  if (!activeDynasty) activeDynasty = '全部';
  dom.dirDynastyTabs.innerHTML = ['全部', ...dynasties].map(d =>
    `<button class="dynasty-tab ${d === activeDynasty ? 'active' : ''}" data-dir-dynasty="${d}">${d}</button>`
  ).join('');

  let poets = [...POETS];
  if (activeDynasty !== '全部') poets = poets.filter(p => p.dynasty === activeDynasty);
  if (filter) {
    const q = filter.toLowerCase();
    poets = poets.filter(p => p.name.includes(q) || p.courtesy.includes(q) || p.dynasty.includes(q));
  }

  dom.dirPoetGrid.innerHTML = poets.map(poet => `
    <div class="dir-poet-card" data-dir-poet="${poet.id}">
      ${createAvatar(poet)}
      <div class="dir-poet-info">
        <div class="dir-poet-name">${poet.name}</div>
        <div class="dir-poet-meta">${poet.dynasty} · ${poet.title}</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-light)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>`).join('');
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
      <div class="profile-item" style="cursor:pointer;color:#e74c3c" onclick="showRedPacket()">
        <span class="profile-item-label">🧧 每日詩禮紅包</span>
        <span class="profile-item-value">答題拿金幣 →</span>
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
        ${poet.works.map(w => {
          const art = typeof ARTICLES !== 'undefined' ? ARTICLES.find(a => a.title.includes(w.replace(/[（(].*/,'')) || w.includes(a.title)) : null;
          return art
            ? `<li class="work-link" onclick="hideModal();openArticle('${art.id}')">${w} →</li>`
            : `<li>${w}</li>`;
        }).join('')}
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

  dom.btnBack.addEventListener('click', () => {
    const existing = document.getElementById('article-audio-player');
    if (existing) { existing.pause(); existing.remove(); }
    if (state.currentView === 'article') navigate('library');
    else navigate('chatlist');
  });

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

  dom.stageTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.dynasty-tab');
    if (tab && tab.dataset.stage) renderLibrary(parseInt(tab.dataset.stage));
  });

  dom.articleList.addEventListener('click', (e) => {
    const card = e.target.closest('.article-card');
    if (card) openArticle(card.dataset.article);
  });

  dom.dirDynastyTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.dynasty-tab');
    if (tab && tab.dataset.dirDynasty) renderDirectory(tab.dataset.dirDynasty, dom.dirSearch.value.trim());
  });

  dom.dirPoetGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.dir-poet-card');
    if (card) showPoetModal(card.dataset.dirPoet);
  });

  dom.dirSearch.addEventListener('input', (e) => {
    const active = dom.dirDynastyTabs.querySelector('.dynasty-tab.active');
    renderDirectory(active ? active.dataset.dirDynasty : '全部', e.target.value.trim());
  });

  dom.storiesRow.addEventListener('click', (e) => {
    const story = e.target.closest('.story-item');
    if (story) navigate('chat', story.dataset.poet);
  });

  dom.feedPosts.addEventListener('click', (e) => {
    const nameEl = e.target.closest('.feed-reply-name');
    if (nameEl) return;
  });
}

function formatAnalysis(text) {
  if (!text) return '';
  if (text.includes('\n')) {
    return text.split('\n').filter(p => p.trim()).map(p => '<p class="ana-para">' + p.trim() + '</p>').join('');
  }
  const sentences = text.match(/[^。！？]+[。！？]+/g) || [text];
  const paras = [];
  let buf = [];
  for (let i = 0; i < sentences.length; i++) {
    buf.push(sentences[i]);
    if (buf.join('').length > 150 && i < sentences.length - 1) {
      paras.push(buf.join(''));
      buf = [];
    }
  }
  if (buf.length) paras.push(buf.join(''));
  if (paras.length <= 1) return '<p class="ana-para">' + text + '</p>';
  return paras.map(p => '<p class="ana-para">' + p + '</p>').join('');
}

async function aiInterpret(articleId) {
  const art = ARTICLES.find(a => a.id === articleId);
  if (!art || !art.text) return;
  const panel = document.getElementById('ai-result-panel');
  if (!panel) return;

  if (!panel.classList.contains('hidden') && panel.dataset.artId === articleId) {
    panel.classList.add('hidden');
    return;
  }

  panel.dataset.artId = articleId;
  panel.classList.remove('hidden');
  panel.innerHTML = '<div class="ai-loading"><span class="ai-spinner"></span> AI 正在解讀中...</div>';

  const plainText = art.text.replace(/\{([^|]+)\|[^}]*\}/g, '$1');

  try {
    const apiKey = localStorage.getItem('poetpal-apikey') || API_KEY;
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: '你是一位香港中學的專業古文翻譯老師。請將以下文言文翻譯成通俗易懂的現代白話文。嚴格要求：1)必須使用香港繁體字（依照香港教育局標準用字，例如用「裏」不用「裡」、用「牀」不用「床」、用「啟」不用「啓」、用「綫」不用「線」等）；2)翻譯準確，忠於原文；3)語言流暢自然，適合香港中小學生閱讀；4)按原文的段落結構分段翻譯；5)不要加入個人評價或額外解釋。直接輸出翻譯結果。' },
          { role: 'user', content: '請用香港繁體字將以下文言文翻譯成現代白話文：\n\n' + plainText }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });
    if (!res.ok) throw new Error('API error: ' + res.status);
    const data = await res.json();
    const result = data.choices?.[0]?.message?.content || '翻譯失敗';
    const formatted = result.split('\n').filter(l => l.trim()).map(l => '<p class="ai-para">' + l + '</p>').join('');
    panel.innerHTML = `<div class="ai-result-header"><span>🤖 AI 白話文翻譯</span><button class="ai-close-btn" onclick="document.getElementById('ai-result-panel').classList.add('hidden')">✕</button></div><div class="ai-result-body">${formatted}</div>`;
  } catch (e) {
    panel.innerHTML = '<div class="ai-error">解讀失敗，請稍後再試</div>';
  }
}

function triggerRandomRedPacket() {
  if (typeof POET_REDPACKETS === 'undefined' || !POET_REDPACKETS.length) return;
  if (state.user.msgCount > 0 && state.user.msgCount % 5 === 0) {
    setTimeout(showRedPacket, 800);
  }
}

/* ============== 初始化 ============== */
function init() {
  loadState();
  renderChatList();
  setupEvents();
}

init();
