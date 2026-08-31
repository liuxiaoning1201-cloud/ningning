/** 23 種香港小學筆畫的識別碼。一筆一物、一物一筆，雙向唯一。 */
export type StrokeId =
  // 基本筆畫（6）
  | 'dian'
  | 'heng'
  | 'zhi'
  | 'pie'
  | 'na'
  | 'ti'
  // 複合筆畫（17）
  | 'hengzhi'
  | 'hengzhigou'
  | 'hengpie'
  | 'hengpiewangou'
  | 'hengwangou'
  | 'henggou'
  | 'zhizheng'
  | 'zhizhengzhi'
  | 'zhizhengzhigou'
  | 'zhigou'
  | 'zhiwangou'
  | 'zhiti'
  | 'piedian'
  | 'pieti'
  | 'wangou'
  | 'wogou'
  | 'xiegou';

export type StrokeCategory = 'basic' | 'compound';

/** 同一件物品的替代擺放，例如三點水裡朝左與朝右的點。仍是同一個 StrokeId。 */
export interface StrokeVariant {
  key: string;
  label: string;
  image: string;
  /** 這張圖被畫出來的方向，度；用來抵銷旋轉 */
  baseAngle?: number;
}

export interface StrokeDef {
  id: StrokeId;
  /** 香港課本用的名稱 */
  name: string;
  /** 筆形字元，用於圖鑑對照 */
  shape: string;
  /** 大陸常用名稱，僅作對照參考，不對學生顯示 */
  mainlandName?: string;
  category: StrokeCategory;
  /** 物品名稱 */
  objectName: string;
  /** 物品圖檔名（public/objects 下） */
  image: string;
  /** 物品材質，帶鈎各筆靠材質分辨 */
  material: string;
  /** 建議解鎖年級 */
  stage: 1 | 2 | 3 | 4;
  /** 課本字例 */
  examples: string[];
  /** 擺放提示，寫給老師看 */
  hint: string;
  /**
   * 物品畫得比筆畫本身「胖」時的縮放補償。水滴是一整顆，比一個點粗，所以要縮。
   * 預設 1，代表物品的外框就等於筆畫的外框。
   */
  drawScale?: number;
  variants?: StrokeVariant[];
}

/** 一筆的中線折線，makemeahanzi 1024 座標系（y 軸向上遞減）。 */
export type Median = [number, number][];

export type CharSource = 'override' | 'ZhHant' | 'makemeahanzi';

export interface CharData {
  char: string;
  /** 每一筆的 SVG path，供字卡動畫使用 */
  strokes: string[];
  medians: Median[];
  /** 每一筆對應的筆畫識別碼；null 表示未能判定 */
  strokeTypes: (StrokeId | null)[];
  source: CharSource;
  /** 筆畫標註是否經人工覈核 */
  verified: boolean;
}

/** 由 median 推導出的目標槽位，米字格內的正規化座標（0–1）。 */
export interface StrokeSlot {
  index: number;
  strokeId: StrokeId | null;
  /** 中心點，0–1 */
  cx: number;
  cy: number;
  /** 首末點連線的角度，度，0 為向右，順時針為正 */
  angle: number;
  /** 首末點距離佔格寬的比例 */
  length: number;
  /**
   * 這一筆外框的最大邊，佔格寬的比例。
   * 物品圖是按外框裁成正方形的，所以這個才是物品該有的大小，不是首末點距離。
   */
  extent: number;
}

/** 學生擺在格子裡的一件物品。 */
export interface Piece {
  id: string;
  strokeId: StrokeId;
  /** 使用的替代擺放 */
  variantKey?: string;
  /** 中心點，0–1 */
  x: number;
  y: number;
  /** 佔格寬的比例 */
  scale: number;
  /** 旋轉角度，度 */
  rot: number;
  /** 放置次序，用於筆順評分 */
  seq: number;
  /** 練習模式吸附到的槽位 */
  slotIndex?: number;
}

export type JudgeLevel = 'kind' | 'order' | 'placement';

export interface StrokeJudgement {
  slotIndex: number;
  strokeId: StrokeId | null;
  pieceId?: string;
  kindOk: boolean;
  orderOk: boolean;
  placementOk: boolean;
}

export interface JudgeResult {
  total: number;
  matched: number;
  kindScore: number;
  orderScore: number;
  placementScore: number;
  perStroke: StrokeJudgement[];
  /** 多放、對不上任何槽位的物件 */
  extraPieceIds: string[];
  passed: boolean;
}

/** 老師建立的字簿，一課一本。 */
export interface Wordbook {
  id: string;
  name: string;
  chars: string[];
  createdAt: number;
  updatedAt: number;
}
