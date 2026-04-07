/**
 * 誰是臥底 — Cloudflare Worker + Durable Object 後端
 * 每個房間對應一個 GameRoom DO 實例，透過 WebSocket 與前端即時通訊。
 */

// ─── 預設詞庫 ───
const DEFAULT_WORD_BANK = [
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

    // POST /api/create-room → 建立房間並回傳房間碼
    if (url.pathname === '/api/create-room' && request.method === 'POST') {
      const roomId = generateRoomId();
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      await stub.fetch(new Request(`https://do/init?roomId=${roomId}`));
      return Response.json({ roomId }, { headers: CORS });
    }

    // GET /api/room-info?id=XXXX → 查詢房間狀態
    if (url.pathname === '/api/room-info') {
      const roomId = url.searchParams.get('id');
      if (!roomId) return Response.json({ error: '缺少房間碼' }, { status: 400, headers: CORS });
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      const resp = await stub.fetch(new Request('https://do/info'));
      const data = await resp.json();
      return Response.json(data, { headers: CORS });
    }

    // GET /api/ai-words?topic=XXX → AI 生成 10 組詞對
    if (url.pathname === '/api/ai-words') {
      const topic = url.searchParams.get('topic') || '常見事物';
      const count = 10;
      try {
        const words = await generateAiWords(env, topic, count);
        return Response.json({ words }, { headers: CORS });
      } catch (e) {
        return Response.json({ error: e.message, words: [] }, { status: 500, headers: CORS });
      }
    }

    // WebSocket /ws?room=XXXX
    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room');
      if (!roomId) return new Response('Missing room id', { status: 400 });
      const id = env.ROOMS.idFromName(roomId);
      const stub = env.ROOMS.get(id);
      return stub.fetch(request);
    }

    return new Response('誰是臥底 API', { headers: CORS });
  },
};

async function generateAiWords(env, topic, count) {
  const apiKey = env.AI_API_KEY;
  const apiBase = env.AI_API_BASE || 'https://api.deepseek.com';

  if (!apiKey) {
    throw new Error('未配置 AI_API_KEY，請在 .dev.vars 或 Secrets 中設定');
  }

  const prompt = `你是「誰是臥底」遊戲的專業出題助手。

任務：根據主題「${topic}」生成恰好 ${count} 組詞對。

嚴格規則：
1. 每組的兩個詞必須是【同一類別】的事物。例如主題是「詩人」，則兩個詞都必須是詩人的名字（如「李白」和「杜甫」），絕對不能混入詩詞名稱、朝代或其他類別。
2. 兩個詞要足夠相似（屬於同一類別、有某些共同特徵），讓臥底不容易被發現。
3. 但兩個詞必須有明確的區別，不能是同一個事物的不同說法。
4. 不要重複使用相同的詞語。
5. 詞語應簡潔，通常 2-4 個字。

嚴格按以下 JSON 格式回覆，不要加任何額外文字、解釋或 markdown：
[{"civilian":"平民詞1","spy":"臥底詞1"},{"civilian":"平民詞2","spy":"臥底詞2"}]`;

  const resp = await fetch(`${apiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      temperature: 0.8,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text().catch(() => '');
    throw new Error(`AI API 回傳錯誤 (${resp.status}): ${err.slice(0, 200)}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error('AI 回覆格式異常');

  const parsed = JSON.parse(match[0]);
  return parsed.filter(w => w.civilian && w.spy).slice(0, count);
}

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

// ─── GameRoom Durable Object ───
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
    this.playerSockets = new Map();
    this.room = null;
    this.timers = {};
    this.msgSeq = 0;
    this.disconnectGrace = new Map();
  }

  async init() {
    if (this.room) return;
    this.room = {
      id: '',
      hostId: '',
      players: {},
      phase: 'waiting',
      round: 0,
      wordPair: null,
      speakOrder: [],
      currentSpeakerIdx: -1,
      votes: {},
      eliminated: [],
      settings: {
        spyCount: 1,
        speakTimeSec: 60,
        voteTimeSec: 30,
        maxPlayers: 12,
        hostAsObserver: false,
        tieRule: 'no-eliminate',
      },
      wordBank: [...DEFAULT_WORD_BANK],
      chatLog: [],
      paused: false,
      seriesIndex: 0,
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
      const count = Object.values(this.room.players).filter(p => p.connected).length;
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

    // 服務端心跳：每 20 秒 ping 一次保持連線
    const pingInterval = setInterval(() => {
      if (this.sessions.has(ws)) {
        try { ws.send(JSON.stringify({ type: 'server-ping' })); } catch { clearInterval(pingInterval); }
      } else {
        clearInterval(pingInterval);
      }
    }, 20000);
  }

  async onMessage(ws, msg) {
    const handlers = {
      join: () => this.handleJoin(ws, msg),
      ready: () => this.handleReady(ws),
      start: () => this.handleStart(ws),
      speak: () => this.handleSpeak(ws, msg),
      'speak-done': () => this.handleSpeakDone(ws),
      vote: () => this.handleVote(ws, msg),
      'update-settings': () => this.handleUpdateSettings(ws, msg),
      'update-words': () => this.handleUpdateWords(ws, msg),
      'host-action': () => this.handleHostAction(ws, msg),
      ping: () => this.send(ws, { type: 'pong' }),
    };
    if (handlers[msg.type]) await handlers[msg.type]();
  }

  // ─── 加入房間 ───
  handleJoin(ws, msg) {
    const { name } = msg;
    if (!name || !name.trim()) {
      return this.send(ws, { type: 'error', message: '請輸入暱稱' });
    }

    const trimName = name.trim();

    // 嘗試重連：同名玩家回歸
    const reconnectEntry = Object.entries(this.room.players)
      .find(([, p]) => p.name === trimName && !p.connected);

    if (reconnectEntry) {
      const [oldId, player] = reconnectEntry;
      player.connected = true;

      // 取消斷線寬限計時
      if (this.disconnectGrace.has(oldId)) {
        clearTimeout(this.disconnectGrace.get(oldId));
        this.disconnectGrace.delete(oldId);
      }

      // 關閉舊 socket（如果還在）
      const oldWs = this.playerSockets.get(oldId);
      if (oldWs && oldWs !== ws) {
        try { oldWs.close(); } catch {}
      }

      this.sessions.get(ws).playerId = oldId;
      this.playerSockets.set(oldId, ws);

      const isHost = oldId === this.room.hostId;
      this.send(ws, {
        type: 'joined',
        playerId: oldId,
        isHost,
        room: this.getPublicRoomState(),
        reconnect: true,
      });

      // 遊戲進行中：補發遊戲狀態
      if (this.room.phase !== 'waiting' && this.room.phase !== 'gameEnd') {
        this.send(ws, {
          type: 'game-start',
          yourRole: player.role,
          yourWord: player.word,
          round: this.room.round,
          speakOrder: this.room.speakOrder.map(sid => ({
            id: sid,
            name: this.room.players[sid]?.name,
          })),
          currentSpeakerId: this.room.speakOrder[this.room.currentSpeakerIdx],
          alivePlayers: this.getAlivePlayers().map(([id, p]) => ({ id, name: p.name })),
          seriesIndex: this.room.seriesIndex,
          seriesTotal: this.room.wordBank.length,
        });
        // 補發歷史聊天
        for (const chatMsg of this.room.chatLog) {
          this.send(ws, { type: 'chat', ...chatMsg });
        }
        if (this.room.phase === 'voting') {
          this.send(ws, {
            type: 'vote-phase',
            alivePlayers: this.getAlivePlayers().map(([id, p]) => ({ id, name: p.name })),
            seconds: 0,
          });
        }
        if (isHost) this.sendGodView();
      }

      this.broadcast({ type: 'player-reconnected', playerId: oldId, name: trimName }, oldId);
      this.broadcastPlayerList();
      return;
    }

    // 新玩家加入
    const connected = Object.values(this.room.players).filter(p => p.connected);
    if (connected.length >= this.room.settings.maxPlayers) {
      return this.send(ws, { type: 'error', message: '房間已滿' });
    }
    if (this.room.phase !== 'waiting') {
      return this.send(ws, { type: 'error', message: '遊戲已開始，無法加入' });
    }
    if (connected.some(p => p.name === trimName)) {
      return this.send(ws, { type: 'error', message: '該暱稱已被使用' });
    }

    const playerId = crypto.randomUUID();
    const isHost = !this.room.hostId;

    this.room.players[playerId] = {
      name: trimName,
      role: null,
      word: null,
      alive: true,
      ready: false,
      muted: false,
      connected: true,
    };

    if (isHost) this.room.hostId = playerId;

    this.sessions.get(ws).playerId = playerId;
    this.playerSockets.set(playerId, ws);

    this.send(ws, {
      type: 'joined',
      playerId,
      isHost,
      room: this.getPublicRoomState(),
    });

    this.broadcast({ type: 'player-joined', player: { id: playerId, name: trimName } }, playerId);
    this.broadcastPlayerList();
  }

  // ─── 準備 ───
  handleReady(ws) {
    const pid = this.getPlayerId(ws);
    if (!pid || !this.room.players[pid]) return;
    this.room.players[pid].ready = !this.room.players[pid].ready;
    this.broadcastPlayerList();
  }

  // ─── 開始遊戲（房主） ───
  handleStart(ws) {
    const pid = this.getPlayerId(ws);
    if (pid !== this.room.hostId) {
      return this.send(ws, { type: 'error', message: '只有房主可以開始遊戲' });
    }

    const activePlayers = this.getActivePlayers();
    const minPlayers = 3;
    if (activePlayers.length < minPlayers) {
      return this.send(ws, { type: 'error', message: `至少需要 ${minPlayers} 位玩家才能開始` });
    }

    if (this.room.wordBank.length === 0) {
      return this.send(ws, { type: 'error', message: '詞庫為空，請先設定詞對' });
    }

    this.startGame();
  }

  startGame(seriesIdx) {
    const players = this.getActivePlayers();
    const spyCount = Math.min(this.room.settings.spyCount, Math.floor(players.length / 3));

    const idx = seriesIdx != null ? seriesIdx : 0;
    this.room.seriesIndex = idx;
    this.room.wordPair = { ...this.room.wordBank[idx] };

    const shuffled = [...players].sort(() => Math.random() - 0.5);
    const spyIds = new Set(shuffled.slice(0, spyCount).map(([id]) => id));

    for (const [id, player] of players) {
      if (this.room.settings.hostAsObserver && id === this.room.hostId) {
        player.role = 'observer';
        player.word = null;
        player.alive = false;
        continue;
      }
      player.role = spyIds.has(id) ? 'spy' : 'civilian';
      player.word = spyIds.has(id) ? this.room.wordPair.spy : this.room.wordPair.civilian;
      player.alive = true;
      player.ready = false;
    }

    this.room.phase = 'speaking';
    this.room.round = 1;
    this.room.eliminated = [];
    this.room.chatLog = [];
    this.room.votes = {};

    this.room.speakOrder = this.getAlivePlayers().map(([id]) => id).sort(() => Math.random() - 0.5);
    this.room.currentSpeakerIdx = 0;

    const seriesTotal = this.room.wordBank.length;
    for (const [id, player] of Object.entries(this.room.players)) {
      const ws = this.playerSockets.get(id);
      if (!ws) continue;
      this.send(ws, {
        type: 'game-start',
        yourRole: player.role,
        yourWord: player.word,
        round: this.room.round,
        speakOrder: this.room.speakOrder.map(sid => ({
          id: sid,
          name: this.room.players[sid]?.name,
        })),
        currentSpeakerId: this.room.speakOrder[0],
        alivePlayers: this.getAlivePlayers().map(([id, p]) => ({ id, name: p.name })),
        seriesIndex: idx,
        seriesTotal,
      });
    }

    this.sendGodView();
    this.startSpeakTimer();
  }

  // ─── 發言 ───
  handleSpeak(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (this.room.phase !== 'speaking') return;
    if (this.room.paused) return;

    const currentSpeaker = this.room.speakOrder[this.room.currentSpeakerIdx];
    if (pid !== currentSpeaker) {
      return this.send(ws, { type: 'error', message: '還沒輪到你發言' });
    }

    if (this.room.players[pid]?.muted) {
      return this.send(ws, { type: 'error', message: '你已被禁言' });
    }

    const text = (msg.text || '').trim();
    if (!text) return;

    const chatMsg = {
      senderId: pid,
      senderName: this.room.players[pid].name,
      text,
      round: this.room.round,
      timestamp: Date.now(),
    };
    this.room.chatLog.push(chatMsg);

    this.broadcast({ type: 'chat', ...chatMsg });
    this.nextSpeaker();
  }

  handleSpeakDone(ws) {
    const pid = this.getPlayerId(ws);
    if (this.room.phase !== 'speaking') return;
    if (this.room.paused) return;
    const currentSpeaker = this.room.speakOrder[this.room.currentSpeakerIdx];
    if (pid !== currentSpeaker) {
      return this.send(ws, { type: 'error', message: '還沒輪到你發言' });
    }
    if (this.room.players[pid]?.muted) {
      return this.send(ws, { type: 'error', message: '你已被禁言' });
    }

    const chatMsg = {
      senderId: 'system',
      senderName: '系統',
      text: `${this.room.players[pid].name} 已結束發言`,
      round: this.room.round,
      timestamp: Date.now(),
    };
    this.room.chatLog.push(chatMsg);
    this.broadcast({ type: 'chat', ...chatMsg });
    this.nextSpeaker();
  }

  nextSpeaker() {
    this.clearTimer('speak');
    this.room.currentSpeakerIdx++;

    // 跳過已淘汰或離線的
    while (
      this.room.currentSpeakerIdx < this.room.speakOrder.length &&
      !this.isPlayerAliveAndConnected(this.room.speakOrder[this.room.currentSpeakerIdx])
    ) {
      this.room.currentSpeakerIdx++;
    }

    if (this.room.currentSpeakerIdx >= this.room.speakOrder.length) {
      this.startVotingPhase();
      return;
    }

    const nextId = this.room.speakOrder[this.room.currentSpeakerIdx];
    this.broadcast({
      type: 'next-speaker',
      currentSpeakerId: nextId,
      currentSpeakerName: this.room.players[nextId]?.name,
    });
    this.startSpeakTimer();
  }

  startSpeakTimer() {
    this.clearTimer('speak');
    const sec = this.room.settings.speakTimeSec;
    this.broadcast({ type: 'timer', phase: 'speaking', seconds: sec });
    this.timers.speak = setTimeout(() => {
      if (this.room.phase === 'speaking' && !this.room.paused) {
        const skippedId = this.room.speakOrder[this.room.currentSpeakerIdx];
        this.broadcast({
          type: 'chat',
          senderId: 'system',
          senderName: '系統',
          text: `${this.room.players[skippedId]?.name || '???'} 發言超時，自動跳過`,
          round: this.room.round,
          timestamp: Date.now(),
        });
        this.nextSpeaker();
      }
    }, sec * 1000);
  }

  // ─── 投票 ───
  startVotingPhase() {
    this.room.phase = 'voting';
    this.room.votes = {};
    const alive = this.getAlivePlayers().map(([id, p]) => ({ id, name: p.name }));
    this.broadcast({
      type: 'vote-phase',
      alivePlayers: alive,
      seconds: this.room.settings.voteTimeSec,
    });
    this.startVoteTimer();
  }

  handleVote(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (this.room.phase !== 'voting') return;
    if (!this.room.players[pid]?.alive) return;
    if (this.room.settings.hostAsObserver && pid === this.room.hostId) return;

    const targetId = msg.targetId;
    if (!targetId || !this.room.players[targetId]?.alive) return;
    if (targetId === pid) return;

    this.room.votes[pid] = targetId;
    this.broadcast({
      type: 'vote-cast',
      voterId: pid,
      voterName: this.room.players[pid].name,
    });

    this.sendGodView();

    const aliveCount = this.getAlivePlayers()
      .filter(([id]) => !(this.room.settings.hostAsObserver && id === this.room.hostId))
      .length;
    if (Object.keys(this.room.votes).length >= aliveCount) {
      this.resolveVotes();
    }
  }

  startVoteTimer() {
    this.clearTimer('vote');
    this.timers.vote = setTimeout(() => {
      if (this.room.phase === 'voting') this.resolveVotes();
    }, this.room.settings.voteTimeSec * 1000);
  }

  resolveVotes() {
    this.clearTimer('vote');
    const tally = {};
    for (const targetId of Object.values(this.room.votes)) {
      tally[targetId] = (tally[targetId] || 0) + 1;
    }

    let maxVotes = 0;
    let maxTargets = [];
    for (const [tid, count] of Object.entries(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
        maxTargets = [tid];
      } else if (count === maxVotes) {
        maxTargets.push(tid);
      }
    }

    let eliminatedId = null;
    if (maxTargets.length === 1) {
      eliminatedId = maxTargets[0];
    } else if (this.room.settings.tieRule === 'eliminate-first') {
      eliminatedId = maxTargets[0];
    }

    if (eliminatedId && this.room.players[eliminatedId]) {
      this.room.players[eliminatedId].alive = false;
      this.room.eliminated.push(eliminatedId);
    }

    const voteDetail = {};
    for (const [voterId, targetId] of Object.entries(this.room.votes)) {
      voteDetail[voterId] = {
        voterName: this.room.players[voterId]?.name,
        targetId,
        targetName: this.room.players[targetId]?.name,
      };
    }

    this.broadcast({
      type: 'vote-result',
      eliminatedId,
      eliminatedName: eliminatedId ? this.room.players[eliminatedId]?.name : null,
      eliminatedRole: eliminatedId ? this.room.players[eliminatedId]?.role : null,
      votes: voteDetail,
      tally,
      isTie: maxTargets.length > 1,
    });

    const winner = this.checkGameEnd();
    if (winner) {
      this.endGame(winner);
    } else {
      setTimeout(() => this.startNextRound(), 3000);
    }
  }

  /**
   * 勝負判定：只依「場上仍存活、有身分的玩家」計數，不依 WebSocket 連線狀態。
   * 若用 getAlivePlayers()（含 connected），臥底短暫斷線會被排除，會誤判平民勝。
   */
  getPlayersAliveInGame() {
    return Object.entries(this.room.players).filter(
      ([, p]) => p.alive && p.role && p.role !== 'observer'
    );
  }

  checkGameEnd() {
    const alive = this.getPlayersAliveInGame();
    const spies = alive.filter(([, p]) => p.role === 'spy');
    const civilians = alive.filter(([, p]) => p.role === 'civilian');

    if (spies.length === 0) return 'civilian';
    if (spies.length >= civilians.length) return 'spy';
    return null;
  }

  endGame(winner) {
    this.room.phase = 'gameEnd';
    this.clearAllTimers();

    const roles = {};
    for (const [id, p] of Object.entries(this.room.players)) {
      if (p.role) {
        roles[id] = { name: p.name, role: p.role, word: p.word, alive: p.alive };
      }
    }

    const seriesTotal = this.room.wordBank.length;
    const seriesIndex = this.room.seriesIndex;
    this.broadcast({
      type: 'game-end',
      winner,
      wordPair: this.room.wordPair,
      roles,
      chatLog: this.room.chatLog,
      seriesIndex,
      seriesTotal,
      hasNextMatch: seriesIndex + 1 < seriesTotal,
    });
  }

  startNextRound() {
    this.room.round++;
    this.room.phase = 'speaking';
    this.room.votes = {};

    this.room.speakOrder = this.getAlivePlayers().map(([id]) => id).sort(() => Math.random() - 0.5);
    this.room.currentSpeakerIdx = 0;

    this.broadcast({
      type: 'new-round',
      round: this.room.round,
      speakOrder: this.room.speakOrder.map(id => ({ id, name: this.room.players[id]?.name })),
      currentSpeakerId: this.room.speakOrder[0],
      alivePlayers: this.getAlivePlayers().map(([id, p]) => ({ id, name: p.name })),
    });

    this.startSpeakTimer();
  }

  // ─── 房主更新設定 ───
  handleUpdateSettings(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (pid !== this.room.hostId) return;
    if (this.room.phase !== 'waiting') return;

    const s = msg.settings || {};
    if (s.spyCount != null) this.room.settings.spyCount = Math.max(1, Math.min(4, Number(s.spyCount)));
    if (s.speakTimeSec != null) this.room.settings.speakTimeSec = Math.max(15, Math.min(180, Number(s.speakTimeSec)));
    if (s.voteTimeSec != null) this.room.settings.voteTimeSec = Math.max(10, Math.min(120, Number(s.voteTimeSec)));
    if (s.maxPlayers != null) this.room.settings.maxPlayers = Math.max(4, Math.min(20, Number(s.maxPlayers)));
    if (s.hostAsObserver != null) this.room.settings.hostAsObserver = !!s.hostAsObserver;
    if (s.tieRule != null) this.room.settings.tieRule = s.tieRule;

    this.broadcast({ type: 'settings-updated', settings: this.room.settings });
  }

  // ─── 更新詞庫 ───
  handleUpdateWords(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (pid !== this.room.hostId) return;

    const words = msg.words;
    if (words === null) {
      this.room.wordBank = [...DEFAULT_WORD_BANK];
      this.broadcast({ type: 'words-updated', count: this.room.wordBank.length });
      return;
    }
    if (Array.isArray(words) && words.length > 0) {
      this.room.wordBank = words.filter(w => w.civilian && w.spy).slice(0, 10);
      this.broadcast({
        type: 'words-updated',
        count: this.room.wordBank.length,
      });
    }
  }

  // ─── 房主操作 ───
  handleHostAction(ws, msg) {
    const pid = this.getPlayerId(ws);
    if (pid !== this.room.hostId) return;

    const { action, targetId } = msg;

    switch (action) {
      case 'kick':
        if (targetId && this.room.players[targetId] && targetId !== this.room.hostId) {
          const kicked = this.room.players[targetId];
          kicked.connected = false;
          kicked.alive = false;
          const targetWs = this.playerSockets.get(targetId);
          if (targetWs) {
            this.send(targetWs, { type: 'kicked', message: '你已被房主移出房間' });
            targetWs.close();
          }
          this.broadcast({ type: 'player-kicked', playerId: targetId, name: kicked.name });
          this.broadcastPlayerList();
          if (this.room.phase === 'speaking' || this.room.phase === 'voting') {
            const winner = this.checkGameEnd();
            if (winner) this.endGame(winner);
          }
        }
        break;

      case 'mute':
        if (targetId && this.room.players[targetId]) {
          this.room.players[targetId].muted = !this.room.players[targetId].muted;
          this.broadcast({
            type: 'player-muted',
            playerId: targetId,
            name: this.room.players[targetId].name,
            muted: this.room.players[targetId].muted,
          });
        }
        break;

      case 'pause':
        this.room.paused = true;
        this.clearAllTimers();
        this.broadcast({ type: 'game-paused' });
        break;

      case 'resume':
        this.room.paused = false;
        this.broadcast({ type: 'game-resumed' });
        if (this.room.phase === 'speaking') this.startSpeakTimer();
        if (this.room.phase === 'voting') this.startVoteTimer();
        break;

      case 'skip':
        if (this.room.phase === 'speaking') this.nextSpeaker();
        break;

      case 'end-game':
        this.endGame('host-ended');
        break;

      case 'new-game':
        this.resetForNewGame();
        break;

      case 'next-series-match':
        if (this.room.phase === 'gameEnd' && this.room.seriesIndex + 1 < this.room.wordBank.length) {
          this.startGame(this.room.seriesIndex + 1);
        }
        break;
    }
  }

  resetForNewGame() {
    this.clearAllTimers();
    for (const p of Object.values(this.room.players)) {
      p.role = null;
      p.word = null;
      p.alive = true;
      p.ready = false;
      p.muted = false;
    }
    this.room.phase = 'waiting';
    this.room.round = 0;
    this.room.wordPair = null;
    this.room.votes = {};
    this.room.eliminated = [];
    this.room.chatLog = [];
    this.room.speakOrder = [];
    this.room.currentSpeakerIdx = -1;
    this.room.paused = false;
    this.room.seriesIndex = 0;

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

    // 如果有更新的 socket，代表玩家已經重連，忽略舊 socket 的 close
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

    // 遊戲中：跳過當前發言者（如果是斷線的人）
    if (this.room.phase === 'speaking') {
      const currentSpeaker = this.room.speakOrder[this.room.currentSpeakerIdx];
      if (currentSpeaker === pid) {
        this.nextSpeaker();
      }
    }

    // 投票中：如果斷線的人還沒投票，自動棄票，檢查是否所有人都投完
    if (this.room.phase === 'voting') {
      const aliveVoters = this.getAlivePlayers()
        .filter(([id]) => !(this.room.settings.hostAsObserver && id === this.room.hostId));
      if (Object.keys(this.room.votes).length >= aliveVoters.length) {
        this.resolveVotes();
      }
    }

    // 設定寬限期：15 秒內不重連才視為永久退出並檢查勝負
    if (this.disconnectGrace.has(pid)) {
      clearTimeout(this.disconnectGrace.get(pid));
    }
    this.disconnectGrace.set(pid, setTimeout(() => {
      this.disconnectGrace.delete(pid);
      if (!this.room.players[pid]?.connected && this.room.phase !== 'waiting' && this.room.phase !== 'gameEnd') {
        const winner = this.checkGameEnd();
        if (winner) this.endGame(winner);
      }
    }, 15000));
  }

  // ─── 上帝視角（房主/旁觀者專用） ───
  sendGodView() {
    const hostWs = this.playerSockets.get(this.room.hostId);
    if (!hostWs) return;
    if (!this.room.settings.hostAsObserver && this.room.phase === 'waiting') return;

    const roles = {};
    for (const [id, p] of Object.entries(this.room.players)) {
      if (p.role) roles[id] = { name: p.name, role: p.role, word: p.word, alive: p.alive };
    }

    this.send(hostWs, {
      type: 'god-view',
      roles,
      wordPair: this.room.wordPair,
      votes: this.room.votes,
    });
  }

  // ─── 輔助方法 ───
  getPlayerId(ws) {
    return this.sessions.get(ws)?.playerId;
  }

  getActivePlayers() {
    return Object.entries(this.room.players).filter(([, p]) => p.connected);
  }

  getAlivePlayers() {
    return Object.entries(this.room.players).filter(([, p]) => p.alive && p.connected);
  }

  isPlayerAliveAndConnected(pid) {
    const p = this.room.players[pid];
    return p && p.alive && p.connected;
  }

  getPublicRoomState() {
    const players = {};
    for (const [id, p] of Object.entries(this.room.players)) {
      players[id] = { name: p.name, ready: p.ready, connected: p.connected, alive: p.alive, muted: p.muted };
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
    this.broadcast({ type: 'player-list', players: this.getPublicRoomState().players, hostId: this.room.hostId });
  }

  clearTimer(name) {
    if (this.timers[name]) { clearTimeout(this.timers[name]); delete this.timers[name]; }
  }

  clearAllTimers() {
    for (const name of Object.keys(this.timers)) this.clearTimer(name);
  }
}
