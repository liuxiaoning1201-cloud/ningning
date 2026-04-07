/**
 * 誰是臥底 — 前端應用
 */
(() => {
'use strict';

const STORAGE_KEYS = { name: 'spy_name', server: 'spy_server', library: 'spy_user_word_library' };
const DEFAULT_SERVER = 'https://spy-game.liuxiaoning1201.workers.dev';

const PRESET_WORDS = [
  { civilian: '李白', spy: '杜甫' },
  { civilian: '《靜夜思》', spy: '《春曉》' },
  { civilian: '《水調歌頭》', spy: '《念奴嬌》' },
  { civilian: '蘇軾', spy: '辛棄疾' },
  { civilian: '王維', spy: '孟浩然' },
  { civilian: '《出師表》', spy: '《陳情表》' },
  { civilian: '諸葛亮', spy: '司馬懿' },
  { civilian: '《西遊記》', spy: '《封神演義》' },
  { civilian: '曹操', spy: '劉備' },
  { civilian: '唐朝', spy: '宋朝' },
  { civilian: '長城', spy: '故宮' },
  { civilian: '包子', spy: '餃子' },
  { civilian: '籃球', spy: '排球' },
  { civilian: '鋼琴', spy: '小提琴' },
  { civilian: '老師', spy: '教授' },
  { civilian: '圖書館', spy: '書店' },
  { civilian: '地鐵', spy: '公車' },
  { civilian: '蘋果', spy: '梨子' },
  { civilian: '咖啡', spy: '奶茶' },
  { civilian: '月亮', spy: '太陽' },
];

// ─── 狀態 ───
const state = {
  serverUrl: localStorage.getItem(STORAGE_KEYS.server) || DEFAULT_SERVER,
  ws: null, playerId: null, playerName: '', roomId: '', isHost: false,
  players: {}, hostId: '', phase: 'waiting',
  myWord: '', myRole: '', round: 0, currentSpeakerId: null, alivePlayers: [],
  selectedVote: null, timerInterval: null, timerValue: 0,
  godView: null, paused: false, settings: {},
  wordMode: 'preset',
  presetSelected: new Set(),
  aiGenerated: [],
  aiSelected: new Set(),
  seriesIndex: 0, seriesTotal: 1,
};

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
function showConnectionStatus(text) { $('#connection-status').hidden = false; $('#connection-text').textContent = text; }
function hideConnectionStatus() { $('#connection-status').hidden = true; }

// ━━━━━━━━━ 大廳 ━━━━━━━━━
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
  } catch (e) { showError('建立房間失敗：' + e.message); }
  finally { $('#btn-create').disabled = false; }
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
let _reconnectAttempts = 0, _reconnectTimer = null, _heartbeatTimer = null, _lastMsgIds = new Set();

function closeExistingWs() {
  if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
  if (_reconnectTimer) { clearTimeout(_reconnectTimer); _reconnectTimer = null; }
  if (state.ws) { state.ws._manualClose = true; try { state.ws.close(); } catch {} state.ws = null; }
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
  const ws = new WebSocket(`${protocol}://${host}/ws?room=${roomId}`);
  state.ws = ws;
  ws._manualClose = false;

  ws.addEventListener('open', () => {
    _reconnectAttempts = 0;
    ws.send(JSON.stringify({ type: 'join', name, roomId }));
    showConnectionStatus('已連線');
    setTimeout(hideConnectionStatus, 1500);
    _heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
      else clearInterval(_heartbeatTimer);
    }, 15000);
  });

  ws.addEventListener('message', (e) => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'pong' || msg.type === 'server-ping') return;
      if (msg.type === 'chat' && msg.timestamp) {
        const key = `${msg.senderId}_${msg.timestamp}`;
        if (_lastMsgIds.has(key)) return;
        _lastMsgIds.add(key);
        if (_lastMsgIds.size > 200) { const arr = [..._lastMsgIds]; _lastMsgIds = new Set(arr.slice(-100)); }
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
      _reconnectTimer = setTimeout(() => { if (state.ws === ws || !state.ws) _doConnect(name, roomId); }, delay);
    } else { showConnectionStatus('已斷線'); }
  });

  ws.addEventListener('error', () => {
    if (!state.playerId) { showError('無法連線至伺服器'); hideConnectionStatus(); }
  });
}

function wsSend(data) { if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify(data)); }

// ━━━━━━━━━ 訊息處理 ━━━━━━━━━
function handleMessage(msg) {
  const handlers = {
    joined: onJoined, error: onError,
    'player-joined': onPlayerJoined, 'player-list': onPlayerList,
    'player-disconnected': onPlayerDisconnected, 'player-reconnected': onPlayerReconnected,
    'player-kicked': onPlayerKicked, 'player-muted': onPlayerMuted,
    'new-host': onNewHost, 'settings-updated': onSettingsUpdated,
    'words-updated': onWordsUpdated, 'game-start': onGameStart,
    'next-speaker': onNextSpeaker, chat: onChat, timer: onTimer,
    'vote-phase': onVotePhase, 'vote-cast': onVoteCast, 'vote-result': onVoteResult,
    'new-round': onNewRound, 'game-end': onGameEnd,
    'game-paused': onGamePaused, 'game-resumed': onGameResumed,
    'god-view': onGodView, 'new-game-reset': onNewGameReset, kicked: onKicked,
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
  updateWordSettingsSummary();
}

function onError(msg) { toast(msg.message, 3000); if (state.phase === 'waiting' && !state.playerId) showError(msg.message); }
function onPlayerJoined(msg) { toast(`${msg.player.name} 加入了房間`); }

function onPlayerList(msg) {
  state.players = msg.players;
  state.hostId = msg.hostId;
  state.isHost = msg.hostId === state.playerId;
  renderPlayerList();
  renderHostSettings();
  renderTeacherPlayerMgmt();
}

function onPlayerDisconnected(msg) { toast(`${msg.name} 已離線，等待重連...`); }
function onPlayerReconnected(msg) { toast(`${msg.name} 已重新連線`); }
function onPlayerKicked(msg) { toast(`${msg.name} 被移出房間`); }
function onPlayerMuted(msg) { toast(`${msg.name} ${msg.muted ? '被禁言' : '解除禁言'}`); }

function onNewHost(msg) {
  state.hostId = msg.hostId;
  state.isHost = msg.hostId === state.playerId;
  toast(`${msg.name} 成為新房主`);
  renderHostSettings();
}

function onSettingsUpdated(msg) { state.settings = msg.settings; toast('設定已更新'); updateGameSettingsSummary(); }
function onWordsUpdated(msg) { updateWordSettingsSummary(); toast(`詞庫已更新，共 ${msg.count} 組詞對`); }

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
  state.seriesIndex = msg.seriesIndex ?? 0;
  state.seriesTotal = msg.seriesTotal ?? 1;

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

  const seriesEl = $('#game-series');
  if (state.seriesTotal > 1) {
    seriesEl.textContent = `第 ${state.seriesIndex + 1}/${state.seriesTotal} 局`;
    seriesEl.hidden = false;
  } else {
    seriesEl.hidden = true;
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

function onChat(msg) { appendChat(msg); }
function onTimer(msg) { startTimer(msg.seconds); }

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

function onVoteCast(msg) { if (msg.voterId !== state.playerId) toast(`${msg.voterName} 已完成投票`); }

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
    html += `<p style="color:var(--ink-soft)">身分：<strong style="color:${msg.eliminatedRole === 'spy' ? 'var(--crimson)' : 'var(--jade)'}">${roleLabel}</strong></p>`;
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

  state.seriesIndex = msg.seriesIndex ?? 0;
  state.seriesTotal = msg.seriesTotal ?? 1;
  const hasNext = !!msg.hasNextMatch;

  const seriesBadge = $('#result-series-badge');
  if (state.seriesTotal > 1) {
    seriesBadge.textContent = `第 ${state.seriesIndex + 1} / ${state.seriesTotal} 局`;
    seriesBadge.hidden = false;
  } else {
    seriesBadge.hidden = true;
  }

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

  // 按鈕邏輯
  const btnNext = $('#btn-next-match');
  const btnNew = $('#btn-new-game');
  const waitHint = $('#result-wait-hint');

  if (hasNext) {
    if (state.isHost) {
      btnNext.hidden = false;
      waitHint.hidden = true;
    } else {
      btnNext.hidden = true;
      waitHint.hidden = false;
    }
    btnNew.hidden = true;
  } else {
    btnNext.hidden = true;
    waitHint.hidden = true;
    btnNew.hidden = false;
  }
}

function onGamePaused() { state.paused = true; clearTimer(); toast('遊戲已暫停'); $('#game-phase-label').textContent += '（已暫停）'; $('#btn-pause').hidden = true; $('#btn-resume').hidden = false; }
function onGameResumed() { state.paused = false; toast('遊戲已恢復'); $('#btn-pause').hidden = false; $('#btn-resume').hidden = true; }

function onGodView(msg) { state.godView = msg; renderGodView(); }

function onNewGameReset(msg) {
  state.phase = 'waiting';
  state.players = msg.room.players;
  state.hostId = msg.room.hostId;
  state.isHost = msg.room.hostId === state.playerId;
  state.myWord = '';
  state.myRole = '';
  state.round = 0;
  state.godView = null;
  state.seriesIndex = 0;
  state.seriesTotal = 1;
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
    const cls = [id === state.hostId ? 'host' : '', !p.connected ? 'disconnected' : ''].filter(Boolean).join(' ');
    const muted = p.muted ? '<span class="muted-icon">🔇</span>' : '';
    const hostTag = id === state.hostId ? ' <span class="host-tag">房主</span>' : '';
    html += `<li class="${cls}">${p.name}${muted}${hostTag}</li>`;
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
    updateGameSettingsSummary();
  }
}

function updateGameSettingsSummary() {
  const spy = $('#set-spy-count').value;
  const speak = $('#set-speak-time').value;
  $('#game-settings-summary').textContent = `${spy} 名臥底 · ${speak} 秒發言`;
}

function updateWordSettingsSummary() {
  const mode = state.wordMode;
  const count = getSelectedWordCount();
  if (mode === 'preset') {
    $('#word-settings-summary').textContent = `預設詞庫 · ${count} 組`;
  } else {
    $('#word-settings-summary').textContent = `自定義 · ${count} 組`;
  }
  updateSeriesBadge();
}

function getSelectedWordCount() {
  if (state.wordMode === 'preset') {
    return state.presetSelected.size;
  }
  let c = 0;
  $$('#word-table-body .word-row').forEach(row => {
    const cb = row.querySelector('.wr-check input');
    if (!cb?.checked) return;
    const civ = row.querySelector('.wr-civilian').value.trim();
    const spy = row.querySelector('.wr-spy').value.trim();
    if (civ && spy) c++;
  });
  return c;
}

function updateSeriesBadge() {
  const count = getSelectedWordCount();
  const badge = $('#series-badge');
  if (count > 1) {
    badge.hidden = false;
    $('#series-count').textContent = count;
  } else {
    badge.hidden = true;
  }
}

// ─── Accordion ───
$$('.accordion-header').forEach(btn => {
  btn.addEventListener('click', () => {
    const acc = btn.closest('.accordion');
    acc.classList.toggle('open');
  });
});

// ─── 模式選擇器 ───
$$('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.wordMode = btn.dataset.mode;
    $$('.mode-panel').forEach(p => p.classList.remove('active'));
    $(`#mode-${btn.dataset.mode}`).classList.add('active');
    updateWordSettingsSummary();
  });
});

// ─── 預設詞庫 chip 列表 ───
function initPresetChips() {
  const container = $('#preset-chips');
  let html = '';
  PRESET_WORDS.forEach((w, i) => {
    html += `<button class="chip selected" data-idx="${i}">${w.civilian} ↔ ${w.spy}</button>`;
  });
  container.innerHTML = html;
  state.presetSelected = new Set(PRESET_WORDS.map((_, i) => i).slice(0, 5));
  syncPresetChipStyles();

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const idx = +chip.dataset.idx;
    if (state.presetSelected.has(idx)) {
      state.presetSelected.delete(idx);
    } else {
      if (state.presetSelected.size >= 10) return toast('最多選擇 10 組');
      state.presetSelected.add(idx);
    }
    syncPresetChipStyles();
    updateWordSettingsSummary();
    autoSendWords();
  });
}

function syncPresetChipStyles() {
  $$('#preset-chips .chip').forEach(chip => {
    const idx = +chip.dataset.idx;
    chip.classList.toggle('selected', state.presetSelected.has(idx));
  });
}

$('#btn-preset-all').addEventListener('click', () => {
  state.presetSelected = new Set(PRESET_WORDS.map((_, i) => i).slice(0, 10));
  syncPresetChipStyles();
  updateWordSettingsSummary();
  autoSendWords();
  if (PRESET_WORDS.length > 10) toast('已選前 10 組（上限 10）');
});

$('#btn-preset-none').addEventListener('click', () => {
  state.presetSelected.clear();
  syncPresetChipStyles();
  updateWordSettingsSummary();
  autoSendWords();
});

initPresetChips();

// ─── 我的詞庫表格（帶 checkbox）───
function addWordRow(civilian, spy, checked = true) {
  const body = $('#word-table-body');
  const count = body.querySelectorAll('.word-row').length;
  if (count >= 50) return toast('詞庫上限 50 組');
  const div = document.createElement('div');
  div.className = 'word-row' + (checked ? ' checked' : '');
  div.innerHTML = `
    <div class="wr-check"><input type="checkbox" ${checked ? 'checked' : ''} /></div>
    <input type="text" class="wr-civilian" placeholder="平民詞" value="${escAttr(civilian || '')}" maxlength="20" />
    <input type="text" class="wr-spy" placeholder="臥底詞" value="${escAttr(spy || '')}" maxlength="20" />
    <div class="wr-actions">
      <button class="btn-tiny wr-swap" title="交換平民/臥底">⇄</button>
      <button class="wr-del" title="刪除">×</button>
    </div>`;
  body.appendChild(div);

  const cb = div.querySelector('.wr-check input');
  cb.addEventListener('change', () => {
    div.classList.toggle('checked', cb.checked);
    updateLibSelectInfo();
    updateWordSettingsSummary();
    autoSendWords();
    saveUserLibrary();
  });
  div.querySelector('.wr-swap').addEventListener('click', () => {
    const ci = div.querySelector('.wr-civilian');
    const si = div.querySelector('.wr-spy');
    [ci.value, si.value] = [si.value, ci.value];
    saveUserLibrary();
    autoSendWords();
  });
  div.querySelector('.wr-del').addEventListener('click', () => {
    div.remove();
    updateLibSelectInfo();
    updateWordSettingsSummary();
    saveUserLibrary();
    autoSendWords();
    if (!$('#word-table-body .word-row')) showTableEmpty();
  });
  div.querySelector('.wr-civilian').addEventListener('input', () => { updateWordSettingsSummary(); saveUserLibrary(); });
  div.querySelector('.wr-spy').addEventListener('input', () => { updateWordSettingsSummary(); saveUserLibrary(); });

  hideTableEmpty();
  updateLibSelectInfo();
  updateWordSettingsSummary();
}

function showTableEmpty() {
  if ($('#word-table-body .word-table-empty')) return;
  const div = document.createElement('div');
  div.className = 'word-table-empty';
  div.textContent = '詞庫為空，可透過 AI 生成或手動新增';
  $('#word-table-body').appendChild(div);
}
function hideTableEmpty() {
  const el = $('#word-table-body .word-table-empty');
  if (el) el.remove();
}

function updateLibSelectInfo() {
  const total = $$('#word-table-body .word-row').length;
  const checked = getSelectedWordCount();
  const el = $('#lib-select-info');
  if (total === 0) {
    el.textContent = '勾選即選用';
  } else if (checked === 0) {
    el.textContent = `共 ${total} 組，未選用`;
    el.style.color = 'var(--crimson)';
    el.style.background = 'var(--crimson-bg)';
  } else {
    el.textContent = `已選 ${checked} 組 → ${checked} 局`;
    el.style.color = '';
    el.style.background = '';
  }
}

$('#btn-add-row').addEventListener('click', () => {
  addWordRow('', '', true);
  const rows = $$('#word-table-body .word-row');
  const lastRow = rows[rows.length - 1];
  if (lastRow) lastRow.querySelector('.wr-civilian').focus();
});

$('#btn-clear-lib').addEventListener('click', () => {
  if (!confirm('確定清空所有詞庫？此操作不可恢復。')) return;
  $('#word-table-body').innerHTML = '';
  showTableEmpty();
  localStorage.removeItem(STORAGE_KEYS.library);
  updateLibSelectInfo();
  updateWordSettingsSummary();
  autoSendWords();
  toast('詞庫已清空');
});

// ─── localStorage 存取 ───
function loadUserLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.library);
    if (!raw) return false;
    const lib = JSON.parse(raw);
    if (!lib.entries?.length) return false;
    $('#word-table-body').innerHTML = '';
    lib.entries.slice(0, 50).forEach(w => addWordRow(w.civilian, w.spy, false));
    return true;
  } catch { return false; }
}

function saveUserLibrary() {
  const entries = [];
  $$('#word-table-body .word-row').forEach(row => {
    const civ = row.querySelector('.wr-civilian').value.trim();
    const spy = row.querySelector('.wr-spy').value.trim();
    if (civ && spy) entries.push({ civilian: civ, spy });
  });
  if (entries.length === 0) {
    localStorage.removeItem(STORAGE_KEYS.library);
    return;
  }
  const unique = [];
  const seen = new Set();
  for (const e of entries) {
    const key = e.civilian + '|' + e.spy;
    if (!seen.has(key)) { seen.add(key); unique.push(e); }
  }
  localStorage.setItem(STORAGE_KEYS.library, JSON.stringify({ version: 2, entries: unique.slice(0, 50) }));
}

// 切到自定義時自動載入
$$('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.mode === 'custom' && !$$('#word-table-body .word-row').length) {
      const loaded = loadUserLibrary();
      if (!loaded) showTableEmpty();
      else toast('已載入個人詞庫');
    }
  });
});

// ─── AI 生成 → chips 展示 ───
$('#btn-ai-generate').addEventListener('click', async () => {
  const topic = $('#ai-topic').value.trim();
  if (!topic) return toast('請輸入主題');

  $('#btn-ai-generate').disabled = true;
  $('#btn-ai-generate').textContent = '生成中...';

  try {
    const resp = await apiFetch(`/api/ai-words?topic=${encodeURIComponent(topic)}`);
    const data = await resp.json();
    if (data.words?.length > 0) {
      state.aiGenerated = data.words;
      state.aiSelected = new Set(data.words.map((_, i) => i));
      renderAiChips();
      toast(`已生成 ${data.words.length} 組，請選取後加入詞庫`);
    } else {
      toast('AI 未能生成詞對，請嘗試其他主題');
    }
  } catch { toast('AI 生成失敗，請稍後再試'); }
  finally {
    $('#btn-ai-generate').disabled = false;
    $('#btn-ai-generate').textContent = 'AI 生成';
  }
});

function renderAiChips() {
  const area = $('#ai-chips-area');
  const container = $('#ai-chips');
  area.hidden = false;
  let html = '';
  state.aiGenerated.forEach((w, i) => {
    const sel = state.aiSelected.has(i) ? ' selected' : '';
    html += `<button class="ai-chip${sel}" data-idx="${i}"><span class="ai-chip-check">✓</span>${w.civilian} ↔ ${w.spy}</button>`;
  });
  container.innerHTML = html;
  updateAiSelectedCount();

  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.ai-chip');
    if (!chip) return;
    const idx = +chip.dataset.idx;
    if (state.aiSelected.has(idx)) state.aiSelected.delete(idx);
    else state.aiSelected.add(idx);
    chip.classList.toggle('selected', state.aiSelected.has(idx));
    updateAiSelectedCount();
  });
}

function updateAiSelectedCount() {
  $('#ai-selected-count').textContent = state.aiSelected.size;
  $('#btn-ai-add-to-lib').disabled = state.aiSelected.size === 0;
}

$('#btn-ai-select-all').addEventListener('click', () => {
  state.aiSelected = new Set(state.aiGenerated.map((_, i) => i));
  $$('#ai-chips .ai-chip').forEach(c => c.classList.add('selected'));
  updateAiSelectedCount();
});

$('#btn-ai-select-none').addEventListener('click', () => {
  state.aiSelected.clear();
  $$('#ai-chips .ai-chip').forEach(c => c.classList.remove('selected'));
  updateAiSelectedCount();
});

$('#btn-ai-add-to-lib').addEventListener('click', () => {
  if (state.aiSelected.size === 0) return toast('請先選取至少一組');
  const existingKeys = new Set();
  $$('#word-table-body .word-row').forEach(row => {
    const c = row.querySelector('.wr-civilian').value.trim();
    const s = row.querySelector('.wr-spy').value.trim();
    if (c && s) existingKeys.add(c + '|' + s);
  });

  let added = 0;
  [...state.aiSelected].sort((a, b) => a - b).forEach(idx => {
    const w = state.aiGenerated[idx];
    if (!existingKeys.has(w.civilian + '|' + w.spy)) {
      hideTableEmpty();
      addWordRow(w.civilian, w.spy, true);
      added++;
    }
  });

  if (added > 0) {
    saveUserLibrary();
    autoSendWords();
    toast(`已加入 ${added} 組到詞庫`);
  } else {
    toast('所選詞組已存在於詞庫中');
  }

  $('#ai-chips-area').hidden = true;
  state.aiGenerated = [];
  state.aiSelected.clear();
});

// ─── 收集詞庫（僅勾選項）───
function collectWordsFromUI() {
  if (state.wordMode === 'preset') {
    if (state.presetSelected.size === 0) return null;
    return [...state.presetSelected].sort((a, b) => a - b).map(i => ({ ...PRESET_WORDS[i] }));
  }
  const words = [];
  $$('#word-table-body .word-row').forEach(row => {
    const cb = row.querySelector('.wr-check input');
    if (!cb?.checked) return;
    const civ = row.querySelector('.wr-civilian').value.trim();
    const spy = row.querySelector('.wr-spy').value.trim();
    if (civ && spy) words.push({ civilian: civ, spy });
  });
  return words.length > 0 ? words : null;
}

// ─── 房間操作 ───
$('#btn-copy-code').addEventListener('click', () => {
  navigator.clipboard?.writeText(state.roomId).then(() => toast('已複製房間碼'));
});

$('#btn-leave-room').addEventListener('click', () => {
  closeExistingWs();
  state.playerId = null;
  state.phase = 'waiting';
  showScreen('lobby');
});

$('#btn-start').addEventListener('click', () => {
  autoSendSettings();
  autoSendWords();
  wsSend({ type: 'start' });
});

function autoSendSettings() {
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
}

function autoSendWords() {
  const words = collectWordsFromUI();
  if (words) {
    wsSend({ type: 'update-words', words });
  }
}

['#set-spy-count', '#set-speak-time', '#set-vote-time', '#set-tie-rule'].forEach(sel => {
  $(sel).addEventListener('change', () => { autoSendSettings(); updateGameSettingsSummary(); });
});
$('#set-observer').addEventListener('change', () => { autoSendSettings(); updateGameSettingsSummary(); });

// ━━━━━━━━━ 遊戲 UI ━━━━━━━━━
function renderAlivePlayers() {
  let html = '';
  for (const p of (state.alivePlayers || [])) {
    const cls = ['avatar'];
    if (p.id === state.currentSpeakerId) cls.push('speaking');
    html += `<span class="${cls.join(' ')}">${p.name}</span>`;
  }
  const eliminated = Object.entries(state.players).filter(([id]) => !state.alivePlayers?.some(a => a.id === id));
  for (const [, p] of eliminated) {
    if (p.connected || state.phase !== 'waiting') html += `<span class="avatar eliminated">${p.name}</span>`;
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
  const btnDone = $('#btn-speak-done');
  const isMyTurn = state.currentSpeakerId === state.playerId && state.phase === 'speaking';
  input.disabled = !isMyTurn;
  btn.disabled = !isMyTurn;
  btnDone.disabled = !isMyTurn;
  input.placeholder = isMyTurn ? '輸入文字描述，或口頭發言後點擊「結束發言」' : '等待你的回合...';
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

$('#btn-speak-done').addEventListener('click', () => {
  wsSend({ type: 'speak-done' });
});

// 計時器
function startTimer(seconds) {
  clearTimer();
  state.timerValue = seconds;
  $('#game-timer').textContent = seconds;
  state.timerInterval = setInterval(() => {
    state.timerValue--;
    const t = Math.max(0, state.timerValue);
    $('#game-timer').textContent = t;
    const el = $('#game-timer');
    if (t <= 5) { el.style.color = 'var(--crimson)'; el.classList.add('warning'); }
    else if (t <= 10) { el.style.color = 'var(--amber)'; el.classList.remove('warning'); }
    else { el.style.color = 'var(--crimson)'; el.classList.remove('warning'); }
    if (state.timerValue <= 0) { clearTimer(); state.timerValue = 0; }
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

$('#btn-pause').addEventListener('click', () => wsSend({ type: 'host-action', action: 'pause' }));
$('#btn-resume').addEventListener('click', () => wsSend({ type: 'host-action', action: 'resume' }));
$('#btn-skip-speaker').addEventListener('click', () => wsSend({ type: 'host-action', action: 'skip' }));
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

window.hostAction = (action, targetId) => wsSend({ type: 'host-action', action, targetId });

// ━━━━━━━━━ 結算操作 ━━━━━━━━━
$('#btn-next-match').addEventListener('click', () => {
  wsSend({ type: 'host-action', action: 'next-series-match' });
});

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
  lines.push($('#result-title').textContent);
  lines.push(`平民詞：${$('#result-civilian-word').textContent}  臥底詞：${$('#result-spy-word').textContent}`);
  lines.push('');
  lines.push('--- 身分 ---');
  $$('.result-role-card').forEach(card => {
    lines.push(`${card.querySelector('.name').textContent} | ${card.querySelector('.role-tag').textContent} | ${card.querySelector('.alive-status').textContent}`);
  });
  lines.push('');
  lines.push('--- 發言紀錄 ---');
  $$('#result-chat-log .chat-msg').forEach(msg => lines.push(msg.textContent));

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `誰是臥底_${state.roomId}_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
});

// ─── 工具 ───
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function escAttr(s) { return s.replace(/"/g, '&quot;').replace(/</g, '&lt;'); }

})();
