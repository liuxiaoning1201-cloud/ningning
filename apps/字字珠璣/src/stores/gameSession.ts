import { defineStore } from "pinia";
import { generateBoard } from "@/lib/boardGenerator";
import { evaluateComplete, evaluateCount, evaluateFirst, resolveLineLength, verifyDeclaration } from "@/lib/ruleEngine";
import { tryPlace } from "@/lib/boardEngine";
import { drawQuestion } from "@/lib/questionDeck";
import type {
  BoardState,
  ConnectedLine,
  GameRule,
  GameTemplate,
  Player,
  QuestionCard,
} from "@/lib/types";

interface LocalPlayer {
  color: Player;
  name: string;
  score: number;
  countLines: number;
  qaStreak: number;
}

interface PendingQA {
  forPlayer: Player;
  card: QuestionCard;
  targetCell: { r: number; c: number };
}

interface PendingComplete {
  by: Player;
  cells: { r: number; c: number }[];
  text: string;
  expiresAt: number;
}

/** 本地對戰狀態（Pinia） */
export const useGameSessionStore = defineStore("gameSession", {
  state: () => ({
    template: null as GameTemplate | null,
    rule: null as GameRule | null,
    resolvedLineLength: 5,
    boardSize: 11,
    turnSeconds: 60,
    board: null as BoardState | null,
    placedTexts: [] as string[],
    players: { black: { color: "black", name: "黑方", score: 0, countLines: 0, qaStreak: 0 }, white: { color: "white", name: "白方", score: 0, countLines: 0, qaStreak: 0 } } as Record<Player, LocalPlayer>,
    currentTurn: "black" as Player,
    status: "waiting" as "waiting" | "playing" | "ended",
    startedAt: null as number | null,
    deadline: null as number | null,
    lastMove: null as { r: number; c: number; player: Player; ch?: string } | null,
    winner: null as Player | "draw" | null,
    winnerLine: null as ConnectedLine | null,
    endReason: "" as string,
    pendingQA: null as PendingQA | null,
    pendingComplete: null as PendingComplete | null,
  }),
  actions: {
    /** 開始一場本地對戰：從模板生成棋盤 + 玩家。 */
    initLocal(template: GameTemplate, opts?: { blackName?: string; whiteName?: string; customTexts?: string[] }) {
      this.template = template;
      this.rule = template.rule;
      this.resolvedLineLength = resolveLineLength(template.rule);
      this.boardSize = template.boardSize;
      this.turnSeconds = template.turnSeconds;
      const { board, texts } = generateBoard({
        size: template.boardSize,
        contentType: template.rule.content,
        customTexts: opts?.customTexts,
        lineLength: this.resolvedLineLength,
      });
      this.board = board;
      this.placedTexts = texts;
      this.players = {
        black: { color: "black", name: opts?.blackName || "黑方", score: 0, countLines: 0, qaStreak: 0 },
        white: { color: "white", name: opts?.whiteName || "白方", score: 0, countLines: 0, qaStreak: 0 },
      };
      this.currentTurn = "black";
      this.status = "playing";
      this.startedAt = Date.now();
      this.lastMove = null;
      this.winner = null;
      this.winnerLine = null;
      this.endReason = "";
      this.pendingQA = null;
      this.pendingComplete = null;
      if (template.rule.win.kind === "count") {
        this.deadline = Date.now() + template.rule.win.durationSec * 1000;
      } else if (template.turnSeconds > 0) {
        this.deadline = Date.now() + template.turnSeconds * 1000;
      } else {
        this.deadline = null;
      }
    },

    /** 嘗試在 (r,c) 落子。若 QA 模式，會先彈題卡。 */
    requestPlace(r: number, c: number): { needsQA: boolean; placed: boolean; reason?: string } {
      if (!this.rule || !this.board || this.status !== "playing") return { needsQA: false, placed: false, reason: "對局尚未開始" };
      if (this.pendingQA || this.pendingComplete) return { needsQA: false, placed: false, reason: "尚有待處理事件" };
      const cell = this.board.cells[r]?.[c];
      if (!cell || cell.type === "claimed") return { needsQA: false, placed: false, reason: "此格無法落子" };

      if (this.rule.placement.kind === "qa") {
        const card = drawQuestion(this.rule.placement.difficulty);
        this.pendingQA = { forPlayer: this.currentTurn, card, targetCell: { r, c } };
        return { needsQA: true, placed: false };
      }

      this.applyPlace(r, c);
      return { needsQA: false, placed: true };
    },

    answerQuestion(optionIndex: number): { correct: boolean } {
      if (!this.pendingQA) return { correct: false };
      const correct = optionIndex === this.pendingQA.card.correctIndex;
      const target = this.pendingQA.targetCell;
      const player = this.pendingQA.forPlayer;
      this.pendingQA = null;
      const p = this.players[player];
      if (correct) {
        p.qaStreak += 1;
        this.applyPlace(target.r, target.c);
      } else {
        p.qaStreak = 0;
        this.advanceTurn();
      }
      return { correct };
    },

    /** 句子模式（complete + challengeable）：玩家手動宣告。 */
    declareComplete(cells: { r: number; c: number }[], text: string): { ok: boolean; reason?: string } {
      if (!this.rule || !this.board) return { ok: false, reason: "對局未開始" };
      const player = this.currentTurn;
      const v = verifyDeclaration(this.board, cells, player, text, this.rule);
      if (!v.ok) return v;
      this.declareWin(player, `拼出「${text}」`, {
        cells: cells.map((p) => ({ r: p.r, c: p.c, ch: this.chAt(p.r, p.c) })),
        direction: detectDir(cells),
        by: player,
      });
      return { ok: true };
    },

    requestRematch() {
      if (!this.template) return;
      this.initLocal(this.template, {
        blackName: this.players.black.name,
        whiteName: this.players.white.name,
      });
    },

    applyPlace(r: number, c: number) {
      if (!this.rule || !this.board) return;
      const player = this.currentTurn;
      const cell = tryPlace(this.board, r, c, player);
      if (!cell) return;
      this.lastMove = {
        r,
        c,
        player,
        ch: cell.type === "claimed" ? cell.ch : undefined,
      };

      // 檢查勝負
      if (this.rule.win.kind === "first") {
        const res = evaluateFirst(this.board, { r, c, player }, this.rule.win.n);
        if (res.winner) {
          this.declareWin(player, `先連成 ${this.rule.win.n} 子勝`, res.line);
          return;
        }
      } else if (this.rule.win.kind === "count") {
        const result = evaluateCount(this.board, this.rule.win.lineLength);
        this.players.black.countLines = result.scores.black;
        this.players.white.countLines = result.scores.white;
      } else if (this.rule.win.kind === "complete") {
        const res = evaluateComplete(this.board, { r, c, player }, this.rule);
        if (res.hits.length > 0) {
          const hit = res.hits[0];
          if (this.rule.challengeable) {
            // 句子模式 → 進入待質疑（本地對戰簡化：直接判勝，由人工裁定）
            const seg = hit.line.cells.slice(hit.startIdx, hit.startIdx + hit.substring.length);
            this.pendingComplete = {
              by: player,
              cells: seg.map((c) => ({ r: c.r, c: c.c })),
              text: hit.substring,
              expiresAt: Date.now() + 8000,
            };
            return;
          }
          const seg = hit.line.cells.slice(hit.startIdx, hit.startIdx + hit.substring.length);
          this.declareWin(player, `拼出「${hit.substring}」`, {
            cells: seg,
            direction: hit.line.direction,
            by: player,
          });
          return;
        }
      }

      this.advanceTurn();
    },

    /** 句子模式：對手選擇接受 → 結束；或質疑後本地由老師裁定。 */
    acceptComplete() {
      if (!this.pendingComplete) return;
      const pc = this.pendingComplete;
      this.pendingComplete = null;
      this.declareWin(pc.by, `拼出「${pc.text}」`, {
        cells: pc.cells.map((p) => ({ r: p.r, c: p.c, ch: this.chAt(p.r, p.c) })),
        direction: detectDir(pc.cells),
        by: pc.by,
      });
    },

    rejectComplete() {
      // 老師判決不算數，跳過該回合
      this.pendingComplete = null;
      this.advanceTurn();
    },

    advanceTurn() {
      if (!this.rule) return;
      this.currentTurn = this.currentTurn === "black" ? "white" : "black";
      if (this.rule.win.kind !== "count" && this.turnSeconds > 0) {
        this.deadline = Date.now() + this.turnSeconds * 1000;
      }
    },

    declareWin(winner: Player | "draw", reason: string, line: ConnectedLine | null) {
      this.status = "ended";
      this.winner = winner;
      this.endReason = reason;
      this.winnerLine = line;
      this.deadline = null;
    },

    declareDraw(reason: string) {
      this.status = "ended";
      this.winner = "draw";
      this.endReason = reason;
      this.deadline = null;
    },

    /** count 模式倒數歸零時觸發 */
    onCountTimeout() {
      const bs = this.players.black.countLines;
      const ws = this.players.white.countLines;
      if (bs > ws) this.declareWin("black", `黑棋連得 ${bs} 條 vs 白棋 ${ws} 條`, null);
      else if (ws > bs) this.declareWin("white", `白棋連得 ${ws} 條 vs 黑棋 ${bs} 條`, null);
      else this.declareDraw(`雙方都連得 ${bs} 條，平手`);
    },

    chAt(r: number, c: number): string | undefined {
      if (!this.board) return undefined;
      const cell = this.board.cells[r]?.[c];
      if (!cell) return undefined;
      if (cell.type === "char") return cell.ch;
      if (cell.type === "claimed") return cell.ch;
      return undefined;
    },
  },
});

function detectDir(cells: { r: number; c: number }[]): "h" | "v" | "d1" | "d2" {
  if (cells.length < 2) return "h";
  const dr = cells[1].r - cells[0].r;
  const dc = cells[1].c - cells[0].c;
  if (dr === 0) return "h";
  if (dc === 0) return "v";
  if (dr === dc) return "d1";
  return "d2";
}
