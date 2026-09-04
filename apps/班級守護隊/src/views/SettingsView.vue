<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG, CATEGORY_LABELS, CATEGORY_EMOJIS, CATEGORY_COLORS, SPINNER_CATEGORY_CONFIG } from '../types'
import type { Student, ScoreButton, ScoreCategory, SpinnerItem, SpinnerCategory } from '../types'
import RewardPoolEditor from '../components/RewardPoolEditor.vue'

const store = useClassStore()

const className = ref(store.classData.name)
const semester = ref(store.classData.semester)
const classInfoSaved = ref(false)

function saveClassInfo() {
  store.updateClassName(className.value.trim(), semester.value.trim())
  classInfoSaved.value = true
  setTimeout(() => { classInfoSaved.value = false }, 2000)
}

const groupNames = ref<Record<string, string>>(
  Object.fromEntries(store.groups.map(g => [g.id, g.name]))
)

function saveGroupName(groupId: string) {
  const name = groupNames.value[groupId]?.trim()
  if (name) store.updateGroupName(groupId, name)
}

const newStudentName = ref('')
const newStudentSeat = ref<number | undefined>(undefined)
const newStudentGroup = ref(store.groups[0]?.id ?? '')

function addNewStudent() {
  const name = newStudentName.value.trim()
  if (!name || !newStudentSeat.value || !newStudentGroup.value) return
  store.addStudent(name, newStudentSeat.value, newStudentGroup.value)
  newStudentName.value = ''
  newStudentSeat.value = undefined
}

// 批量貼上：逗號或換行分隔的姓名
const batchPasteText = ref('')
const batchPasteGroupMode = ref<'roundRobin' | 'single'>('roundRobin')
const batchPasteTargetGroup = ref(store.groups[0]?.id ?? '')
const batchPasteMessage = ref<{ type: 'success' | 'error'; text: string } | null>(null)

function parseBatchNames(raw: string): string[] {
  return raw
    .split(/[,，\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
}

function addBatchStudents() {
  const names = parseBatchNames(batchPasteText.value)
  if (names.length === 0) {
    batchPasteMessage.value = { type: 'error', text: '請貼上至少一個姓名（用逗號或換行分隔）' }
    setTimeout(() => { batchPasteMessage.value = null }, 3000)
    return
  }

  const maxSeat = sortedStudents.value.length > 0
    ? Math.max(...store.students.map(s => s.seatNumber))
    : 0
  const groups = store.groups

  names.forEach((name, i) => {
    const seatNumber = maxSeat + i + 1
    const groupId = batchPasteGroupMode.value === 'single'
      ? batchPasteTargetGroup.value
      : groups[i % groups.length].id
    store.addStudent(name, seatNumber, groupId)
  })

  batchPasteMessage.value = { type: 'success', text: `已新增 ${names.length} 位學生` }
  batchPasteText.value = ''
  setTimeout(() => { batchPasteMessage.value = null }, 3000)
}

const editingStudent = ref<Student | null>(null)
const editName = ref('')
const editSeat = ref(0)
const editGroup = ref('')

function openEditModal(student: Student) {
  editingStudent.value = student
  editName.value = student.name
  editSeat.value = student.seatNumber
  editGroup.value = student.groupId
}

function saveStudentEdit() {
  if (!editingStudent.value) return
  store.updateStudent(editingStudent.value.id, {
    name: editName.value.trim(),
    seatNumber: editSeat.value,
    groupId: editGroup.value,
  })
  editingStudent.value = null
}

function deleteStudent(studentId: string) {
  const student = store.getStudentById(studentId)
  if (!student) return
  if (window.confirm(`確定要刪除學生「${student.name}」嗎？此操作無法復原。`)) {
    store.removeStudent(studentId)
  }
}

function handleClearToday() {
  if (window.confirm('確定要清除今日所有分數紀錄嗎？')) {
    store.clearTodayScores()
  }
}

function handleResetAll() {
  if (window.confirm('⚠️ 確定要重置所有資料嗎？這將刪除所有學生、分數和徽章紀錄！')) {
    if (window.confirm('再次確認：所有資料將被永久刪除，無法復原。確定繼續？')) {
      store.resetAllData()
      className.value = store.classData.name
      semester.value = store.classData.semester
      groupNames.value = Object.fromEntries(store.groups.map(g => [g.id, g.name]))
      newStudentGroup.value = store.groups[0]?.id ?? ''
    }
  }
}

const sortedStudents = computed(() =>
  [...store.students].sort((a, b) => a.seatNumber - b.seatNumber)
)

// ===== Score Button Management =====
const scoreBtnFilter = ref<ScoreCategory | 'all'>('all')
const filteredScoreButtons = computed(() => {
  const btns = store.scoreButtons
  if (scoreBtnFilter.value === 'all') return btns
  return btns.filter(b => b.category === scoreBtnFilter.value)
})

interface EditingScoreBtn {
  id?: string
  label: string
  emoji: string
  points: number
  category: ScoreCategory
  targetType: 'student' | 'group'
}

const editingScoreBtn = ref<EditingScoreBtn | null>(null)

function openNewScoreBtn() {
  editingScoreBtn.value = { label: '', emoji: '⭐', points: 1, category: 'learning', targetType: 'student' }
}

function openEditScoreBtn(btn: ScoreButton) {
  editingScoreBtn.value = { id: btn.id, label: btn.label, emoji: btn.emoji, points: btn.points, category: btn.category, targetType: btn.targetType }
}

function saveScoreBtn() {
  const e = editingScoreBtn.value
  if (!e || !e.label.trim()) return
  if (e.id) {
    store.updateScoreButton(e.id, { label: e.label.trim(), emoji: e.emoji, points: e.points, category: e.category, targetType: e.targetType })
  } else {
    store.addScoreButton({ label: e.label.trim(), emoji: e.emoji, points: e.points, category: e.category, targetType: e.targetType })
  }
  editingScoreBtn.value = null
}

function deleteScoreBtn(id: string) {
  if (window.confirm('確定刪除此計分按鈕？')) store.removeScoreButton(id)
}

// ===== Spinner Management =====
const spinnerTab = ref<SpinnerCategory | 'weights'>('weights')
const spinnerWeights = ref({ ...store.spinnerConfig.weights })

function saveSpinnerWeights() {
  store.updateSpinnerWeights(spinnerWeights.value)
}

const filteredSpinnerItems = computed(() => {
  if (spinnerTab.value === 'weights') return []
  return store.spinnerConfig.items.filter(i => i.category === spinnerTab.value)
})

interface EditingSpinnerItem {
  id?: string
  label: string
  emoji: string
  description: string
  category: SpinnerCategory
}

const editingSpinnerItem = ref<EditingSpinnerItem | null>(null)

function openNewSpinnerItem() {
  const cat = spinnerTab.value === 'weights' ? 'reward' : spinnerTab.value
  editingSpinnerItem.value = { label: '', emoji: '🎁', description: '', category: cat }
}

function openEditSpinnerItem(item: SpinnerItem) {
  editingSpinnerItem.value = { id: item.id, label: item.label, emoji: item.emoji, description: item.description, category: item.category }
}

function saveSpinnerItem() {
  const e = editingSpinnerItem.value
  if (!e || !e.label.trim()) return
  if (e.id) {
    store.updateSpinnerItem(e.id, { label: e.label.trim(), emoji: e.emoji, description: e.description.trim(), category: e.category })
  } else {
    store.addSpinnerItem({ label: e.label.trim(), emoji: e.emoji, description: e.description.trim(), category: e.category })
  }
  editingSpinnerItem.value = null
}

function deleteSpinnerItem(id: string) {
  if (window.confirm('確定刪除此轉盤項目？')) store.removeSpinnerItem(id)
}

function resetSpinner() {
  if (window.confirm('還原為預設轉盤設定？您的自訂項目將被覆蓋。')) {
    store.resetSpinnerConfig()
    spinnerWeights.value = { ...store.spinnerConfig.weights }
  }
}

const totalSpinnerWeight = computed(() => spinnerWeights.value.reward + spinnerWeights.value.punishment + spinnerWeights.value.reversal)
function weightPercent(w: number) {
  return totalSpinnerWeight.value > 0 ? Math.round((w / totalSpinnerWeight.value) * 100) : 0
}
</script>

<template>
  <div class="p-6 max-w-4xl mx-auto space-y-8">
    <h1 class="text-2xl font-bold text-stone-700 flex items-center gap-2">
      <span class="text-2xl">⚙️</span> 設定
    </h1>

    <!-- 班級資訊 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-lg font-semibold text-stone-700 mb-4">📋 班級資訊</h2>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-stone-600 mb-1">班級名稱</label>
          <input
            v-model="className"
            type="text"
            class="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300"
            placeholder="例：五年級一班"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-stone-600 mb-1">學期</label>
          <input
            v-model="semester"
            type="text"
            class="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 focus:border-violet-300"
            placeholder="例：114學年第二學期"
          />
        </div>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <button
          @click="saveClassInfo"
          class="px-5 py-2 bg-violet-500 text-white rounded-xl text-sm font-medium hover:bg-violet-600 transition-colors"
        >
          儲存班級資訊
        </button>
        <span v-if="classInfoSaved" class="text-sm text-green-600">✓ 已儲存</span>
      </div>
    </section>

    <!-- 小組管理 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-lg font-semibold text-stone-700 mb-4">🐾 小組管理</h2>
      <div class="grid grid-cols-3 gap-4">
        <div
          v-for="group in store.groups"
          :key="group.id"
          class="rounded-xl p-4 border-2"
          :style="{
            backgroundColor: ANIMAL_CONFIG[group.animal].lightColor,
            borderColor: ANIMAL_CONFIG[group.animal].color,
          }"
        >
          <div class="text-center mb-3">
            <img
              :src="ANIMAL_CONFIG[group.animal].avatar"
              :alt="`${group.name} 頭像`"
              class="w-16 h-16 rounded-full object-cover border-2 mx-auto"
              :style="{ borderColor: ANIMAL_CONFIG[group.animal].color }"
            />
          </div>
          <label class="block text-xs font-medium text-stone-500 mb-1">組名</label>
          <input
            v-model="groupNames[group.id]"
            @blur="saveGroupName(group.id)"
            type="text"
            class="w-full px-3 py-1.5 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
          />
          <div class="mt-3">
            <p class="text-xs text-stone-400 mb-1">組員（{{ store.getStudentsByGroup(group.id).length }} 人）</p>
            <div class="space-y-1">
              <p
                v-for="s in store.getStudentsByGroup(group.id)"
                :key="s.id"
                class="text-sm text-stone-600"
              >
                {{ s.seatNumber }}號 {{ s.name }}
              </p>
              <p
                v-if="store.getStudentsByGroup(group.id).length === 0"
                class="text-xs text-stone-400 italic"
              >
                尚無組員
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 學生管理 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-lg font-semibold text-stone-700 mb-4">👩‍🎓 學生管理</h2>

      <div class="bg-stone-50 rounded-xl p-4 mb-6">
        <h3 class="text-sm font-medium text-stone-600 mb-3">新增學生</h3>
        <div class="flex gap-3 items-end">
          <div class="flex-1">
            <label class="block text-xs text-stone-500 mb-1">姓名</label>
            <input
              v-model="newStudentName"
              type="text"
              class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
              placeholder="學生姓名"
            />
          </div>
          <div class="w-24">
            <label class="block text-xs text-stone-500 mb-1">座號</label>
            <input
              v-model.number="newStudentSeat"
              type="number"
              min="1"
              class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
              placeholder="座號"
            />
          </div>
          <div class="w-36">
            <label class="block text-xs text-stone-500 mb-1">小組</label>
            <select
              v-model="newStudentGroup"
              class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            >
              <option v-for="g in store.groups" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </div>
          <button
            @click="addNewStudent"
            :disabled="!newStudentName.trim() || !newStudentSeat"
            class="px-5 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            新增
          </button>
        </div>
      </div>

      <div class="bg-violet-50/50 rounded-xl p-4 mb-6 border border-violet-100">
        <h3 class="text-sm font-medium text-stone-600 mb-3">📋 批量貼上</h3>
        <p class="text-xs text-stone-500 mb-2">
          複製學生姓名，用逗號（, 或 ，）或換行分隔，貼上後一鍵新增。座號將自動接續現有學生。
        </p>
        <textarea
          v-model="batchPasteText"
          rows="3"
          placeholder="例：小明, 小華, 小美, 小強（逗號或換行分隔）"
          class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white placeholder:text-stone-300 resize-y mb-3"
        />
        <div class="flex flex-wrap gap-4 items-center">
          <div class="flex items-center gap-2">
            <span class="text-xs text-stone-500">分配方式：</span>
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input v-model="batchPasteGroupMode" type="radio" value="roundRobin" class="text-violet-500" />
              <span class="text-sm">輪流分配三組</span>
            </label>
            <label class="inline-flex items-center gap-1.5 cursor-pointer">
              <input v-model="batchPasteGroupMode" type="radio" value="single" class="text-violet-500" />
              <span class="text-sm">全部加入</span>
            </label>
            <select
              v-if="batchPasteGroupMode === 'single'"
              v-model="batchPasteTargetGroup"
              class="px-2 py-1 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white"
            >
              <option v-for="g in store.groups" :key="g.id" :value="g.id">
                {{ g.name }}
              </option>
            </select>
          </div>
          <button
            @click="addBatchStudents"
            :disabled="!parseBatchNames(batchPasteText).length"
            class="px-5 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            批量新增
          </button>
          <span
            v-if="batchPasteMessage"
            class="text-sm"
            :class="batchPasteMessage.type === 'success' ? 'text-green-600' : 'text-red-600'"
          >
            {{ batchPasteMessage.text }}
          </span>
        </div>
      </div>

      <div class="overflow-hidden rounded-xl border border-stone-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-stone-50 text-stone-500">
              <th class="text-left px-4 py-3 font-medium">座號</th>
              <th class="text-left px-4 py-3 font-medium">姓名</th>
              <th class="text-left px-4 py-3 font-medium">小組</th>
              <th class="text-center px-4 py-3 font-medium">🎖 印章</th>
              <th class="text-right px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(student, idx) in sortedStudents"
              :key="student.id"
              :class="idx % 2 === 0 ? 'bg-white' : 'bg-stone-50/50'"
              class="border-t border-stone-100"
            >
              <td class="px-4 py-2.5 text-stone-600">{{ student.seatNumber }}</td>
              <td class="px-4 py-2.5 text-stone-700 font-medium">{{ student.name }}</td>
              <td class="px-4 py-2.5">
                <span
                  v-if="store.getGroupById(student.groupId)"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                  :style="{
                    backgroundColor: ANIMAL_CONFIG[store.getGroupById(student.groupId)!.animal].lightColor,
                    color: ANIMAL_CONFIG[store.getGroupById(student.groupId)!.animal].darkColor,
                  }"
                >
                  <img
                    :src="ANIMAL_CONFIG[store.getGroupById(student.groupId)!.animal].avatar"
                    :alt="`${store.getGroupById(student.groupId)!.name} 頭像`"
                    class="w-4 h-4 rounded-full object-cover"
                  />
                  {{ store.getGroupById(student.groupId)!.name }}
                </span>
              </td>
              <td class="px-4 py-2.5 text-center">
                <span v-if="(student.stamps ?? 0) > 0" class="text-sm font-bold text-amber-600">🎖 {{ student.stamps }}</span>
                <span v-else class="text-xs text-stone-300">—</span>
              </td>
              <td class="px-4 py-2.5 text-right">
                <button
                  @click="openEditModal(student)"
                  class="px-3 py-1 text-xs text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                >
                  編輯
                </button>
                <button
                  @click="deleteStudent(student.id)"
                  class="px-3 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                >
                  刪除
                </button>
              </td>
            </tr>
            <tr v-if="sortedStudents.length === 0">
              <td colspan="5" class="text-center py-8 text-stone-400">尚無學生資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- 計分按鈕管理 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-lg font-semibold text-stone-700 flex items-center gap-2">
          <span>✏️</span> 計分按鈕管理
        </h2>
        <div class="flex gap-2">
          <button
            @click="store.resetScoreButtons()"
            class="px-4 py-2 bg-stone-100 text-stone-600 rounded-lg text-sm hover:bg-stone-200 transition-colors cursor-pointer"
          >
            還原預設
          </button>
          <button
            @click="openNewScoreBtn"
            class="px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors cursor-pointer"
          >
            ＋ 新增按鈕
          </button>
        </div>
      </div>

      <div class="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        <button
          @click="scoreBtnFilter = 'all'"
          class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border"
          :class="scoreBtnFilter === 'all' ? 'bg-stone-700 text-white border-stone-700' : 'bg-stone-50 text-stone-500 border-stone-200 hover:bg-stone-100'"
        >
          全部
        </button>
        <button
          v-for="(label, key) in CATEGORY_LABELS"
          :key="key"
          @click="scoreBtnFilter = key"
          class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border flex items-center gap-1"
          :style="scoreBtnFilter === key
            ? { backgroundColor: CATEGORY_COLORS[key].bar, color: 'white', borderColor: CATEGORY_COLORS[key].bar }
            : { backgroundColor: CATEGORY_COLORS[key].bg, color: CATEGORY_COLORS[key].text, borderColor: CATEGORY_COLORS[key].border }"
        >
          {{ CATEGORY_EMOJIS[key] }} {{ label }}
        </button>
      </div>

      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        <div
          v-for="btn in filteredScoreButtons"
          :key="btn.id"
          class="flex items-center gap-2 p-3 rounded-xl border-2 group relative"
          :style="{ backgroundColor: CATEGORY_COLORS[btn.category].bg, borderColor: CATEGORY_COLORS[btn.category].border }"
        >
          <span class="text-xl">{{ btn.emoji }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold truncate" :style="{ color: CATEGORY_COLORS[btn.category].text }">{{ btn.label }}</p>
            <p class="text-[10px]" :style="{ color: CATEGORY_COLORS[btn.category].text }">
              {{ btn.points > 0 ? '+' : '' }}{{ btn.points }} · {{ btn.targetType === 'group' ? '小組' : '個人' }}
            </p>
          </div>
          <div class="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
            <button @click="openEditScoreBtn(btn)" class="text-xs text-violet-600 hover:bg-violet-50 px-1.5 py-1 rounded cursor-pointer">編輯</button>
            <button @click="deleteScoreBtn(btn.id)" class="text-xs text-red-500 hover:bg-red-50 px-1.5 py-1 rounded cursor-pointer">刪</button>
          </div>
        </div>
      </div>
      <p v-if="filteredScoreButtons.length === 0" class="text-center text-stone-400 py-6 text-sm">此類別尚無按鈕</p>
    </section>

    <!-- Score Button Edit Modal -->
    <Teleport to="body">
      <div
        v-if="editingScoreBtn"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        @click.self="editingScoreBtn = null"
      >
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 class="text-lg font-semibold text-stone-700 mb-4">{{ editingScoreBtn.id ? '編輯按鈕' : '新增按鈕' }}</h3>
          <div class="space-y-3">
            <div class="grid grid-cols-4 gap-3">
              <div>
                <label class="block text-xs text-stone-500 mb-1">圖示</label>
                <input v-model="editingScoreBtn.emoji" type="text" maxlength="4" class="w-full px-2 py-2 border border-stone-200 rounded-lg text-xl text-center focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div class="col-span-3">
                <label class="block text-xs text-stone-500 mb-1">名稱</label>
                <input v-model="editingScoreBtn.label" type="text" class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" placeholder="例：主動發言" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-stone-500 mb-1">分數</label>
                <input v-model.number="editingScoreBtn.points" type="number" class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div>
                <label class="block text-xs text-stone-500 mb-1">對象</label>
                <select v-model="editingScoreBtn.targetType" class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-300">
                  <option value="student">個人</option>
                  <option value="group">小組</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">類別</label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="(label, key) in CATEGORY_LABELS"
                  :key="key"
                  @click="editingScoreBtn.category = key"
                  class="text-xs font-bold px-2.5 py-1.5 rounded-lg border cursor-pointer transition-all"
                  :style="editingScoreBtn.category === key
                    ? { backgroundColor: CATEGORY_COLORS[key].bar, color: 'white', borderColor: CATEGORY_COLORS[key].bar }
                    : { backgroundColor: CATEGORY_COLORS[key].bg, color: CATEGORY_COLORS[key].text, borderColor: CATEGORY_COLORS[key].border }"
                >
                  {{ CATEGORY_EMOJIS[key] }} {{ label }}
                </button>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="editingScoreBtn = null" class="px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 rounded-xl cursor-pointer">取消</button>
            <button @click="saveScoreBtn" :disabled="!editingScoreBtn.label.trim()" class="px-5 py-2 bg-violet-500 text-white rounded-xl text-sm font-bold hover:bg-violet-600 disabled:opacity-40 cursor-pointer">儲存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 獎勵卡池 -->
    <RewardPoolEditor />

    <!-- 命運轉盤設定 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <div class="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 class="text-lg font-semibold text-stone-700 flex items-center gap-2">
          <span>🎡</span> 命運轉盤設定
        </h2>
        <div class="flex gap-2">
          <button @click="resetSpinner" class="px-4 py-2 bg-stone-100 text-stone-600 rounded-lg text-sm hover:bg-stone-200 transition-colors cursor-pointer">還原預設</button>
          <button v-if="spinnerTab !== 'weights'" @click="openNewSpinnerItem" class="px-4 py-2 bg-violet-500 text-white rounded-lg text-sm font-medium hover:bg-violet-600 transition-colors cursor-pointer">＋ 新增項目</button>
        </div>
      </div>

      <p class="text-xs text-stone-500 mb-4">下課結算時，抽卡結束後會出現命運轉盤。轉盤分為獎勵、挑戰（知識複習）、反轉三種類型。</p>

      <div class="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        <button
          @click="spinnerTab = 'weights'"
          class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border"
          :class="spinnerTab === 'weights' ? 'bg-stone-700 text-white border-stone-700' : 'bg-stone-50 text-stone-500 border-stone-200'"
        >
          ⚖️ 佔比設定
        </button>
        <button
          v-for="(cfg, key) in SPINNER_CATEGORY_CONFIG"
          :key="key"
          @click="spinnerTab = key"
          class="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer border flex items-center gap-1"
          :style="spinnerTab === key
            ? { backgroundColor: cfg.color, color: 'white', borderColor: cfg.color }
            : { backgroundColor: cfg.lightColor, color: cfg.color, borderColor: cfg.color + '40' }"
        >
          {{ cfg.emoji }} {{ cfg.label }}（{{ store.spinnerConfig.items.filter(i => i.category === key).length }}）
        </button>
      </div>

      <!-- Weights tab -->
      <div v-if="spinnerTab === 'weights'" class="space-y-4">
        <div v-for="(cfg, key) in SPINNER_CATEGORY_CONFIG" :key="key" class="flex items-center gap-4">
          <span class="w-20 text-sm font-bold flex items-center gap-1" :style="{ color: cfg.color }">
            {{ cfg.emoji }} {{ cfg.label }}
          </span>
          <input
            v-model.number="spinnerWeights[key]"
            type="range"
            min="0"
            max="100"
            class="flex-1 h-2 rounded-full appearance-none cursor-pointer"
            :style="{ accentColor: cfg.color }"
            @change="saveSpinnerWeights"
          />
          <span class="w-12 text-right text-sm font-bold" :style="{ color: cfg.color }">
            {{ weightPercent(spinnerWeights[key]) }}%
          </span>
        </div>
        <div class="flex gap-3 mt-2">
          <div
            v-for="(cfg, key) in SPINNER_CATEGORY_CONFIG"
            :key="key"
            class="h-3 rounded-full transition-all duration-300"
            :style="{ width: weightPercent(spinnerWeights[key]) + '%', backgroundColor: cfg.color }"
          />
        </div>
      </div>

      <!-- Items list -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div
          v-for="item in filteredSpinnerItems"
          :key="item.id"
          class="flex items-center gap-3 p-3 rounded-xl border-2 group"
          :style="{ backgroundColor: SPINNER_CATEGORY_CONFIG[item.category].lightColor, borderColor: SPINNER_CATEGORY_CONFIG[item.category].color + '40' }"
        >
          <span class="text-2xl">{{ item.emoji }}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-stone-700 truncate">{{ item.label }}</p>
            <p class="text-xs text-stone-500 truncate">{{ item.description }}</p>
          </div>
          <div class="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
            <button @click="openEditSpinnerItem(item)" class="text-xs text-violet-600 hover:bg-violet-50 px-1.5 py-1 rounded cursor-pointer">編輯</button>
            <button @click="deleteSpinnerItem(item.id)" class="text-xs text-red-500 hover:bg-red-50 px-1.5 py-1 rounded cursor-pointer">刪</button>
          </div>
        </div>
        <p v-if="filteredSpinnerItems.length === 0" class="text-center text-stone-400 py-6 text-sm col-span-full">此類別尚無項目</p>
      </div>
    </section>

    <!-- Spinner Item Edit Modal -->
    <Teleport to="body">
      <div
        v-if="editingSpinnerItem"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
        @click.self="editingSpinnerItem = null"
      >
        <div class="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
          <h3 class="text-lg font-semibold text-stone-700 mb-4">{{ editingSpinnerItem.id ? '編輯轉盤項目' : '新增轉盤項目' }}</h3>
          <div class="space-y-3">
            <div class="grid grid-cols-4 gap-3">
              <div>
                <label class="block text-xs text-stone-500 mb-1">圖示</label>
                <input v-model="editingSpinnerItem.emoji" type="text" maxlength="4" class="w-full px-2 py-2 border border-stone-200 rounded-lg text-xl text-center focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div class="col-span-3">
                <label class="block text-xs text-stone-500 mb-1">名稱</label>
                <input v-model="editingSpinnerItem.label" type="text" class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300" placeholder="例：背誦挑戰" />
              </div>
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">說明</label>
              <textarea v-model="editingSpinnerItem.description" rows="2" class="w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" placeholder="簡短描述" />
            </div>
            <div>
              <label class="block text-xs text-stone-500 mb-1">類別</label>
              <div class="flex gap-2">
                <button
                  v-for="(cfg, key) in SPINNER_CATEGORY_CONFIG"
                  :key="key"
                  @click="editingSpinnerItem.category = key"
                  class="flex-1 text-xs font-bold py-2 rounded-lg border-2 cursor-pointer transition-all"
                  :style="editingSpinnerItem.category === key
                    ? { backgroundColor: cfg.color, color: 'white', borderColor: cfg.color }
                    : { backgroundColor: cfg.lightColor, color: cfg.color, borderColor: cfg.color + '40' }"
                >
                  {{ cfg.emoji }} {{ cfg.label }}
                </button>
              </div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-5">
            <button @click="editingSpinnerItem = null" class="px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 rounded-xl cursor-pointer">取消</button>
            <button @click="saveSpinnerItem" :disabled="!editingSpinnerItem.label.trim()" class="px-5 py-2 bg-violet-500 text-white rounded-xl text-sm font-bold hover:bg-violet-600 disabled:opacity-40 cursor-pointer">儲存</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 資料管理 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-lg font-semibold text-stone-700 mb-4">🗃️ 資料管理</h2>
      <div class="space-y-4">
        <div class="flex items-center justify-between p-4 bg-amber-50 rounded-xl border border-amber-200">
          <div>
            <p class="text-sm font-medium text-amber-800">清除今日分數</p>
            <p class="text-xs text-amber-600 mt-0.5">僅清除今天的評分紀錄，歷史紀錄不受影響</p>
          </div>
          <button
            @click="handleClearToday"
            class="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors"
          >
            清除今日
          </button>
        </div>
        <div class="flex items-center justify-between p-4 bg-red-50 rounded-xl border border-red-200">
          <div>
            <p class="text-sm font-medium text-red-800">重置所有資料</p>
            <p class="text-xs text-red-600 mt-0.5">永久刪除所有資料，包括學生、分數、徽章，恢復預設值</p>
          </div>
          <button
            @click="handleResetAll"
            class="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors"
          >
            重置全部
          </button>
        </div>
      </div>
    </section>

    <!-- 操作說明 -->
    <section class="bg-white rounded-2xl p-6 shadow-sm border border-stone-100">
      <h2 class="text-lg font-semibold text-stone-700 mb-4">📖 操作說明</h2>
      <div class="text-sm text-stone-600 space-y-3 leading-relaxed">
        <div class="flex gap-3">
          <span class="text-lg">✏️</span>
          <p><strong>課堂記分：</strong>選擇小組或學生，點擊對應的評分按鈕即可快速加分或扣分。</p>
        </div>
        <div class="flex gap-3">
          <span class="text-lg">📺</span>
          <p><strong>學生展示：</strong>投影到教室大螢幕，學生只看到進度條和星星，看不到確切分數。</p>
        </div>
        <div class="flex gap-3">
          <span class="text-lg">📊</span>
          <p><strong>歷史紀錄：</strong>查看每日、每週的評分紀錄，可依類別和小組篩選。</p>
        </div>
        <div class="flex gap-3">
          <span class="text-lg">🐾</span>
          <p><strong>小組管理：</strong>三個小組（貓頭鷹、海獺、柴犬）的名稱可自訂，但不可增減組數。</p>
        </div>
        <div class="flex gap-3">
          <span class="text-lg">🏅</span>
          <p><strong>徽章系統：</strong>在課堂記分頁面手動頒發徽章，鼓勵學生團隊表現。</p>
        </div>
      </div>
    </section>

    <!-- Edit Modal -->
    <Teleport to="body">
      <div
        v-if="editingStudent"
        class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
        @click.self="editingStudent = null"
      >
        <div class="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl" @click.stop>
          <h3 class="text-lg font-semibold text-stone-700 mb-4">編輯學生</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-stone-600 mb-1">姓名</label>
              <input
                v-model="editName"
                type="text"
                class="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-600 mb-1">座號</label>
              <input
                v-model.number="editSeat"
                type="number"
                min="1"
                class="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-stone-600 mb-1">小組</label>
              <select
                v-model="editGroup"
                class="w-full px-4 py-2 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              >
                <option v-for="g in store.groups" :key="g.id" :value="g.id">
                  {{ g.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="flex justify-end gap-3 mt-6">
            <button
              @click="editingStudent = null"
              class="px-4 py-2 text-sm text-stone-500 hover:bg-stone-50 rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              @click="saveStudentEdit"
              class="px-5 py-2 bg-violet-500 text-white rounded-xl text-sm font-medium hover:bg-violet-600 transition-colors"
            >
              儲存
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
