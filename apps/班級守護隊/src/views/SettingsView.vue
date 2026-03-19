<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClassStore } from '../stores/classStore'
import { ANIMAL_CONFIG } from '../types'
import type { Student } from '../types'

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
            <span class="text-4xl">{{ ANIMAL_CONFIG[group.animal].emoji }}</span>
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
                {{ ANIMAL_CONFIG[g.animal].emoji }} {{ g.name }}
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
                {{ ANIMAL_CONFIG[g.animal].emoji }} {{ g.name }}
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
                  {{ ANIMAL_CONFIG[store.getGroupById(student.groupId)!.animal].emoji }}
                  {{ store.getGroupById(student.groupId)!.name }}
                </span>
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
              <td colspan="4" class="text-center py-8 text-stone-400">尚無學生資料</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

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
                  {{ ANIMAL_CONFIG[g.animal].emoji }} {{ g.name }}
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
