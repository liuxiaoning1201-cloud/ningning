import owlAvatar from '../assets/group-avatars/group-owl.png'
import otterAvatar from '../assets/group-avatars/group-otter.png'
import shibaAvatar from '../assets/group-avatars/group-shiba.png'

export type AnimalType = 'owl' | 'otter' | 'shiba'

export type ScoreCategory = 'learning' | 'listening' | 'cooperation' | 'habit' | 'reminder'

export interface Student {
  id: string
  name: string
  seatNumber: number
  groupId: string
  notes: StudentNote[]
  /** 印章累積數（下課抽卡獎勵可為每位組員加蓋印章） */
  stamps?: number
}

export interface StudentNote {
  id: string
  content: string
  timestamp: number
}

export interface Group {
  id: string
  name: string
  animal: AnimalType
  studentIds: string[]
}

export interface ScoreEvent {
  id: string
  timestamp: number
  targetType: 'student' | 'group'
  targetId: string
  groupId: string
  category: ScoreCategory
  label: string
  points: number
  note?: string
  /** 關聯到某一節課，未啟用課堂時為 undefined */
  sessionId?: string
}

export interface ScoreButton {
  id: string
  label: string
  emoji: string
  points: number
  category: ScoreCategory
  targetType: 'student' | 'group'
}

export interface Badge {
  id: string
  name: string
  emoji: string
  description: string
  groupId?: string
  unlockedAt?: number
}

// ====== 課堂 Session 與獎勵系統 ======

export type RewardRarity = 'common' | 'rare' | 'legendary'

export type RewardEffect =
  | { type: 'stamp'; count: number }
  | { type: 'bonusPoints'; points: number }
  | { type: 'badge'; badgeName: string; badgeEmoji: string }
  | { type: 'privilege'; name: string }
  | { type: 'mystery' }

export interface RewardCard {
  id: string
  name: string
  emoji: string
  description: string
  rarity: RewardRarity
  effect: RewardEffect
}

/** 單次抽卡的結果記錄 */
export interface RewardDraw {
  id: string
  sessionId: string
  groupId: string
  card: RewardCard
  drawnAt: number
  /** 是否已由老師點擊「套用」，已套用才會發放印章或加分 */
  applied: boolean
}

export interface LessonSession {
  id: string
  subject: string
  startedAt: number
  endedAt?: number
  isActive: boolean
  /** 結算時的各組得分快照，key 為 groupId */
  groupScores?: Record<string, number>
  /** 冠軍組 id，平手時可為多個 */
  winningGroupIds?: string[]
}

export interface ClassData {
  id: string
  name: string
  semester: string
  groups: Group[]
  students: Student[]
  scoreEvents: ScoreEvent[]
  badges: Badge[]
  lessons: LessonSession[]
  rewardDraws: RewardDraw[]
  rewardPool: RewardCard[]
  /** 下節課可對該小組加成的積分（來自「下課加分券」） */
  pendingBonusPoints?: Record<string, number>
  createdAt: number
}

export const ANIMAL_CONFIG: Record<
  AnimalType,
  { name: string; emoji: string; avatar: string; color: string; lightColor: string; darkColor: string }
> = {
  owl: { name: '貓頭鷹', emoji: '🧊', avatar: owlAvatar, color: '#8B5CF6', lightColor: '#EDE9FE', darkColor: '#6D28D9' },
  otter: { name: '海獺', emoji: '🦄', avatar: otterAvatar, color: '#14B8A6', lightColor: '#CCFBF1', darkColor: '#0F766E' },
  shiba: { name: '柴犬', emoji: '⚡', avatar: shibaAvatar, color: '#F59E0B', lightColor: '#FEF3C7', darkColor: '#D97706' },
}

export const DEFAULT_SCORE_BUTTONS: ScoreButton[] = [
  { id: 'think-first', label: '先想再答', emoji: '💭', points: 2, category: 'learning', targetType: 'student' },
  { id: 'evidence', label: '有根據回答', emoji: '📖', points: 2, category: 'learning', targetType: 'student' },
  { id: 'supplement', label: '補充同學', emoji: '🔗', points: 2, category: 'listening', targetType: 'student' },
  { id: 'self-correct', label: '修正自己', emoji: '🔄', points: 2, category: 'learning', targetType: 'student' },
  { id: 'restate', label: '重述同學', emoji: '👂', points: 1, category: 'listening', targetType: 'student' },
  { id: 'attentive', label: '專心傾聽', emoji: '🎧', points: 1, category: 'listening', targetType: 'student' },
  { id: 'team-complete', label: '合作完成', emoji: '🤝', points: 2, category: 'cooperation', targetType: 'group' },
  { id: 'team-helping', label: '互助合作', emoji: '💪', points: 2, category: 'cooperation', targetType: 'group' },
  { id: 'good-habit', label: '課堂專注', emoji: '📚', points: 1, category: 'habit', targetType: 'student' },
  { id: 'on-time', label: '準時交作業', emoji: '⏰', points: 1, category: 'habit', targetType: 'student' },
  { id: 'interrupt', label: '插嘴提醒', emoji: '⚠️', points: -1, category: 'reminder', targetType: 'student' },
  { id: 'off-task', label: '分心提醒', emoji: '💤', points: -1, category: 'reminder', targetType: 'student' },
]

export const DEFAULT_BADGES: Badge[] = [
  { id: 'listener', name: '專心小耳朵', emoji: '👂', description: '全組傾聽達標' },
  { id: 'thinker', name: '思考小博士', emoji: '🧠', description: '出現有依據的回答' },
  { id: 'helper', name: '補充高手', emoji: '🌟', description: '多次有效補充同學' },
  { id: 'guardian', name: '合作守護隊', emoji: '🛡️', description: '全組互助完成任務' },
  { id: 'improver', name: '進步之星', emoji: '🚀', description: '本週表現持續進步' },
  { id: 'brave', name: '勇敢發言家', emoji: '🎤', description: '主動回答困難問題' },
]

export const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  learning: '個人學習',
  listening: '傾聽互動',
  cooperation: '小組合作',
  habit: '課堂習慣',
  reminder: '行為提醒',
}

export const CATEGORY_EMOJIS: Record<ScoreCategory, string> = {
  learning: '📚',
  listening: '👂',
  cooperation: '🤝',
  habit: '✨',
  reminder: '⚠️',
}

export const CATEGORY_COLORS: Record<ScoreCategory, { bg: string; border: string; text: string; bar: string }> = {
  learning: { bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8', bar: '#3B82F6' },
  listening: { bg: '#F0FDF4', border: '#86EFAC', text: '#15803D', bar: '#22C55E' },
  cooperation: { bg: '#FDF4FF', border: '#D8B4FE', text: '#7E22CE', bar: '#A855F7' },
  habit: { bg: '#FFF7ED', border: '#FDBA74', text: '#C2410C', bar: '#F97316' },
  reminder: { bg: '#FEF2F2', border: '#FCA5A5', text: '#B91C1C', bar: '#EF4444' },
}

/** 學生展示頁輪播的鼓勵語，依課堂計分類別歸類（與 DEFAULT_SCORE_BUTTONS 對應） */
export const ENCOURAGEMENTS_BY_CATEGORY: Record<ScoreCategory, string[]> = {
  learning: [
    '先想再答，答案更好！💭',
    '有根據的回答最棒！📖',
    '修正自己也是進步！🔄',
    '每一次發言都是進步！🌟',
    '你的想法很重要，說出來吧！💡',
    '勇敢表達，你會更厲害！🎤',
  ],
  listening: [
    '聽完同學再說，你更棒！👂',
    '專心聽，用心想，勇敢說！🎧',
    '先重述同學的話，再補充！🔗',
    '尊重發言，輪到你再說！✨',
    '聽懂再回答，答案更完整！👂',
  ],
  cooperation: [
    '合作才是真正的力量！🤝',
    '互相幫助，一起成長！🌱',
    '一起完成任務，最開心！🛡️',
    '小組齊心，表現更亮眼！🌟',
  ],
  habit: [
    '專心投入，進步看得見！📚',
    '穩定參與，一天比一天棒！✨',
    '做得好，繼續加油！🔥',
  ],
  reminder: [
    '先聽完再說，更有禮貌！💭',
    '等輪到你，再舉手發言！✨',
    '深呼吸，準備好再舉手！👂',
  ],
}

/** 預設獎勵卡池 */
export const DEFAULT_REWARD_POOL: RewardCard[] = [
  {
    id: 'stamp-rain',
    name: '印章雨',
    emoji: '🎖️',
    description: '全組每位成員獲得 1 個印章',
    rarity: 'common',
    effect: { type: 'stamp', count: 1 },
  },
  {
    id: 'double-stamp',
    name: '雙倍印章',
    emoji: '🏅',
    description: '全組每位成員獲得 2 個印章',
    rarity: 'rare',
    effect: { type: 'stamp', count: 2 },
  },
  {
    id: 'bonus-voucher',
    name: '下課加分券',
    emoji: '🎟️',
    description: '下節課開始該組預先獲得 3 分',
    rarity: 'common',
    effect: { type: 'bonusPoints', points: 3 },
  },
  {
    id: 'big-bonus',
    name: '黃金加分券',
    emoji: '💰',
    description: '下節課開始該組預先獲得 5 分',
    rarity: 'rare',
    effect: { type: 'bonusPoints', points: 5 },
  },
  {
    id: 'mystery-badge',
    name: '神秘徽章',
    emoji: '🎖',
    description: '全組獲得一枚限定徽章',
    rarity: 'rare',
    effect: { type: 'badge', badgeName: '冠軍徽章', badgeEmoji: '👑' },
  },
  {
    id: 'wish-star',
    name: '許願星',
    emoji: '🌠',
    description: '老師認可的一次小願望（例：選座位、免功課一次）',
    rarity: 'legendary',
    effect: { type: 'privilege', name: '一次小願望（老師決定）' },
  },
  {
    id: 'golden-chest',
    name: '黃金寶箱',
    emoji: '🎁',
    description: '全組每人獲得 3 個印章 ＋ 傳說徽章',
    rarity: 'legendary',
    effect: { type: 'stamp', count: 3 },
  },
  {
    id: 'cheer',
    name: '小掌聲',
    emoji: '👏',
    description: '全組獲得同學的一次熱烈掌聲',
    rarity: 'common',
    effect: { type: 'privilege', name: '全班給予一次熱烈掌聲' },
  },
  {
    id: 'mystery',
    name: '神秘卡',
    emoji: '❓',
    description: '老師臨時想到的驚喜獎勵',
    rarity: 'legendary',
    effect: { type: 'mystery' },
  },
]

export const RARITY_CONFIG: Record<RewardRarity, { label: string; color: string; bg: string; border: string; weight: number }> = {
  common: { label: '普通', color: '#6B7280', bg: '#F3F4F6', border: '#D1D5DB', weight: 60 },
  rare: { label: '稀有', color: '#7C3AED', bg: '#F3E8FF', border: '#C4B5FD', weight: 30 },
  legendary: { label: '傳說', color: '#D97706', bg: '#FEF3C7', border: '#FBBF24', weight: 10 },
}
