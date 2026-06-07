/**
 * GameRoom Durable Object：權威遊戲狀態管理。
 *
 * 一個 DO instance 對應一個房間（一場對局）。
 * 透過 WebSocket 與多個玩家保持連線，所有規則邏輯（落子、答題、宣告、計分）
 * 都在伺服器執行，客戶端僅做顯示與動畫。
 */

import type {
  ClientMessage,
  ConnectedLine,
  GameRule,
  GameState,
  GameTemplate,
  PendingQuestion,
  Player,
  PlayerInfo,
  QuestionCard,
  ServerMessage,
} from "../../../shared/zizizhujiTypes.js";
import {
  evaluateComplete,
  evaluateCount,
  evaluateFirst,
  resolveLineLength,
  verifyDeclaration,
} from "./ruleEngine.js";
import { generateBoard } from "./boardGenerator.js";
import { tryPlace } from "./boardEngine.js";
import { drawQuestion } from "./questionDeck.js";
import { getTemplate } from "./templates.js";

interface SessionMeta {
  ws: WebSocket;
  playerId: string;
  playerName: string;
}

interface InitBody {
  template: GameTemplate | string;
  customRule?: GameRule;
  customBoardSize?: number;
  customTurnSeconds?: number;
  customTexts?: string[];
  hostId: string;
  hostName: string;
  joinCode: string;
}

const QUESTION_TIMEOUT_MS = 30_000;
const COMPLETE_CHALLENGE_MS = 8_000;

export class GameRoom {
  state: DurableObjectState;
  env: unknown;
  /** 連線會話 */
  sessions: Map<WebSocket, SessionMeta> = new Map();
  /** 房間設定 */
  meta: {
    roomId: string;
    joinCode: string;
    templateId: string;
    templateName: string;
    boardSize: number;
    turnSeconds: number;
    hostId: string;
    hostName: string;
    customTexts?: string[];
  } = {
    roomId: "",
    joinCode: "",
    templateId: "",
    templateName: "",
    boardSize: 11,
    turnSeconds: 60,
    hostId: "",
    hostName: "",
  };
  /** 對局狀態（單一信源） */
  game: GameState | null = null;

  constructor(state: DurableObjectState, env: unknown) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/init" && request.method === "POST") {
      const body = (await request.json()) as InitBody;
      this.initRoom(body);
      return new Response("ok");
    }

    if (url.pathname === "/info") {
      return Response.json(this.summary());
    }

    if (request.headers.get("Upgrade") === "websocket") {
      const { 0: client, 1: server } = new WebSocketPair() as unknown as Record<string, WebSocket>;
      const playerId = url.searchParams.get("playerId") || `p_${Math.random().toString(36).slice(2, 9)}`;
      const playerName = url.searchParams.get("name") || "玩家";
      this.handleSession(server, playerId, playerName);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  private summary() {
    return {
      exists: !!this.meta.roomId,
      roomId: this.meta.roomId,
      joinCode: this.meta.joinCode,
      templateId: this.meta.templateId,
      templateName: this.meta.templateName,
      hostId: this.meta.hostId,
      hostName: this.meta.hostName,
      status: this.game?.status ?? "waiting",
      players: this.game?.players ?? [],
    };
  }

  private initRoom(body: InitBody): void {
    let rule: GameRule;
    let templateId: string;
    let templateName: string;
    let boardSize: number;
    let turnSeconds: number;

    if (typeof body.template === "string") {
      const t = getTemplate(body.template);
      if (!t) throw new Error("Unknown template: " + body.template);
      rule = body.customRule ?? t.rule;
      templateId = t.id;
      templateName = t.name;
      boardSize = body.customBoardSize ?? t.boardSize;
      turnSeconds = body.customTurnSeconds ?? t.turnSeconds;
    } else {
      const t = body.template;
      rule = body.customRule ?? t.rule;
      templateId = t.id;
      templateName = t.name;
      boardSize = body.customBoardSize ?? t.boardSize;
      turnSeconds = body.customTurnSeconds ?? t.turnSeconds;
    }

    this.meta = {
      roomId: this.state.id.toString(),
      joinCode: body.joinCode,
      templateId,
      templateName,
      boardSize,
      turnSeconds,
      hostId: body.hostId,
      hostName: body.hostName,
      customTexts: body.customTexts,
    };

    const seed = Math.floor(Math.random() * 0xffffffff);
    const rng = rngFromSeed(seed);
    const { board } = generateBoard({
      size: boardSize,
      contentType: rule.content,
      customTexts: body.customTexts,
      lineLength: resolveLineLength(rule),
      rng,
    });

    this.game = {
      rule,
      resolvedLineLength: resolveLineLength(rule),
      board,
      templateId,
      templateName,
      status: "waiting",
      players: [],
      currentTurn: "black",
      startedAt: null,
      deadline: null,
      lastMove: null,
      pendingComplete: null,
      pendingQuestion: null,
      winner: null,
      winnerLine: null,
      endReason: null,
      log: [{ t: Date.now(), kind: "init" }],
    };
  }

  private handleSession(ws: WebSocket, playerId: string, playerName: string): void {
    ws.accept();
    this.sessions.set(ws, { ws, playerId, playerName });

    if (!this.game) {
      this.send(ws, { type: "error", message: "房間尚未建立" });
      ws.close();
      return;
    }

    let player = this.game.players.find((p) => p.id === playerId);
    if (!player) {
      // 第一個 join 者為 black，第二個為 white
      const taken = new Set(this.game.players.map((p) => p.color));
      const color: Player | null =
        this.game.players.length === 0
          ? "black"
          : !taken.has("white")
            ? "white"
            : null; // 其他只是觀戰
      player = {
        id: playerId,
        name: playerName,
        color,
        connected: true,
        joinedAt: Date.now(),
        qaStreak: 0,
        score: 0,
        countLines: 0,
      };
      this.game.players.push(player);
    } else {
      player.connected = true;
      player.name = playerName;
    }

    this.send(ws, {
      type: "snapshot",
      state: this.game,
      you: { playerId, color: player.color },
    });
    this.broadcast({ type: "player-joined", players: this.game.players, player });

    // 兩人都到齊 → 自動開局
    if (this.game.status === "waiting" && this.bothPlayersReady()) {
      this.startGame();
    }

    ws.addEventListener("message", async (event) => {
      try {
        const msg = JSON.parse(typeof event.data === "string" ? event.data : "") as ClientMessage;
        await this.onClientMessage(ws, msg);
      } catch (e) {
        const m = e instanceof Error ? e.message : "錯誤";
        this.send(ws, { type: "error", message: m });
      }
    });

    ws.addEventListener("close", () => {
      const meta = this.sessions.get(ws);
      this.sessions.delete(ws);
      if (!meta || !this.game) return;
      const p = this.game.players.find((pl) => pl.id === meta.playerId);
      if (p) p.connected = false;
      this.broadcast({
        type: "player-left",
        players: this.game.players,
        playerId: meta.playerId,
      });
    });
  }

  private bothPlayersReady(): boolean {
    if (!this.game) return false;
    const black = this.game.players.find((p) => p.color === "black" && p.connected);
    const white = this.game.players.find((p) => p.color === "white" && p.connected);
    return !!(black && white);
  }

  private startGame(): void {
    if (!this.game) return;
    this.game.status = "playing";
    this.game.startedAt = Date.now();
    if (this.game.rule.win.kind === "count") {
      this.game.deadline = Date.now() + this.game.rule.win.durationSec * 1000;
      this.scheduleTick();
    } else if (this.meta.turnSeconds > 0) {
      this.game.deadline = Date.now() + this.meta.turnSeconds * 1000;
    } else {
      this.game.deadline = null;
    }
    this.game.log.push({ t: Date.now(), kind: "start" });
    this.broadcast({ type: "started", state: this.game });
    this.broadcast({
      type: "turn",
      currentTurn: this.game.currentTurn,
      deadline: this.game.deadline,
    });
  }

  private scheduleTick(): void {
    // 每秒對 count 模式廣播 tick；用 alarm 實現
    void this.state.storage.setAlarm(Date.now() + 1000).catch(() => {});
  }

  async alarm(): Promise<void> {
    if (!this.game || this.game.status !== "playing") return;
    if (this.game.rule.win.kind === "count") {
      const now = Date.now();
      const deadline = this.game.deadline ?? 0;
      const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
      const black = this.game.players.find((p) => p.color === "black");
      const white = this.game.players.find((p) => p.color === "white");
      this.broadcast({
        type: "tick",
        secondsLeft,
        lines: {
          black: black?.countLines ?? 0,
          white: white?.countLines ?? 0,
        },
      });
      if (secondsLeft <= 0) {
        this.endGameByCount();
        return;
      }
      void this.state.storage.setAlarm(now + 1000).catch(() => {});
    }
  }

  private endGameByCount(): void {
    if (!this.game) return;
    const black = this.game.players.find((p) => p.color === "black");
    const white = this.game.players.find((p) => p.color === "white");
    const bs = black?.countLines ?? 0;
    const ws = white?.countLines ?? 0;
    let winner: Player | "draw";
    let reason: string;
    if (bs > ws) { winner = "black"; reason = `黑棋連得 ${bs} 條 vs 白棋 ${ws} 條`; }
    else if (ws > bs) { winner = "white"; reason = `白棋連得 ${ws} 條 vs 黑棋 ${bs} 條`; }
    else { winner = "draw"; reason = `雙方都連得 ${bs} 條，平手`; }
    this.declareWin(winner, reason, null);
  }

  private async onClientMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    const meta = this.sessions.get(ws);
    if (!meta || !this.game) return;
    const player = this.game.players.find((p) => p.id === meta.playerId);
    if (!player) return;

    switch (msg.type) {
      case "ready":
        if (this.game.status === "waiting" && this.bothPlayersReady()) this.startGame();
        return;

      case "place":
        if (this.game.status !== "playing") {
          this.send(ws, { type: "error", message: "對局尚未開始或已結束" });
          return;
        }
        if (!player.color || player.color !== this.game.currentTurn) {
          this.send(ws, { type: "error", message: "現在不是你的回合" });
          return;
        }
        if (this.game.pendingComplete || this.game.pendingQuestion) {
          this.send(ws, { type: "error", message: "尚有待處理的事件" });
          return;
        }
        await this.handlePlacement(player, msg.r, msg.c);
        return;

      case "answer-question":
        await this.handleAnswerQuestion(player, msg.optionIndex);
        return;

      case "declare-complete":
        await this.handleDeclareComplete(player, msg.cells, msg.text);
        return;

      case "challenge":
        await this.handleChallenge(player);
        return;

      case "accept-complete":
        // 對手不質疑、主動承認 → 立即結束（或可以等超時）
        await this.handleAcceptComplete(player);
        return;

      case "rematch":
        if (this.game.status === "ended") this.rematch();
        return;

      case "leave":
        ws.close();
        return;
    }
  }

  private async handlePlacement(player: PlayerInfo, r: number, c: number): Promise<void> {
    if (!this.game || !player.color) return;
    if (this.game.rule.placement.kind === "qa") {
      // 先發題，等答對才落子
      const card = drawQuestion(this.game.rule.placement.difficulty, Math.floor(Math.random() * 0xffffffff));
      const expiresAt = Date.now() + QUESTION_TIMEOUT_MS;
      const pending: PendingQuestion = {
        forPlayer: player.color,
        card,
        targetCell: { r, c },
        expiresAt,
      };
      this.game.pendingQuestion = pending;
      this.game.log.push({ t: Date.now(), kind: "question", detail: { player: player.color, cell: { r, c } } });
      // 私發給該玩家
      const ws = this.findWs(player.id);
      if (ws) {
        this.send(ws, {
          type: "question",
          card,
          forPlayer: player.color,
          targetCell: { r, c },
          expiresAt,
        });
      }
      // 對手收到「對方正在答題」事件（不附答案）
      const opponentWs = this.findOpponentWs(player.id);
      if (opponentWs) {
        const masked: QuestionCard = {
          ...card,
          options: card.options.map(() => "?"),
          correctIndex: -1,
        };
        this.send(opponentWs, {
          type: "question",
          card: masked,
          forPlayer: player.color,
          targetCell: { r, c },
          expiresAt,
        });
      }
      return;
    }

    // free 落子
    this.applyPlacement(player, r, c);
  }

  private async handleAnswerQuestion(player: PlayerInfo, optionIndex: number): Promise<void> {
    if (!this.game || !player.color) return;
    const pq = this.game.pendingQuestion;
    if (!pq || pq.forPlayer !== player.color) {
      this.send(this.findWs(player.id)!, { type: "error", message: "目前無待答題目" });
      return;
    }
    const correct = optionIndex === pq.card.correctIndex;
    this.broadcast({ type: "question-resolved", correct, reveal: pq.card.correctIndex });
    this.game.pendingQuestion = null;
    if (correct) {
      player.qaStreak += 1;
      this.applyPlacement(player, pq.targetCell.r, pq.targetCell.c);
    } else {
      player.qaStreak = 0;
      // 跳過該回合
      this.advanceTurn();
    }
  }

  private applyPlacement(player: PlayerInfo, r: number, c: number): void {
    if (!this.game || !player.color) return;
    const result = tryPlace(this.game.board, r, c, player.color);
    if (!result) {
      const ws = this.findWs(player.id);
      if (ws) this.send(ws, { type: "error", message: "此格無法落子" });
      return;
    }
    this.game.lastMove = { r, c, player: player.color, ch: result.type === "claimed" ? result.ch : undefined };
    this.game.log.push({ t: Date.now(), kind: "place", detail: { r, c, by: player.color } });

    const cell = result;
    this.broadcast({
      type: "placed",
      r,
      c,
      by: player.color,
      ch: cell.type === "claimed" ? cell.ch : undefined,
      cell,
      scores: this.scoresMap(),
    });

    // 檢查勝負
    if (this.checkWinAfterPlacement(player.color, r, c)) return;

    this.advanceTurn();
  }

  private scoresMap(): Record<string, number> {
    if (!this.game) return {};
    const m: Record<string, number> = {};
    for (const p of this.game.players) m[p.id] = p.score;
    return m;
  }

  private checkWinAfterPlacement(color: Player, r: number, c: number): boolean {
    if (!this.game) return false;

    if (this.game.rule.win.kind === "first") {
      const res = evaluateFirst(this.game.board, { r, c, player: color }, this.game.rule.win.n);
      if (res.winner) {
        this.declareWin(color, `先連成 ${this.game.rule.win.n} 子勝`, res.line);
        return true;
      }
    } else if (this.game.rule.win.kind === "count") {
      // count 模式：累積該玩家 N 連數量
      const result = evaluateCount(this.game.board, this.game.rule.win.lineLength);
      const black = this.game.players.find((p) => p.color === "black");
      const white = this.game.players.find((p) => p.color === "white");
      if (black) black.countLines = result.scores.black;
      if (white) white.countLines = result.scores.white;
    } else if (this.game.rule.win.kind === "complete") {
      // 自動偵測：若連線且子串命中 → 直接勝（也可改成必須宣告）
      const res = evaluateComplete(
        this.game.board,
        { r, c, player: color },
        this.game.rule,
        this.meta.customTexts
      );
      if (res.hits.length > 0) {
        const hit = res.hits[0];
        if (this.game.rule.challengeable) {
          // 句子模式：進入待質疑期
          this.enterPendingComplete(color, hit.line.cells.slice(hit.startIdx, hit.startIdx + hit.substring.length), hit.substring);
        } else {
          this.declareWin(
            color,
            `拼出「${hit.substring}」`,
            { ...hit.line, cells: hit.line.cells.slice(hit.startIdx, hit.startIdx + hit.substring.length) }
          );
          return true;
        }
      }
    }

    return false;
  }

  private async handleDeclareComplete(
    player: PlayerInfo,
    cells: { r: number; c: number }[],
    text: string
  ): Promise<void> {
    if (!this.game || !player.color) return;
    if (this.game.rule.win.kind !== "complete") {
      this.send(this.findWs(player.id)!, { type: "error", message: "目前模式無需宣告" });
      return;
    }
    const ok = verifyDeclaration(this.game.board, cells, player.color, text, this.game.rule, this.meta.customTexts);
    if (!ok.ok) {
      this.send(this.findWs(player.id)!, { type: "error", message: `宣告失敗：${ok.reason ?? ""}` });
      return;
    }
    if (this.game.rule.challengeable) {
      this.enterPendingComplete(player.color, cells, text);
    } else {
      const line: ConnectedLine = {
        cells: cells.map((p) => ({ r: p.r, c: p.c, ch: this.chAt(p.r, p.c) })),
        direction: detectDir(cells),
        by: player.color,
      };
      this.declareWin(player.color, `拼出「${text}」`, line);
    }
  }

  private enterPendingComplete(by: Player, cells: { r: number; c: number }[], text: string): void {
    if (!this.game) return;
    const expiresAt = Date.now() + COMPLETE_CHALLENGE_MS;
    this.game.pendingComplete = { by, cells, text, expiresAt };
    this.broadcast({ type: "complete-pending", cells, text, by, expiresAt });
    // 用 setTimeout 自動結算（DO 連線期間穩定有效）；避免與 count tick 的 alarm 互踩。
    setTimeout(() => this.maybeResolvePendingComplete(), COMPLETE_CHALLENGE_MS + 50);
  }

  private maybeResolvePendingComplete(): void {
    if (!this.game) return;
    const pc = this.game.pendingComplete;
    if (!pc) return;
    if (Date.now() < pc.expiresAt) return;
    this.acceptComplete();
  }

  private async handleAcceptComplete(_player: PlayerInfo): Promise<void> {
    this.acceptComplete();
  }

  private async handleChallenge(_player: PlayerInfo): Promise<void> {
    if (!this.game) return;
    const pc = this.game.pendingComplete;
    if (!pc) return;
    // 質疑後：客觀規則本就已經驗證過 declared text，所以質疑「失敗」→ 仍視為成立
    // 但 sentence/free 主題可能有人為 ambiguity，先簡化：質疑視同接受
    this.acceptComplete("被質疑後仍成立");
  }

  private acceptComplete(reasonExtra?: string): void {
    if (!this.game) return;
    const pc = this.game.pendingComplete;
    if (!pc) return;
    this.game.pendingComplete = null;
    const reason = `拼出「${pc.text}」${reasonExtra ? "（" + reasonExtra + "）" : ""}`;
    const line: ConnectedLine = {
      cells: pc.cells.map((p) => ({ r: p.r, c: p.c, ch: this.chAt(p.r, p.c) })),
      direction: detectDir(pc.cells),
      by: pc.by,
    };
    this.broadcast({ type: "complete-resolved", accepted: true, by: pc.by });
    this.declareWin(pc.by, reason, line);
  }

  private advanceTurn(): void {
    if (!this.game) return;
    this.game.currentTurn = this.game.currentTurn === "black" ? "white" : "black";
    if (this.game.rule.win.kind !== "count" && this.meta.turnSeconds > 0) {
      this.game.deadline = Date.now() + this.meta.turnSeconds * 1000;
    }
    this.broadcast({
      type: "turn",
      currentTurn: this.game.currentTurn,
      deadline: this.game.deadline,
    });
  }

  private declareWin(winner: Player | "draw", reason: string, line: ConnectedLine | null): void {
    if (!this.game) return;
    this.game.status = "ended";
    this.game.winner = winner;
    this.game.winnerLine = line;
    this.game.endReason = reason;
    this.game.deadline = null;
    this.game.log.push({ t: Date.now(), kind: "end", detail: { winner, reason } });
    this.broadcast({ type: "win", winner, reason, line, state: this.game });
  }

  private rematch(): void {
    if (!this.game) return;
    const seed = Math.floor(Math.random() * 0xffffffff);
    const rng = rngFromSeed(seed);
    const { board } = generateBoard({
      size: this.meta.boardSize,
      contentType: this.game.rule.content,
      customTexts: this.meta.customTexts,
      lineLength: this.game.resolvedLineLength,
      rng,
    });
    this.game.board = board;
    this.game.status = "waiting";
    this.game.currentTurn = "black";
    this.game.startedAt = null;
    this.game.deadline = null;
    this.game.lastMove = null;
    this.game.pendingComplete = null;
    this.game.pendingQuestion = null;
    this.game.winner = null;
    this.game.winnerLine = null;
    this.game.endReason = null;
    for (const p of this.game.players) {
      p.qaStreak = 0;
      p.score = 0;
      p.countLines = 0;
    }
    this.broadcast({
      type: "snapshot",
      state: this.game,
      you: { playerId: "", color: null },
    });
    if (this.bothPlayersReady()) this.startGame();
  }

  private chAt(r: number, c: number): string | undefined {
    if (!this.game) return undefined;
    const cell = this.game.board.cells[r]?.[c];
    if (!cell) return undefined;
    if (cell.type === "char") return cell.ch;
    if (cell.type === "claimed") return cell.ch;
    return undefined;
  }

  private findWs(playerId: string): WebSocket | null {
    for (const [ws, meta] of this.sessions) if (meta.playerId === playerId) return ws;
    return null;
  }

  private findOpponentWs(playerId: string): WebSocket | null {
    for (const [ws, meta] of this.sessions) if (meta.playerId !== playerId) return ws;
    return null;
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    try {
      ws.send(JSON.stringify(msg));
    } catch { /* ignore */ }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.sessions.keys()) {
      try { ws.send(data); } catch { /* ignore */ }
    }
  }
}

function rngFromSeed(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function detectDir(cells: { r: number; c: number }[]): "h" | "v" | "d1" | "d2" {
  if (cells.length < 2) return "h";
  const dr = cells[1].r - cells[0].r;
  const dc = cells[1].c - cells[0].c;
  if (dr === 0) return "h";
  if (dc === 0) return "v";
  if (dr === dc) return "d1";
  return "d2";
}

