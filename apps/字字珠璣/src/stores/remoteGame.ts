import { defineStore } from "pinia";
import type { ClientMessage, GameState, Player, PlayerInfo, QuestionCard, ServerMessage } from "@/lib/types";
import { connectGameWS } from "@/lib/api";

interface PendingQA {
  card: QuestionCard;
  forPlayer: Player;
  targetCell: { r: number; c: number };
  expiresAt: number;
}

interface PendingComplete {
  cells: { r: number; c: number }[];
  text: string;
  by: Player;
  expiresAt: number;
}

export const useRemoteGameStore = defineStore("remoteGame", {
  state: () => ({
    ws: null as WebSocket | null,
    roomId: "",
    connected: false,
    state: null as GameState | null,
    you: { playerId: "", color: null as Player | null },
    pendingQA: null as PendingQA | null,
    pendingComplete: null as PendingComplete | null,
    questionResolved: null as { correct: boolean; reveal?: number } | null,
    countdownSecondsLeft: 0,
    countLines: { black: 0, white: 0 },
    error: "",
    notice: "",
    finalState: null as GameState | null,
  }),
  actions: {
    connect(roomId: string) {
      this.disconnect();
      this.roomId = roomId;
      const ws = connectGameWS(roomId);
      if (!ws) {
        this.error = "無法連接後端，請先在設定頁配置 API URL。";
        return;
      }
      this.ws = ws;
      ws.onopen = () => {
        this.connected = true;
        this.error = "";
      };
      ws.onclose = () => {
        this.connected = false;
      };
      ws.onerror = () => {
        this.error = "連線異常";
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "") as ServerMessage;
          this.handle(msg);
        } catch {
          /* ignore */
        }
      };
    },

    handle(msg: ServerMessage) {
      switch (msg.type) {
        case "snapshot":
          this.state = msg.state;
          if (msg.you.playerId) this.you = msg.you;
          break;
        case "started":
          this.state = msg.state;
          break;
        case "player-joined":
          if (this.state) this.state.players = msg.players;
          this.notice = `${msg.player.name} 加入了房間`;
          break;
        case "player-left":
          if (this.state) this.state.players = msg.players;
          this.notice = `對手暫時離線`;
          break;
        case "turn":
          if (this.state) {
            this.state.currentTurn = msg.currentTurn;
            this.state.deadline = msg.deadline;
            this.state.pendingQuestion = null;
          }
          this.pendingQA = null;
          break;
        case "placed":
          if (this.state) {
            this.state.board.cells[msg.r][msg.c] = msg.cell;
            this.state.lastMove = { r: msg.r, c: msg.c, player: msg.by, ch: msg.ch };
          }
          break;
        case "question":
          this.pendingQA = {
            card: msg.card,
            forPlayer: msg.forPlayer,
            targetCell: msg.targetCell,
            expiresAt: msg.expiresAt,
          };
          break;
        case "question-resolved":
          this.questionResolved = { correct: msg.correct, reveal: msg.reveal };
          this.pendingQA = null;
          setTimeout(() => { this.questionResolved = null; }, 1500);
          break;
        case "complete-pending":
          this.pendingComplete = {
            cells: msg.cells,
            text: msg.text,
            by: msg.by,
            expiresAt: msg.expiresAt,
          };
          break;
        case "complete-resolved":
          this.pendingComplete = null;
          break;
        case "tick":
          this.countdownSecondsLeft = msg.secondsLeft;
          this.countLines = msg.lines;
          break;
        case "win":
          if (this.state) {
            this.state.status = "ended";
            this.state.winner = msg.winner;
            this.state.winnerLine = msg.line;
            this.state.endReason = msg.reason;
          }
          this.finalState = msg.state;
          break;
        case "error":
          this.error = msg.message;
          setTimeout(() => { this.error = ""; }, 3500);
          break;
      }
    },

    send(msg: ClientMessage) {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      this.ws.send(JSON.stringify(msg));
    },

    place(r: number, c: number) {
      this.send({ type: "place", r, c });
    },
    answer(optionIndex: number) {
      this.send({ type: "answer-question", optionIndex });
    },
    declareComplete(cells: { r: number; c: number }[], text: string) {
      this.send({ type: "declare-complete", cells, text });
    },
    challenge() {
      this.send({ type: "challenge" });
    },
    accept() {
      this.send({ type: "accept-complete" });
    },
    rematch() {
      this.send({ type: "rematch" });
    },

    disconnect() {
      try { this.ws?.close(); } catch { /* ignore */ }
      this.ws = null;
      this.connected = false;
      this.state = null;
      this.pendingQA = null;
      this.pendingComplete = null;
      this.questionResolved = null;
      this.error = "";
      this.notice = "";
      this.finalState = null;
    },

    findPlayer(color: Player | null): PlayerInfo | undefined {
      if (!this.state || !color) return undefined;
      return this.state.players.find((p) => p.color === color);
    },
  },
});
