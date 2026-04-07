/**
 * 誰是臥底 — 前端應用
 */
(() => {
'use strict';

// ─── 配置 ───
const STORAGE_KEYS = { name: 'spy_name', server: 'spy_server' };
const DEFAULT_SERVER = 'https://spy-game.liuxiaoning1201.workers.dev';

// ─── 狀態 ───
const state = {
  serverUrl: localStorage.getItem(STORAGE_KEYS.server) || DEFAULT_SERVER,
  ws: null,
  playerId: null,
  playerName: '',
  roomId: '',
  isHost: false,
  players: {},
  hostId: '',
  phase: 'waiting',
  myWord: '',
  myRole: '',
  round: 0,
  currentSpeakerId: null,
  alivePlayers: [],
  selectedVote: null,
  timerInterval: null,
  timerValue: 0,
  godView: null,
  paused: false,
  settings: {},
};

// ─── DOM 快取 ───
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ─── 螢幕 ───
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $(`#screen-${id}`).classList.add('active');
}

// ─── Toast ───
function toast(msg, ms = 2500) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.hidden = true, ms);
}

// ─── 連線狀態 ───
function showConnectionStatus(text) {
  $('#connection-status').hidden = false;
  $('#connection-text').textContent = text;
}
function hideConnectionStatus() {
  $('#connection-status').hidden = true;
}

// ━━━━━━━━━ 大廳邏輯 ━━━━━━━━━
$('#input-name').value = localStorage.getItem(STORAGE_KEYS.name) || '';


$('#btn-create').addEventListener('click', async () => {
  const name = $('#input-name').value.trim();
  if (!name) return showError('請輸入暱稱');
  saveName(name);
  try {
    showError('');
    $('#btn-create').disabled = true;
    const resp = await apiFetch('/api/create-room', { method: 'POST' });
    const data = await resp.json();
    state.roomId = data.roomId;
    state.playerName = name;
    connectWs(name, data.roomId);
  } catch (e) {
    showError('建立房間失敗：' + e.message);
  } finally {
    $('#btn-create').disabled = false;
  }
});

$('#btn-join').addEventListener('click', () => {
  const name = $('#input-name').value.trim();
  const code = $('#input-room-code').value.trim().toUpperCase();
  if (!name) return showError('請輸入暱稱');
  if (!code || code.length < 4) return showError('請輸入有效的房間碼');
  saveName(name);
  showError('');
  state.roomId = code;
  state.playerName = name;
  connectWs(name, code);
});


function saveName(n) { localStorage.setItem(STORAGE_KEYS.name, n); }
function showError(msg) { const el = $('#lobby-error'); el.textContent = msg; el.hidden = !msg; }

async function apiFetch(path, opts = {}) {
  const resp = await fetch(state.serverUrl + path, opts);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp;
}

// ━━━━━━━━━ WebSocket ━━━━━━━━━
let _reconnectAttempts = 0;
let _reconnectTimer = null;
let _heartbeatTimer = null;
let _lastMsgIds = new Set();

function closeExistingWs() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (state.ws) {
    state.ws._manualClose = true;
    try { state.ws.close(); } catch {}
    state.ws = null;
  }
}

function connectWs(name, roomId) {
  closeExistingWs();
  _reconnectAttempts = 0;
  _lastMsgIds.clear();
  _doConnect(name, roomId);
}

function _doConnect(name, roomId) {
  showConnectionStatus('連線中...');
  const protocol = state.serverUrl.startsWith('https') ? 'wss' : 'ws';
  const host = state.serverUrl.replace(/^https?:\/\//, '');
  const url = `${protocol}://${host}/ws?room=${roomId}`;

  const ws = new WebSocket(url);
  state.ws = ws;
  ws._manualClose = false;

  ws.addEventListener('open', () => {
    _reconnectAttempts = 0;
    ws.send(JSON.stringify({ type: 'join', name, roomId }));
    showConnectionStatus('已連線');
    setTimeout(hideConnectionStatus, 1500);

    _heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      } else {
        clearInterval(_heartbeatTimer);
      }
    }, 15000);
  });

  ws.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pong' || msg.type === 'server-ping') return;

      // 訊息去重：用 type+senderId+timestamp 做 key
      if (msg.type === 'chat' && msg.timestamp) {
        const key = `${msg.senderId}_${msg.timestamp}`;
        if (_lastMsgIds.has(key)) return;
        _lastMsgIds.add(key);
        if (_lastMsgIds.size > 200) {
          const arr = [..._lastMsgIds];
          _lastMsgIds = new Set(arr.slice(-100));
        }
      }

      handleMessage(msg);
    } catch {}
  });

  ws.addEventListener('close', () => {
    if (ws._manualClose) return;
    showConnectionStatus('已斷線，重連中...');

    if (state.playerId && state.phase !== 'waiting') {
      const delay = Math.min(1000 * Math.pow(2, _reconnectAttempts), 10000);
      _reconnectAttempts++;
      _reconnectTimer = setTimeout(() => {
        if (state.ws === ws || !state.ws) {
          _doConnect(name, roomId);
        }
      }, delay);
    } else {
      showConnectionStatus('已斷線');
    }
  });

  ws.addEventListener('error', () => {
    if (!state.playerId) {
      showError('無法連線至伺服器');
      hideConnectionStatus();
    }
  });
}

function wsSend(data) {
  if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(data));
}

// ━━━━━━━━━ 訊息處理 ━━━━━━━━━
function handleMessage(msg) {
  const handlers = {
    joined: onJoined,
    error: onError,
    'player-joined': onPlayerJoined,
    'player-list': onPlayerList,
    'player-disconnected': onPlayerDisconnected,
    'player-reconnected': onPlayerReconnected,
    'player-kicked': onPlayerKicked,
    'player-muted': onPlayerMuted,
    'new-host': onNewHost,
    'settings-updated': onSettingsUpdated,
    'words-updated': onWordsUpdated,
    'game-start': onGameStart,
    'next-speaker': onNextSpeaker,
    chat: onChat,
    timer: onTimer,
    'vote-phase': onVotePhase,
    'vote-cast': onVoteCast,
    'vote-result': onVoteResult,
    'new-round': onNewRound,
    'game-end': onGameEnd,
    'game-paused': onGamePaused,
    'game-resumed': onGameResumed,
    'god-view': onGodView,
    'new-game-reset': onNewGameReset,
    kicked: onKicked,
  };
  if (handlers[msg.type]) handlers[msg.type](msg);
}

function onJoined(msg) {
  state.playerId = msg.playerId;
  state.isHost = msg.isHost;
  state.players = msg.room.players;
  state.hostId = msg.room.hostId;
  state.settings = msg.room.settings;
  state.roomId = msg.room.id;
  showScreen('room');
  $('#display-room-code').textContent = state.roomId;
  renderPlayerList();
  renderHostSettings();
  updateWordCount(msg.room.wordBankCount);
}

function onError(msg) {
  toast(msg.message, 3000);
  if (state.phase === 'waiting' && !state.playerId) showError(msg.message);
}

function onPlayerJoined(msg) {
  toast(`${msg.player.name} 加入了房間`);
}

function onPlayerList(msg) {
  state.players = msg.players;
  state.hostId = msg.hostId;
  state.isHost = msg.hostId === state.playerId;
  renderPlayerList();
  renderHostSettings();
  renderTeacherPlayerMgmt();
}

function onPlayerDisconnected(msg) {
  toast(`${msg.name} 已離線，等待重連...`);
}

function onPlayerReconnected(msg) {
  toast(`${msg.name} 已重新連線`);
}

function onPlayerKicked(msg) {
  toast(`${msg.name} 被移出房間`);
}

function onPlayerMuted(msg) {
  toast(`${msg.name} ${msg.muted ? '被禁言' : '解除禁言'}`);
}

function onNewHost(msg) {
  state.hostId = msg.hostId;
  state.isHost = msg.hostId === state.playerId;
  toast(`${msg.name} 成為新房主`);
  renderHostSettings();
}

function onSettingsUpdated(msg) {
  state.settings = msg.settings;
  toast('設定已更新');
}

function onWordsUpdated(msg) {
  updateWordCount(msg.count);
  toast(`詞庫已更新，共 ${msg.count} 組詞對`);
}

function onKicked() {
  closeExistingWs();
  state.playerId = null;
  state.phase = 'waiting';
  showScreen('lobby');
  showError('你已被房主移出房間');
}

// ━━━━━━━━━ 遊戲開始 ━━━━━━━━━
function onGameStart(msg) {
  state.phase = 'speaking';
  state.myRole = msg.yourRole;
  state.myWord = msg.yourWord;
  state.round = msg.round;
  state.currentSpeakerId = msg.currentSpeakerId;
  state.alivePlayers = msg.alivePlayers;

  showScreen('game');
  $('#game-round').textContent = `第 ${msg.round} 輪`;
  $('#game-phase-label').textContent = '發言階段';
  $('#my-word').textContent = msg.yourWord || '（旁觀者）';
  $('#my-role').textContent = msg.yourRole === 'spy' ? '你是臥底' : msg.yourRole === 'observer' ? '旁觀模式' : '';

  if (msg.yourRole === 'spy') {
    $('#my-word-card').style.background = 'linear-gradient(145deg, #5c1a1a, #8a2828)';
  } else if (msg.yourRole === 'observer') {
    $('#my-word-card').style.background = 'linear-gradient(145deg, #4a5568, #2d3748)';
  } else {
    $('#my-word-card').style.background = '';
  }

  renderAlivePlayers();
  clearChat();
  updateSpeakerBar();
  updateSpeakInput();
  showHideVoteArea(false);
  showHideVoteResult(false);

  if (state.isHost) {
    $('#teacher-panel').hidden = false;
    $('#btn-toggle-teacher').hidden = false;
  }
}

function onNextSpeaker(msg) {
  state.currentSpeakerId = msg.currentSpeakerId;
  updateSpeakerBar();
  updateSpeakInput();
  renderAlivePlayers();
}

function onChat(msg) {
  appendChat(msg);
}

function onTimer(msg) {
  startTimer(msg.seconds);
}

function onVotePhase(msg) {
  state.phase = 'voting';
  state.alivePlayers = msg.alivePlayers;
  state.selectedVote = null;
  $('#game-phase-label').textContent = '投票階段';
  showHideVoteArea(true);
  renderVoteCandidates();
  if (msg.seconds > 0) startTimer(msg.seconds);
  updateSpeakInput();
  $('#speaker-bar').innerHTML = '<span>所有人請投票選出臥底</span>';
  $('#btn-confirm-vote').textContent = '確認投票';
  $('#btn-confirm-vote').disabled = true;
}

function onVoteCast(msg) {
  if (msg.voterId !== state.playerId) {
    toast(`${msg.voterName} 已完成投票`);
  }
}

function onVoteResult(msg) {
  state.phase = 'roundResult';
  showHideVoteArea(false);
  showHideVoteResult(true);
  clearTimer();

  let html = '';
  if (msg.eliminatedId) {
    const roleLabel = msg.eliminatedRole === 'spy' ? '臥底' : '平民';
    html += `<h3>投票結果</h3>`;
    html += `<p class="eliminated-name">${msg.eliminatedName} 被淘汰</p>`;
    html += `<p style="color:var(--text2)">身分：<strong style="color:${msg.eliminatedRole === 'spy' ? 'var(--danger)' : 'var(--success)'}">${roleLabel}</strong></p>`;
  } else {
    html += `<h3>投票結果</h3>`;
    html += `<p class="no-eliminate">${msg.isTie ? '平票，本輪無人淘汰' : '無人被淘汰'}</p>`;
  }

  html += '<div class="vote-detail">';
  for (const [, v] of Object.entries(msg.votes)) {
    html += `<span class="vote-chip">${v.voterName} → ${v.targetName}</span>`;
  }
  html += '</div>';

  $('#vote-result-content').innerHTML = html;

  if (msg.eliminatedId) {
    state.alivePlayers = state.alivePlayers.filter(p => p.id !== msg.eliminatedId);
    renderAlivePlayers();
  }
}

function onNewRound(msg) {
  state.phase = 'speaking';
  state.round = msg.round;
  state.currentSpeakerId = msg.currentSpeakerId;
  state.alivePlayers = msg.alivePlayers;

  $('#game-round').textContent = `第 ${msg.round} 輪`;
  $('#game-phase-label').textContent = '發言階段';
  showHideVoteResult(false);
  showHideVoteArea(false);
  renderAlivePlayers();
  updateSpeakerBar();
  updateSpeakInput();
}

// ━━━━━━━━━ 結算 ━━━━━━━━━
function onGameEnd(msg) {
  state.phase = 'gameEnd';
  clearTimer();
  showScreen('result');

  const banner = $('#result-banner');
  banner.className = 'result-banner';
  if (msg.winner === 'civilian') {
    $('#result-title').textContent = '平民勝利！';
    $('#result-subtitle').textContent = '成功找出了所有臥底';
  } else if (msg.winner === 'spy') {
    banner.classList.add('spy-win');
    $('#result-title').textContent = '臥底勝利！';
    $('#result-subtitle').textContent = '臥底成功隱藏到最後';
  } else {
    $('#result-title').textContent = '遊戲結束';
    $('#result-subtitle').textContent = '房主提前結束了遊戲';
  }

  if (msg.wordPair) {
    $('#result-civilian-word').textContent = msg.wordPair.civilian;
    $('#result-spy-word').textContent = msg.wordPair.spy;
  }

  let rolesHtml = '';
  if (msg.roles) {
    for (const [id, r] of Object.entries(msg.roles)) {
      const cls = r.role === 'spy' ? 'spy-card' : r.role === 'observer' ? 'observer-card' : 'civilian-card';
      const tag = r.role === 'spy' ? '臥底' : r.role === 'observer' ? '旁觀' : '平民';
      const alive = r.alive ? '存活' : '已淘汰';
      const isMe = id === state.playerId ? ' (你)' : '';
      rolesHtml += `<div class="result-role-card ${cls}">
        <div class="name">${r.name}${isMe}</div>
        <span class="role-tag">${tag}</span>
        <div class="alive-status">${alive}${r.word ? ' · ' + r.word : ''}</div>
      </div>`;
    }
  }
  $('#result-roles').innerHTML = rolesHtml;

  let chatHtml = '';
  if (msg.chatLog) {
    for (const c of msg.chatLog) {
      if (c.senderId === 'system') {
        chatHtml += `<div class="chat-msg system">${c.text}</div>`;
      } else {
        chatHtml += `<div class="chat-msg"><span class="msg-name">[第${c.round}輪] ${c.senderName}：</span><span class="msg-text">${escHtml(c.text)}</span></div>`;
      }
    }
  }
  $('#result-chat-log').innerHTML = chatHtml || '<p class="hint">無發言紀錄</p>';
}

function onGamePaused() { state.paused = true; clearTimer(); toast('遊戲已暫停'); $('#game-phase-label').textContent += '（已暫停）'; $('#btn-pause').hidden = true; $('#btn-resume').hidden = false; }
function onGameResumed() { state.paused = false; toast('遊戲已恢復'); $('#btn-pause').hidden = false; $('#btn-resume').hidden = true; }

function onGodView(msg) {
  state.godView = msg;
  renderGodView();
}

function onNewGameReset(msg) {
  state.phase = 'waiting';
  state.players = msg.room.players;
  state.hostId = msg.room.hostId;
  state.isHost = msg.room.hostId === state.playerId;
  state.myWord = '';
  state.myRole = '';
  state.round = 0;
  state.godView = null;
  showScreen('room');
  renderPlayerList();
  renderHostSettings();
  toast('準備開始新一局');
}

// ━━━━━━━━━ 房間 UI ━━━━━━━━━
function renderPlayerList() {
  const ul = $('#player-list');
  let html = '';
  const count = Object.keys(state.players).length;
  for (const [id, p] of Object.entries(state.players)) {
    if (!p.connected && state.phase === 'waiting') continue;
    const cls = [p.ready ? 'ready' : '', id === state.hostId ? 'host' : '', !p.connected ? 'disconnected' : ''].filter(Boolean).join(' ');
    const muted = p.muted ? '<span class="muted-icon">🔇</span>' : '';
    const readyIcon = p.ready ? ' ✓' : '';
    html += `<li class="${cls}">${p.name}${muted}${readyIcon}</li>`;
  }
  ul.innerHTML = html;
  $('#player-count').textContent = `(${count})`;
}

function renderHostSettings() {
  const el = $('#host-settings');
  el.hidden = !state.isHost;
  $('#btn-start').hidden = !state.isHost;
  if (state.isHost) {
    $('#set-spy-count').value = state.settings.spyCount || 1;
    $('#set-speak-time').value = state.settings.speakTimeSec || 60;
    $('#set-vote-time').value = state.settings.voteTimeSec || 30;
    $('#set-tie-rule').value = state.settings.tieRule || 'no-eliminate';
    $('#set-observer').checked = state.settings.hostAsObserver || false;
  }
}

function updateWordCount(n) { $('#word-count').textContent = n != null ? `${n} 組` : ''; }

// Tab 切換
$$('.word-source-tabs .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    $$('.word-source-tabs .tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    $$('.tab-panel').forEach(p => p.classList.remove('active'));
    $(`.tab-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
  });
});

// 房間操作
$('#btn-copy-code').addEventListener('click', () => {
  navigator.clipboard?.writeText(state.roomId).then(() => toast('已複製房間碼'));
});

$('#btn-leave-room').addEventListener('click', () => {
  closeExistingWs();
  state.playerId = null;
  state.phase = 'waiting';
  showScreen('lobby');
});

$('#btn-ready').addEventListener('click', () => { wsSend({ type: 'ready' }); });

$('#btn-start').addEventListener('click', () => { wsSend({ type: 'start' }); });

/** 從目前介面收集詞庫，供「儲存設定」時一併送出（優先 AI 預覽勾選，其次自訂文字） */
function collectWordsFromUI() {
  const aiWords = $('#ai-preview')?._words;
  if (aiWords && aiWords.length && !$('#ai-preview').hidden) {
    const selected = [];
    $$('#ai-word-list input[type=checkbox]:checked').forEach((cb) => {
      selected.push(aiWords[+cb.dataset.idx]);
    });
    if (selected.length > 0) return selected;
  }
  const text = $('#custom-words').value.trim();
  if (text) {
    const words = text.split('\n').map((line) => {
      const parts = line.split('/');
      if (parts.length >= 2) return { civilian: parts[0].trim(), spy: parts[1].trim() };
      return null;
    }).filter(Boolean);
    if (words.length > 0) return words;
  }
  return null;
}

$('#btn-save-settings').addEventListener('click', () => {
  wsSend({
    type: 'update-settings',
    settings: {
      spyCount: +$('#set-spy-count').value,
      speakTimeSec: +$('#set-speak-time').value,
      voteTimeSec: +$('#set-vote-time').value,
      tieRule: $('#set-tie-rule').value,
      hostAsObserver: $('#set-observer').checked,
    },
  });
  const words = collectWordsFromUI();
  if (words) {
    wsSend({ type: 'update-words', words });
    toast('設定與詞庫已送出');
  } else {
    toast('設定已送出');
  }
});

// 自訂詞庫
$('#btn-apply-custom').addEventListener('click', () => {
  const text = $('#custom-words').value.trim();
  if (!text) return toast('請輸入詞對');
  const words = text.split('\n').map(line => {
    const parts = line.split('/');
    if (parts.length >= 2) return { civilian: parts[0].trim(), spy: parts[1].trim() };
    return null;
  }).filter(Boolean);
  if (words.length === 0) return toast('格式錯誤，請用 / 分隔平民詞和臥底詞');
  wsSend({ type: 'update-words', words });
});

// Excel 匯入
$('#btn-pick-excel').addEventListener('click', () => { $('#excel-upload').click(); });
$('#excel-upload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $('#excel-filename').textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const words = rows.filter(r => r.length >= 2 && r[0] && r[1]).map(r => ({ civilian: String(r[0]).trim(), spy: String(r[1]).trim() }));
      if (words.length === 0) return toast('未找到有效的詞對（需第一欄和第二欄）');
      wsSend({ type: 'update-words', words });
      toast(`匯入成功，共 ${words.length} 組詞對`);
    } catch { toast('Excel 解析失敗'); }
  };
  reader.readAsArrayBuffer(file);
});

// 預設詞庫重置
$('#btn-reset-words').addEventListener('click', () => {
  wsSend({ type: 'update-words', words: null });
  toast('伺服器端已使用預設詞庫');
});

// AI 生成
$('#btn-ai-generate').addEventListener('click', async () => {
  const topic = $('#ai-topic').value.trim();
  if (!topic) return toast('請輸入主題');
  const raw = Math.floor(+$('#ai-count').value);
  const count = Math.max(1, Math.min(20, isNaN(raw) ? 5 : raw));
  $('#ai-count').value = count;
  $('#btn-ai-generate').disabled = true;
  $('#btn-ai-generate').textContent = '生成中...';

  try {
    const resp = await apiFetch(`/api/ai-words?topic=${encodeURIComponent(topic)}&count=${count}`);
    const data = await resp.json();
    if (data.words && data.words.length > 0) {
      renderAiPreview(data.words);
    } else {
      toast('AI 未能生成詞對，請嘗試其他主題');
    }
  } catch {
    toast('AI 生成失敗，請稍後再試');
  } finally {
    $('#btn-ai-generate').disabled = false;
    $('#btn-ai-generate').textContent = '生成詞對';
  }
});

function renderAiPreview(words) {
  $('#ai-preview').hidden = false;
  let html = '';
  words.forEach((w, i) => {
    html += `<li><label><input type="checkbox" checked data-idx="${i}" /> ${w.civilian} / ${w.spy}</label></li>`;
  });
  $('#ai-word-list').innerHTML = html;
  $('#ai-preview')._words = words;
}

$('#btn-ai-apply').addEventListener('click', () => {
  const words = $('#ai-preview')._words;
  if (!words) return;
  const selected = [];
  $$('#ai-word-list input[type=checkbox]:checked').forEach(cb => {
    selected.push(words[+cb.dataset.idx]);
  });
  if (selected.length === 0) return toast('請至少勾選一組');
  wsSend({ type: 'update-words', words: selected });
  $('#ai-preview').hidden = true;
});

// ━━━━━━━━━ 遊戲 UI ━━━━━━━━━
function renderAlivePlayers() {
  let html = '';
  for (const p of (state.alivePlayers || [])) {
    const cls = ['avatar'];
    if (p.id === state.currentSpeakerId) cls.push('speaking');
    html += `<span class="${cls.join(' ')}">${p.name}</span>`;
  }
  const eliminated = Object.entries(state.players).filter(([id, p]) => !state.alivePlayers?.some(a => a.id === id) && p.connected);
  for (const [, p] of eliminated) {
    html += `<span class="avatar eliminated">${p.name}</span>`;
  }
  $('#alive-players').innerHTML = html;
}

function updateSpeakerBar() {
  const speaker = state.alivePlayers?.find(p => p.id === state.currentSpeakerId);
  if (speaker) {
    const isMe = state.currentSpeakerId === state.playerId;
    $('#speaker-bar').innerHTML = isMe
      ? '<span class="highlight">輪到你發言了！</span>'
      : `<span>等待 <span class="highlight">${speaker.name}</span> 發言中...</span>`;
  }
}

function updateSpeakInput() {
  const input = $('#speak-input');
  const btn = $('#btn-send-speak');
  const isMyTurn = state.currentSpeakerId === state.playerId && state.phase === 'speaking';
  input.disabled = !isMyTurn;
  btn.disabled = !isMyTurn;
  input.placeholder = isMyTurn ? '輸入你的描述...' : '等待你的回合...';
  if (isMyTurn) input.focus();
}

function clearChat() { $('#chat-messages').innerHTML = ''; }

function appendChat(msg) {
  const div = document.createElement('div');
  div.className = 'chat-msg';
  if (msg.senderId === 'system') {
    div.className += ' system';
    div.textContent = msg.text;
  } else {
    if (msg.senderId === state.playerId) div.className += ' my';
    div.innerHTML = `<span class="msg-name">${escHtml(msg.senderName)}：</span><span class="msg-text">${escHtml(msg.text)}</span>`;
  }
  $('#chat-messages').appendChild(div);
  $('#chat-area').scrollTop = $('#chat-area').scrollHeight;
}

// 發言
$('#btn-send-speak').addEventListener('click', sendSpeak);
$('#speak-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendSpeak(); });

function sendSpeak() {
  const input = $('#speak-input');
  const text = input.value.trim();
  if (!text) return;
  wsSend({ type: 'speak', text });
  input.value = '';
}

// 計時器
function startTimer(seconds) {
  clearTimer();
  state.timerValue = seconds;
  $('#game-timer').textContent = seconds;
  state.timerInterval = setInterval(() => {
    state.timerValue--;
    if (state.timerValue <= 0) { clearTimer(); state.timerValue = 0; }
    const t = Math.max(0, state.timerValue);
    $('#game-timer').textContent = t;
    const el = $('#game-timer');
    if (t <= 5) { el.style.color = 'var(--crimson)'; el.classList.add('warning'); }
    else if (t <= 10) { el.style.color = 'var(--amber)'; el.classList.remove('warning'); }
    else { el.style.color = 'var(--crimson)'; el.classList.remove('warning'); }
  }, 1000);
}
function clearTimer() { if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; } }

// 投票
function showHideVoteArea(show) { $('#vote-area').hidden = !show; $('#speak-input-area').style.display = show ? 'none' : ''; }
function showHideVoteResult(show) { $('#vote-result-area').hidden = !show; }

function renderVoteCandidates() {
  let html = '';
  for (const p of state.alivePlayers) {
    if (p.id === state.playerId) continue;
    html += `<div class="vote-card" data-id="${p.id}">${p.name}</div>`;
  }
  $('#vote-candidates').innerHTML = html;
  $('#btn-confirm-vote').disabled = true;
  state.selectedVote = null;

  $$('.vote-card').forEach(card => {
    card.addEventListener('click', () => {
      $$('.vote-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.selectedVote = card.dataset.id;
      $('#btn-confirm-vote').disabled = false;
    });
  });
}

$('#btn-confirm-vote').addEventListener('click', () => {
  if (!state.selectedVote) return;
  wsSend({ type: 'vote', targetId: state.selectedVote });
  $('#btn-confirm-vote').disabled = true;
  $('#btn-confirm-vote').textContent = '已投票';
  $$('.vote-card').forEach(c => { c.style.pointerEvents = 'none'; });
});

// ━━━━━━━━━ 老師面板 ━━━━━━━━━
$('#btn-toggle-teacher').addEventListener('click', () => {
  const body = $('#teacher-panel-body');
  body.hidden = !body.hidden;
});

$('#btn-pause').addEventListener('click', () => { wsSend({ type: 'host-action', action: 'pause' }); });
$('#btn-resume').addEventListener('click', () => { wsSend({ type: 'host-action', action: 'resume' }); });
$('#btn-skip-speaker').addEventListener('click', () => { wsSend({ type: 'host-action', action: 'skip' }); });
$('#btn-end-game').addEventListener('click', () => {
  if (confirm('確定要提前結束遊戲？')) wsSend({ type: 'host-action', action: 'end-game' });
});

function renderGodView() {
  const gv = state.godView;
  if (!gv) return;
  let html = '';
  if (gv.wordPair) {
    html += `<div class="god-role-item"><span>平民詞：${gv.wordPair.civilian}</span><span>臥底詞：${gv.wordPair.spy}</span></div>`;
  }
  if (gv.roles) {
    for (const [id, r] of Object.entries(gv.roles)) {
      const tag = r.role === 'spy' ? 'spy' : r.role === 'observer' ? 'observer' : 'civilian';
      const label = r.role === 'spy' ? '臥底' : r.role === 'observer' ? '旁觀' : '平民';
      html += `<div class="god-role-item"><span>${r.name}${r.alive ? '' : '(淘汰)'}</span><span class="role-tag ${tag}">${label}</span></div>`;
    }
  }
  $('#god-view-roles').innerHTML = html;
}

function renderTeacherPlayerMgmt() {
  if (!state.isHost) return;
  let html = '';
  for (const [id, p] of Object.entries(state.players)) {
    if (id === state.playerId) continue;
    if (!p.connected) continue;
    html += `<div class="teacher-player-item">
      <span>${p.name}${p.muted ? ' 🔇' : ''}</span>
      <div class="mgmt-btns">
        <button class="btn btn-ghost btn-sm" onclick="hostAction('mute','${id}')">${p.muted ? '解除禁言' : '禁言'}</button>
        <button class="btn btn-danger btn-sm" onclick="hostAction('kick','${id}')">踢出</button>
      </div>
    </div>`;
  }
  $('#teacher-player-mgmt').innerHTML = html;
}

// 全域函數供 onclick 使用
window.hostAction = (action, targetId) => {
  wsSend({ type: 'host-action', action, targetId });
};

// ━━━━━━━━━ 結算操作 ━━━━━━━━━
$('#btn-new-game').addEventListener('click', () => {
  wsSend({ type: 'host-action', action: 'new-game' });
});

$('#btn-back-lobby').addEventListener('click', () => {
  closeExistingWs();
  state.playerId = null;
  state.phase = 'waiting';
  showScreen('lobby');
});

$('#btn-export').addEventListener('click', () => {
  const lines = [];
  lines.push('誰是臥底 — 遊戲紀錄');
  lines.push(`房間碼：${state.roomId}`);
  lines.push(`日期：${new Date().toLocaleString('zh-Hant')}`);
  lines.push('');

  const banner = $('#result-title').textContent;
  lines.push(banner);
  lines.push(`平民詞：${$('#result-civilian-word').textContent}  臥底詞：${$('#result-spy-word').textContent}`);
  lines.push('');
  lines.push('--- 身分 ---');
  $$('.result-role-card').forEach(card => {
    lines.push(`${card.querySelector('.name').textContent} | ${card.querySelector('.role-tag').textContent} | ${card.querySelector('.alive-status').textContent}`);
  });
  lines.push('');
  lines.push('--- 發言紀錄 ---');
  $$('#result-chat-log .chat-msg').forEach(msg => {
    lines.push(msg.textContent);
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `誰是臥底_${state.roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
});

// ─── 工具 ───
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

})();
