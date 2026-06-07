/**
 * 巧手猜猜畫 — 前端應用
 * 多人連線：建房/純數字房間碼進房、輪流出題、實物貼紙共享畫布、打字搶猜、遞減計分。
 */
(() => {
'use strict';

// 後端 Worker 位址（部署後若帳號不同請改這裡）
const SERVER = 'https://caihua-game.liuxiaoning1201.workers.dev';
const WS_BASE = SERVER.replace(/^http/, 'ws');

const STORAGE_NAME = 'caihua_name';
const STORAGE_WORDBOOK = 'caihua_wordbook';

// 實物貼紙調色盤
const PALETTE = ['✏️','🖊️','🖍️','📏','📐','✂️','📚','📓','🧹','🪣','🧴','☕','🥄','🍴','🥢','🔑','📎','🧦','🧤','🎒','⚽','🏀','🔔','🕯️','🍎','🍌','🥕','🌂','🧵','📌','💡','🪥','🧼','🥖','🍩','🌙','⭐','❤️','🔺','⚫'];
const STICKER_BASE = 46; // px

// ─── 狀態 ───
const S = {
  ws: null,
  roomId: '',
  name: '',
  playerId: '',
  isHost: false,
  isDrawer: false,
  drawerId: '',
  players: {},
  word: null,
  wordLen: 0,
  stickers: [],
  selectedId: null,
  timerInt: null,
  secondsLeft: 0,
  candidates: [],        // 候選詞語
  selected: new Set(),   // 已勾選詞語
  intentionalLeave: false,
  reconnectTimer: null,
};

// ─── DOM ───
const $ = (id) => document.getElementById(id);
const screens = {
  lobby: $('screen-lobby'),
  room: $('screen-room'),
  game: $('screen-game'),
};
function show(name) {
  for (const k in screens) screens[k].classList.toggle('active', k === name);
}

// ─── Toast ───
let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2400);
}

// ═══════════════ 連線 ═══════════════
async function createRoom() {
  const name = getName();
  if (!name) return;
  setLobbyError('');
  try {
    const res = await fetch(`${SERVER}/api/create-room`, { method: 'POST' });
    const data = await res.json();
    if (!data.roomId) throw new Error('建立房間失敗');
    connect(data.roomId);
  } catch (e) {
    setLobbyError('無法連線伺服器，請稍後再試');
  }
}

async function joinRoom() {
  const name = getName();
  if (!name) return;
  const code = $('input-room-code').value.replace(/\D/g, '');
  if (code.length < 4) return setLobbyError('請輸入正確的房間碼');
  setLobbyError('');
  try {
    const res = await fetch(`${SERVER}/api/room-info?id=${code}`);
    const info = await res.json();
    if (!info.exists) return setLobbyError('找不到該房間');
    connect(code);
  } catch {
    setLobbyError('無法連線伺服器，請稍後再試');
  }
}

function connect(roomId) {
  S.roomId = roomId;
  S.intentionalLeave = false;
  openSocket();
}

function openSocket() {
  if (S.ws) { try { S.ws.close(); } catch {} }
  const ws = new WebSocket(`${WS_BASE}/ws?room=${S.roomId}`);
  S.ws = ws;
  ws.addEventListener('open', () => {
    send({ type: 'join', name: S.name });
  });
  ws.addEventListener('message', (e) => {
    let msg; try { msg = JSON.parse(e.data); } catch { return; }
    onServerMessage(msg);
  });
  ws.addEventListener('close', () => {
    if (S.intentionalLeave) return;
    if (S.playerId) {
      clearTimeout(S.reconnectTimer);
      S.reconnectTimer = setTimeout(openSocket, 1500);
    }
  });
}

function send(obj) {
  if (S.ws && S.ws.readyState === WebSocket.OPEN) {
    S.ws.send(JSON.stringify(obj));
  }
}

function leaveRoom() {
  S.intentionalLeave = true;
  if (S.ws) { try { S.ws.close(); } catch {} }
  S.ws = null; S.playerId = ''; S.isHost = false;
  stopTimer();
  show('lobby');
}

// ═══════════════ 伺服器訊息 ═══════════════
function onServerMessage(msg) {
  switch (msg.type) {
    case 'joined': onJoined(msg); break;
    case 'player-list': onPlayerList(msg); break;
    case 'player-joined': toast(`${msg.player.name} 加入了`); break;
    case 'player-disconnected': break;
    case 'new-host':
      if (msg.hostId === S.playerId) { S.isHost = true; refreshRoomPanels(); toast('你成為新房主'); }
      break;
    case 'words-updated': updateWordCount(msg.count); break;
    case 'settings-updated': break;
    case 'round-start': onRoundStart(msg); break;
    case 'canvas-update': onCanvasUpdate(msg); break;
    case 'guess': onGuess(msg); break;
    case 'round-end': onRoundEnd(msg); break;
    case 'game-end': onGameEnd(msg); break;
    case 'new-game-reset': onNewGameReset(msg); break;
    case 'error': toast(msg.message); setLobbyError(msg.message); break;
    case 'server-ping': case 'pong': break;
  }
}

function onJoined(msg) {
  S.playerId = msg.playerId;
  S.isHost = msg.isHost;
  S.players = msg.room.players || {};
  S.hostId = msg.room.hostId || '';
  $('room-code').textContent = msg.room.id || S.roomId;
  show('room');
  refreshRoomPanels();
  renderRoomPlayers();
  if (S.isHost && S.candidates.length === 0) refreshWordbookSelect();
}

function onPlayerList(msg) {
  S.players = msg.players || {};
  S.hostId = msg.hostId;
  renderRoomPlayers();
  renderScoreboard();
}

// ═══════════════ 房間畫面 ═══════════════
function refreshRoomPanels() {
  $('host-panel').hidden = !S.isHost;
  $('guest-wait').hidden = S.isHost;
  if (S.isHost) renderWordChips();
}

function renderRoomPlayers() {
  const ul = $('room-player-list');
  const list = Object.entries(S.players);
  $('player-count').textContent = list.filter(([, p]) => p.connected).length;
  ul.innerHTML = '';
  for (const [id, p] of list) {
    const li = document.createElement('li');
    if (!p.connected) li.className = 'off';
    li.innerHTML = `<span class="dot-live"></span><span style="flex:1">${esc(p.name)}</span>${id === (S.hostId || '') ? '<span class="badge-host">房主</span>' : ''}`;
    ul.appendChild(li);
  }
}

// ═══════════════ 設定：AI 生詞 + 候選詞 ═══════════════
async function aiGenerate() {
  const topic = $('input-topic').value.trim();
  if (!topic) return toast('請先輸入主題');
  const btn = $('btn-ai-gen');
  btn.disabled = true; btn.textContent = '生成中…';
  $('ai-hint').textContent = `正在為「${topic}」生成詞語…`;
  try {
    const res = await fetch(`${SERVER}/api/ai-words?topic=${encodeURIComponent(topic)}&count=12`);
    const data = await res.json();
    if (!data.words || data.words.length === 0) throw new Error(data.error || '生成失敗');
    addCandidates(data.words, true);
    $('ai-hint').textContent = `已生成 ${data.words.length} 個詞，已自動勾選，可再調整。`;
  } catch (e) {
    $('ai-hint').textContent = 'AI 生成失敗，可手動加入詞語。';
    toast('AI 生成失敗');
  } finally {
    btn.disabled = false; btn.textContent = '生成';
  }
}

function addCandidates(words, select) {
  for (const w of words) {
    const word = String(w).trim();
    if (!word) continue;
    if (!S.candidates.includes(word)) S.candidates.push(word);
    if (select) S.selected.add(word);
  }
  renderWordChips();
  syncWords();
}

function renderWordChips() {
  const box = $('word-chips');
  if (!box) return;
  box.innerHTML = '';
  for (const word of S.candidates) {
    const on = S.selected.has(word);
    const chip = document.createElement('div');
    chip.className = 'word-chip' + (on ? ' on' : '');
    chip.innerHTML = `<span>${esc(word)}</span><span class="x" title="移除">✕</span>`;
    chip.querySelector('span:first-child').addEventListener('click', () => {
      if (S.selected.has(word)) S.selected.delete(word); else S.selected.add(word);
      renderWordChips(); syncWords();
    });
    chip.querySelector('.x').addEventListener('click', (e) => {
      e.stopPropagation();
      S.candidates = S.candidates.filter((w) => w !== word);
      S.selected.delete(word);
      renderWordChips(); syncWords();
    });
    box.appendChild(chip);
  }
  $('word-selected-count').textContent = S.selected.size;
}

function syncWords() {
  send({ type: 'set-words', words: [...S.selected] });
}
function updateWordCount(n) { /* 伺服器確認，目前不需特別處理 */ }

// ═══════════════ 單詞本（localStorage 按主題分類） ═══════════════
function loadWordbook() {
  try { return JSON.parse(localStorage.getItem(STORAGE_WORDBOOK)) || {}; } catch { return {}; }
}
function saveWordbook(wb) { localStorage.setItem(STORAGE_WORDBOOK, JSON.stringify(wb)); }

function refreshWordbookSelect() {
  const wb = loadWordbook();
  const sel = $('select-theme');
  sel.innerHTML = '<option value="">選擇主題…</option>';
  for (const theme of Object.keys(wb)) {
    const opt = document.createElement('option');
    opt.value = theme; opt.textContent = `${theme}（${wb[theme].length}）`;
    sel.appendChild(opt);
  }
}

function saveTheme() {
  const theme = $('input-save-theme').value.trim();
  if (!theme) return toast('請輸入主題名稱');
  if (S.selected.size === 0) return toast('請先勾選要儲存的詞語');
  const wb = loadWordbook();
  wb[theme] = [...S.selected];
  saveWordbook(wb);
  refreshWordbookSelect();
  $('input-save-theme').value = '';
  toast(`已存入單詞本：${theme}`);
}

function loadTheme() {
  const theme = $('select-theme').value;
  if (!theme) return toast('請先選擇主題');
  const wb = loadWordbook();
  if (wb[theme]) { addCandidates(wb[theme], true); toast(`已載入「${theme}」`); }
}

function deleteTheme() {
  const theme = $('select-theme').value;
  if (!theme) return toast('請先選擇主題');
  const wb = loadWordbook();
  delete wb[theme];
  saveWordbook(wb);
  refreshWordbookSelect();
  toast(`已刪除「${theme}」`);
}

function addCustomWord() {
  const w = prompt('輸入要加入的詞語：');
  if (w && w.trim()) addCandidates([w.trim()], true);
}

// ═══════════════ 開始遊戲 ═══════════════
function startGame() {
  if (S.selected.size === 0) return toast('請先用 AI 生詞並勾選詞語');
  send({ type: 'update-settings', settings: {
    roundTimeSec: Number($('input-round-time').value) || 90,
    totalRounds: Number($('input-total-rounds').value) || 6,
  }});
  syncWords();
  send({ type: 'start' });
}

// ═══════════════ 回合 ═══════════════
function onRoundStart(msg) {
  hideOverlay();
  show('game');
  S.isDrawer = msg.isDrawer;
  S.drawerId = msg.drawerId;
  S.word = msg.word;
  S.wordLen = msg.wordLen;
  S.stickers = [];
  S.selectedId = null;

  $('round-now').textContent = msg.round;
  $('round-total').textContent = msg.totalRounds;
  $('drawer-name').textContent = msg.drawerName + (msg.isDrawer ? '（你）' : '');
  $('btn-skip').hidden = !S.isHost;

  // 角色 UI
  $('palette').hidden = !S.isDrawer;
  $('guess-box').style.display = S.isDrawer ? 'none' : 'flex';
  $('drawer-note').hidden = !S.isDrawer;
  $('stage-hint').style.display = 'flex';
  $('sticker-tools').hidden = true;

  if (S.isDrawer) {
    $('word-status').textContent = `你的題目：${msg.word}`;
    $('stage-hint').textContent = '從下方選實物，拖到舞台上拼出題目吧！';
  } else {
    $('word-status').textContent = `題目 ${'＿'.repeat(msg.wordLen)}（${msg.wordLen} 個字）`;
    $('stage-hint').textContent = `${msg.drawerName} 正在用小物拼字…`;
  }

  renderCanvas();
  renderScoreboard();
  $('answers-feed').innerHTML = '';
  addSystemAnswer(`第 ${msg.round} 回合開始！`);
  startTimer(msg.secondsLeft);
}

function onCanvasUpdate(msg) {
  // 出題者本機自行維護畫布，不接收回播
  if (S.isDrawer) return;
  S.stickers = msg.stickers || [];
  if (S.stickers.length) $('stage-hint').style.display = 'none';
  renderCanvas();
}

function onGuess(msg) {
  const div = document.createElement('div');
  div.className = 'ans' + (msg.correct ? ' correct' : '');
  if (msg.correct) {
    div.innerHTML = `<span class="who">${esc(msg.name)}</span>猜對了！<span class="pts">+${msg.points}（第${msg.rank}名）</span>`;
  } else {
    div.innerHTML = `<span class="who">${esc(msg.name)}</span>${esc(msg.text)}`;
  }
  const feed = $('answers-feed');
  feed.appendChild(div);
  feed.scrollTop = feed.scrollHeight;
}

function addSystemAnswer(text) {
  const div = document.createElement('div');
  div.className = 'ans system';
  div.textContent = text;
  $('answers-feed').appendChild(div);
}

function submitGuess() {
  if (S.isDrawer) return;
  const input = $('input-guess');
  const text = input.value.trim();
  if (!text) return;
  send({ type: 'guess', text });
  input.value = '';
}

function onRoundEnd(msg) {
  stopTimer();
  S.isDrawer = false;
  $('palette').hidden = true;
  $('sticker-tools').hidden = true;
  renderScoreboardFromRanking(msg.ranking);
  showRoundEndOverlay(msg);
}

function onGameEnd(msg) {
  stopTimer();
  showGameEndOverlay(msg);
}

function onNewGameReset(msg) {
  hideOverlay();
  S.players = msg.room.players || {};
  show('room');
  refreshRoomPanels();
  renderRoomPlayers();
}

// ═══════════════ 計分榜 ═══════════════
function renderScoreboard() {
  const arr = Object.entries(S.players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, connected: p.connected }))
    .sort((a, b) => b.score - a.score);
  drawScoreboard(arr);
}
function renderScoreboardFromRanking(ranking) {
  drawScoreboard(ranking.map((r) => ({ ...r, connected: true })));
}
function drawScoreboard(arr) {
  const ul = $('scoreboard');
  ul.innerHTML = '';
  arr.forEach((p, i) => {
    const li = document.createElement('li');
    if (p.id === S.playerId) li.classList.add('me');
    if (p.id === S.drawerId) li.classList.add('drawer');
    li.innerHTML = `<span class="rank">${i + 1}</span><span class="nm">${esc(p.name)}${p.id === S.drawerId ? ' ✏️' : ''}</span><span class="sc">${p.score}</span>`;
    ul.appendChild(li);
  });
}

// ═══════════════ 計時 ═══════════════
function startTimer(sec) {
  stopTimer();
  S.secondsLeft = sec;
  updateTimer();
  S.timerInt = setInterval(() => {
    S.secondsLeft--;
    if (S.secondsLeft <= 0) { S.secondsLeft = 0; stopTimer(); }
    updateTimer();
  }, 1000);
}
function updateTimer() {
  const t = $('timer');
  t.textContent = S.secondsLeft;
  t.classList.toggle('urgent', S.secondsLeft <= 10);
}
function stopTimer() { if (S.timerInt) { clearInterval(S.timerInt); S.timerInt = null; } }

// ═══════════════ 共享畫布（實物貼紙） ═══════════════
function renderPalette() {
  const box = $('palette');
  box.innerHTML = '';
  for (const emoji of PALETTE) {
    const it = document.createElement('div');
    it.className = 'palette-item';
    it.textContent = emoji;
    it.addEventListener('click', () => addSticker(emoji));
    box.appendChild(it);
  }
}

function addSticker(emoji) {
  if (!S.isDrawer) return;
  const z = S.stickers.reduce((m, s) => Math.max(m, s.z || 0), 0) + 1;
  const st = { id: 's' + Date.now() + Math.random().toString(36).slice(2, 6), emoji, x: 0.5, y: 0.45, scale: 1, rotate: 0, z };
  S.stickers.push(st);
  S.selectedId = st.id;
  $('stage-hint').style.display = 'none';
  renderCanvas();
  pushCanvas();
}

function positionSticker(el, st, W, H) {
  el.style.left = (st.x * W) + 'px';
  el.style.top = (st.y * H) + 'px';
  el.style.fontSize = STICKER_BASE + 'px';
  el.style.transform = `translate(-50%, -50%) rotate(${st.rotate}deg) scale(${st.scale})`;
  el.style.zIndex = st.z || 1;
}

function renderCanvas() {
  const canvas = $('stage-canvas');
  const stage = $('stage');
  const rect = stage.getBoundingClientRect();
  const W = rect.width, H = rect.height;
  canvas.innerHTML = '';
  const sorted = [...S.stickers].sort((a, b) => (a.z || 0) - (b.z || 0));
  for (const st of sorted) {
    const el = document.createElement('div');
    el.className = 'sticker' + (S.isDrawer ? '' : ' readonly') + (st.id === S.selectedId ? ' selected' : '');
    el.textContent = st.emoji;
    el.dataset.id = st.id;
    positionSticker(el, st, W, H);
    if (S.isDrawer) attachDrag(el, st);
    canvas.appendChild(el);
  }
  positionTools();
}

function attachDrag(el, st) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    S.selectedId = st.id;
    // 提到目前最上層方便操作
    renderCanvas();
    const stage = $('stage');
    const rect = stage.getBoundingClientRect();
    const moveEl = $('stage-canvas').querySelector(`[data-id="${st.id}"]`);
    let moved = false;
    const onMove = (ev) => {
      moved = true;
      st.x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
      st.y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
      if (moveEl) positionSticker(moveEl, st, rect.width, rect.height);
      positionTools();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (moved) pushCanvas();
      else { renderCanvas(); positionTools(); } // 純點選，更新工具列
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

function positionTools() {
  const tools = $('sticker-tools');
  if (!S.isDrawer || !S.selectedId || !S.stickers.find((s) => s.id === S.selectedId)) {
    tools.hidden = true;
    return;
  }
  tools.hidden = false;
}

function stickerToolAction(act) {
  const st = S.stickers.find((s) => s.id === S.selectedId);
  if (!st) return;
  switch (act) {
    case 'bigger': st.scale = clamp(st.scale + 0.2, 0.4, 3.5); break;
    case 'smaller': st.scale = clamp(st.scale - 0.2, 0.4, 3.5); break;
    case 'rotate-l': st.rotate -= 15; break;
    case 'rotate-r': st.rotate += 15; break;
    case 'front': st.z = S.stickers.reduce((m, s) => Math.max(m, s.z || 0), 0) + 1; break;
    case 'delete':
      S.stickers = S.stickers.filter((s) => s.id !== st.id);
      S.selectedId = null;
      break;
  }
  renderCanvas();
  pushCanvas();
}

let pushTimer = null;
function pushCanvas() {
  if (!S.isDrawer) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    send({ type: 'canvas', stickers: S.stickers });
  }, 60);
}

// ═══════════════ 浮層：回合結算 + 學習卡 ═══════════════
function showRoundEndOverlay(msg) {
  const body = $('overlay-body');
  let html = `<p class="reveal-label">本回合題目</p><div class="reveal-word">${esc(msg.word)}</div>`;
  if (msg.roundResult && msg.roundResult.length) {
    html += '<ul class="reveal-list">';
    for (const r of msg.roundResult) {
      html += `<li><span class="rk">第${r.rank}名</span><span>${esc(r.name)}</span><span class="pt">+${r.points}</span></li>`;
    }
    html += '</ul>';
  } else {
    html += '<p class="reveal-label">這回合沒有人猜對～</p>';
  }
  html += `<div class="learn-card" id="learn-card"><div class="learn-loading">學習卡載入中…</div></div>`;
  html += `<p class="reveal-label" style="margin-top:12px">${msg.isLastRound ? '即將公布總成績…' : '下一回合即將開始…'}</p>`;
  body.innerHTML = html;
  $('overlay-close').hidden = true;
  $('overlay').hidden = false;
  fetchLearnCard(msg.word);
}

async function fetchLearnCard(word) {
  try {
    const res = await fetch(`${SERVER}/api/ai-learn?word=${encodeURIComponent(word)}`);
    const data = await res.json();
    const card = data.card;
    const box = $('learn-card');
    if (!box) return;
    if (!card) { box.innerHTML = `<h4>${esc(word)}</h4>`; return; }
    let h = `<h4>📖 ${esc(card.word)}</h4>`;
    if (card.pinyin) h += `<div class="learn-pinyin">${esc(card.pinyin)}</div>`;
    if (card.meaning) h += `<div class="learn-row"><span class="lk">解釋</span>${esc(card.meaning)}</div>`;
    if (card.words && card.words.length) h += `<div class="learn-row"><span class="lk">組詞</span><span class="learn-words">${card.words.map((w) => `<span>${esc(w)}</span>`).join('')}</span></div>`;
    if (card.sentence) h += `<div class="learn-row"><span class="lk">造句</span>${esc(card.sentence)}</div>`;
    box.innerHTML = h;
  } catch {
    const box = $('learn-card');
    if (box) box.innerHTML = `<h4>${esc(word)}</h4><div class="learn-loading">學習卡載入失敗</div>`;
  }
}

function showGameEndOverlay(msg) {
  const body = $('overlay-body');
  const medals = ['🥇', '🥈', '🥉'];
  let html = `<p class="reveal-label">遊戲結束</p><div class="reveal-word" style="font-size:1.8rem">最終成績</div>`;
  html += '<ul class="final-list">';
  msg.ranking.forEach((p, i) => {
    html += `<li class="${i === 0 ? 'top1' : ''}"><span class="medal">${medals[i] || (i + 1)}</span><span class="nm">${esc(p.name)}</span><span class="sc">${p.score} 分</span></li>`;
  });
  html += '</ul>';
  body.innerHTML = html;
  const closeBtn = $('overlay-close');
  if (S.isHost) {
    closeBtn.hidden = false;
    closeBtn.textContent = '再玩一局';
    closeBtn.onclick = () => { send({ type: 'new-game' }); };
  } else {
    closeBtn.hidden = false;
    closeBtn.textContent = '關閉';
    closeBtn.onclick = hideOverlay;
  }
  $('overlay').hidden = false;
}

function hideOverlay() { $('overlay').hidden = true; }

// ═══════════════ 輔助 ═══════════════
function getName() {
  const name = $('input-name').value.trim();
  if (!name) { setLobbyError('請先輸入暱稱'); return ''; }
  S.name = name;
  localStorage.setItem(STORAGE_NAME, name);
  return name;
}
function setLobbyError(msg) {
  const el = $('lobby-error');
  el.textContent = msg; el.hidden = !msg;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ═══════════════ 事件綁定 ═══════════════
function bind() {
  $('btn-create').addEventListener('click', createRoom);
  $('btn-join').addEventListener('click', joinRoom);
  $('input-room-code').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
  $('input-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') createRoom(); });
  $('input-room-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });

  $('btn-leave').addEventListener('click', leaveRoom);
  $('btn-copy').addEventListener('click', () => {
    navigator.clipboard?.writeText(S.roomId).then(() => toast('已複製房間碼'));
  });

  $('btn-ai-gen').addEventListener('click', aiGenerate);
  $('input-topic').addEventListener('keydown', (e) => { if (e.key === 'Enter') aiGenerate(); });
  $('btn-save-theme').addEventListener('click', saveTheme);
  $('btn-load-theme').addEventListener('click', loadTheme);
  $('btn-del-theme').addEventListener('click', deleteTheme);
  $('btn-add-word').addEventListener('click', addCustomWord);
  $('btn-select-all').addEventListener('click', () => { S.candidates.forEach((w) => S.selected.add(w)); renderWordChips(); syncWords(); });
  $('btn-clear-all').addEventListener('click', () => { S.selected.clear(); renderWordChips(); syncWords(); });
  $('btn-start').addEventListener('click', startGame);

  $('btn-guess').addEventListener('click', submitGuess);
  $('input-guess').addEventListener('keydown', (e) => { if (e.key === 'Enter') submitGuess(); });
  $('btn-skip').addEventListener('click', () => send({ type: 'skip-round' }));

  $('sticker-tools').addEventListener('click', (e) => {
    const btn = e.target.closest('.st-btn');
    if (btn) stickerToolAction(btn.dataset.act);
  });
  // 點空白處取消選取
  $('stage').addEventListener('pointerdown', (e) => {
    if (S.isDrawer && (e.target.id === 'stage' || e.target.id === 'stage-canvas')) {
      S.selectedId = null; renderCanvas(); positionTools();
    }
  });

  window.addEventListener('resize', () => { if (screens.game.classList.contains('active')) renderCanvas(); });

  // 預填暱稱
  const saved = localStorage.getItem(STORAGE_NAME);
  if (saved) $('input-name').value = saved;

  renderPalette();
}

bind();
})();
