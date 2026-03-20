<template>
  <div class="page teacher-page">
    <nav class="nav-bar">
      <RouterLink to="/play/remote" class="btn btn-secondary">← 遠程對戰</RouterLink>
    </nav>
    <h1 class="page-title teacher-title">教師開場</h1>
    <p class="teacher-lead muted">先選活動類型；請學生在「遠程對戰」頁<strong>登入後只輸入一個碼</strong>。<strong>6 位數字</strong>＝競賽，<strong>較長的合作碼</strong>＝小組同一張圖。</p>

    <template v-if="!currentUser">
      <div class="card">
        <p class="muted">請先在遠程對戰頁登入，再回來此頁。</p>
        <RouterLink to="/play/remote" class="btn btn-primary" style="margin-top: 0.75rem">前往登入</RouterLink>
      </div>
    </template>

    <template v-else>
      <!-- 建立班級（僅在未建立時顯眼） -->
      <div v-if="!teacherClass" class="card animate-fade-in card-spotlight">
        <h3 class="h3-compact">📚 先建立班級</h3>
        <p class="muted small-mb">建立後會取得<strong>班級碼</strong>（選修：讓學生加入後從列表進房）。發起競賽／合作可不經班級碼，直接給學生活動碼。</p>
        <div class="form-row">
          <input v-model="newClassName" type="text" placeholder="班級名稱" class="input-field" />
          <button class="btn btn-primary" :disabled="!newClassName.trim()" @click="createClass">建立班級</button>
        </div>
      </div>

      <template v-if="teacherClass">
        <!-- 班級一覽（精簡一列） -->
        <div class="card card-inline class-strip animate-fade-in">
          <span class="strip-name"><strong>{{ teacherClass.name }}</strong></span>
          <span v-if="teacherClass.code" class="strip-code muted">
            班級碼 <code class="class-code">{{ teacherClass.code }}</code>
            <button type="button" class="btn btn-secondary btn-sm" @click="copyClassCode">複製</button>
          </span>
        </div>

        <!-- 快速發起：兩種活動並排 -->
        <div class="quick-grid animate-fade-in">
          <div class="action-card action-competition">
            <h3 class="action-title">🏆 計時競賽</h3>
            <p class="action-hint muted">每人自己答，比正確與速度。給學生<strong>6 位數競賽碼</strong>。</p>
            <div class="form-stack">
              <select v-model="sessionPuzzleId" class="input-field full">
                <option value="">選擇題組</option>
                <option v-for="s in crosswordSets" :key="s.id" :value="s.id">{{ s.title }}</option>
              </select>
              <div class="form-inline">
                <label class="lbl-sm">分鐘</label>
                <input v-model.number="sessionDuration" type="number" min="1" max="60" class="input-field num" />
                <label class="chk-inline">
                  <input v-model="sessionShowHints" type="checkbox" />
                  提示
                </label>
              </div>
              <button
                class="btn btn-primary btn-block"
                :disabled="!sessionPuzzleId || creatingSession"
                @click="createSession"
              >
                {{ creatingSession ? "建立中…" : "建立競賽並取得競賽碼" }}
              </button>
            </div>
            <div v-if="lastCreatedSession" class="code-box code-competition">
              <p class="code-label">請學生輸入（6 位數）</p>
              <p v-if="lastCreatedSession.joinCode" class="code-big">
                <code>{{ lastCreatedSession.joinCode }}</code>
                <button type="button" class="btn btn-secondary btn-sm" @click="copyRoomCode(String(lastCreatedSession.joinCode))">複製</button>
              </p>
              <p v-else class="muted small-mb">後端未回傳六位碼時，請從下方「進行中」進入場次查看。</p>
              <RouterLink :to="`/play/remote/session/${lastCreatedSession.id}`" class="btn btn-secondary btn-sm">教師進入場次</RouterLink>
            </div>
          </div>

          <div class="action-card action-collab">
            <h3 class="action-title">🤝 小組合作</h3>
            <p class="action-hint muted">全組<strong>同一張圖</strong>。給學生<strong>合作碼</strong>（目前為完整房間 ID，勿與六位競賽碼混淆）。</p>
            <div class="form-stack">
              <select v-model="roomPuzzleId" class="input-field full">
                <option value="">選擇題組</option>
                <option v-for="s in crosswordSets" :key="s.id" :value="s.id">{{ s.title }}</option>
              </select>
              <select v-model="roomGroupId" class="input-field full">
                <option value="">選擇小組</option>
                <option v-for="g in teacherGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
              </select>
              <button
                class="btn btn-primary btn-block"
                :disabled="!roomPuzzleId || !roomGroupId || creatingRoom"
                @click="createRoom"
              >
                {{ creatingRoom ? "建立中…" : "建立合作房並取得合作碼" }}
              </button>
            </div>
            <div v-if="lastCreatedRoom" class="code-box code-collab">
              <p class="code-label">請學生輸入（合作碼）</p>
              <p class="code-raw">
                <code>{{ lastCreatedRoom.id }}</code>
                <button type="button" class="btn btn-secondary btn-sm" @click="copyRoomCode(lastCreatedRoom.id)">複製</button>
              </p>
              <RouterLink :to="`/play/remote/room/${lastCreatedRoom.id}`" class="btn btn-secondary btn-sm">教師進入房間</RouterLink>
            </div>
          </div>
        </div>

        <details class="fold-card">
          <summary>小組名單與電郵（需小組合作時再開）</summary>
          <div class="fold-inner">
            <p class="muted small-mb">建立小組並貼上學生電郵（<code>xxxxxxx@student.isf.edu.hk</code>），每行一筆。</p>
            <div class="form-row">
              <input v-model="newGroupName" type="text" placeholder="小組名稱" class="input-field" />
              <button class="btn btn-primary" :disabled="!newGroupName.trim()" @click="addGroup">新增小組</button>
            </div>
            <div v-for="g in teacherGroups" :key="g.id" class="group-block">
              <div class="group-header">
                <strong>{{ g.name }}</strong>
                <button type="button" class="btn btn-secondary btn-sm" @click="removeGroup(g.id)">刪除</button>
              </div>
              <textarea
                v-model="groupEmails[g.id]"
                placeholder="貼上學生電郵，每行一筆"
                class="email-textarea"
                rows="3"
                @blur="saveGroupEmails(g.id)"
              />
            </div>
            <p v-if="teacherGroups.length === 0" class="muted">尚無小組，請先新增。</p>
          </div>
        </details>

        <details class="fold-card">
          <summary>進行中的競賽與合作房</summary>
          <div class="fold-inner">
            <div v-if="activeRooms.length > 0" class="list-section">
              <p class="muted">小組合作：</p>
              <RouterLink v-for="r in activeRooms" :key="r.id" :to="`/play/remote/room/${r.id}`" class="list-item">
                {{ r.puzzleTitle }} · {{ r.status === "playing" ? "進行中" : "等待中" }} · {{ r.members.length }} 人
              </RouterLink>
            </div>
            <div v-if="activeSessions.length > 0" class="list-section">
              <p class="muted">計時競賽：</p>
              <RouterLink v-for="s in activeSessions" :key="s.id" :to="`/play/remote/session/${s.id}`" class="list-item">
                {{ s.puzzleTitle }} · {{ s.status === "playing" ? "進行中" : "等待中" }} · {{ s.participants.length }} 人
              </RouterLink>
            </div>
            <p v-if="activeRooms.length === 0 && activeSessions.length === 0" class="muted">尚無進行中的活動。</p>
          </div>
        </details>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from "vue";
import { getSavedUser, fetchAuthMe } from "@/lib/api";
import type { ApiUser } from "@/lib/api";
import { useRemoteBackendStore } from "@/stores/remoteBackend";
import { usePuzzleSetsStore } from "@/stores/puzzleSets";
import {
  isRemoteApiAvailable,
  getTeacherClass,
  getGroupsByClassId,
  createClass as apiCreateClass,
  createGroup as apiCreateGroup,
  updateGroupMembers as apiUpdateGroupMembers,
  removeGroup as apiRemoveGroup,
  createRoom as apiCreateRoom,
  createSession as apiCreateSession,
  getRoomsForClass,
  getSessionsForClass,
  getTeacherHostedSessions,
} from "@/lib/remoteApi";

const currentUser = ref<ApiUser | null>(getSavedUser());
const backend = useRemoteBackendStore();
const puzzleSets = usePuzzleSetsStore();

const apiTeacherClassRef = ref<{ id: string; name: string; code: string } | null>(null);
const apiTeacherGroupsRef = ref<{ id: string; name: string; memberEmails: string[] }[]>([]);
const apiRoomsRef = ref<{ id: string; puzzleTitle: string; status: string; members: unknown[] }[]>([]);
const apiSessionsRef = ref<{ id: string; puzzleTitle: string; status: string; participants: unknown[] }[]>([]);

const newClassName = ref("");
const newGroupName = ref("");
const groupEmails = reactive<Record<string, string>>({});
const roomPuzzleId = ref("");
const roomGroupId = ref("");
const creatingRoom = ref(false);
const lastCreatedRoom = ref<{ id: string } | null>(null);
const sessionPuzzleId = ref("");
const sessionDuration = ref(5);
const sessionShowHints = ref(true);
const creatingSession = ref(false);
const lastCreatedSession = ref<{ id: string; joinCode?: string } | null>(null);

const teacherClass = computed(() => {
  if (!currentUser.value) return null;
  if (isRemoteApiAvailable()) return apiTeacherClassRef.value;
  return backend.getTeacherCurrentClass(currentUser.value.id);
});

const teacherGroups = computed(() => {
  if (!teacherClass.value) return [];
  if (isRemoteApiAvailable()) return apiTeacherGroupsRef.value;
  return backend.getGroupsByClassId(teacherClass.value.id);
});

const crosswordSets = computed(() => puzzleSets.sets.filter((s) => s.type === "crossword"));

const activeRooms = computed(() => {
  if (!teacherClass.value) return [];
  if (isRemoteApiAvailable()) return apiRoomsRef.value;
  return backend.rooms.filter((r) => r.classId === teacherClass.value!.id && (r.status === "waiting" || r.status === "playing"));
});

const activeSessions = computed(() => {
  if (!teacherClass.value) return [];
  if (isRemoteApiAvailable()) return apiSessionsRef.value;
  return backend.getSessionsByClassId(teacherClass.value.id).filter((s) => s.status === "waiting" || s.status === "playing");
});

async function loadApiData() {
  if (!isRemoteApiAvailable() || !currentUser.value) return;
  const cls = await getTeacherClass();
  if (cls) {
    apiTeacherClassRef.value = cls;
    apiTeacherGroupsRef.value = await getGroupsByClassId(cls.id);
    apiRoomsRef.value = await getRoomsForClass(cls.id);
    apiSessionsRef.value = await getSessionsForClass(cls.id);
    return;
  }
  const me = await fetchAuthMe();
  if (me?.role === "teacher") {
    apiTeacherClassRef.value = {
      id: `virtual-${currentUser.value.id}`,
      name: "線上教學",
      code: "",
    };
    apiTeacherGroupsRef.value = [];
    apiRoomsRef.value = [];
    apiSessionsRef.value = await getTeacherHostedSessions();
    return;
  }
  apiTeacherClassRef.value = null;
  apiTeacherGroupsRef.value = [];
  apiRoomsRef.value = [];
  apiSessionsRef.value = [];
}

onMounted(() => loadApiData());
watch(currentUser, () => loadApiData(), { immediate: true });

async function createClass() {
  if (!currentUser.value || !newClassName.value.trim()) return;
  if (isRemoteApiAvailable()) {
    const c = await apiCreateClass(newClassName.value.trim());
    if (c) {
      apiTeacherClassRef.value = c;
      apiTeacherGroupsRef.value = [];
      apiRoomsRef.value = [];
      apiSessionsRef.value = [];
    }
  } else {
    backend.createClass(currentUser.value.id, currentUser.value.displayName, newClassName.value.trim());
  }
  newClassName.value = "";
}

function copyClassCode() {
  if (teacherClass.value) navigator.clipboard.writeText(teacherClass.value.code);
}

async function addGroup() {
  if (!teacherClass.value || !newGroupName.value.trim()) return;
  if (isRemoteApiAvailable()) {
    const g = await apiCreateGroup(teacherClass.value.id, newGroupName.value.trim());
    if (g) apiTeacherGroupsRef.value = [...apiTeacherGroupsRef.value, { ...g, memberEmails: [] }];
  } else {
    backend.createGroup(teacherClass.value.id, newGroupName.value.trim());
  }
  newGroupName.value = "";
}

async function removeGroup(groupId: string) {
  if (!teacherClass.value) return;
  if (isRemoteApiAvailable()) {
    await apiRemoveGroup(teacherClass.value.id, groupId);
    apiTeacherGroupsRef.value = apiTeacherGroupsRef.value.filter((g) => g.id !== groupId);
  } else {
    backend.removeGroup(groupId);
  }
}

async function saveGroupEmails(groupId: string) {
  const raw = groupEmails[groupId] ?? "";
  const emails = raw
    .split(/[\n,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
  if (!teacherClass.value) return;
  if (isRemoteApiAvailable()) {
    await apiUpdateGroupMembers(teacherClass.value.id, groupId, emails);
    const g = apiTeacherGroupsRef.value.find((x) => x.id === groupId);
    if (g) g.memberEmails = emails;
  } else {
    backend.updateGroupMembers(groupId, emails);
  }
}

async function createRoom() {
  if (!currentUser.value || !teacherClass.value || !roomPuzzleId.value || !roomGroupId.value) return;
  const set = puzzleSets.sets.find((s) => s.id === roomPuzzleId.value && s.type === "crossword");
  creatingRoom.value = true;
  lastCreatedRoom.value = null;
  try {
    if (isRemoteApiAvailable()) {
      const room = await apiCreateRoom({
        puzzleId: roomPuzzleId.value,
        puzzleTitle: set?.title ?? "填字題",
        classId: teacherClass.value.id,
        groupId: roomGroupId.value,
        puzzleSnapshot: set?.crossword ?? undefined,
      });
      if (room) {
        lastCreatedRoom.value = { id: room.id };
        apiRoomsRef.value = await getRoomsForClass(teacherClass.value.id);
      }
    } else {
      const room = backend.createRoom(
        currentUser.value.id,
        currentUser.value.displayName,
        roomPuzzleId.value,
        set?.title ?? "填字題",
        teacherClass.value.id,
        roomGroupId.value,
        set?.crossword ?? null
      );
      lastCreatedRoom.value = { id: room.id };
    }
  } finally {
    creatingRoom.value = false;
  }
}

function copyRoomCode(roomId: string) {
  navigator.clipboard.writeText(roomId);
}

async function createSession() {
  if (!currentUser.value || !teacherClass.value || !sessionPuzzleId.value) return;
  const set = puzzleSets.sets.find((s) => s.id === sessionPuzzleId.value && s.type === "crossword");
  creatingSession.value = true;
  lastCreatedSession.value = null;
  try {
    if (isRemoteApiAvailable()) {
      const session = await apiCreateSession({
        puzzleId: sessionPuzzleId.value,
        puzzleTitle: set?.title ?? "填字題",
        classId: teacherClass.value.id,
        durationMinutes: sessionDuration.value,
        showHints: sessionShowHints.value,
        puzzleSnapshot: set?.crossword ?? undefined,
        mode: "class",
      });
      if (session) {
        lastCreatedSession.value = { id: session.id, joinCode: session.joinCode };
        if (teacherClass.value.id.startsWith("virtual-")) {
          apiSessionsRef.value = await getTeacherHostedSessions();
        } else {
          apiSessionsRef.value = await getSessionsForClass(teacherClass.value.id);
        }
      }
    } else {
      const session = backend.createSession(
        currentUser.value.id,
        currentUser.value.displayName,
        sessionPuzzleId.value,
        set?.title ?? "填字題",
        teacherClass.value.id,
        sessionDuration.value,
        sessionShowHints.value,
        set?.crossword ?? null
      );
      lastCreatedSession.value = { id: session.id };
    }
  } finally {
    creatingSession.value = false;
  }
}

watch(teacherGroups, (groups) => {
  groups.forEach((g) => {
    const id = g.id;
    const emails = "memberEmails" in g ? (g as { memberEmails: string[] }).memberEmails : [];
    if (!(id in groupEmails)) groupEmails[id] = Array.isArray(emails) ? emails.join("\n") : "";
  });
}, { immediate: true });
</script>

<style scoped>
.teacher-page { max-width: 900px; margin: 0 auto; }
.teacher-title { font-family: var(--font-heading); margin-bottom: 0.35rem; }
.teacher-lead { font-size: 0.9rem; line-height: 1.5; margin-bottom: 1rem; }
.h3-compact { margin: 0 0 0.35rem; font-size: 1.1rem; }
.small-mb { margin-bottom: 0.65rem; }
.card-spotlight { border: 2px dashed var(--border, #e5d5c3); }
.class-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  padding: 0.65rem 1rem;
  margin-bottom: 1rem;
}
.strip-code { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 0.35rem; }
.muted { color: var(--text-muted, #8B8B8B); font-size: 0.9rem; }
.form-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem; }
.form-row label { min-width: 5rem; }
.input-field { flex: 1; min-width: 160px; padding: 0.5rem 0.75rem; border: 2px solid var(--border); border-radius: 10px; }
.input-field.full { width: 100%; flex: none; }
.input-field.num { max-width: 5rem; flex: none; min-width: 0; }
.form-stack { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem; }
.form-inline { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem 0.75rem; }
.lbl-sm { font-size: 0.85rem; color: var(--text-muted); }
.chk-inline { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; cursor: pointer; }
.btn-block { width: 100%; justify-content: center; }
.class-code { font-size: 1.05rem; background: #F9F5F0; padding: 0.2rem 0.5rem; border-radius: 6px; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.85rem; }
.quick-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}
@media (min-width: 720px) {
  .quick-grid { grid-template-columns: 1fr 1fr; align-items: stretch; }
}
.action-card {
  border: 2px solid var(--border, #f0e6d8);
  border-radius: 14px;
  padding: 1rem 1rem 0.85rem;
  background: #fff;
}
.action-competition { border-color: #fcd34d; background: linear-gradient(180deg, #fffbeb 0%, #fff 50%); }
.action-collab { border-color: #a5b4fc; background: linear-gradient(180deg, #eef2ff 0%, #fff 50%); }
.action-title { margin: 0 0 0.35rem; font-size: 1.05rem; }
.action-hint { font-size: 0.85rem; line-height: 1.45; margin: 0 0 0.25rem; }
.code-box {
  margin-top: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 10px;
  font-size: 0.9rem;
}
.code-competition { background: #ecfdf5; border: 1px solid #a7f3d0; }
.code-collab { background: #f5f3ff; border: 1px solid #ddd6fe; }
.code-label { margin: 0 0 0.35rem; font-weight: 600; font-size: 0.85rem; }
.code-big { margin: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
.code-big code { font-size: 1.35rem; font-weight: 700; letter-spacing: 0.08em; }
.code-raw { margin: 0; word-break: break-all; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.5rem; }
.code-raw code { font-size: 0.8rem; line-height: 1.4; }
.fold-card {
  margin-bottom: 0.75rem;
  border: 1px solid var(--border, #e5d5c3);
  border-radius: 12px;
  padding: 0.35rem 0.75rem;
  background: #faf8f5;
}
.fold-card summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 0.95rem;
  padding: 0.35rem 0;
}
.fold-inner { padding: 0.5rem 0 0.75rem; border-top: 1px solid var(--border); margin-top: 0.25rem; }
.group-block { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
.email-textarea { width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: 8px; font-size: 0.9rem; resize: vertical; margin-top: 0.25rem; }
.list-section { margin-top: 0.5rem; }
.list-item { display: block; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; background: #F9F5F0; border-radius: 8px; text-decoration: none; color: inherit; }
.list-item:hover { background: #FFF0F3; }
</style>
