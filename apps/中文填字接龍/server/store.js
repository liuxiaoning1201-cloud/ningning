/**
 * 遠程對戰後端：記憶體資料庫（與前端 remoteBackend 邏輯對齊）
 */

function genId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const classes = [];
const groups = [];
const roomJoins = {}; // userId -> classId
const sessionJoins = {};
const teacherClassId = {}; // userId (teacher) -> classId
const rooms = [];
const sessions = [];

// 簡易 token 儲存（token -> { userId, displayName, email }）
const tokens = new Map();

function getClassByCode(code) {
  const norm = String(code).trim().toUpperCase();
  return classes.find((c) => c.code.toUpperCase() === norm) ?? null;
}

export const store = {
  // Auth
  createToken(userId, displayName, email) {
    const token = genId() + genId();
    tokens.set(token, { userId, displayName, email });
    return token;
  },
  getToken(token) {
    return tokens.get(token) ?? null;
  },

  // Class
  createClass(teacherId, teacherName, name) {
    const code = genId().slice(0, 8).toUpperCase();
    const c = {
      id: genId(),
      name,
      code,
      teacherId,
      teacherName,
      createdAt: new Date().toISOString(),
    };
    classes.push(c);
    teacherClassId[teacherId] = c.id;
    return c;
  },
  getTeacherClass(teacherId) {
    const classId = teacherClassId[teacherId];
    if (!classId) return null;
    return classes.find((c) => c.id === classId) ?? null;
  },
  getClassByCode(code) {
    return getClassByCode(code);
  },
  joinClass(userId, code) {
    const cls = getClassByCode(code);
    if (!cls) return null;
    roomJoins[userId] = cls.id;
    sessionJoins[userId] = cls.id;
    const gs = groups.filter((g) => g.classId === cls.id);
    return { class: cls, groups: gs };
  },
  getMyClass(userId) {
    const classId = roomJoins[userId] ?? sessionJoins[userId];
    if (!classId) return null;
    return classes.find((c) => c.id === classId) ?? null;
  },
  getMyGroups(userId, userEmail) {
    const cls = this.getMyClass(userId);
    if (!cls) return [];
    const emailLower = String(userEmail).trim().toLowerCase();
    return groups.filter(
      (g) => g.classId === cls.id && g.memberEmails.some((e) => String(e).trim().toLowerCase() === emailLower)
    );
  },
  getMyClassAndGroups(userId, userEmail) {
    const cls = this.getMyClass(userId);
    if (!cls) return null;
    const emailLower = String(userEmail).trim().toLowerCase();
    const gs = groups.filter(
      (g) =>
        g.classId === cls.id &&
        g.memberEmails.some((e) => String(e).trim().toLowerCase() === emailLower)
    );
    return { class: cls, groups: gs };
  },

  // Groups
  createGroup(classId, name) {
    const g = {
      id: genId(),
      classId,
      name,
      memberEmails: [],
      createdAt: new Date().toISOString(),
    };
    groups.push(g);
    return g;
  },
  updateGroupMembers(groupId, memberEmails) {
    const g = groups.find((x) => x.id === groupId);
    if (g) g.memberEmails = memberEmails.map((e) => String(e).trim()).filter(Boolean);
  },
  removeGroup(groupId) {
    const i = groups.findIndex((g) => g.id === groupId);
    if (i >= 0) groups.splice(i, 1);
  },
  getGroupsByClassId(classId) {
    return groups.filter((g) => g.classId === classId);
  },
  getRoomsByClassId(classId) {
    return rooms.filter((r) => r.classId === classId);
  },

  // Rooms
  createRoom(hostId, hostName, puzzleId, puzzleTitle, classId, groupId, puzzleSnapshot = null) {
    const r = {
      id: genId(),
      puzzleId,
      puzzleTitle,
      puzzleSnapshot,
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
    rooms.push(r);
    return r;
  },
  getRoom(roomId) {
    return rooms.find((r) => r.id === roomId) ?? null;
  },
  joinRoom(roomId, userId, displayName, email) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== "waiting") return null;
    if (room.members.some((m) => m.userId === userId)) return room;
    room.members.push({ userId, displayName, email });
    return room;
  },
  startRoom(roomId, puzzleId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== "waiting") return false;
    room.status = "playing";
    room.puzzleId = puzzleId;
    return true;
  },
  setRoomCell(roomId, cellKey, value, userId) {
    const room = this.getRoom(roomId);
    if (!room || room.status !== "playing") return false;
    room.sharedAnswers[cellKey] = value;
    room.filledBy[cellKey] = userId;
    return true;
  },
  endRoom(roomId) {
    const room = this.getRoom(roomId);
    if (room) room.status = "ended";
  },

  // Sessions
  createSession(hostId, hostName, puzzleId, puzzleTitle, classId, durationMinutes, showHints, puzzleSnapshot = null) {
    const s = {
      id: genId(),
      puzzleId,
      puzzleTitle,
      puzzleSnapshot,
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
    sessions.push(s);
    return s;
  },
  getSession(sessionId) {
    return sessions.find((s) => s.id === sessionId) ?? null;
  },
  getSessionsByClassId(classId) {
    return sessions.filter((s) => s.classId === classId).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  },
  joinSession(sessionId, userId, displayName, email) {
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
    return session;
  },
  startSession(sessionId) {
    const session = this.getSession(sessionId);
    if (!session || session.status !== "waiting") return false;
    session.status = "playing";
    session.startedAt = new Date().toISOString();
    const end = new Date();
    end.setMinutes(end.getMinutes() + session.durationMinutes);
    session.endsAt = end.toISOString();
    return true;
  },
  setSessionAnswer(sessionId, userId, cellKey, value) {
    const session = this.getSession(sessionId);
    if (!session || session.status !== "playing") return false;
    const p = session.participants.find((x) => x.userId === userId);
    if (!p) return false;
    p.answers[cellKey] = value;
    return true;
  },
  endSession(sessionId) {
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
  },
  getRankings(sessionId) {
    const session = this.getSession(sessionId);
    if (!session) return [];
    return session.participants
      .map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        score: p.score,
        timeMs: p.finishedAt
          ? new Date(p.finishedAt).getTime() - new Date(session.startedAt).getTime()
          : 0,
      }))
      .sort((a, b) => b.score - a.score || a.timeMs - b.timeMs);
  },
};
