/**
 * 手勢切水果學中文 — Worker：訊飛 TTS 代理 + Durable Object 多人房間
 */

import { synthesizeMp3 } from './iflytek.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export default {
  /** @param {ExecutionContext} ctx */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    /* ─── 訊飛 TTS ─── */
    if (url.pathname === '/api/tts' && request.method === 'POST') {
      try {
        const secretsOk = env.IFLYTEK_APP_ID && env.IFLYTEK_API_KEY && env.IFLYTEK_API_SECRET;
        if (!secretsOk) {
          return json({ error: 'IFLYTEK_NOT_CONFIGURED', fallback: true }, 503);
        }
        const body = await request.json();
        const text = (body.text || '').trim().slice(0, 4000);
        const lang = body.lang === 'cantonese' ? 'cantonese' : 'mandarin';
        if (!text) {
          return json({ error: 'EMPTY_TEXT' }, 400);
        }
        const mp3 = await synthesizeMp3(env, text, lang);
        return new Response(mp3, {
          headers: {
            ...CORS,
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'private, max-age=3600',
          },
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return json({ error: msg, fallback: true }, 502);
      }
    }

    /* ─── 多人房間 ─── */
    if (url.pathname === '/api/create-room' && request.method === 'POST') {
      let wordPack = null;
      try {
        const body = await request.json();
        wordPack = body.wordPack ?? null;
      } catch {
        /* 允許空 body */
      }
      const roomId = generateRoomId();
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      await stub.fetch(
        new Request('https://do/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, wordPack }),
        })
      );
      return json({ roomId });
    }

    if (url.pathname === '/api/room-info') {
      const roomId = url.searchParams.get('id');
      if (!roomId) return json({ error: 'missing id' }, 400);
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      const resp = await stub.fetch(new Request('https://do/info'));
      const data = await resp.json();
      return json(data);
    }

    if (url.pathname === '/ws') {
      const roomId = url.searchParams.get('room');
      if (!roomId) return new Response('Missing room', { status: 400 });
      const id = env.GAME_ROOM.idFromName(roomId);
      const stub = env.GAME_ROOM.get(id);
      return stub.fetch(request);
    }

    return new Response('fruit-cn-game: use /api/tts, /api/create-room, /ws', { headers: CORS });
  },
};

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** @typedef {{ playerId: string, name: string, score: number }} PlayerRow */

export class GameRoom {
  /** @param {DurableObjectState} state */
  constructor(state, env) {
    this.state = state;
    this.env = env;
    /** @type {Map<WebSocket, { playerId: string | null }>} */
    this.sessions = new Map();
    /** @type {{ roomId: string, words: unknown[] | null, players: Record<string, PlayerRow>, lastScoreAt: Record<string, number> }} */
    this.room = {
      roomId: '',
      words: null,
      players: Object.create(null),
      lastScoreAt: Object.create(null),
    };
  }

  /** @param {Request} request */
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      try {
        const body = await request.json();
        this.room.roomId = body.roomId || '';
        this.room.words = body.wordPack ?? null;
      } catch {
        this.room.roomId = '';
        this.room.words = null;
      }
      return new Response('ok');
    }

    if (url.pathname === '/info') {
      return Response.json({
        exists: !!this.room.roomId,
        words: this.room.words,
        players: this.room.players,
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

  /** @param {WebSocket} ws */
  handleSession(ws) {
    ws.accept();
    this.sessions.set(ws, { playerId: null });

    ws.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        await this.onMessage(ws, msg);
      } catch (e) {
        const m = e instanceof Error ? e.message : '錯誤';
        this.send(ws, { type: 'error', message: m });
      }
    });

    ws.addEventListener('close', () => {
      const meta = this.sessions.get(ws);
      this.sessions.delete(ws);
      if (meta?.playerId && this.room.players[meta.playerId]) {
        this.room.players[meta.playerId].connected = false;
      }
      this.broadcast({ type: 'state', players: this.room.players });
    });
  }

  /** @param {WebSocket} ws */
  send(ws, obj) {
    try {
      ws.send(JSON.stringify(obj));
    } catch {
      /* ignore */
    }
  }

  broadcast(obj) {
    const data = JSON.stringify(obj);
    for (const ws of this.sessions.keys()) {
      try {
        ws.send(data);
      } catch {
        /* ignore */
      }
    }
  }

  /** @param {WebSocket} ws */
  /** @param {{ type: string, playerId?: string, name?: string, delta?: number }} msg */
  async onMessage(ws, msg) {
    if (msg.type === 'join') {
      const pid = msg.playerId || `p_${Math.random().toString(36).slice(2, 9)}`;
      const name = (msg.name || '玩家').slice(0, 16);
      this.room.players[pid] = {
        playerId: pid,
        name,
        score: 0,
        connected: true,
      };
      const meta = this.sessions.get(ws);
      if (meta) meta.playerId = pid;
      this.send(ws, { type: 'joined', playerId: pid, words: this.room.words });
      this.broadcast({ type: 'state', players: this.room.players });
      return;
    }

    if (msg.type === 'score') {
      const meta = this.sessions.get(ws);
      if (!meta?.playerId || !this.room.players[meta.playerId]) {
        this.send(ws, { type: 'error', message: '請先 join' });
        return;
      }
      const delta = Number(msg.delta);
      if (!Number.isFinite(delta) || delta < 0 || delta > 500) {
        this.send(ws, { type: 'error', message: 'delta 無效' });
        return;
      }
      const now = Date.now();
      const last = this.room.lastScoreAt[meta.playerId] || 0;
      if (now - last < 80) {
        return;
      }
      this.room.lastScoreAt[meta.playerId] = now;
      this.room.players[meta.playerId].score += delta;
      this.broadcast({
        type: 'score',
        playerId: meta.playerId,
        score: this.room.players[meta.playerId].score,
        players: this.room.players,
      });
    }
  }
}
