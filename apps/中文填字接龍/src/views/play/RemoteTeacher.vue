<template>
  <div class="page">
    <nav class="nav-bar">
      <RouterLink to="/play/remote" class="btn btn-secondary">← 遠程對戰</RouterLink>
    </nav>
    <h1 class="page-title" style="font-family: var(--font-heading)">👩‍🏫 教師後台</h1>

    <template v-if="!currentUser">
      <div class="card">
        <p class="muted">請先至遠程對戰頁面登入後再使用教師後台。</p>
        <RouterLink to="/play/remote" class="btn btn-primary" style="margin-top: 0.75rem">前往遠程對戰</RouterLink>
      </div>
    </template>

    <template v-else>
      <!-- 建立班級 -->
      <div class="card animate-fade-in">
        <h3>📚 班級</h3>
        <template v-if="!teacherClass">
          <p class="muted">建立班級後可取得班級碼，學生輸入班級碼即可加入。</p>
          <div class="form-row">
            <input v-model="newClassName" type="text" placeholder="班級名稱" class="input-field" />
            <button class="btn btn-primary" :disabled="!newClassName.trim()" @click="createClass">建立班級</button>
          </div>
        </template>
        <template v-else>
          <p><strong>{{ teacherClass.name }}</strong></p>
          <p class="muted">班級碼：<code class="class-code">{{ teacherClass.code }}</code> <button class="btn btn-secondary btn-sm" @click="copyClassCode">複製</button></p>
        </template>
      </div>

      <template v-if="teacherClass">
        <!-- 小組管理 -->
        <div class="card animate-fade-in" style="animation-delay: 0.05s">
          <h3>👥 小組</h3>
          <p class="muted">建立小組並貼上學生電郵（<code>xxxxxxx@student.isf.edu.hk</code>），每行一筆。</p>
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
        </div>

        <!-- 發起小組合作（房間） -->
        <div class="card animate-fade-in" style="animation-delay: 0.1s">
          <h3>🤝 發起小組合作</h3>
          <p class="muted">選擇題組與小組，建立房間後將房間碼分享給該組學生。</p>
          <div class="form-row">
            <label>題組</label>
            <select v-model="roomPuzzleId" class="input-field">
              <option value="">— 選擇題組 —</option>
              <option v-for="s in crosswordSets" :key="s.id" :value="s.id">{{ s.title }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>小組</label>
            <select v-model="roomGroupId" class="input-field">
              <option value="">— 選擇小組 —</option>
              <option v-for="g in teacherGroups" :key="g.id" :value="g.id">{{ g.name }}</option>
            </select>
          </div>
          <button
            class="btn btn-primary"
            :disabled="!roomPuzzleId || !roomGroupId || creatingRoom"
            @click="createRoom"
          >
            {{ creatingRoom ? "建立中..." : "建立房間" }}
          </button>
          <div v-if="lastCreatedRoom" class="room-created">
            <p>房間已建立，房間碼：<code>{{ lastCreatedRoom.id }}</code> <button class="btn btn-secondary btn-sm" @click="copyRoomCode(lastCreatedRoom.id)">複製</button></p>
            <RouterLink :to="`/play/remote/room/${lastCreatedRoom.id}`" class="btn btn-secondary btn-sm">進入房間</RouterLink>
          </div>
        </div>

        <!-- 發起班級競賽 -->
        <div class="card animate-fade-in" style="animation-delay: 0.15s">
          <h3>🏆 發起班級競賽</h3>
          <p class="muted">選擇題組與計時，建立場次後學生在遠程對戰頁可看到並加入。</p>
          <div class="form-row">
            <label>題組</label>
            <select v-model="sessionPuzzleId" class="input-field">
              <option value="">— 選擇題組 —</option>
              <option v-for="s in crosswordSets" :key="s.id" :value="s.id">{{ s.title }}</option>
            </select>
          </div>
          <div class="form-row">
            <label>計時（分鐘）</label>
            <input v-model.number="sessionDuration" type="number" min="1" max="60" class="input-field" style="max-width: 6rem" />
          </div>
          <label class="checkbox-label">
            <input v-model="sessionShowHints" type="checkbox" />
            顯示提示
          </label>
          <button
            class="btn btn-primary"
            :disabled="!sessionPuzzleId || creatingSession"
            @click="createSession"
          >
            {{ creatingSession ? "建立中..." : "建立競賽場次" }}
          </button>
          <div v-if="lastCreatedSession" class="session-created">
            <p>場次已建立，學生可在「班級競賽」區塊看到並加入。</p>
            <RouterLink :to="`/play/remote/session/${lastCreatedSession.id}`" class="btn btn-secondary btn-sm">進入場次（教師視角）</RouterLink>
          </div>
        </div>

        <!-- 進行中的房間與場次 -->
        <div class="card animate-fade-in" style="animation-delay: 0.2s">
          <h3>📋 進行中</h3>
          <div v-if="activeRooms.length > 0" class="list-section">
            <p class="muted">小組合作房間：</p>
            <RouterLink v-for="r in activeRooms" :key="r.id" :to="`/play/remote/room/${r.id}`" class="list-item">
              {{ r.puzzleTitle }} · {{ r.status === "playing" ? "進行中" : "等待中" }} · {{ r.members.length }} 人
            </RouterLink>
          </div>
          <div v-if="activeSessions.length > 0" class="list-section">
            <p class="muted">班級競賽場次：</p>
            <RouterLink v-for="s in activeSessions" :key="s.id" :to="`/play/remote/session/${s.id}`" class="list-item">
              {{ s.puzzleTitle }} · {{ s.status === "playing" ? "進行中" : "等待中" }} · {{ s.participants.length }} 人
            </RouterLink>
          </div>
          <p v-if="activeRooms.length === 0 && activeSessions.length === 0" class="muted">尚無進行中的房間或場次。</p>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from "vue";
import { getSavedUser } from "@/lib/api";
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
const lastCreatedSession = ref<{ id: string } | null>(null);

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
  apiTeacherClassRef.value = cls;
  if (cls) {
    apiTeacherGroupsRef.value = await getGroupsByClassId(cls.id);
    apiRoomsRef.value = await getRoomsForClass(cls.id);
    apiSessionsRef.value = await getSessionsForClass(cls.id);
  } else {
    apiTeacherGroupsRef.value = [];
    apiRoomsRef.value = [];
    apiSessionsRef.value = [];
  }
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
      });
      if (session) {
        lastCreatedSession.value = { id: session.id };
        apiSessionsRef.value = await getSessionsForClass(teacherClass.value.id);
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
.muted { color: var(--text-muted, #8B8B8B); font-size: 0.9rem; }
.form-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; margin-top: 0.5rem; }
.form-row label { min-width: 5rem; }
.input-field { flex: 1; min-width: 160px; padding: 0.5rem 0.75rem; border: 2px solid var(--border); border-radius: 10px; }
.class-code { font-size: 1.1rem; background: #F9F5F0; padding: 0.2rem 0.5rem; border-radius: 6px; }
.btn-sm { padding: 0.3rem 0.6rem; font-size: 0.85rem; }
.group-block { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); }
.group-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
.email-textarea { width: 100%; padding: 0.5rem; border: 2px solid var(--border); border-radius: 8px; font-size: 0.9rem; resize: vertical; margin-top: 0.25rem; }
.checkbox-label { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; cursor: pointer; }
.room-created, .session-created { margin-top: 0.75rem; padding: 0.5rem; background: #F0FDF4; border-radius: 8px; }
.list-section { margin-top: 0.5rem; }
.list-item { display: block; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; background: #F9F5F0; border-radius: 8px; text-decoration: none; color: inherit; }
.list-item:hover { background: #FFF0F3; }
</style>
