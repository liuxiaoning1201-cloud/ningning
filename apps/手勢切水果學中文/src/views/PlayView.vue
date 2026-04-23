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
import { defaultLevel, type Level } from '@/types/level';
import { wsUrl } from '@/lib/api';

const route = useRoute();
const router = useRouter();
const wordStore = useWordPackStore();
const levelStore = useLevelStore();
const { entries: wordList } = storeToRefs(wordStore);

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

const online = ref(false);
const onlineBoard = ref<Record<string, { name: string; score: number; connected?: boolean }>>({});
let ws: WebSocket | null = null;

type Fruit = {
  id: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  w: WordEntry;
  kind: FruitKind;
  bobPhase: number;
  t: number;
  isTarget: boolean;
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

/** 抽題池 */
const targetPool = computed<WordEntry[]>(() => wordStore.byTags(currentLevel.value.topics));
const distractorPool = computed<WordEntry[]>(() =>
  currentLevel.value.distractorRatio > 0 ? wordStore.notByTags(currentLevel.value.topics) : []
);

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

function pickWord(isTarget: boolean): WordEntry | null {
  const pool = isTarget ? targetPool.value : distractorPool.value;
  if (!pool.length) return null;
  if (!currentLevel.value.allowRepeat && pool.length > 1) {
    for (let i = 0; i < 6; i++) {
      const w = pool[Math.floor(Math.random() * pool.length)]!;
      const usedRecently = fruits.value.slice(-4).some((f) => f.w.word === w.word);
      if (!usedRecently) return w;
    }
  }
  return pool[Math.floor(Math.random() * pool.length)]!;
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
    distractorPool.value.length > 0 && Math.random() < currentLevel.value.distractorRatio;
  const isTarget = !wantDistractor;
  let w = pickWord(isTarget);
  if (!w) {
    w = pickWord(!isTarget);
    if (!w) return;
  }
  const realTarget = targetPool.value.includes(w);
  const r = easyMode.value ? 70 : 60;
  const x = pickSpawnX(r);
  if (x == null) return;
  fruits.value.push({
    id: ++fruitId,
    x,
    y: -r - 10,
    vy: fallSpeed(),
    r,
    w,
    kind: fruitForWord(w.word || w.hanzi || ''),
    bobPhase: Math.random() * Math.PI * 2,
    t: now,
    isTarget: realTarget,
  });
}

function burst(x: number, y: number, color: string) {
  if (!screenFx.value) return;
  const n = 24;
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 3 + Math.random() * 10;
    particles.value.push({
      x,
      y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp - 3,
      life: 38 + Math.random() * 24,
      c: color,
      s: 3 + Math.random() * 5,
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

onMounted(async () => {
  const qLevelId = typeof route.query.level === 'string' ? route.query.level : '';
  const picked = qLevelId ? levelStore.getById(qLevelId) : levelStore.selected;
  if (picked) currentLevel.value = { ...picked };

  if (!wordList.value.length) {
    router.replace('/teacher');
    return;
  }
  if (currentLevel.value.mode === 'timed') timeLeft.value = currentLevel.value.duration ?? 60;

  resize();
  window.addEventListener('resize', resize);
  const room = typeof route.query.room === 'string' ? route.query.room : '';
  if (room) connectOnline(room);

  try {
    await bootCamera();
    status.value = 'ready';
    bootHands().catch(() => {
      errMsg.value = '手勢模型載入失敗，請重新整理或檢查網路。';
    });
  } catch {
    status.value = 'need_camera';
    errMsg.value = '無法開啟鏡頭，請檢查瀏覽器權限與 HTTPS。';
  }

  loop();
});

onUnmounted(() => {
  cancelAnimationFrame(raf);
  window.removeEventListener('resize', resize);
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

    if (hands && v && v.readyState >= 2 && !handsBusy && now - lastHandsAt > 33) {
      handsBusy = true;
      lastHandsAt = now;
      hands
        .send({ image: v })
        .catch(() => {})
        .finally(() => {
          handsBusy = false;
        });
    }

    ctx.clearRect(0, 0, cw, ch);

    const lm = lastResults?.multiHandLandmarks?.[0];
    const sample = pinch.update(lm, cw, ch);

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
      return;
    }

    const speed = fallSpeed();
    fruits.value = fruits.value.filter((f) => {
      f.vy = speed;
      f.y += f.vy * dt;

      let hit = false;
      if (sample?.pinch && now - lastPop > 280) {
        const dx = sample.cx - f.x;
        const dy = sample.cy - f.y;
        const hitR = f.r + (easyMode.value ? 22 : 14);
        if (dx * dx + dy * dy < hitR * hitR) {
          hit = true;
        }
      }

      if (hit) {
        lastPop = now;
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
          speakForEntry(f.w);
        } else {
          combo.value = 0;
          wrongHit.value += 1;
          const penalty = currentLevel.value.wrongPenalty ? 8 : 0;
          score.value = Math.max(0, score.value - penalty);
          burst(f.x, f.y, '#ff5577');
          playWrongSfx();
        }
        maybeFinish();
        return false;
      }

      if (f.y - f.r > ch + 40) {
        if (f.isTarget) {
          combo.value = 0;
          targetMiss.value += 1;
          targetTotal.value += 1;
          missedWords.value.push(f.w);
          if (currentLevel.value.missPenalty) {
            score.value = Math.max(0, score.value - 5);
          }
          maybeFinish();
        }
        return false;
      }

      const bob = Math.sin(now / 600 + f.bobPhase) * 0.08;
      if (f.isTarget) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 220 + f.bobPhase);
        ctx.save();
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r + 8 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 215, 64, ${0.55 + 0.25 * pulse})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255, 215, 64, 0.8)';
        ctx.shadowBlur = 12 + pulse * 8;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.save();
        ctx.globalAlpha = 0.85;
        drawFruit(ctx, f.kind, f.x, f.y, f.r, bob);
        ctx.restore();
      }
      if (f.isTarget) drawFruit(ctx, f.kind, f.x, f.y, f.r, bob);

      /* 文字標籤 */
      const display = currentLevel.value.display;
      const hanzi = f.w.hanzi || f.w.word;
      const pinyin = f.w.pinyin || '';
      const primary = display === 'pinyin_only' ? pinyin : hanzi;
      const secondary = display === 'hanzi_pinyin' ? pinyin : '';

      if (primary) {
        ctx.save();
        ctx.translate(f.x, f.y + f.r + 6);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const labelFont = `900 ${Math.max(18, Math.round(f.r * 0.42))}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
        ctx.font = labelFont;
        const labelW = ctx.measureText(primary).width;
        const padX = 10;
        const padY = 5;
        const labelH = Math.max(20, Math.round(f.r * 0.42)) + padY * 2;
        ctx.fillStyle = f.isTarget ? 'rgba(28,12,42,0.82)' : 'rgba(55,55,90,0.58)';
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
        ctx.fillStyle = f.isTarget ? '#fff' : 'rgba(255,255,255,0.7)';
        ctx.fillText(primary, 0, padY);
        if (secondary) {
          ctx.font = `600 ${Math.max(11, Math.round(f.r * 0.18))}px "PingFang TC",sans-serif`;
          ctx.fillStyle = f.isTarget ? 'rgba(255,236,180,0.95)' : 'rgba(220,210,230,0.7)';
          ctx.fillText(secondary, 0, bh + 4);
        }
        ctx.restore();
      }

      return true;
    });

    if (sample && playing.value) {
      ctx.strokeStyle = sample.pinch ? 'rgba(255,80,180,0.85)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = sample.pinch ? 5 : 3;
      ctx.beginPath();
      ctx.arc(sample.cx, sample.cy, sample.pinch ? 26 : 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* 生成節奏 */
    const interval = currentLevel.value.spawnEveryMs
      ? currentLevel.value.spawnEveryMs
      : easyMode.value
      ? Math.max(900, 1400 - Math.min(score.value, 350))
      : Math.max(700, 1200 - Math.min(score.value, 400));
    const cap = easyMode.value ? 5 : 7;
    if (now - lastSpawn > interval && fruits.value.length < cap) {
      spawn(now);
      lastSpawn = now;
    }

    if (playing.value && currentLevel.value.mode === 'timed') {
      timeLeft.value = Math.max(0, timeLeft.value - dt);
      if (timeLeft.value <= 0) {
        finishGame();
      }
    }
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
</script>

<template>
  <div
    class="relative h-full min-h-[100dvh] w-full overflow-hidden text-white"
    style="
      background-image:
        radial-gradient(circle at 20% 18%, #ff7ad9 0, transparent 55%),
        radial-gradient(circle at 80% 80%, #6ad7ff 0, transparent 50%),
        linear-gradient(160deg, #4a2a6b 0%, #2b1748 60%, #160c2a 100%);
    "
  >
    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />

    <!-- 鏡頭 PIP -->
    <div
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
          <div class="text-[11px] uppercase tracking-widest text-yellow-200">本關</div>
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
          簡易（大目標）
        </label>
        <label class="flex cursor-pointer items-center gap-2 rounded-2xl bg-black/35 px-3 py-2 text-xs font-semibold backdrop-blur">
          <input v-model="screenFx" type="checkbox" class="accent-pink-500" />
          粒子特效
        </label>
      </div>

      <div class="flex flex-col items-end gap-2">
        <div
          class="rounded-3xl bg-gradient-to-br from-[#ff6bcb]/95 to-[#ff9e6d]/95 px-7 py-4 text-center shadow-xl ring-4 ring-white/25 backdrop-blur"
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

    <!-- 鏡頭錯誤 -->
    <div
      v-if="status === 'need_camera' || status === 'error'"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 px-8 text-center backdrop-blur-md"
    >
      <p class="max-w-md text-lg leading-relaxed">{{ errMsg }}</p>
    </div>

    <!-- 玩法說明 -->
    <div
      v-if="showHow && status === 'ready'"
      class="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 px-6 backdrop-blur-sm"
    >
      <div class="max-w-lg rounded-[2rem] bg-white p-8 text-[#4a235f] shadow-2xl ring-8 ring-[#ffd6f5]/40">
        <h2 class="mb-2 text-center text-2xl font-black">{{ currentLevel.name }}</h2>
        <div class="mb-5 flex flex-wrap justify-center gap-2 text-sm font-semibold">
          <span v-for="t in currentLevel.topics.length ? currentLevel.topics : ['全部詞']" :key="t" class="rounded-full bg-[#fde8ff] px-3 py-1 text-[#a1299b]">#{{ t }}</span>
          <span v-if="currentLevel.distractorRatio > 0" class="rounded-full bg-[#ffd8dc] px-3 py-1 text-[#c72c5b]">干擾 {{ Math.round(currentLevel.distractorRatio * 100) }}%</span>
        </div>
        <ol class="mb-6 space-y-3 text-base font-semibold leading-relaxed">
          <li class="flex gap-3"><span class="text-2xl">🌟</span> 金光閃爍的是<strong>目標水果</strong>，要捏它！</li>
          <li v-if="currentLevel.distractorRatio > 0" class="flex gap-3"><span class="text-2xl">⚠️</span> 暗色水果是<strong>干擾詞</strong>，捏錯會扣分</li>
          <li class="flex gap-3"><span class="text-2xl">✋</span> 用<strong>拇指＋食指捏合</strong>對準水果</li>
        </ol>
        <button
          type="button"
          class="w-full rounded-3xl bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d] py-5 text-xl font-black text-white shadow-lg transition hover:brightness-110 active:scale-[0.99]"
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
          <dt class="text-[#8a6fb0]">捏中目標</dt>
          <dd>{{ targetHit }}</dd>
          <dt class="text-[#8a6fb0]">漏掉目標</dt>
          <dd>{{ targetMiss }}</dd>
          <dt class="text-[#8a6fb0]">捏錯干擾</dt>
          <dd>{{ wrongHit }}</dd>
          <dt class="text-[#8a6fb0]">正確率</dt>
          <dd>{{ accuracy }}%</dd>
          <dt class="text-[#8a6fb0]">最佳連擊</dt>
          <dd>{{ bestCombo }}</dd>
        </dl>
        <button
          type="button"
          class="mb-3 w-full rounded-3xl bg-[#ff6bcb] py-4 text-lg font-black text-white shadow-lg"
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
