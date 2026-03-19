export type AnimalType = 'owl' | 'otter' | 'shiba'

export type ScoreCategory = 'learning' | 'listening' | 'cooperation' | 'habit' | 'reminder'

export interface Student {
  id: string
  name: string
  seatNumber: number
  groupId: string
  notes: StudentNote[]
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

export interface ClassData {
  id: string
  name: string
  semester: string
  groups: Group[]
  students: Student[]
  scoreEvents: ScoreEvent[]
  badges: Badge[]
  createdAt: number
}

export const ANIMAL_CONFIG: Record<AnimalType, { name: string; emoji: string; color: string; lightColor: string; darkColor: string }> = {
  owl: { name: '貓頭鷹', emoji: '🦉', color: '#8B5CF6', lightColor: '#EDE9FE', darkColor: '#6D28D9' },
  otter: { name: '海獺', emoji: '🦦', color: '#14B8A6', lightColor: '#CCFBF1', darkColor: '#0F766E' },
  shiba: { name: '柴犬', emoji: '🐕', color: '#F59E0B', lightColor: '#FEF3C7', darkColor: '#D97706' },
}

export const DEFAULT_SCORE_BUTTONS: ScoreButton[] = [
  { id: 'think-first', label: '先想再答', emoji: '💭', points: 2, category: 'learning', targetType: 'student' },
  { id: 'evidence', label: '有根據回答', emoji: '📖', points: 2, category: 'learning', targetType: 'student' },
  { id: 'supplement', label: '補充同學', emoji: '🔗', points: 2, category: 'listening', targetType: 'student' },
  { id: 'self-correct', label: '修正自己', emoji: '🔄', points: 2, category: 'learning', targetType: 'student' },
  { id: 'restate', label: '重述同學', emoji: '👂', points: 1, category: 'listening', targetType: 'student' },
  { id: 'attentive', label: '專心傾聽', emoji: '🎧', points: 1, category: 'listening', targetType: 'student' },
  { id: 'team-complete', label: '合作完成', emoji: '🤝', points: 2, category: 'cooperation', targetType: 'group' },
  { id: 'interrupt', label: '插嘴提醒', emoji: '⚠️', points: -1, category: 'reminder', targetType: 'student' },
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
