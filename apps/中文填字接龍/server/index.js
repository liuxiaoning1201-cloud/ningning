/**
 * 遠程對戰後端：Express REST + WebSocket
 * 使用方式：cd server && npm install && npm run dev
 * 環境變數：PORT=3000, API_KEY=sk-xxx（選填，可留作日後 AI 功能）
 */

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { store } from "./store.js";

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.API_KEY || ""; // 可選，例如 sk-xxx 供日後 AI 功能使用

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const user = token ? store.getToken(token) : null;
  req.user = user;
  next();
}

// ---------- Auth ----------
app.post("/auth/demo", (req, res) => {
  const { displayName, email } = req.body || {};
  if (!displayName || !email) {
    return res.status(400).json({ error: "displayName and email required" });
  }
  const userId = String(email);
  const token = store.createToken(userId, displayName, email);
  res.json({
    token,
    user: { id: userId, email, displayName },
  });
});

/** Google 登入：驗證 ID token 後發給本系統 JWT */
app.post("/auth/google", async (req, res) => {
  const { credential } = req.body || {};
  if (!credential || typeof credential !== "string") {
    return res.status(400).json({ error: "credential required" });
  }
  try {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`;
    const r = await fetch(url);
    if (!r.ok) {
      return res.status(401).json({ error: "Invalid Google credential" });
    }
    const payload = await r.json();
    const email = payload.email;
    const displayName = payload.name || payload.email?.split("@")[0] || "User";
    if (!email) {
      return res.status(401).json({ error: "Google token missing email" });
    }
    const userId = String(email);
    const token = store.createToken(userId, displayName, email);
    res.json({
      token,
      user: { id: userId, email, displayName, avatarUrl: payload.picture || undefined },
    });
  } catch (err) {
    console.error("/auth/google", err);
    res.status(500).json({ error: "Google sign-in failed" });
  }
});

// ---------- Class ----------
app.post("/api/classes", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const c = store.createClass(req.user.userId, req.user.displayName, name);
  res.json(c);
});

app.get("/api/classes/:code", (req, res) => {
  const cls = store.getClassByCode(req.params.code);
  if (!cls) return res.status(404).json({ error: "CLASS_CODE_INVALID" });
  res.json(cls);
});

app.post("/api/classes/join", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: "code required" });
  const result = store.joinClass(req.user.userId, code);
  if (!result) return res.status(404).json({ error: "CLASS_CODE_INVALID" });
  res.json(result);
});

app.post("/api/classes/:id/join", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const result = store.joinClass(req.user.userId, req.params.id);
  if (!result) return res.status(404).json({ error: "CLASS_CODE_INVALID" });
  res.json(result);
});

app.get("/api/me/class-and-groups", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const result = store.getMyClassAndGroups(req.user.userId, req.user.email);
  if (!result) return res.status(404).json({ error: "Not in any class" });
  res.json(result);
});

app.get("/api/me/teacher-class", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const cls = store.getTeacherClass(req.user.userId);
  if (!cls) return res.status(404).json({ error: "No teacher class" });
  res.json(cls);
});

app.post("/api/classes/:classId/groups", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "name required" });
  const g = store.createGroup(req.params.classId, name);
  res.json(g);
});

app.put("/api/classes/:classId/groups/:groupId", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { memberEmails } = req.body || {};
  store.updateGroupMembers(req.params.groupId, Array.isArray(memberEmails) ? memberEmails : []);
  res.json({ ok: true });
});

app.delete("/api/classes/:classId/groups/:groupId", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  store.removeGroup(req.params.groupId);
  res.json({ ok: true });
});

app.get("/api/classes/:classId/groups", authMiddleware, (req, res) => {
  const list = store.getGroupsByClassId(req.params.classId);
  res.json(list);
});

app.get("/api/classes/:classId/rooms", (req, res) => {
  const list = store.getRoomsByClassId(req.params.classId);
  res.json(list.filter((r) => r.status === "waiting" || r.status === "playing"));
});

app.get("/api/classes/:classId/sessions", (req, res) => {
  const list = store.getSessionsByClassId(req.params.classId);
  res.json(list.filter((s) => s.status === "waiting" || s.status === "playing"));
});

// ---------- Rooms ----------
app.post("/api/rooms", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { puzzleId, puzzleTitle, classId, groupId, puzzleSnapshot } = req.body || {};
  if (!puzzleId || !classId || !groupId) return res.status(400).json({ error: "puzzleId, classId, groupId required" });
  const r = store.createRoom(
    req.user.userId,
    req.user.displayName,
    puzzleId,
    puzzleTitle || "填字題",
    classId,
    groupId,
    puzzleSnapshot
  );
  res.json(r);
});

app.get("/api/rooms/:id", (req, res) => {
  const room = store.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });
  res.json(room);
});

app.post("/api/rooms/:id/join", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const room = store.joinRoom(
    req.params.id,
    req.user.userId,
    req.user.displayName,
    req.user.email
  );
  if (!room) return res.status(400).json({ error: "ROOM_FULL or not waiting" });
  res.json(room);
});

app.post("/api/rooms/:id/start", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { puzzleId } = req.body || {};
  const room = store.getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "ROOM_NOT_FOUND" });
  if (room.hostId !== req.user.userId) return res.status(403).json({ error: "Forbidden" });
  const ok = store.startRoom(req.params.id, puzzleId || room.puzzleId);
  if (!ok) return res.status(400).json({ error: "Already started or ended" });
  res.json(room);
});

app.post("/api/rooms/:id/end", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const room = store.getRoom(req.params.id);
  if (room && room.hostId === req.user.userId) store.endRoom(req.params.id);
  res.json({ ok: true });
});

// ---------- Sessions ----------
app.post("/api/sessions", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { puzzleId, puzzleTitle, classId, durationMinutes, showHints, puzzleSnapshot } = req.body || {};
  if (!puzzleId || !classId) return res.status(400).json({ error: "puzzleId, classId required" });
  const s = store.createSession(
    req.user.userId,
    req.user.displayName,
    puzzleId,
    puzzleTitle || "填字題",
    classId,
    Number(durationMinutes) || 5,
    Boolean(showHints),
    puzzleSnapshot
  );
  res.json(s);
});

app.get("/api/sessions/:id", (req, res) => {
  const session = store.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "SESSION_NOT_FOUND" });
  res.json(session);
});

app.post("/api/sessions/:id/join", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const session = store.joinSession(
    req.params.id,
    req.user.userId,
    req.user.displayName,
    req.user.email
  );
  if (!session) return res.status(400).json({ error: "SESSION_ENDED or not waiting" });
  res.json(session);
});

app.post("/api/sessions/:id/start", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const session = store.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "SESSION_NOT_FOUND" });
  if (session.hostId !== req.user.userId) return res.status(403).json({ error: "Forbidden" });
  const ok = store.startSession(req.params.id);
  if (!ok) return res.status(400).json({ error: "Already started" });
  res.json(store.getSession(req.params.id));
});

app.post("/api/sessions/:id/end", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const session = store.getSession(req.params.id);
  if (session && session.hostId === req.user.userId) store.endSession(req.params.id);
  res.json({ ok: true });
});

app.get("/api/sessions/:id/rankings", (req, res) => {
  const list = store.getRankings(req.params.id);
  res.json(list);
});

// ---------- Session answers (competition) ----------
app.post("/api/sessions/:id/answer", authMiddleware, (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Unauthorized" });
  const { cellKey, value } = req.body || {};
  const ok = store.setSessionAnswer(req.params.id, req.user.userId, cellKey, value);
  res.json({ ok });
});

// ---------- Health ----------
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const server = createServer(app);

// ---------- WebSocket：房間內填格同步（路徑 /ws/room/:roomId） ----------
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const pathname = request.url?.split("?")[0] || "";
  if (!pathname.startsWith("/ws/room/")) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

function getRoomIdFromUrl(pathname) {
  const m = pathname.match(/^\/ws\/room\/([^/]+)/);
  return m ? m[1] : null;
}

wss.on("connection", (ws, req) => {
  const pathname = req.url?.split("?")[0] || "";
  const search = req.url?.includes("?") ? "?" + req.url.split("?")[1] : "";
  const url = new URL(search, `http://${req.headers.host}`);
  const roomId = getRoomIdFromUrl(pathname);
  const userId = url.searchParams.get("userId") || "";
  const displayName = url.searchParams.get("name") ? decodeURIComponent(url.searchParams.get("name")) : "使用者";

  if (!roomId) {
    ws.close(1008, "roomId required");
    return;
  }

  const room = store.getRoom(roomId);
  if (!room) {
    ws.close(1008, "ROOM_NOT_FOUND");
    return;
  }

  ws.roomId = roomId;
  ws.userId = userId;
  ws.displayName = displayName;

  // 進房時推送全量狀態
  ws.send(
    JSON.stringify({
      type: "sync_state",
      puzzle: room.puzzleSnapshot,
      answers: room.sharedAnswers,
      filledBy: room.filledBy || {},
    })
  );

  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw);
      if (msg.type === "cell_fill" && msg.cellKey != null) {
        const ok = store.setRoomCell(roomId, msg.cellKey, String(msg.value || "").trim().slice(-1), userId);
        if (ok) {
          const room = store.getRoom(roomId);
          wss.clients.forEach((client) => {
            if (client.roomId === roomId && client.readyState === 1) {
              client.send(
                JSON.stringify({
                  type: "cell_fill",
                  cellKey: msg.cellKey,
                  value: msg.value,
                  userId,
                  displayName,
                })
              );
            }
          });
        }
      }
    } catch (_) {}
  });
});

server.listen(PORT, () => {
  console.log(`遠程對戰後端: http://localhost:${PORT}`);
  if (API_KEY) console.log("API_KEY 已設定（可留作日後 AI 功能使用）");
});
