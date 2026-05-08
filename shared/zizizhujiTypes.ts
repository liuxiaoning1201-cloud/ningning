/**
 * 「字字珠璣」中文連字棋 — Worker 與前端共用型別。
 *
 * 三大正交維度：
 *   1. 內容形態 ContentType  → 棋盤怎麼填字
 *   2. 連線長度 lineLength    → N 連算數（隨內容浮動或固定）
 *   3. 勝負類型 WinType       → 先到 / 累計 / 內容完成
 */

export type Player = "black" | "white";

export type CellState =
  | { type: "empty" }
  | { type: "char"; ch: string }
  | { type: "claimed"; ch?: string; by: Player };

export type ContentType =
  | "free"     // 不限內容（純五子棋風格）
  | "char"     // 識字（部首/注音/同類）
  | "word"     // 二字詞
  | "idiom"    // 四字成語
  | "poem-5"   // 五言詩
  | "poem-7"   // 七言詩
  | "sentence" // 句子（長度動態）
  ;

export type WinType =
  | { kind: "first"; n: number }                         // 先連到 N 子者勝
  | { kind: "count"; durationSec: number; lineLength: number }   // 限時內 N 連數量多者勝
  | { kind: "complete"; targetType: ContentType }        // 拼出指定內容勝
  ;

export type PlacementGate =
  | { kind: "free" }
  | { kind: "qa"; difficulty: 1 | 2 | 3 | 4 | 5 };

export interface GameRule {
  content: ContentType;
  /** 連線長度；"match-content" 表示跟隨內容類型自動推斷（成語=4、五言=5、七言=7、句子=動態） */
  lineLength: number | "match-content";
  win: WinType;
  placement: PlacementGate;
  /** 對手是否可質疑宣告（complete + 句子/主題類） */
  challengeable: boolean;
}

export type YearLevel = "g1-2" | "g3-4" | "g5-6";

export interface GameTemplate {
  id: string;
  name: string;
  description: string;
  /** 不變的核心規則 */
  rule: GameRule;
  boardSize: 9 | 11 | 13 | 15;
  yearLevels: YearLevel[];
  /** 推薦每回合秒數（0 = 不限時） */
  turnSeconds: number;
  /** 輸入詞庫的最少字數要求（避免內容不足） */
  minBankItems?: number;
  /** UI 用 emoji */
  emoji: string;
  builtIn: boolean;
}

export interface BoardState {
  size: number;
  cells: CellState[][];
}

export type QuestionType =
  | "phonetic"      // 注音 ↔ 漢字
  | "definition"    // 詞義選擇
  | "compose"       // 組詞
  | "idiom-meaning" // 成語意義
  | "near-form"     // 形近字辨別
  ;

export interface QuestionCard {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  hint?: string;
  source?: string;
}

export interface PlayerInfo {
  id: string;
  name: string;
  color: Player | null;
  connected: boolean;
  joinedAt: number;
  /** 目前 streak（連答對；用於 QA 飛子獎勵） */
  qaStreak: number;
  /** 目前累計分數 */
  score: number;
  /** count 模式累計連線數 */
  countLines: number;
}

export interface ConnectedLine {
  cells: { r: number; c: number; ch?: string }[];
  direction: "h" | "v" | "d1" | "d2";
  by: Player;
}

export type GameStatus = "waiting" | "playing" | "ended";

export interface GameState {
  rule: GameRule;
  /** 已解析的真實 N（若原本為 "match-content" 會被填入具體數字） */
  resolvedLineLength: number;
  board: BoardState;
  templateId: string;
  templateName: string;
  status: GameStatus;
  players: PlayerInfo[];
  currentTurn: Player;
  startedAt: number | null;
  /** count 模式倒數結束時刻（毫秒）/ 其他模式回合超時 */
  deadline: number | null;
  lastMove: { r: number; c: number; player: Player; ch?: string } | null;
  pendingComplete: PendingComplete | null;
  pendingQuestion: PendingQuestion | null;
  winner: Player | "draw" | null;
  winnerLine: ConnectedLine | null;
  endReason: string | null;
  log: GameEvent[];
}

export interface PendingComplete {
  by: Player;
  cells: { r: number; c: number }[];
  text: string;
  expiresAt: number;
}

export interface PendingQuestion {
  forPlayer: Player;
  card: QuestionCard;
  targetCell: { r: number; c: number };
  expiresAt: number;
}

export interface GameEvent {
  t: number;
  kind: string;
  detail?: unknown;
}

export interface RoomSummary {
  roomId: string;
  joinCode: string;
  templateId: string;
  templateName: string;
  status: GameStatus;
  players: { id: string; name: string; color: Player | null }[];
  hostId: string;
  createdAt: number;
}

/** 客 → 伺服器 */
export type ClientMessage =
  | { type: "ready" }
  | { type: "place"; r: number; c: number }
  | { type: "answer-question"; optionIndex: number }
  | { type: "declare-complete"; cells: { r: number; c: number }[]; text: string }
  | { type: "challenge" }
  | { type: "accept-complete" }
  | { type: "rematch" }
  | { type: "leave" }
  ;

/** 伺服器 → 客 */
export type ServerMessage =
  | { type: "snapshot"; state: GameState; you: { playerId: string; color: Player | null } }
  | { type: "player-joined"; players: PlayerInfo[]; player: PlayerInfo }
  | { type: "player-left"; players: PlayerInfo[]; playerId: string }
  | { type: "started"; state: GameState }
  | { type: "turn"; currentTurn: Player; deadline: number | null }
  | { type: "placed"; r: number; c: number; by: Player; ch?: string; cell: CellState; scores: Record<string, number> }
  | { type: "question"; card: QuestionCard; forPlayer: Player; targetCell: { r: number; c: number }; expiresAt: number }
  | { type: "question-resolved"; correct: boolean; reveal?: number }
  | { type: "complete-pending"; cells: { r: number; c: number }[]; text: string; by: Player; expiresAt: number }
  | { type: "complete-resolved"; accepted: boolean; by: Player; reason?: string }
  | { type: "tick"; secondsLeft: number; lines: { black: number; white: number } }
  | { type: "win"; winner: Player | "draw"; reason: string; line: ConnectedLine | null; state: GameState }
  | { type: "error"; message: string }
  ;
