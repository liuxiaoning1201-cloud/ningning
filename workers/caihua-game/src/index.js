/**
 * 巧手猜猜畫 — Cloudflare Worker + Durable Object 後端
 *
 * 玩法：教師（房主）以 AI 依主題生詞、勾選後建房；學生輸入純數字房間碼進房。
 * 系統每回合自動輪流指定一位「出題者」，出題者在中央共享畫布用實物貼紙拼出題詞，
 * 其餘人即時看到畫布並打字搶猜，按猜中先後遞減給分（人人有分）。
 *
 * 每個房間對應一個 GameRoom DO 實例，透過 WebSocket 即時通訊。
 */

// ─── 預設詞庫（未設定時的備援） ───
const DEFAULT_WORDS = ['太陽', '小船', '大樹', '雨傘', '房子', '蝴蝶', '火車', '月亮', '星星', '彩虹'];

// ─── CORS ───
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ─── Worker 入口 ───
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // POST /api/create-room → 建立房間並回傳純數字房間碼
    if (url.pathname === '/api/create-room' && request.method === 'POST') {
      const roomId = generateRoomId();
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      await stub.fetch(new Request(`https://do/init?roomId=${roomId}`));
      return Response.json({ roomId }, { headers: CORS });
    }

    // GET /api/room-info?id=123456 → 查詢房間狀態
    if (url.pathname === '/api/room-info') {
      const roomId = url.searchParams.get('id');
      if (!roomId) return Response.json({ error: '缺少房間碼' }, { status: 400, headers: CORS });
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      const resp = await stub.fetch(new Request('https://do/info'));
      const data = await resp.json();
      return Response.json(data, { headers: CORS });
    }

    // GET /api/ai-words?topic=水果&count=12 → AI 依主題生成候選詞彙
    if (url.pathname === '/api/ai-words') {
      const topic = url.searchParams.get('topic') || '常見事物';
      const count = Math.max(4, Math.min(20, Number(url.searchParams.get('count')) || 12));
      try {
        const words = await generateAiWords(env, topic, count);
        return Response.json({ words }, { headers: CORS });
      } catch (e) {
        return Response.json({ error: e.message, words: [] }, { status: 500, headers: CORS });
      }
    }

    // GET /api/ai-learn?word=蘋果 → 學習卡（拼音/釋義/組詞/造句）
    if (url.pathname === '/api/ai-learn') {
      const word = url.searchParams.get('word') || '';
      if (!word) return Response.json({ error: '缺少詞語' }, { status: 400, headers: CORS });
      try {
        const card = await generateLearnCard(env, word);
        return Response.json({ card }, { headers: CORS });
      } catch (e) {
        return Response.json({ error: e.message, card: null }, { status: 500, headers: CORS });
      }
    }

    // WebSocket /ws?room=123456
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room');
      if (!roomId) return new Response('Missing room id', { status: 400 });
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response('巧手猜猜畫 API', { headers: CORS });
  },
};

// ─── AI：依主題生詞 ───
async function generateAiWords(env, topic, count) {
  const prompt = `你是小學中文「你拼我猜」遊戲的出題助手。

任務：圍繞主題「${topic}」生成恰好 ${count} 個適合小學生的中文詞語，供他們用生活物品創意拼出來讓人猜。

嚴格規則：
1. 全部詞語都要緊扣主題「${topic}」。
2. 詞語要具體、形象、容易用實物擺出來（避免太抽象）。
3. 以 2-3 個字的常見詞為主，適合小學生認讀。
4. 不要重複。
5. 使用繁體中文。

嚴格只回覆 JSON 陣列，不要任何額外文字、解釋或 markdown：
["詞語1","詞語2","詞語3"]`;

  const text = await callDeepSeek(env, {
    app: 'caihua-ai-words',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
    temperature: 0.8,
  });

  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI 回覆格式異常');
  const parsed = JSON.parse(match[0]);
  const words = parsed
    .map((w) => (typeof w === 'string' ? w.trim() : ''))
    .filter(Boolean);
  // 去重
  return [...new Set(words)].slice(0, count);
}

// ─── AI：學習卡 ───
async function generateLearnCard(env, word) {
  const prompt = `你是小學中文老師。請為詞語「${word}」生成一張學習卡，幫助小學生學習。

嚴格只回覆 JSON 物件，不要任何額外文字、解釋或 markdown：
{"word":"${word}","pinyin":"漢語拼音(帶聲調)","meaning":"用一句小學生能懂的話解釋","words":["組詞1","組詞2","組詞3"],"sentence":"一個簡單造句"}

使用繁體中文。`;

  const text = await callDeepSeek(env, {
    app: 'caihua-ai-learn',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 600,
    temperature: 0.6,
  });

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('AI 回覆格式異常');
  const card = JSON.parse(match[0]);
  return {
    word: card.word || word,
    pinyin: card.pinyin || '',
    meaning: card.meaning || '',
    words: Array.isArray(card.words) ? card.words.slice(0, 5) : [],
    sentence: card.sentence || '',
  };
}

// ─── 統一呼叫平台 DeepSeek 代理 ───
async function callDeepSeek(env, payload) {
  const aiProxyUrl = env.AI_PROXY_URL || 'https://zykongjian.pages.dev/api/ai/deepseek';
  const resp = await fetch(aiProxyUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // 讓 Pages Function 的 Origin 白名單識別為本平台流量。
      Origin: 'https://zykongjian.pages.dev',
    },
    body: JSON.stringify({ model: 'deepseek-chat', ...payload }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`AI API 回傳錯誤 (${resp.status}): ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}

function generateRoomId() {
  // 6 位純數字（首位非 0），方便小學生輸入。
  let id = String(Math.floor(Math.random() * 9) + 1);
  for (let i = 0; i < 5; i++) id += Math.floor(Math.random() * 10);
  return id;
}

// 比對搶猜：去除空白與標點後比較。
function normalizeGuess(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[\s。，、！？；：「」『』（）()【】\[\]"'.,!?;:~`·…—\-_]/g, '');
}

// 按猜中順位遞減計分（人人有分）。
function scoreForRank(rank) {
  return Math.max(20, 100 - (rank - 1) * 20);
}

const DRAWER_BONUS_PER_CORRECT = 10;

// ─── GameRoom Durable Object ───
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map(); // ws -> { playerId }
    this.playerSockets = new Map(); // playerId -> ws
    this.room = null;
    this.timers = {};
    this.disconnectGrace = new Map();
  }

  async init() {
    if (this.room) return;
    this.room = {
      id: '',
      hostId: '',
      players: {}, // id -> { name, connected, score }
      phase: 'waiting', // waiting | playing | roundEnd | gameEnd
      settings: {
        roundTimeSec: 90,
        totalRounds: 6,
        maxPlayers: 30,
      },
      wordBank: [],
      round: 0,
      drawerOrder: [],
      drawerIdx: -1,
      currentWord: null,
      usedWords: [],
      canvasState: { stickers: [], strokes: [] },
      correctOrder: [], // [playerId] 本回合按猜中先後
      roundEndsAt: 0,
    };
  }

  async fetch(request) {
    await this.init();
    const url = new URL(request.url);

    if (url.pathname === '/init') {
      this.room.id = url.searchParams.get('roomId') || '';
      return new Response('ok');
    }

    if (url.pathname === '/info') {
      const count = Object.values(this.room.players).filter((p) => p.connected).length;
      return Response.json({
        exists: this.room.id !== '',
        playerCount: count,
        phase: this.room.phase,
        maxPlayers: this.room.settings.maxPlayers,
      });
    }

    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.handleSession(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response('Not found', { status: 404 });
  }

  handleSession(ws) {
    ws.accept();
    this.sessions.set(ws, { playerId: null });

    ws.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.onMessage(ws, msg);
      } catch (e) {
        this.send(ws, { type: 'error', message: e.message || '未知錯誤' });
      }
    });

    ws.addEventListener('close', () => this.onClose(ws));
    ws.addEventListener('error', () => this.onClose(ws));

    const pingInterval = setInterval(() => {
      if (this.sessions.has(ws)) {
        try { ws.send(JSON.stringify({ type: 'server-ping' })); } catch { clearInterval(pingInterval); }
      } else {
        clearInterval(pingInterval);
      }
    }, 10000);
  }

  async onMessage(ws, msg) {
    const handlers = {
      join: () => this.handleJoin(ws, msg),
      'set-words': () => this.handleSetWords(ws, msg),
      'update-settings': () => this.handleUpdateSettings(ws, msg),
      start: () => this.handleStart(ws),
      canvas: () => this.handleCanvas(ws, msg),
      guess: () => this.handleGuess(ws, msg),
      'skip-round': () => this.handleSkipRound(ws),
      'new-game': () => this.handleNewGame(ws),
      ping: () => this.send(ws, { type: 'pong' }),
    };
    if (handlers[msg.type]) await handlers[msg.type]();
  }

  // ─── 加入房間 ───
  handleJoin(ws, msg) {
    const name = (msg.name || '').trim();
    if (!name) return this.send(ws, { type: 'error', message: '請輸入暱稱' });

    // 嘗試重連：同名玩家回歸
    const reconnectEntry = Object.entries(this.room.players)
      .find(([, p]) => p.name === name && !p.connected);

    if (reconnectEntry) {
      const [oldId, player] = reconnectEntry;
      player.connected = true;

      if (this.disconnectGrace.has(oldId)) {
        clearTimeout(this.disconnectGrace.get(oldId));
        this.disconnectGrace.delete(oldId);
      }
      const oldWs = this.playerSockets.get(oldId);
      if (oldWs && oldWs !== ws) { try { oldWs.close(); } catch {} }

      this.sessions.get(ws).playerId = oldId;
      this.playerSockets.set(oldId, ws);

      const isHost = oldId === this.room.hostId;
      this.send(ws, { type: 'joined', playerId: oldId, isHost, room: this.getPublicRoomState(), reconnect: true });
      this.sendRoundStateTo(ws, oldId);
      this.broadcastPlayerList();
      return;
    }

    const connected = Object.values(this.room.players).filter((p) => p.connected);
    if (connected.length >= this.room.settings.maxPlayers) {
      return this.send(ws, { type: 'error', message: '房間已滿' });
    }
    if (this.room.phase !== 'waiting') {
      return this.send(ws, { type: 'error', message: '遊戲已開始，暫時無法加入' });
    }
    if (connected.some((p) => p.name === name)) {
      return this.send(ws, { type: 'error', message: '該暱稱已被使用' });
    }

    const playerId = crypto.randomUUID();
    const isHost = !this.room.hostId;
    this.room.players[playerId] = { name, connected: true, score: 0 };
    if (isHost) this.room.hostId = playerId;

    this.sessions.get(ws).playerId = playerId;
    this.playerSockets.set(playerId, ws);

    this.send(ws, { type: 'joined', playerId, isHost, room: this.getPublicRoomState() });
    this.broadcast({ type: 'player-joined', player: { id: playerId, name } }, playerId);
    this.broadcastPlayerList();
  }

  // 重連時補發目前回合狀態
  sendRoundStateTo(ws, pid) {
    if (this.room.phase === 'playing' || this.room.phase === 'roundEnd') {
      const drawerId = this.room.drawerOrder[this.room.drawerIdx];
      const isDrawer = pid === drawerId;
      this.send(ws, {
        type: 'round-start',
        round: this.room.round,
        totalRounds: this.room.settings.totalRounds,
        drawerId,
        drawerName: this.room.players[drawerId]?.name || '',
        isDrawer,
        word: isDrawer ? this.room.currentWord : null,
        wordLen: this.room.currentWord ? this.room.currentWord.length : 0,
        secondsLeft: Math.max(0, Math.round((this.room.roundEndsAt - Date.now()) / 1000)),
      });
      this.send(ws, { type: 'canvas-update', stickers: this.room.canvasState.stickers, strokes: this.room.canvasState.strokes });
    }
  }

  // ─── 房主設定詞庫 ───
  handleSetWords(ws, msg) {
    if (this.getPlayerId(ws) !== this.room.hostId) return;
    const words = Array.isArray(msg.words)
      ? [...new Set(msg.words.map((w) => String(w || '').trim()).filter(Boolean))]
      : [];
    this.room.wordBank = words.slice(0, 60);
    this.broadcast({ type: 'words-updated', count: this.room.wordBank.length });
  }

  // ─── 房主更新設定 ───
  handleUpdateSettings(ws, msg) {
    if (this.getPlayerId(ws) !== this.room.hostId) return;
    if (this.room.phase !== 'waiting') return;
    const s = msg.settings || {};
    if (s.roundTimeSec != null) this.room.settings.roundTimeSec = Math.max(30, Math.min(300, Number(s.roundTimeSec)));
    if (s.totalRounds != null) this.room.settings.totalRounds = Math.max(1, Math.min(30, Number(s.totalRounds)));
    if (s.maxPlayers != null) this.room.settings.maxPlayers = Math.max(2, Math.min(50, Number(s.maxPlayers)));
    this.broadcast({ type: 'settings-updated', settings: this.room.settings });
  }

  // ─── 開始遊戲 ───
  handleStart(ws) {
    if (this.getPlayerId(ws) !== this.room.hostId) {
      return this.send(ws, { type: 'error', message: '只有房主可以開始遊戲' });
    }
    const players = this.getConnectedPlayers();
    if (players.length < 2) {
      return this.send(ws, { type: 'error', message: '至少需要 2 位玩家才能開始' });
    }
    if (this.room.wordBank.length === 0) {
      return this.send(ws, { type: 'error', message: '詞庫為空，請先用 AI 生詞並勾選詞語' });
    }

    // 為所有人歸零分數，建立出題者輪轉序
    for (const [, p] of players) p.score = 0;
    this.room.drawerOrder = players.map(([id]) => id).sort(() => Math.random() - 0.5);
    this.room.drawerIdx = -1;
    this.room.round = 0;
    this.room.usedWords = [];
    this.startNextRound();
  }

  startNextRound() {
    this.clearAllTimers();

    // 推進出題者（循環）
    const connectedIds = this.getConnectedPlayers().map(([id]) => id);
    if (connectedIds.length < 2) {
      this.endGame();
      return;
    }
    // 確保輪轉序仍有效（移除已離線者）
    this.room.drawerOrder = this.room.drawerOrder.filter((id) => connectedIds.includes(id));
    for (const id of connectedIds) {
      if (!this.room.drawerOrder.includes(id)) this.room.drawerOrder.push(id);
    }

    this.room.round++;
    if (this.room.round > this.room.settings.totalRounds) {
      this.endGame();
      return;
    }

    this.room.drawerIdx = (this.room.drawerIdx + 1) % this.room.drawerOrder.length;
    const drawerId = this.room.drawerOrder[this.room.drawerIdx];

    // 選題：未用過的優先
    let pool = this.room.wordBank.filter((w) => !this.room.usedWords.includes(w));
    if (pool.length === 0) { this.room.usedWords = []; pool = [...this.room.wordBank]; }
    this.room.currentWord = pool[Math.floor(Math.random() * pool.length)];
    this.room.usedWords.push(this.room.currentWord);

    this.room.phase = 'playing';
    this.room.canvasState = { stickers: [], strokes: [] };
    this.room.correctOrder = [];
    this.room.roundEndsAt = Date.now() + this.room.settings.roundTimeSec * 1000;

    for (const [id, player] of Object.entries(this.room.players)) {
      const sock = this.playerSockets.get(id);
      if (!sock) continue;
      const isDrawer = id === drawerId;
      this.send(sock, {
        type: 'round-start',
        round: this.room.round,
        totalRounds: this.room.settings.totalRounds,
        drawerId,
        drawerName: this.room.players[drawerId]?.name || '',
        isDrawer,
        word: isDrawer ? this.room.currentWord : null,
        wordLen: this.room.currentWord.length,
        secondsLeft: this.room.settings.roundTimeSec,
      });
    }
    this.broadcast({ type: 'canvas-update', stickers: [], strokes: [] });
    this.startRoundTimer();
  }

  startRoundTimer() {
    this.clearTimer('round');
    const sec = this.room.settings.roundTimeSec;
    this.timers.round = setTimeout(() => {
      if (this.room.phase === 'playing') this.endRound('timeout');
    }, sec * 1000);
  }

  // ─── 畫布同步（出題者） ───
  handleCanvas(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (this.room.phase !== 'playing') return;
    const drawerId = this.room.drawerOrder[this.room.drawerIdx];
    if (pid !== drawerId) return; // 只有出題者能操作
    // 限制數量，避免濫用
    const stickers = Array.isArray(msg.stickers) ? msg.stickers.slice(0, 80) : [];
    const strokes = Array.isArray(msg.strokes)
      ? msg.strokes.slice(0, 80).map((s) => ({
          id: s.id, color: s.color, width: s.width, z: s.z,
          points: Array.isArray(s.points) ? s.points.slice(0, 400) : [],
        }))
      : [];
    this.room.canvasState = { stickers, strokes };
    this.broadcast({ type: 'canvas-update', stickers, strokes }, pid);
  }

  // ─── 搶猜 ───
  handleGuess(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (this.room.phase !== 'playing') return;
    const player = this.room.players[pid];
    if (!player) return;

    const drawerId = this.room.drawerOrder[this.room.drawerIdx];
    if (pid === drawerId) {
      return this.send(ws, { type: 'error', message: '出題者不能猜題' });
    }
    if (this.room.correctOrder.includes(pid)) return; // 已猜中過

    const raw = (msg.text || '').trim();
    if (!raw) return;

    const correct = normalizeGuess(raw) === normalizeGuess(this.room.currentWord);
    let rank = 0;
    let points = 0;

    if (correct) {
      this.room.correctOrder.push(pid);
      rank = this.room.correctOrder.length;
      points = scoreForRank(rank);
      player.score += points;
      // 出題者獲鼓勵分
      const drawer = this.room.players[drawerId];
      if (drawer) drawer.score += DRAWER_BONUS_PER_CORRECT;
    }

    // 即時答案流：所有人可見（猜中時隱藏正確答案文字，只標記猜中）
    this.broadcast({
      type: 'guess',
      playerId: pid,
      name: player.name,
      text: correct ? '' : raw,
      correct,
      rank,
      points,
    });

    if (correct) {
      this.broadcastPlayerList();
      // 全部非出題者都猜中 → 提前結束
      const guessers = this.getConnectedPlayers().filter(([id]) => id !== drawerId);
      if (guessers.length > 0 && this.room.correctOrder.length >= guessers.length) {
        this.endRound('all-correct');
      }
    }
  }

  endRound(reason) {
    this.clearTimer('round');
    this.room.phase = 'roundEnd';

    const ranking = this.getConnectedPlayers()
      .map(([id, p]) => ({ id, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);

    const roundResult = this.room.correctOrder.map((id, i) => ({
      id,
      name: this.room.players[id]?.name || '',
      rank: i + 1,
      points: scoreForRank(i + 1),
    }));

    this.broadcast({
      type: 'round-end',
      reason,
      word: this.room.currentWord,
      drawerId: this.room.drawerOrder[this.room.drawerIdx],
      drawerName: this.room.players[this.room.drawerOrder[this.room.drawerIdx]]?.name || '',
      roundResult,
      ranking,
      isLastRound: this.room.round >= this.room.settings.totalRounds,
    });

    if (this.room.round >= this.room.settings.totalRounds) {
      this.timers.next = setTimeout(() => this.endGame(), 6000);
    } else {
      this.timers.next = setTimeout(() => this.startNextRound(), 6000);
    }
  }

  endGame() {
    this.clearAllTimers();
    this.room.phase = 'gameEnd';
    const ranking = Object.entries(this.room.players)
      .map(([id, p]) => ({ id, name: p.name, score: p.score, connected: p.connected }))
      .sort((a, b) => b.score - a.score);
    this.broadcast({ type: 'game-end', ranking });
  }

  handleSkipRound(ws) {
    if (this.getPlayerId(ws) !== this.room.hostId) return;
    if (this.room.phase === 'playing') this.endRound('host-skip');
  }

  handleNewGame(ws) {
    if (this.getPlayerId(ws) !== this.room.hostId) return;
    this.clearAllTimers();
    for (const p of Object.values(this.room.players)) p.score = 0;
    this.room.phase = 'waiting';
    this.room.round = 0;
    this.room.drawerOrder = [];
    this.room.drawerIdx = -1;
    this.room.currentWord = null;
    this.room.usedWords = [];
    this.room.canvasState = { stickers: [], strokes: [] };
    this.room.correctOrder = [];
    this.broadcast({ type: 'new-game-reset', room: this.getPublicRoomState() });
    this.broadcastPlayerList();
  }

  // ─── 斷線 ───
  onClose(ws) {
    const session = this.sessions.get(ws);
    if (!session) return;
    const pid = session.playerId;
    this.sessions.delete(ws);
    if (!pid) return;
    if (this.playerSockets.get(pid) !== ws) return;

    this.playerSockets.delete(pid);
    const player = this.room.players[pid];
    if (!player) return;
    player.connected = false;
    this.broadcast({ type: 'player-disconnected', playerId: pid, name: player.name });

    if (this.room.phase === 'waiting') {
      delete this.room.players[pid];
      if (pid === this.room.hostId) {
        const remaining = Object.entries(this.room.players).filter(([, p]) => p.connected);
        this.room.hostId = remaining[0]?.[0] || '';
        if (this.room.hostId) {
          this.broadcast({ type: 'new-host', hostId: this.room.hostId, name: this.room.players[this.room.hostId]?.name });
        }
      }
      this.broadcastPlayerList();
      return;
    }

    this.broadcastPlayerList();

    // 遊戲中出題者斷線：寬限 20 秒不回則跳過該回合
    const drawerId = this.room.drawerOrder[this.room.drawerIdx];
    if ((this.room.phase === 'playing') && pid === drawerId) {
      if (this.disconnectGrace.has(pid)) clearTimeout(this.disconnectGrace.get(pid));
      this.disconnectGrace.set(pid, setTimeout(() => {
        this.disconnectGrace.delete(pid);
        if (!this.room.players[pid]?.connected && this.room.phase === 'playing') {
          this.endRound('drawer-left');
        }
      }, 20000));
    }
  }

  // ─── 輔助 ───
  getPlayerId(ws) {
    return this.sessions.get(ws)?.playerId;
  }

  getConnectedPlayers() {
    return Object.entries(this.room.players).filter(([, p]) => p.connected);
  }

  getPublicRoomState() {
    const players = {};
    for (const [id, p] of Object.entries(this.room.players)) {
      players[id] = { name: p.name, connected: p.connected, score: p.score };
    }
    return {
      id: this.room.id,
      hostId: this.room.hostId,
      players,
      phase: this.room.phase,
      round: this.room.round,
      settings: this.room.settings,
      wordBankCount: this.room.wordBank.length,
    };
  }

  send(ws, data) {
    try { ws.send(JSON.stringify(data)); } catch {}
  }

  broadcast(data, excludeId) {
    const msg = JSON.stringify(data);
    for (const [ws, session] of this.sessions) {
      if (session.playerId !== excludeId) {
        try { ws.send(msg); } catch {}
      }
    }
  }

  broadcastPlayerList() {
    this.broadcast({
      type: 'player-list',
      players: this.getPublicRoomState().players,
      hostId: this.room.hostId,
    });
  }

  clearTimer(name) {
    if (this.timers[name]) { clearTimeout(this.timers[name]); delete this.timers[name]; }
  }

  clearAllTimers() {
    for (const name of Object.keys(this.timers)) this.clearTimer(name);
  }
}
