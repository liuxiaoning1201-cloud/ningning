<script setup lang="ts">
import type { Hands, Results } from '@mediapipe/hands';

declare global {
  interface Window {
    Hands: new (config?: object) => Hands;
  }
}
import { storeToRefs } from 'pinia';
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { createPinchSmoother } from '@/composables/usePinch';
import { speakWithBackend } from '@/composables/useSpeech';
import { useWordPackStore } from '@/stores/wordPack';
import { useLevelStore } from '@/stores/levels';
import type { WordEntry } from '@/types/word';
import { drawFruit, fruitForWord, accentFor, type FruitKind } from '@/composables/fruits';
import { defaultLevel, readInputMode, type InputMode, type Level } from '@/types/level';
import { wsUrl } from '@/lib/api';

const route = useRoute();
const router = useRouter();
const wordStore = useWordPackStore();
const levelStore = useLevelStore();
const { entries: wordList } = storeToRefs(wordStore);

const inputMode = ref<InputMode>(
  route.query.input === 'click' ? 'click' : route.query.input === 'pinch' ? 'pinch' : readInputMode()
);
const isClickMode = computed(() => inputMode.value === 'click');

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const showHow = ref(true);
const status = ref<'loading' | 'ready' | 'need_camera' | 'error'>('loading');
const handsReady = ref(false);
const errMsg = ref('');

/** 當前關卡（從 query 或全域選擇） */
const currentLevel = ref<Level>(defaultLevel({ name: '快速練習', topics: [] }));

const playing = ref(false);
const timeLeft = ref(60);
const score = ref(0);
const combo = ref(0);
const bestCombo = ref(0);
const gameOver = ref(false);
const easyMode = ref(true);
const screenFx = ref(true);
const lastTtsError = ref('');
const targetHit = ref(0);
const targetMiss = ref(0);
const targetTotal = ref(0);
const wrongHit = ref(0);
const missedWords = ref<WordEntry[]>([]);

/** 點擊模式：滑鼠/觸控狀態 */
const pointer = ref<{ x: number; y: number; visible: boolean }>({ x: 0, y: 0, visible: false });
/** 炸彈／岩石命中後的冷卻時間戳（ms 系統時間）；冷卻期間禁止再命中 */
const inputDisabledUntil = ref(0);
/** 螢幕抖動結束時間 */
const shakeUntil = ref(0);
/** 紅閃結束時間 */
const flashUntil = ref(0);

const online = ref(false);
const onlineBoard = ref<Record<string, { name: string; score: number; connected?: boolean }>>({});
let ws: WebSocket | null = null;

type Fruit = {
  id: number;
  x: number;
  y: number;
  vy: number;
  /** 基礎半徑（出生時帶隨機偏差） */
  baseR: number;
  w: WordEntry | null;
  kind: FruitKind;
  bobPhase: number;
  /** 出生隨機尺寸係數（0.88 ~ 1.12） */
  birthScale: number;
  t: number;
  isTarget: boolean;
  /** 'word' = 一般詞語水果，'bomb' = 炸彈，'rock' = 岩石（不可消除） */
  category: 'word' | 'bomb' | 'rock';
  /** 岩石的最大存活時間（ms 系統時間） */
  expireAt?: number;
};

const fruits = ref<Fruit[]>([]);
const particles = ref<
  { x: number; y: number; vx: number; vy: number; life: number; c: string; s: number }[]
>([]);
let fruitId = 0;
let lastSpawn = 0;
let lastPop = 0;
let raf = 0;
let tick = 0;
let lastFrameT = performance.now();
let hands: Hands | null = null;
let lastResults: Results | null = null;
let stream: MediaStream | null = null;

const pinch = createPinchSmoother();

/** 捏到干擾詞（不符合關卡目標）時播放 */
const wrongSfxUrl = `${import.meta.env.BASE_URL}sounds/universfield-error-04-199275.mp3`;
let wrongSfx: HTMLAudioElement | null = null;
function playWrongSfx() {
  try {
    if (!wrongSfx) {
      wrongSfx = new Audio(wrongSfxUrl);
      wrongSfx.preload = 'auto';
    }
    wrongSfx.currentTime = 0;
    void wrongSfx.play().catch(() => {});
  } catch {
    /* ignore */
  }
}

let cw = 800;
let ch = 600;

/** ─── 抽詞：bag-shuffle 發牌制 ─────────────────────────── */
let targetBag: WordEntry[] = [];
let distractorBag: WordEntry[] = [];

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i]!, a[j]!] = [a[j]!, a[i]!];
  }
  return a;
}

function reseedBags() {
  targetBag = shuffle(wordStore.byTags(currentLevel.value.topics));
  distractorBag = shuffle(
    currentLevel.value.distractorRatio > 0 ? wordStore.notByTags(currentLevel.value.topics) : []
  );
}

function dealWord(isTarget: boolean): WordEntry | null {
  const bag = isTarget ? targetBag : distractorBag;
  const source = isTarget ? wordStore.byTags(currentLevel.value.topics) : wordStore.notByTags(currentLevel.value.topics);
  if (!source.length) return null;
  if (!bag.length) {
    const reshuffled = shuffle(source);
    if (isTarget) targetBag = reshuffled;
    else distractorBag = reshuffled;
  }
  const next = (isTarget ? targetBag : distractorBag).shift();
  return next ?? null;
}

const targetPool = computed<WordEntry[]>(() => wordStore.byTags(currentLevel.value.topics));

const topicLabel = computed(() =>
  currentLevel.value.topics.length ? currentLevel.value.topics.map((t) => `#${t}`).join(' ') : '全部詞'
);

const endGoalText = computed(() => {
  const l = currentLevel.value;
  if (l.mode === 'timed') return `⏱ ${Math.ceil(timeLeft.value)} 秒`;
  if (l.mode === 'count') return `🎯 目標 ${targetHit.value}/${l.targetCount}`;
  if (l.mode === 'survival') return `❤ 可漏 ${(l.missAllowance ?? 0) - targetMiss.value}`;
  return '🏖 自由練習';
});

function resize() {
  cw = window.innerWidth;
  ch = window.innerHeight;
  const c = canvasRef.value;
  if (!c) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = cw * dpr;
  c.height = ch * dpr;
  c.style.width = `${cw}px`;
  c.style.height = `${ch}px`;
  const ctx = c.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fallSpeed() {
  const base = easyMode.value ? 110 : 145;
  const boost = Math.min(score.value * 0.2, 70);
  return (base + boost) * currentLevel.value.speedScale;
}

function pickSpawnX(r: number): number | null {
  const margin = r + 18;
  const minGap = r * 2 + 24;
  for (let i = 0; i < 12; i++) {
    const x = margin + Math.random() * Math.max(1, cw - margin * 2);
    let ok = true;
    for (const f of fruits.value) {
      if (f.y < r * 2.5 && Math.abs(f.x - x) < minGap) {
        ok = false;
        break;
      }
    }
    if (ok) return x;
  }
  return null;
}

function spawn(now: number) {
  const wantDistractor =
    currentLevel.value.distractorRatio > 0 &&
    wordStore.notByTags(currentLevel.value.topics).length > 0 &&
    Math.random() < currentLevel.value.distractorRatio;
  const isTarget = !wantDistractor;
  let w = dealWord(isTarget);
  if (!w) {
    w = dealWord(!isTarget);
    if (!w) return;
  }
  const realTarget = targetPool.value.includes(w);
  const baseR = easyMode.value ? 70 : 60;
  const x = pickSpawnX(baseR);
  if (x == null) return;
  fruits.value.push({
    id: ++fruitId,
    x,
    y: -baseR - 10,
    vy: fallSpeed(),
    baseR,
    w,
    kind: fruitForWord(w.word || w.hanzi || ''),
    bobPhase: Math.random() * Math.PI * 2,
    birthScale: 0.88 + Math.random() * 0.24,
    t: now,
    isTarget: realTarget,
    category: 'word',
  });
}

/** 在錯誤之後召喚一顆懲罰物（炸彈或岩石） */
function summonPunish(now: number) {
  if (!playing.value || gameOver.value) return;
  const useBomb = Math.random() < 0.65;
  const baseR = useBomb ? 56 : 70;
  const x = pickSpawnX(baseR) ?? Math.random() * cw;
  fruits.value.push({
    id: ++fruitId,
    x,
    y: -baseR - 10,
    vy: useBomb ? fallSpeed() * 1.15 : fallSpeed() * 0.9,
    baseR,
    w: null,
    kind: useBomb ? 'bomb' : 'rock',
    bobPhase: Math.random() * Math.PI * 2,
    birthScale: 1,
    t: now,
    isTarget: false,
    category: useBomb ? 'bomb' : 'rock',
    expireAt: useBomb ? undefined : now + 6500,
  });
}

function burst(x: number, y: number, color: string, big = false) {
  if (!screenFx.value) return;
  const n = big ? 48 : 24;
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = (big ? 5 : 3) + Math.random() * (big ? 14 : 10);
    particles.value.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 3,
      life: 38 + Math.random() * (big ? 38 : 24),
      c: color,
      s: 3 + Math.random() * (big ? 7 : 5),
    });
  }
}

async function bootCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'user',
      width: { ideal: 480 },
      height: { ideal: 360 },
      frameRate: { ideal: 24, max: 30 },
    },
    audio: false,
  });
  const v = videoRef.value;
  if (!v) return;
  v.srcObject = stream;
  await v.play().catch(() => {});
}

async function bootHands() {
  if (!window.Hands) throw new Error('Hands');
  const h = new window.Hands({
    locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });
  h.setOptions({
    maxNumHands: 1,
    modelComplexity: 0,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.4,
  });
  h.onResults((res) => {
    lastResults = res;
    if (!handsReady.value) handsReady.value = true;
  });
  hands = h;
}

function connectOnline(room: string) {
  ws = new WebSocket(wsUrl(`/ws?room=${encodeURIComponent(room)}`));
  online.value = true;
  ws.addEventListener('open', () => {
    let pid = sessionStorage.getItem('fruit-player-id');
    if (!pid) {
      pid = `p_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem('fruit-player-id', pid);
    }
    const name =
      sessionStorage.getItem('fruit-player-name') ||
      `勇者${Math.floor(Math.random() * 900 + 100)}`;
    ws!.send(JSON.stringify({ type: 'join', playerId: pid, name }));
  });
  ws.addEventListener('message', (ev) => {
    try {
      const m = JSON.parse(ev.data as string);
      if (m.type === 'state' || m.type === 'score') {
        onlineBoard.value = m.players || onlineBoard.value;
      }
    } catch {
      /* ignore */
    }
  });
}

function emitScore(delta: number) {
  if (!online.value || !ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: 'score', delta }));
}

function speakForEntry(w: WordEntry) {
  const lang =
    currentLevel.value.voice === 'per_entry' ? w.langRead : currentLevel.value.voice;
  void speakWithBackend(w.word || w.hanzi || '', lang).then((r) => {
    if (!r.ok && r.error) lastTtsError.value = r.error;
    else lastTtsError.value = '';
  });
}

function persistMisses() {
  if (!missedWords.value.length) return;
  try {
    const KEY = 'fruit-cn-wrong-book-v1';
    const raw = localStorage.getItem(KEY);
    const existing: WordEntry[] = raw ? JSON.parse(raw) : [];
    const dedup = new Map<string, WordEntry>();
    for (const e of [...existing, ...missedWords.value]) {
      dedup.set(e.word, e);
    }
    localStorage.setItem(KEY, JSON.stringify([...dedup.values()].slice(-120)));
  } catch {
    /* ignore */
  }
}

/** ─── 點擊模式：pointer 事件 ─────────────────────────── */
function onPointerMove(e: PointerEvent) {
  pointer.value.x = e.clientX;
  pointer.value.y = e.clientY;
  pointer.value.visible = true;
}
function onPointerLeave() {
  pointer.value.visible = false;
}
function onPointerDown(e: PointerEvent) {
  pointer.value.x = e.clientX;
  pointer.value.y = e.clientY;
  pointer.value.visible = true;
  if (!playing.value || gameOver.value) return;
  const now = performance.now();
  if (now < inputDisabledUntil.value) return;
  tryHit(e.clientX, e.clientY, now);
}

/** 共用命中流程：捏合與點擊都會走這裡 */
function tryHit(hx: number, hy: number, now: number) {
  for (let i = fruits.value.length - 1; i >= 0; i--) {
    const f = fruits.value[i]!;
    const r = effectiveRadius(f, now);
    const padding = isClickMode.value ? 6 : easyMode.value ? 22 : 14;
    const hitR = r + padding;
    const dx = hx - f.x;
    const dy = hy - f.y;
    if (dx * dx + dy * dy < hitR * hitR) {
      handleHit(f, now);
      return;
    }
  }
}

function handleHit(f: Fruit, now: number) {
  lastPop = now;

  if (f.category === 'rock') {
    return;
  }

  if (f.category === 'bomb') {
    fruits.value = fruits.value.filter((x) => x.id !== f.id);
    score.value = Math.max(0, score.value - 10);
    combo.value = 0;
    inputDisabledUntil.value = now + 800;
    shakeUntil.value = now + 600;
    flashUntil.value = now + 380;
    burst(f.x, f.y, '#ff3344', true);
    burst(f.x, f.y, '#fff7c0', true);
    playWrongSfx();
    pinch.reset();
    maybeFinish();
    return;
  }

  fruits.value = fruits.value.filter((x) => x.id !== f.id);
  const ac = accentFor(f.kind);
  if (f.isTarget) {
    combo.value += 1;
    bestCombo.value = Math.max(bestCombo.value, combo.value);
    const pts = 10 + Math.min(combo.value * 2, 40);
    score.value += pts;
    targetHit.value += 1;
    targetTotal.value += 1;
    burst(f.x, f.y, combo.value > 6 ? '#fffb8d' : ac.soft);
    emitScore(pts);
    if (f.w) speakForEntry(f.w);
  } else {
    combo.value = 0;
    wrongHit.value += 1;
    const penalty = currentLevel.value.wrongPenalty ? 8 : 0;
    score.value = Math.max(0, score.value - penalty);
    burst(f.x, f.y, '#ff5577');
    playWrongSfx();
    flashUntil.value = now + 220;
    if (Math.random() < 0.5) {
      summonPunish(now);
    }
  }
  maybeFinish();
}

/** 計算當前有效半徑（含出生隨機/呼吸/落底放大） */
function effectiveRadius(f: Fruit, now: number): number {
  if (f.category !== 'word') return f.baseR;
  const breathe = 1 + 0.06 * Math.sin(now * 0.0026 + f.bobPhase);
  const fallProgress = Math.max(0, Math.min(1, f.y / Math.max(1, ch)));
  const grow = 1 + fallProgress * 0.18;
  return f.baseR * f.birthScale * breathe * grow;
}

onMounted(async () => {
  const qLevelId = typeof route.query.level === 'string' ? route.query.level : '';
  const picked = qLevelId ? levelStore.getById(qLevelId) : levelStore.selected;
  if (picked) currentLevel.value = { ...picked };

  if (!wordList.value.length) {
    router.replace('/teacher');
    return;
  }
  if (currentLevel.value.mode === 'timed') timeLeft.value = currentLevel.value.duration ?? 60;

  reseedBags();

  resize();
  window.addEventListener('resize', resize);
  const room = typeof route.query.room === 'string' ? route.query.room : '';
  if (room) connectOnline(room);

  if (isClickMode.value) {
    status.value = 'ready';
    handsReady.value = true;
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerleave', onPointerLeave);
  } else {
    try {
      await bootCamera();
      status.value = 'ready';
      bootHands().catch(() => {
        errMsg.value = '手勢模型載入失敗，請重新整理或檢查網路。';
      });
    } catch {
      status.value = 'need_camera';
      errMsg.value = '無法開啟鏡頭，請檢查瀏覽器權限與 HTTPS（也可改用點擊模式，回首頁切換）。';
    }
  }

  loop();
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', resize);
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerdown', onPointerDown);
  window.removeEventListener('pointerleave', onPointerLeave);
  pinch.reset();
  hands?.close();
  stream?.getTracks().forEach((t) => t.stop());
  ws?.close();
});

let handsBusy = false;
let lastHandsAt = 0;

function loop() {
  const step = (now: number) => {
    raf = requestAnimationFrame(step);
    tick = now;
    const dt = Math.min(0.052, (now - lastFrameT) / 1000);
    lastFrameT = now;

    const v = videoRef.value;
    const c = canvasRef.value;
    const ctx = c?.getContext('2d');
    if (!ctx || !c) return;

    if (!isClickMode.value && hands && v && v.readyState >= 2 && !handsBusy && now - lastHandsAt > 33) {
      handsBusy = true;
      lastHandsAt = now;
      hands
        .send({ image: v })
        .catch(() => {})
        .finally(() => {
          handsBusy = false;
        });
    }

    /* 螢幕抖動 */
    let shakeX = 0;
    let shakeY = 0;
    if (now < shakeUntil.value) {
      const k = (shakeUntil.value - now) / 600;
      shakeX = (Math.random() - 0.5) * 18 * k;
      shakeY = (Math.random() - 0.5) * 18 * k;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(-shakeX, -shakeY, cw, ch);

    let sample: ReturnType<typeof pinch.update> = null;
    if (!isClickMode.value) {
      const lm = lastResults?.multiHandLandmarks?.[0];
      sample = pinch.update(lm, cw, ch);
    }

    particles.value = particles.value.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.28;
      p.life -= 1.6;
      if (p.life <= 0) return false;
      ctx.globalAlpha = Math.min(1, p.life / 40);
      ctx.fillStyle = p.c;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });

    if (!playing.value || gameOver.value) {
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(0, 0, cw, ch);
      ctx.restore();
      return;
    }

    const speed = fallSpeed();

    /** 體感模式：捏合命中（迴圈內檢查每顆水果，與原本相同；非冷卻時才生效） */
    if (!isClickMode.value && sample?.pinch && now > inputDisabledUntil.value && now - lastPop > 280) {
      tryHit(sample.cx, sample.cy, now);
    }

    fruits.value = fruits.value.filter((f) => {
      f.vy = f.category === 'rock' ? speed * 0.9 : speed;
      f.y += f.vy * dt;

      /* 岩石倒數結束 */
      if (f.category === 'rock' && f.expireAt && now > f.expireAt) {
        return false;
      }

      if (f.y - f.baseR > ch + 40) {
        if (f.category === 'word' && f.isTarget) {
          combo.value = 0;
          targetMiss.value += 1;
          targetTotal.value += 1;
          if (f.w) missedWords.value.push(f.w);
          if (currentLevel.value.missPenalty) {
            score.value = Math.max(0, score.value - 5);
          }
          maybeFinish();
        }
        return false;
      }

      const r = effectiveRadius(f, now);
      const bob = Math.sin(now / 600 + f.bobPhase) * 0.08;
      drawFruit(ctx, f.kind, f.x, f.y, r, bob, now);

      /* 文字標籤（只有一般詞語水果有） */
      if (f.category === 'word' && f.w) {
        const display = currentLevel.value.display;
        const hanzi = f.w.hanzi || f.w.word;
        const pinyin = f.w.pinyin || '';
        const primary = display === 'pinyin_only' ? pinyin : hanzi;
        const secondary = display === 'hanzi_pinyin' ? pinyin : '';

        if (primary) {
          ctx.save();
          ctx.translate(f.x, f.y + r + 6);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          const labelFont = `900 ${Math.max(18, Math.round(r * 0.42))}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
          ctx.font = labelFont;
          const labelW = ctx.measureText(primary).width;
          const padX = 10;
          const padY = 5;
          const labelH = Math.max(20, Math.round(r * 0.42)) + padY * 2;
          ctx.fillStyle = 'rgba(28,12,42,0.78)';
          const bx = -labelW / 2 - padX;
          const by = 0;
          const bw = labelW + padX * 2;
          const bh = labelH;
          const rr = 10;
          ctx.beginPath();
          ctx.moveTo(bx + rr, by);
          ctx.arcTo(bx + bw, by, bx + bw, by + bh, rr);
          ctx.arcTo(bx + bw, by + bh, bx, by + bh, rr);
          ctx.arcTo(bx, by + bh, bx, by, rr);
          ctx.arcTo(bx, by, bx + bw, by, rr);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#fff';
          ctx.fillText(primary, 0, padY);
          if (secondary) {
            ctx.font = `600 ${Math.max(11, Math.round(r * 0.18))}px "PingFang TC",sans-serif`;
            ctx.fillStyle = 'rgba(255,236,180,0.95)';
            ctx.fillText(secondary, 0, bh + 4);
          }
          ctx.restore();
        }
      }

      return true;
    });

    /** 體感游標 */
    if (!isClickMode.value && sample && playing.value) {
      ctx.strokeStyle = sample.pinch ? 'rgba(255,80,180,0.85)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = sample.pinch ? 5 : 3;
      ctx.beginPath();
      ctx.arc(sample.cx, sample.cy, sample.pinch ? 26 : 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    /** 點擊冷卻倒數環 */
    if (isClickMode.value && pointer.value.visible && playing.value) {
      const cooling = now < inputDisabledUntil.value;
      ctx.save();
      ctx.strokeStyle = cooling ? 'rgba(255,80,80,0.95)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = cooling ? 5 : 3;
      ctx.beginPath();
      ctx.arc(pointer.value.x, pointer.value.y, cooling ? 22 : 14, 0, Math.PI * 2);
      ctx.stroke();
      if (cooling) {
        const remain = (inputDisabledUntil.value - now) / 800;
        ctx.strokeStyle = 'rgba(255,255,180,0.95)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(pointer.value.x, pointer.value.y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remain);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 紅閃 */
    if (now < flashUntil.value) {
      const k = (flashUntil.value - now) / 380;
      ctx.fillStyle = `rgba(255,40,80,${0.18 * k})`;
      ctx.fillRect(0, 0, cw, ch);
    }

    /* 生成節奏 */
    const interval = currentLevel.value.spawnEveryMs
      ? currentLevel.value.spawnEveryMs
      : easyMode.value
      ? Math.max(900, 1400 - Math.min(score.value, 350))
      : Math.max(700, 1200 - Math.min(score.value, 400));
    const cap = easyMode.value ? 5 : 7;
    const wordFruitCount = fruits.value.filter((f) => f.category === 'word').length;
    if (now - lastSpawn > interval && wordFruitCount < cap) {
      spawn(now);
      lastSpawn = now;
    }

    if (playing.value && currentLevel.value.mode === 'timed') {
      timeLeft.value = Math.max(0, timeLeft.value - dt);
      if (timeLeft.value <= 0) {
        finishGame();
      }
    }

    ctx.restore();
  };
  lastFrameT = performance.now();
  raf = requestAnimationFrame(step);
}

function maybeFinish() {
  const l = currentLevel.value;
  if (l.mode === 'count' && targetHit.value >= (l.targetCount ?? Infinity)) {
    finishGame();
  } else if (l.mode === 'survival' && targetMiss.value >= (l.missAllowance ?? Infinity)) {
    finishGame();
  }
}

function finishGame() {
  playing.value = false;
  gameOver.value = true;
  persistMisses();
}

function startGame() {
  showHow.value = false;
  gameOver.value = false;
  playing.value = true;
  score.value = 0;
  combo.value = 0;
  bestCombo.value = 0;
  targetHit.value = 0;
  targetMiss.value = 0;
  targetTotal.value = 0;
  wrongHit.value = 0;
  missedWords.value = [];
  fruits.value = [];
  particles.value = [];
  pinch.reset();
  inputDisabledUntil.value = 0;
  shakeUntil.value = 0;
  flashUntil.value = 0;
  reseedBags();
  lastSpawn = performance.now();
  if (currentLevel.value.mode === 'timed') {
    timeLeft.value = currentLevel.value.duration ?? 60;
  }
}

function goHome() {
  router.push('/');
}

const stars = computed(() => {
  const t = currentLevel.value.starTargets;
  if (!t) return 0;
  if (score.value >= t[2]) return 3;
  if (score.value >= t[1]) return 2;
  if (score.value >= t[0]) return 1;
  return 0;
});

const accuracy = computed(() => {
  const total = targetHit.value + targetMiss.value + wrongHit.value;
  if (!total) return 100;
  return Math.round((targetHit.value / total) * 100);
});

const sortedBoard = computed(() =>
  Object.values(onlineBoard.value)
    .map((p) => ({ ...p }))
    .sort((a, b) => b.score - a.score)
);

const modeBadgeText = computed(() => (isClickMode.value ? '點擊模式' : '捏爆模式'));
</script>

<template>
  <div
    class="relative h-full min-h-[100dvh] w-full overflow-hidden text-white"
    :class="isClickMode ? 'cursor-crosshair' : ''"
    style="
      background-image:
        radial-gradient(circle at 20% 18%, #ff7ad9 0, transparent 55%),
        radial-gradient(circle at 80% 80%, #6ad7ff 0, transparent 50%),
        linear-gradient(160deg, #4a2a6b 0%, #2b1748 60%, #160c2a 100%);
    "
  >
    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />

    <!-- 鏡頭 PIP（只在捏爆模式顯示） -->
    <div
      v-if="!isClickMode"
      class="pointer-events-none absolute bottom-4 right-4 z-25 w-44 overflow-hidden rounded-2xl border-2 border-white/35 bg-black/55 shadow-2xl backdrop-blur md:w-56"
    >
      <video
        ref="videoRef"
        class="h-full w-full object-cover"
        style="transform: scaleX(-1); aspect-ratio: 4 / 3"
        muted
        playsinline
      />
      <div
        class="pointer-events-none absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-black tracking-wider"
        :class="handsReady ? 'bg-emerald-400/90 text-emerald-950' : 'bg-amber-300/90 text-amber-900'"
      >
        {{ handsReady ? '手勢就緒' : '載入手勢…' }}
      </div>
    </div>

    <!-- HUD -->
    <div
      class="pointer-events-none absolute left-0 right-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4"
    >
      <div class="pointer-events-auto flex flex-col gap-2">
        <button
          type="button"
          class="rounded-2xl bg-black/35 px-4 py-2 text-sm font-bold text-white shadow backdrop-blur-md"
          @click="goHome"
        >
          ← 回首頁
        </button>
        <div class="max-w-[72vw] rounded-2xl bg-black/40 px-4 py-2 text-xs font-bold backdrop-blur">
          <div class="flex items-center gap-2 text-[11px] uppercase tracking-widest">
            <span class="text-yellow-200">本關</span>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-black"
              :class="isClickMode ? 'bg-sky-400/90 text-sky-950' : 'bg-pink-400/90 text-pink-950'"
            >
              {{ modeBadgeText }}
            </span>
          </div>
          <div class="text-sm font-black">{{ currentLevel.name }}</div>
          <div class="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold text-white/80">
            <span>{{ topicLabel }}</span>
            <span v-if="currentLevel.distractorRatio > 0" class="rounded-full bg-rose-400/60 px-2 py-0.5 text-[10px] text-white">
              干擾 {{ Math.round(currentLevel.distractorRatio * 100) }}%
            </span>
            <span class="rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
              {{
                currentLevel.voice === 'cantonese'
                  ? '粵語'
                  : currentLevel.voice === 'mandarin'
                  ? '普通話'
                  : '依詞條'
              }}
            </span>
          </div>
        </div>
        <label class="flex cursor-pointer items-center gap-2 rounded-2xl bg-black/35 px-3 py-2 text-xs font-semibold backdrop-blur">
          <input v-model="easyMode" type="checkbox" class="accent-pink-500" />
          {{ isClickMode ? '簡易（容易點中）' : '簡易（大目標）' }}
        </label>
        <label class="flex cursor-pointer items-center gap-2 rounded-2xl bg-black/35 px-3 py-2 text-xs font-semibold backdrop-blur">
          <input v-model="screenFx" type="checkbox" class="accent-pink-500" />
          粒子特效
        </label>
      </div>

      <div class="flex flex-col items-end gap-2">
        <div
          class="rounded-3xl px-7 py-4 text-center shadow-xl ring-4 ring-white/25 backdrop-blur"
          :class="isClickMode
            ? 'bg-gradient-to-br from-[#5d6dff]/95 to-[#7ee8fa]/95'
            : 'bg-gradient-to-br from-[#ff6bcb]/95 to-[#ff9e6d]/95'"
        >
          <div class="text-xs font-bold uppercase tracking-widest text-white/90">得分</div>
          <div class="text-5xl font-black tabular-nums leading-none">{{ score }}</div>
          <div class="mt-2 text-sm font-bold text-yellow-100">連擊 ×{{ combo }}</div>
        </div>
        <div class="rounded-2xl bg-black/45 px-5 py-3 text-lg font-black tabular-nums backdrop-blur">
          {{ endGoalText }}
        </div>
      </div>
    </div>

    <!-- 線上排行榜 -->
    <div
      v-if="online && sortedBoard.length"
      class="pointer-events-none absolute bottom-36 left-4 z-20 max-h-48 overflow-auto rounded-2xl bg-black/40 px-4 py-3 text-sm backdrop-blur"
    >
      <div class="mb-2 font-black text-yellow-200">房間比分</div>
      <div v-for="(p, i) in sortedBoard.slice(0, 6)" :key="p.name + i" class="flex justify-between gap-6 font-bold">
        <span>{{ i + 1 }}. {{ p.name }}</span>
        <span>{{ p.score }}</span>
      </div>
    </div>

    <!-- 鏡頭錯誤（僅捏爆模式可能出現） -->
    <div
      v-if="!isClickMode && (status === 'need_camera' || status === 'error')"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 px-8 text-center backdrop-blur-md"
    >
      <p class="max-w-md text-lg leading-relaxed">{{ errMsg }}</p>
      <button
        type="button"
        class="mt-6 rounded-3xl bg-white px-6 py-3 font-black text-[#4a235f] shadow"
        @click="goHome"
      >
        回首頁切換點擊模式
      </button>
    </div>

    <!-- 玩法說明 -->
    <div
      v-if="showHow && status === 'ready'"
      class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 px-6 backdrop-blur-sm"
    >
      <div class="max-w-lg rounded-[2rem] bg-white p-8 text-[#4a235f] shadow-2xl ring-8 ring-[#ffd6f5]/40">
        <div class="mb-2 flex items-center justify-center gap-2">
          <span
            class="rounded-full px-3 py-1 text-xs font-black"
            :class="isClickMode ? 'bg-[#dceaff] text-[#1f4fa6]' : 'bg-[#ffe2f3] text-[#a1299b]'"
          >
            {{ modeBadgeText }}
          </span>
        </div>
        <h2 class="mb-2 text-center text-2xl font-black">{{ currentLevel.name }}</h2>
        <div class="mb-5 flex flex-wrap justify-center gap-2 text-sm font-semibold">
          <span v-for="t in currentLevel.topics.length ? currentLevel.topics : ['全部詞']" :key="t" class="rounded-full bg-[#fde8ff] px-3 py-1 text-[#a1299b]">#{{ t }}</span>
          <span v-if="currentLevel.distractorRatio > 0" class="rounded-full bg-[#ffd8dc] px-3 py-1 text-[#c72c5b]">干擾 {{ Math.round(currentLevel.distractorRatio * 100) }}%</span>
        </div>
        <ol class="mb-6 space-y-3 text-base font-semibold leading-relaxed">
          <li class="flex gap-3">
            <span class="text-2xl">📖</span>
            <span>看清楚<strong>水果上的詞</strong>，符合主題的才能消除（不再有金光提示！）</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl">{{ isClickMode ? '👆' : '✋' }}</span>
            <span v-if="isClickMode">用<strong>滑鼠或手指</strong>直接點水果。</span>
            <span v-else>用<strong>拇指＋食指捏合</strong>對準水果。</span>
          </li>
          <li class="flex gap-3">
            <span class="text-2xl">💣</span>
            <span>選錯有機會掉下<strong>炸彈或岩石</strong>，碰到炸彈會短暫鎖定！小心避開。</span>
          </li>
        </ol>
        <button
          type="button"
          class="w-full rounded-3xl py-5 text-xl font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
          :class="isClickMode
            ? 'bg-gradient-to-r from-[#5d6dff] to-[#7ee8fa]'
            : 'bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d]'"
          @click="startGame"
        >
          我準備好了！
        </button>
      </div>
    </div>

    <!-- 結束 -->
    <div
      v-if="gameOver"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 px-6 backdrop-blur-md"
    >
      <div class="max-w-md rounded-[2rem] bg-gradient-to-br from-[#ffe6fb] to-[#d5f6ff] p-8 text-center text-[#4a235f] shadow-2xl">
        <p class="mb-1 text-xl font-black">{{ currentLevel.mode === 'survival' && targetMiss >= (currentLevel.missAllowance ?? 0) ? '挑戰失敗' : '完成！' }}</p>
        <div v-if="stars" class="mb-2 text-3xl tracking-widest">
          <span>{{ '★'.repeat(stars) }}<span class="text-[#d0c8dc]">{{ '☆'.repeat(3 - stars) }}</span></span>
        </div>
        <p class="mb-4 text-5xl font-black text-transparent bg-gradient-to-r from-[#ff3cac] to-[#784ba0] bg-clip-text">
          {{ score }} 分
        </p>
        <dl class="mx-auto mb-6 grid max-w-xs grid-cols-2 gap-y-1 text-sm font-bold">
          <dt class="text-[#8a6fb0]">命中目標</dt>
          <dd>{{ targetHit }}</dd>
          <dt class="text-[#8a6fb0]">漏掉目標</dt>
          <dd>{{ targetMiss }}</dd>
          <dt class="text-[#8a6fb0]">選錯干擾</dt>
          <dd>{{ wrongHit }}</dd>
          <dt class="text-[#8a6fb0]">正確率</dt>
          <dd>{{ accuracy }}%</dd>
          <dt class="text-[#8a6fb0]">最佳連擊</dt>
          <dd>{{ bestCombo }}</dd>
        </dl>
        <button
          type="button"
          class="mb-3 w-full rounded-3xl py-4 text-lg font-black text-white shadow-lg"
          :class="isClickMode ? 'bg-[#5d6dff]' : 'bg-[#ff6bcb]'"
          @click="
            gameOver = false;
            startGame();
          "
        >
          再來一局
        </button>
        <button type="button" class="w-full rounded-3xl bg-white py-3 text-base font-bold text-[#843fa1]" @click="goHome">
          回首頁
        </button>
      </div>
    </div>

    <!-- TTS 提示 -->
    <div
      v-if="lastTtsError"
      class="pointer-events-none absolute bottom-6 left-1/2 z-25 max-w-[96%] -translate-x-1/2 rounded-2xl bg-black/55 px-5 py-2 text-center text-xs font-semibold text-amber-100 backdrop-blur"
    >
      朗讀改為瀏覽器備援（{{ lastTtsError }}）
    </div>
  </div>
</template>
