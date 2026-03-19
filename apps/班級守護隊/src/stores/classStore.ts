import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ClassData, Student, Group, ScoreEvent, Badge, ScoreButton, ScoreCategory } from '../types'
import { DEFAULT_BADGES } from '../types'

const STORAGE_KEY = 'class-guardian-data'

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function createDefaultClassData(): ClassData {
  const g1Id = generateId()
  const g2Id = generateId()
  const g3Id = generateId()

  const students: Student[] = [
    { id: generateId(), name: '小明', seatNumber: 1, groupId: g1Id, notes: [] },
    { id: generateId(), name: '小華', seatNumber: 2, groupId: g1Id, notes: [] },
    { id: generateId(), name: '小美', seatNumber: 3, groupId: g1Id, notes: [] },
    { id: generateId(), name: '小強', seatNumber: 4, groupId: g1Id, notes: [] },
    { id: generateId(), name: '小芳', seatNumber: 5, groupId: g1Id, notes: [] },
    { id: generateId(), name: '小龍', seatNumber: 6, groupId: g2Id, notes: [] },
    { id: generateId(), name: '小玲', seatNumber: 7, groupId: g2Id, notes: [] },
    { id: generateId(), name: '小偉', seatNumber: 8, groupId: g2Id, notes: [] },
    { id: generateId(), name: '小婷', seatNumber: 9, groupId: g2Id, notes: [] },
    { id: generateId(), name: '小傑', seatNumber: 10, groupId: g2Id, notes: [] },
    { id: generateId(), name: '小雯', seatNumber: 11, groupId: g3Id, notes: [] },
    { id: generateId(), name: '小智', seatNumber: 12, groupId: g3Id, notes: [] },
    { id: generateId(), name: '小蓉', seatNumber: 13, groupId: g3Id, notes: [] },
    { id: generateId(), name: '小豪', seatNumber: 14, groupId: g3Id, notes: [] },
    { id: generateId(), name: '小琪', seatNumber: 15, groupId: g3Id, notes: [] },
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
    createdAt: Date.now(),
  }
}

export const useClassStore = defineStore('classStore', () => {
  const classData = ref<ClassData>(createDefaultClassData())
  const initialized = ref(false)

  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      try {
        classData.value = JSON.parse(raw)
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

  // --- Actions ---
  function addScoreEvent(
    targetType: 'student' | 'group',
    targetId: string,
    groupId: string,
    button: ScoreButton,
    note?: string
  ) {
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

  function addStudent(name: string, seatNumber: number, groupId: string) {
    const student: Student = {
      id: generateId(),
      name,
      seatNumber,
      groupId,
      notes: [],
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
    updateClassName,
    updateGroupName,
    resetAllData,
    clearTodayScores,
  }
})
