import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ClassData, Student, Group, ScoreEvent, Badge, ScoreButton, ScoreCategory,
  LessonSession, RewardCard, RewardDraw,
} from '../types'
import { DEFAULT_BADGES, DEFAULT_REWARD_POOL, RARITY_CONFIG } from '../types'

const STORAGE_KEY = 'class-guardian-data'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function createDefaultClassData(): ClassData {
  const g1Id = generateId()
  const g2Id = generateId()
  const g3Id = generateId()

  const students: Student[] = [
    { id: generateId(), name: '小明', seatNumber: 1, groupId: g1Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小華', seatNumber: 2, groupId: g1Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小美', seatNumber: 3, groupId: g1Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小強', seatNumber: 4, groupId: g1Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小芳', seatNumber: 5, groupId: g1Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小龍', seatNumber: 6, groupId: g2Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小玲', seatNumber: 7, groupId: g2Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小偉', seatNumber: 8, groupId: g2Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小婷', seatNumber: 9, groupId: g2Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小傑', seatNumber: 10, groupId: g2Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小雯', seatNumber: 11, groupId: g3Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小智', seatNumber: 12, groupId: g3Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小蓉', seatNumber: 13, groupId: g3Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小豪', seatNumber: 14, groupId: g3Id, notes: [], stamps: 0 },
    { id: generateId(), name: '小琪', seatNumber: 15, groupId: g3Id, notes: [], stamps: 0 },
  ]

  const groups: Group[] = [
    { id: g1Id, name: '貓頭鷹隊', animal: 'owl', studentIds: students.filter(s => s.groupId === g1Id).map(s => s.id) },
    { id: g2Id, name: '海獺隊', animal: 'otter', studentIds: students.filter(s => s.groupId === g2Id).map(s => s.id) },
    { id: g3Id, name: '柴犬隊', animal: 'shiba', studentIds: students.filter(s => s.groupId === g3Id).map(s => s.id) },
  ]

  return {
    id: generateId(),
    name: '五年級一班',
    semester: '114學年第二學期',
    groups,
    students,
    scoreEvents: [],
    badges: DEFAULT_BADGES.map(b => ({ ...b })),
    lessons: [],
    rewardDraws: [],
    rewardPool: DEFAULT_REWARD_POOL.map(c => ({ ...c })),
    pendingBonusPoints: {},
    createdAt: Date.now(),
  }
}

/** 舊資料遷移：若缺少新欄位，補上預設值 */
function migrateClassData(raw: any): ClassData {
  const base = createDefaultClassData()
  const merged: ClassData = {
    ...base,
    ...raw,
    students: (raw.students ?? base.students).map((s: any) => ({ ...s, stamps: s.stamps ?? 0 })),
    lessons: raw.lessons ?? [],
    rewardDraws: raw.rewardDraws ?? [],
    rewardPool: raw.rewardPool && raw.rewardPool.length > 0 ? raw.rewardPool : base.rewardPool,
    pendingBonusPoints: raw.pendingBonusPoints ?? {},
  }
  return merged
}

export const useClassStore = defineStore('classStore', () => {
  const classData = ref<ClassData>(createDefaultClassData())
  const initialized = ref(false)

  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        classData.value = migrateClassData(JSON.parse(raw))
      } catch {
        classData.value = createDefaultClassData()
      }
    }
    initialized.value = true
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(classData.value))
  }

  function init() {
    if (!initialized.value) {
      loadFromStorage()
    }
  }

  // --- Getters ---
  const groups = computed(() => classData.value.groups)
  const students = computed(() => classData.value.students)
  const scoreEvents = computed(() => classData.value.scoreEvents)
  const badges = computed(() => classData.value.badges)
  const lessons = computed(() => classData.value.lessons)
  const rewardDraws = computed(() => classData.value.rewardDraws)
  const rewardPool = computed(() => classData.value.rewardPool)

  const activeLesson = computed<LessonSession | null>(() => {
    return classData.value.lessons.find(l => l.isActive) ?? null
  })

  function getStudentsByGroup(groupId: string): Student[] {
    return classData.value.students.filter(s => s.groupId === groupId)
  }

  function getStudentById(id: string): Student | undefined {
    return classData.value.students.find(s => s.id === id)
  }

  function getGroupById(id: string): Group | undefined {
    return classData.value.groups.find(g => g.id === id)
  }

  function getGroupScore(groupId: string, since?: number): number {
    return classData.value.scoreEvents
      .filter(e => {
        if (since && e.timestamp < since) return false
        return e.groupId === groupId
      })
      .reduce((sum, e) => sum + e.points, 0)
  }

  function getStudentScore(studentId: string, since?: number): number {
    return classData.value.scoreEvents
      .filter(e => {
        if (since && e.timestamp < since) return false
        return e.targetType === 'student' && e.targetId === studentId
      })
      .reduce((sum, e) => sum + e.points, 0)
  }

  function getTodayStart(): number {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }

  function getWeekStart(): number {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff)
    return monday.getTime()
  }

  const todayEvents = computed(() => {
    const start = getTodayStart()
    return classData.value.scoreEvents.filter(e => e.timestamp >= start).sort((a, b) => b.timestamp - a.timestamp)
  })

  const weekEvents = computed(() => {
    const start = getWeekStart()
    return classData.value.scoreEvents.filter(e => e.timestamp >= start).sort((a, b) => b.timestamp - a.timestamp)
  })

  const recentEvents = computed(() => {
    return [...classData.value.scoreEvents].sort((a, b) => b.timestamp - a.timestamp).slice(0, 20)
  })

  function getGroupTodayScore(groupId: string): number {
    return getGroupScore(groupId, getTodayStart())
  }

  function getGroupWeekScore(groupId: string): number {
    return getGroupScore(groupId, getWeekStart())
  }

  function getCategoryBreakdown(groupId: string, since?: number): Record<ScoreCategory, number> {
    const result: Record<ScoreCategory, number> = {
      learning: 0, listening: 0, cooperation: 0, habit: 0, reminder: 0,
    }
    classData.value.scoreEvents
      .filter(e => {
        if (since && e.timestamp < since) return false
        return e.groupId === groupId
      })
      .forEach(e => { result[e.category] += e.points })
    return result
  }

  // --- Lesson session ---

  function startLesson(subject: string): LessonSession {
    // 若有正在進行的課堂，先結束掉避免資料混亂
    const existing = classData.value.lessons.find(l => l.isActive)
    if (existing) {
      existing.isActive = false
      existing.endedAt = Date.now()
    }

    const session: LessonSession = {
      id: generateId(),
      subject: subject.trim() || '未命名課堂',
      startedAt: Date.now(),
      isActive: true,
    }

    // 將 pending 加分券套用為本堂課的起始加分事件
    const pending = classData.value.pendingBonusPoints ?? {}
    Object.entries(pending).forEach(([groupId, points]) => {
      if (points > 0 && getGroupById(groupId)) {
        classData.value.scoreEvents.push({
          id: generateId(),
          timestamp: Date.now(),
          targetType: 'group',
          targetId: groupId,
          groupId,
          category: 'cooperation',
          label: '加分券獎勵',
          points,
          note: '上一堂課抽卡獎勵',
          sessionId: session.id,
        })
      }
    })
    classData.value.pendingBonusPoints = {}

    classData.value.lessons.push(session)
    saveToStorage()
    return session
  }

  function endActiveLesson(): LessonSession | null {
    const active = classData.value.lessons.find(l => l.isActive)
    if (!active) return null

    active.isActive = false
    active.endedAt = Date.now()

    // 計算本堂課各組得分快照
    const sessionEvents = classData.value.scoreEvents.filter(e => e.sessionId === active.id)
    const scores: Record<string, number> = {}
    classData.value.groups.forEach(g => { scores[g.id] = 0 })
    sessionEvents.forEach(e => {
      scores[e.groupId] = (scores[e.groupId] ?? 0) + e.points
    })
    active.groupScores = scores

    // 計算冠軍（允許平手多組）
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore > 0) {
      active.winningGroupIds = Object.entries(scores)
        .filter(([, s]) => s === maxScore)
        .map(([id]) => id)
    } else {
      active.winningGroupIds = []
    }

    saveToStorage()
    return active
  }

  function cancelActiveLesson() {
    const active = classData.value.lessons.find(l => l.isActive)
    if (!active) return
    // 取消則移除該 session 且移除這節課的事件
    classData.value.scoreEvents = classData.value.scoreEvents.filter(e => e.sessionId !== active.id)
    classData.value.lessons = classData.value.lessons.filter(l => l.id !== active.id)
    saveToStorage()
  }

  function getLessonById(id: string): LessonSession | undefined {
    return classData.value.lessons.find(l => l.id === id)
  }

  function getLessonEvents(sessionId: string): ScoreEvent[] {
    return classData.value.scoreEvents.filter(e => e.sessionId === sessionId)
  }

  // --- Score events ---

  function addScoreEvent(
    targetType: 'student' | 'group',
    targetId: string,
    groupId: string,
    button: ScoreButton,
    note?: string
  ) {
    const active = activeLesson.value
    const event: ScoreEvent = {
      id: generateId(),
      timestamp: Date.now(),
      targetType,
      targetId,
      groupId,
      category: button.category,
      label: button.label,
      points: button.points,
      note,
      sessionId: active?.id,
    }
    classData.value.scoreEvents.push(event)
    saveToStorage()
    return event
  }

  function addGroupScoreEvent(groupId: string, button: ScoreButton, note?: string) {
    return addScoreEvent('group', groupId, groupId, button, note)
  }

  function addStudentScoreEvent(studentId: string, button: ScoreButton, note?: string) {
    const student = getStudentById(studentId)
    if (!student) return
    return addScoreEvent('student', studentId, student.groupId, button, note)
  }

  function undoLastEvent() {
    if (classData.value.scoreEvents.length === 0) return
    classData.value.scoreEvents.pop()
    saveToStorage()
  }

  // --- Student CRUD ---

  function addStudent(name: string, seatNumber: number, groupId: string) {
    const student: Student = {
      id: generateId(),
      name,
      seatNumber,
      groupId,
      notes: [],
      stamps: 0,
    }
    classData.value.students.push(student)
    const group = getGroupById(groupId)
    if (group) group.studentIds.push(student.id)
    saveToStorage()
    return student
  }

  function removeStudent(studentId: string) {
    const idx = classData.value.students.findIndex(s => s.id === studentId)
    if (idx === -1) return
    const student = classData.value.students[idx]
    const group = getGroupById(student.groupId)
    if (group) {
      group.studentIds = group.studentIds.filter(id => id !== studentId)
    }
    classData.value.students.splice(idx, 1)
    classData.value.scoreEvents = classData.value.scoreEvents.filter(
      e => !(e.targetType === 'student' && e.targetId === studentId)
    )
    saveToStorage()
  }

  function updateStudent(studentId: string, updates: Partial<Pick<Student, 'name' | 'seatNumber' | 'groupId'>>) {
    const student = getStudentById(studentId)
    if (!student) return
    if (updates.groupId && updates.groupId !== student.groupId) {
      const oldGroup = getGroupById(student.groupId)
      const newGroup = getGroupById(updates.groupId)
      if (oldGroup) oldGroup.studentIds = oldGroup.studentIds.filter(id => id !== studentId)
      if (newGroup) newGroup.studentIds.push(studentId)
    }
    Object.assign(student, updates)
    saveToStorage()
  }

  function addStudentNote(studentId: string, content: string) {
    const student = getStudentById(studentId)
    if (!student) return
    student.notes.push({
      id: generateId(),
      content,
      timestamp: Date.now(),
    })
    saveToStorage()
  }

  // --- Badges ---

  function unlockBadge(badgeId: string, groupId: string) {
    const badge = classData.value.badges.find(b => b.id === badgeId)
    if (!badge) return
    const newBadge: Badge = {
      ...badge,
      id: generateId(),
      groupId,
      unlockedAt: Date.now(),
    }
    classData.value.badges.push(newBadge)
    saveToStorage()
  }

  function getUnlockedBadges(groupId?: string): Badge[] {
    return classData.value.badges.filter(b => {
      if (!b.unlockedAt) return false
      if (groupId) return b.groupId === groupId
      return true
    })
  }

  // --- Reward / card draw ---

  /** 依稀有度權重從卡池隨機抽一張 */
  function drawRandomCard(): RewardCard {
    const pool = classData.value.rewardPool.length > 0 ? classData.value.rewardPool : DEFAULT_REWARD_POOL
    const totalWeight = pool.reduce((sum, c) => sum + (RARITY_CONFIG[c.rarity]?.weight ?? 10), 0)
    let r = Math.random() * totalWeight
    for (const card of pool) {
      const w = RARITY_CONFIG[card.rarity]?.weight ?? 10
      if (r < w) return card
      r -= w
    }
    return pool[pool.length - 1]
  }

  function recordDraw(sessionId: string, groupId: string, card: RewardCard): RewardDraw {
    const draw: RewardDraw = {
      id: generateId(),
      sessionId,
      groupId,
      card,
      drawnAt: Date.now(),
      applied: false,
    }
    classData.value.rewardDraws.push(draw)
    saveToStorage()
    return draw
  }

  /** 套用獎勵到學生（發印章、下節課加分等） */
  function applyRewardDraw(drawId: string) {
    const draw = classData.value.rewardDraws.find(d => d.id === drawId)
    if (!draw || draw.applied) return
    const { card, groupId } = draw
    const groupStudents = getStudentsByGroup(groupId)

    switch (card.effect.type) {
      case 'stamp': {
        const count = card.effect.count
        groupStudents.forEach(s => {
          s.stamps = (s.stamps ?? 0) + count
        })
        break
      }
      case 'bonusPoints': {
        if (!classData.value.pendingBonusPoints) classData.value.pendingBonusPoints = {}
        classData.value.pendingBonusPoints[groupId] =
          (classData.value.pendingBonusPoints[groupId] ?? 0) + card.effect.points
        break
      }
      case 'badge': {
        const newBadge: Badge = {
          id: generateId(),
          name: card.effect.badgeName,
          emoji: card.effect.badgeEmoji,
          description: `抽卡獎勵：${card.name}`,
          groupId,
          unlockedAt: Date.now(),
        }
        classData.value.badges.push(newBadge)
        break
      }
      case 'privilege':
      case 'mystery':
        // 特權與神秘獎勵由老師口頭兌現，不做資料變動
        break
    }

    draw.applied = true
    saveToStorage()
  }

  function getDrawsBySession(sessionId: string): RewardDraw[] {
    return classData.value.rewardDraws.filter(d => d.sessionId === sessionId)
  }

  function addStampsToGroup(groupId: string, count: number) {
    getStudentsByGroup(groupId).forEach(s => {
      s.stamps = (s.stamps ?? 0) + count
    })
    saveToStorage()
  }

  // --- Reward pool CRUD ---

  function addRewardCard(card: Omit<RewardCard, 'id'>) {
    classData.value.rewardPool.push({ ...card, id: generateId() })
    saveToStorage()
  }

  function updateRewardCard(id: string, updates: Partial<Omit<RewardCard, 'id'>>) {
    const card = classData.value.rewardPool.find(c => c.id === id)
    if (!card) return
    Object.assign(card, updates)
    saveToStorage()
  }

  function removeRewardCard(id: string) {
    classData.value.rewardPool = classData.value.rewardPool.filter(c => c.id !== id)
    saveToStorage()
  }

  function resetRewardPool() {
    classData.value.rewardPool = DEFAULT_REWARD_POOL.map(c => ({ ...c }))
    saveToStorage()
  }

  // --- Class settings ---

  function updateClassName(name: string, semester: string) {
    classData.value.name = name
    classData.value.semester = semester
    saveToStorage()
  }

  function updateGroupName(groupId: string, name: string) {
    const group = getGroupById(groupId)
    if (group) {
      group.name = name
      saveToStorage()
    }
  }

  function resetAllData() {
    classData.value = createDefaultClassData()
    saveToStorage()
  }

  function clearTodayScores() {
    const start = getTodayStart()
    classData.value.scoreEvents = classData.value.scoreEvents.filter(e => e.timestamp < start)
    saveToStorage()
  }

  return {
    classData,
    initialized,
    groups,
    students,
    scoreEvents,
    badges,
    lessons,
    rewardDraws,
    rewardPool,
    activeLesson,
    init,
    getStudentsByGroup,
    getStudentById,
    getGroupById,
    getGroupScore,
    getStudentScore,
    getGroupTodayScore,
    getGroupWeekScore,
    getCategoryBreakdown,
    todayEvents,
    weekEvents,
    recentEvents,
    startLesson,
    endActiveLesson,
    cancelActiveLesson,
    getLessonById,
    getLessonEvents,
    addScoreEvent,
    addGroupScoreEvent,
    addStudentScoreEvent,
    undoLastEvent,
    addStudent,
    removeStudent,
    updateStudent,
    addStudentNote,
    unlockBadge,
    getUnlockedBadges,
    drawRandomCard,
    recordDraw,
    applyRewardDraw,
    getDrawsBySession,
    addStampsToGroup,
    addRewardCard,
    updateRewardCard,
    removeRewardCard,
    resetRewardPool,
    updateClassName,
    updateGroupName,
    resetAllData,
    clearTodayScores,
  }
})
