interface PlayerInfo {
  userId: string;
  displayName: string;
  score: number;
  finishedAt?: number;
}

interface GameState {
  puzzleId: string;
  status: "waiting" | "playing" | "ended";
  startTime?: number;
  answers: Record<string, { userId: string; value: string; correct: boolean }>;
}

export class GameRoom implements DurableObject {
  private members: Map<WebSocket, PlayerInfo> = new Map();
  private state: GameState = { puzzleId: "", status: "waiting", answers: {} };
  private durableState: DurableObjectState;

  constructor(state: DurableObjectState) {
    this.durableState = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();

      const params = url.searchParams;
      const userId = params.get("userId") || "anonymous";
      const displayName = params.get("name") || "Player";

      this.members.set(server, {
        userId,
        displayName,
        score: 0,
      });

      this.broadcast({
        type: "player_joined",
        userId,
        displayName,
        memberCount: this.members.size,
        members: this.getMemberList(),
      });

      server.addEventListener("message", (event) => {
        this.handleMessage(server, event.data as string);
      });

      server.addEventListener("close", () => {
        const info = this.members.get(server);
        this.members.delete(server);
        if (info) {
          this.broadcast({
            type: "player_left",
            userId: info.userId,
            displayName: info.displayName,
            memberCount: this.members.size,
            members: this.getMemberList(),
          });
        }
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Expected WebSocket", { status: 400 });
  }

  private handleMessage(ws: WebSocket, raw: string) {
    try {
      const msg = JSON.parse(raw);

      switch (msg.type) {
        case "start_game":
          this.state.status = "playing";
          this.state.startTime = Date.now();
          this.state.puzzleId = msg.puzzleId || this.state.puzzleId;
          this.broadcast({
            type: "game_started",
            puzzleId: this.state.puzzleId,
            startTime: this.state.startTime,
          });
          break;

        case "answer": {
          const { cellKey, value, correct } = msg;
          const info = this.members.get(ws);
          if (!info) break;

          this.state.answers[cellKey] = {
            userId: info.userId,
            value,
            correct: !!correct,
          };

          if (correct) info.score++;

          this.broadcast({
            type: "answer_update",
            cellKey,
            userId: info.userId,
            displayName: info.displayName,
            value,
            correct,
            scores: this.getScores(),
          });
          break;
        }

        case "finish": {
          const info = this.members.get(ws);
          if (!info) break;
          info.finishedAt = Date.now();
          const timeMs = this.state.startTime
            ? info.finishedAt - this.state.startTime
            : 0;

          this.broadcast({
            type: "player_finished",
            userId: info.userId,
            displayName: info.displayName,
            score: info.score,
            timeMs,
            scores: this.getScores(),
          });

          const allFinished = [...this.members.values()].every((m) => m.finishedAt);
          if (allFinished) {
            this.state.status = "ended";
            this.broadcast({
              type: "game_ended",
              scores: this.getScores(),
              rankings: this.getRankings(),
            });
          }
          break;
        }

        case "chat": {
          const info = this.members.get(ws);
          if (!info) break;
          this.broadcast({
            type: "chat",
            userId: info.userId,
            displayName: info.displayName,
            message: msg.message,
          });
          break;
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  private broadcast(data: unknown) {
    const msg = JSON.stringify(data);
    for (const [ws] of this.members) {
      try {
        ws.send(msg);
      } catch {
        // connection might be closed
      }
    }
  }

  private getMemberList(): { userId: string; displayName: string; score: number }[] {
    return [...this.members.values()].map(({ userId, displayName, score }) => ({
      userId,
      displayName,
      score,
    }));
  }

  private getScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const info of this.members.values()) {
      scores[info.userId] = info.score;
    }
    return scores;
  }

  private getRankings(): { userId: string; displayName: string; score: number; timeMs: number }[] {
    return [...this.members.values()]
      .map((info) => ({
        userId: info.userId,
        displayName: info.displayName,
        score: info.score,
        timeMs: info.finishedAt && this.state.startTime
          ? info.finishedAt - this.state.startTime
          : 0,
      }))
      .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
  }
}
