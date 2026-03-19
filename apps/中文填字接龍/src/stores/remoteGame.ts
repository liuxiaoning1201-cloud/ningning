import { defineStore } from "pinia";
import { connectWebSocket } from "@/lib/api";

export interface RemoteRoom {
  id: string;
  puzzleId: string;
  status: "waiting" | "playing" | "ended";
  members: { userId: string; displayName: string; score: number }[];
}

export interface RemoteScore {
  userId: string;
  displayName: string;
  score: number;
  timeMs: number;
}

export const useRemoteGameStore = defineStore("remoteGame", {
  state: () => ({
    room: null as RemoteRoom | null,
    ws: null as WebSocket | null,
    isConnected: false,
    scores: {} as Record<string, number>,
    rankings: [] as RemoteScore[],
    messages: [] as { type: string; [key: string]: unknown }[],
    error: null as string | null,
  }),
  actions: {
    joinRoom(roomId: string, userId: string, displayName: string) {
      this.disconnect();
      this.error = null;

      const ws = connectWebSocket(roomId, userId, displayName);
      if (!ws) {
        this.error = "無法連接到伺服器（請確認 API URL 已設定）";
        return;
      }

      this.ws = ws;
      this.room = {
        id: roomId,
        puzzleId: "",
        status: "waiting",
        members: [],
      };

      ws.onopen = () => {
        this.isConnected = true;
        this.error = null;
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.messages.push(msg);
          this.handleMessage(msg);
        } catch {
          // ignore
        }
      };

      ws.onclose = () => {
        this.isConnected = false;
      };

      ws.onerror = () => {
        this.error = "WebSocket 連線錯誤";
        this.isConnected = false;
      };
    },

    handleMessage(msg: { type: string; [key: string]: unknown }) {
      switch (msg.type) {
        case "player_joined":
        case "player_left":
          if (this.room) {
            this.room.members = msg.members as RemoteRoom["members"];
          }
          break;
        case "game_started":
          if (this.room) {
            this.room.status = "playing";
            this.room.puzzleId = msg.puzzleId as string;
          }
          break;
        case "answer_update":
          this.scores = msg.scores as Record<string, number>;
          break;
        case "player_finished":
          this.scores = msg.scores as Record<string, number>;
          break;
        case "game_ended":
          if (this.room) this.room.status = "ended";
          this.scores = msg.scores as Record<string, number>;
          this.rankings = msg.rankings as RemoteScore[];
          break;
      }
    },

    sendMessage(data: unknown) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      }
    },

    startGame(puzzleId: string) {
      this.sendMessage({ type: "start_game", puzzleId });
    },

    submitAnswer(cellKey: string, value: string, correct: boolean) {
      this.sendMessage({ type: "answer", cellKey, value, correct });
    },

    finishGame() {
      this.sendMessage({ type: "finish" });
    },

    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.isConnected = false;
      this.room = null;
      this.scores = {};
      this.rankings = [];
      this.messages = [];
    },

    setRoom(room: RemoteRoom | null) {
      this.room = room;
    },
    setConnected(connected: boolean) {
      this.isConnected = connected;
    },
  },
});
