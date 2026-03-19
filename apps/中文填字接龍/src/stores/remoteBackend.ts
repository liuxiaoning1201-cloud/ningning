/**
 * 遠程對戰 Mock 後端：班級、小組、房間（小組合作）、場次（班級競賽）。
 * 無 API URL 時使用，資料存 localStorage，可跨分頁同步（storage 事件）。
 */

import { defineStore } from "pinia";
import type { CrosswordPuzzle } from "@/lib/types";

const STORAGE_KEY = "word-puzzle:remoteBackend";

export interface RemoteClass {
  id: string;
  name: string;
  code: string;
  teacherId: string;
  teacherName: string;
  createdAt: string;
}

export interface RemoteGroup {
  id: string;
  classId: string;
  name: string;
  memberEmails: string[];
  createdAt: string;
}

export interface RemoteRoom {
  id: string;
  puzzleId: string;
  puzzleTitle: string;
  puzzleSnapshot: CrosswordPuzzle | null;
  classId: string;
  groupId: string;
  status: "waiting" | "playing" | "ended";
  hostId: string;
  hostName: string;
  members: { userId: string; displayName: string; email: string }[];
  sharedAnswers: Record<string, string>;
  filledBy: Record<string, string>;
  createdAt: string;
}

export interface RemoteSession {
  id: string;
  puzzleId: string;
  puzzleTitle: string;
  puzzleSnapshot: CrosswordPuzzle | null;
  classId: string;
  status: "waiting" | "playing" | "ended";
  hostId: string;
  hostName: string;
  durationMinutes: number;
  startedAt: string | null;
  endsAt: string | null;
  participants: {
    userId: string;
    displayName: string;
    email: string;
    answers: Record<string, string>;
    score: number;
    finishedAt: string | null;
  }[];
  showHints: boolean;
  createdAt: string;
}

export interface JoinClassResult {
  class: RemoteClass;
  groups: RemoteGroup[];
}

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadState(): {
  classes: RemoteClass[];
  groups: RemoteGroup[];
  roomJoins: Record<string, string>;
  sessionJoins: Record<string, string>;
  teacherClassId: Record<string, string>;
  rooms: RemoteRoom[];
  sessions: RemoteSession[];
} {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const data = JSON.parse(raw);
    return {
      classes: data.classes ?? [],
      groups: data.groups ?? [],
      roomJoins: data.roomJoins ?? {},
      sessionJoins: data.sessionJoins ?? {},
      teacherClassId: data.teacherClassId ?? {},
      rooms: data.rooms ?? [],
      sessions: data.sessions ?? [],
    };
  } catch {
    return getDefaultState();
  }
}

function getDefaultState() {
  return {
    classes: [] as RemoteClass[],
    groups: [] as RemoteGroup[],
    roomJoins: {} as Record<string, string>,
    sessionJoins: {} as Record<string, string>,
    teacherClassId: {} as Record<string, string>,
    rooms: [] as RemoteRoom[],
    sessions: [] as RemoteSession[],
  };
}

function saveState(state: ReturnType<typeof loadState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export const useRemoteBackendStore = defineStore("remoteBackend", {
  state: () => loadState(),

  actions: {
    _persist() {
      saveState({
        classes: this.classes,
        groups: this.groups,
        roomJoins: this.roomJoins,
        sessionJoins: this.sessionJoins,
        teacherClassId: this.teacherClassId,
        rooms: this.rooms,
        sessions: this.sessions,
      });
    },

    getTeacherCurrentClass(teacherId: string): RemoteClass | null {
      const classId = this.teacherClassId[teacherId];
      if (!classId) return null;
      return this.classes.find((c) => c.id === classId) ?? null;
    },
    setTeacherCurrentClass(teacherId: string, classId: string) {
      this.teacherClassId[teacherId] = classId;
      this._persist();
    },

    // 教師：建立班級（班級碼 = 前 6 碼）
    createClass(teacherId: string, teacherName: string, name: string): RemoteClass {
      const code = genId().slice(0, 8).toUpperCase();
      const c: RemoteClass = {
        id: genId(),
        name,
        code,
        teacherId,
        teacherName,
        createdAt: new Date().toISOString(),
      };
      this.classes.push(c);
      this.teacherClassId[teacherId] = c.id;
      this._persist();
      return c;
    },

    getClassByCode(code: string): RemoteClass | null {
      const norm = code.trim().toUpperCase();
      return this.classes.find((c) => c.code.toUpperCase() === norm) ?? null;
    },

    // 學生：加入班級（記住 userId 加入的班級）
    joinClass(userId: string, _userEmail: string, code: string): JoinClassResult | null {
      const cls = this.getClassByCode(code);
      if (!cls) return null;
      this.roomJoins[userId] = cls.id;
      this.sessionJoins[userId] = cls.id;
      this._persist();
      const groups = this.groups.filter((g) => g.classId === cls.id);
      return { class: cls, groups };
    },

    getMyClass(userId: string): RemoteClass | null {
      const classId = this.roomJoins[userId] ?? this.sessionJoins[userId];
      if (!classId) return null;
      return this.classes.find((c) => c.id === classId) ?? null;
    },

    getMyGroups(userId: string, userEmail: string): RemoteGroup[] {
      const cls = this.getMyClass(userId);
      if (!cls) return [];
      const emailLower = userEmail.trim().toLowerCase();
      return this.groups.filter((g) => g.classId === cls.id && g.memberEmails.some((e) => e.trim().toLowerCase() === emailLower));
    },

    getMyClassAndGroups(userId: string, userEmail: string): { class: RemoteClass; groups: RemoteGroup[] } | null {
      const cls = this.getMyClass(userId);
      if (!cls) return null;
      const groups = this.groups.filter(
        (g) => g.classId === cls.id && (g.memberEmails.includes(userEmail) || g.memberEmails.map((e) => e.toLowerCase()).includes(userEmail.toLowerCase()))
      );
      return { class: cls, groups };
    },

    // 教師：建立小組
    createGroup(classId: string, name: string): RemoteGroup {
      const g: RemoteGroup = {
        id: genId(),
        classId,
        name,
        memberEmails: [],
        createdAt: new Date().toISOString(),
      };
      this.groups.push(g);
      this._persist();
      return g;
    },

    updateGroupMembers(groupId: string, memberEmails: string[]) {
      const g = this.groups.find((x) => x.id === groupId);
      if (g) {
        g.memberEmails = memberEmails.map((e) => e.trim()).filter(Boolean);
        this._persist();
      }
    },

    removeGroup(groupId: string) {
      this.groups = this.groups.filter((g) => g.id !== groupId);
      this._persist();
    },

    getGroupsByClassId(classId: string): RemoteGroup[] {
      return this.groups.filter((g) => g.classId === classId);
    },

    // 小組合作：建立房間（可傳入題組快照供學生端直接渲染）
    createRoom(
      hostId: string,
      hostName: string,
      puzzleId: string,
      puzzleTitle: string,
      classId: string,
      groupId: string,
      puzzleSnapshot?: CrosswordPuzzle | null
    ): RemoteRoom {
      const r: RemoteRoom = {
        id: genId(),
        puzzleId,
        puzzleTitle,
        puzzleSnapshot: puzzleSnapshot ?? null,
        classId,
        groupId,
        status: "waiting",
        hostId,
        hostName,
        members: [],
        sharedAnswers: {},
        filledBy: {},
        createdAt: new Date().toISOString(),
      };
      this.rooms.push(r);
      this._persist();
      return r;
    },

    getRoom(roomId: string): RemoteRoom | null {
      return this.rooms.find((r) => r.id === roomId) ?? null;
    },

    joinRoom(roomId: string, userId: string, displayName: string, email: string): RemoteRoom | null {
      const room = this.getRoom(roomId);
      if (!room || room.status !== "waiting") return null;
      if (room.members.some((m) => m.userId === userId)) return room;
      room.members.push({ userId, displayName, email });
      this._persist();
      return room;
    },

    startRoom(roomId: string, puzzleId: string): boolean {
      const room = this.getRoom(roomId);
      if (!room || room.status !== "waiting") return false;
      room.status = "playing";
      room.puzzleId = puzzleId;
      this._persist();
      return true;
    },

    setRoomCell(roomId: string, cellKey: string, value: string, userId: string): boolean {
      const room = this.getRoom(roomId);
      if (!room || room.status !== "playing") return false;
      room.sharedAnswers[cellKey] = value;
      room.filledBy[cellKey] = userId;
      this._persist();
      return true;
    },

    endRoom(roomId: string): void {
      const room = this.getRoom(roomId);
      if (room) {
        room.status = "ended";
        this._persist();
      }
    },

    // 班級競賽：建立場次（可傳入題組快照）
    createSession(
      hostId: string,
      hostName: string,
      puzzleId: string,
      puzzleTitle: string,
      classId: string,
      durationMinutes: number,
      showHints: boolean,
      puzzleSnapshot?: CrosswordPuzzle | null
    ): RemoteSession {
      const s: RemoteSession = {
        id: genId(),
        puzzleId,
        puzzleTitle,
        puzzleSnapshot: puzzleSnapshot ?? null,
        classId,
        status: "waiting",
        hostId,
        hostName,
        durationMinutes,
        startedAt: null,
        endsAt: null,
        participants: [],
        showHints,
        createdAt: new Date().toISOString(),
      };
      this.sessions.push(s);
      this._persist();
      return s;
    },

    getSession(sessionId: string): RemoteSession | null {
      return this.sessions.find((s) => s.id === sessionId) ?? null;
    },

    getSessionsByClassId(classId: string): RemoteSession[] {
      return this.sessions.filter((s) => s.classId === classId).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
    },

    joinSession(sessionId: string, userId: string, displayName: string, email: string): RemoteSession | null {
      const session = this.getSession(sessionId);
      if (!session || session.status !== "waiting") return null;
      if (session.participants.some((p) => p.userId === userId)) return session;
      session.participants.push({
        userId,
        displayName,
        email,
        answers: {},
        score: 0,
        finishedAt: null,
      });
      this._persist();
      return session;
    },

    startSession(sessionId: string): boolean {
      const session = this.getSession(sessionId);
      if (!session || session.status !== "waiting") return false;
      session.status = "playing";
      session.startedAt = new Date().toISOString();
      const end = new Date();
      end.setMinutes(end.getMinutes() + session.durationMinutes);
      session.endsAt = end.toISOString();
      this._persist();
      return true;
    },

    setSessionAnswer(sessionId: string, userId: string, cellKey: string, value: string): boolean {
      const session = this.getSession(sessionId);
      if (!session || session.status !== "playing") return false;
      const p = session.participants.find((x) => x.userId === userId);
      if (!p) return false;
      p.answers[cellKey] = value;
      this._persist();
      return true;
    },

    finishSessionParticipant(sessionId: string, userId: string, correctCount: number): void {
      const session = this.getSession(sessionId);
      if (!session) return;
      const p = session.participants.find((x) => x.userId === userId);
      if (p) {
        p.score = correctCount;
        p.finishedAt = new Date().toISOString();
        this._persist();
      }
    },

    endSession(sessionId: string): void {
      const session = this.getSession(sessionId);
      if (!session || !session.puzzleSnapshot) return;
      session.status = "ended";
      session.endsAt = new Date().toISOString();
      const puzzle = session.puzzleSnapshot;
      for (const p of session.participants) {
        let correct = 0;
        for (const w of puzzle.words) {
          for (let i = 0; i < w.text.length; i++) {
            const r = w.direction === "horizontal" ? w.startRow : w.startRow + i;
            const c = w.direction === "horizontal" ? w.startCol + i : w.startCol;
            const key = `${r},${c}`;
            const ans = (p.answers[key] ?? "").trim();
            if (ans === (w.text[i] ?? "")) correct++;
          }
        }
        p.score = correct;
        if (!p.finishedAt) p.finishedAt = new Date().toISOString();
      }
      this._persist();
    },

    getRankings(sessionId: string): { userId: string; displayName: string; score: number; timeMs: number }[] {
      const session = this.getSession(sessionId);
      if (!session) return [];
      return session.participants
        .map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          score: p.score,
          timeMs: p.finishedAt ? new Date(p.finishedAt).getTime() - new Date(session.startedAt!).getTime() : 0,
        }))
        .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
    },
  },
});
