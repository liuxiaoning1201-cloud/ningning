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
import type { WordEntry } from '@/types/word';
import { drawFruit, fruitForWord, accentFor, type FruitKind } from '@/composables/fruits';

const route = useRoute();
const router = useRouter();
const wordStore = useWordPackStore();
const { entries: wordList } = storeToRefs(wordStore);

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const showHow = ref(true);
const status = ref<'loading' | 'ready' | 'need_camera' | 'error'>('loading');
const handsReady = ref(false);
const errMsg = ref('');

const playing = ref(false);
const timeLeft = ref(75);
const score = ref(0);
const combo = ref(0);
const bestCombo = ref(0);
const gameOver = ref(false);
const easyMode = ref(true);
const screenFx = ref(true);
const lastTtsError = ref('');

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

let cw = 800;
let ch = 600;

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

function rndWord(): WordEntry {
  const list = wordList.value;
  return list[Math.floor(Math.random() * list.length)]!;
}

/** 由分數調整的「等速」下落速度（像素/秒），加分後輕微提速但仍為勻速 */
function fallSpeed() {
  const base = easyMode.value ? 110 : 145;
  return base + Math.min(score.value * 0.25, 90);
}

/** 找一個與既有水果不重疊的 x 位置；找不到就放棄這次生成 */
function pickSpawnX(r: number): number | null {
  const margin = r + 18;
  const minGap = r * 2 + 24;
  for (let i = 0; i < 12; i++) {
    const x = margin + Math.random() * Math.max(1, cw - margin * 2);
    let ok = true;
    for (const f of fruits.value) {
      if (f.y < r * 2.5) {
        if (Math.abs(f.x - x) < minGap) {
          ok = false;
          break;
        }
      }
    }
    if (ok) return x;
  }
  return null;
}

function spawn(now: number) {
  const w = rndWord();
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
  });
}

function burst(x: number, y: number, color: string) {
  if (!screenFx.value) return;
  const n = 28;
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
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${proto}//${location.host}/ws?room=${encodeURIComponent(room)}`;
  ws = new WebSocket(url);
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

onMounted(async () => {
  if (!wordList.value.length) {
    router.replace('/teacher');
    return;
  }
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

    /* MediaPipe 推送：節流到 ~30fps，且不阻塞渲染 */
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

    /* 粒子 */
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

    /* 水果（勻速下落，無重力） */
    const speed = fallSpeed();
    fruits.value = fruits.value.filter((f) => {
      f.vy = speed;
      f.y += f.vy * dt;

      /* 命中 */
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
        combo.value += 1;
        bestCombo.value = Math.max(bestCombo.value, combo.value);
        const pts = 10 + Math.min(combo.value * 2, 40);
        score.value += pts;
        const ac = accentFor(f.kind);
        burst(f.x, f.y, combo.value > 6 ? '#fffb8d' : ac.soft);
        emitScore(pts);
        void speakWithBackend(f.w.word || f.w.hanzi || '', f.w.langRead).then((r) => {
          if (!r.ok && r.error) lastTtsError.value = r.error;
          else lastTtsError.value = '';
        });
        return false;
      }

      if (f.y - f.r > ch + 40) {
        combo.value = 0;
        return false;
      }

      /* 水果繪製 */
      const bob = Math.sin((now / 600) + f.bobPhase) * 0.08;
      drawFruit(ctx, f.kind, f.x, f.y, f.r, bob);

      /* 文字標籤（純中文＋拼音） */
      const label = f.w.hanzi || f.w.word;
      const pinyin = f.w.pinyin || '';
      ctx.save();
      ctx.translate(f.x, f.y + f.r + 6);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const labelFont = `900 ${Math.max(18, Math.round(f.r * 0.42))}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
      ctx.font = labelFont;
      const labelW = ctx.measureText(label).width;
      const padX = 10;
      const padY = 5;
      const labelH = Math.max(20, Math.round(f.r * 0.42)) + padY * 2;
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
      ctx.fillText(label, 0, padY);
      if (pinyin) {
        ctx.font = `600 ${Math.max(11, Math.round(f.r * 0.18))}px "PingFang TC",sans-serif`;
        ctx.fillStyle = 'rgba(255,236,180,0.95)';
        ctx.fillText(pinyin, 0, bh + 4);
      }
      ctx.restore();

      return true;
    });

    /* 捏合瞄准提示 */
    if (sample && playing.value) {
      ctx.strokeStyle = sample.pinch ? 'rgba(255,80,180,0.85)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = sample.pinch ? 5 : 3;
      ctx.beginPath();
      ctx.arc(sample.cx, sample.cy, sample.pinch ? 26 : 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    /* 生成節奏：固定間隔避免成串掉落擠在一起 */
    const interval = easyMode.value
      ? Math.max(900, 1400 - Math.min(score.value, 350))
      : Math.max(700, 1200 - Math.min(score.value, 400));
    const cap = easyMode.value ? 5 : 7;
    if (now - lastSpawn > interval && fruits.value.length < cap) {
      spawn(now);
      lastSpawn = now;
    }

    /* 倒计时 */
    if (playing.value) {
      timeLeft.value = Math.max(0, timeLeft.value - dt);
      if (timeLeft.value <= 0) {
        playing.value = false;
        gameOver.value = true;
      }
    }
  };
  lastFrameT = performance.now();
  raf = requestAnimationFrame(step);
}

function startGame() {
  showHow.value = false;
  gameOver.value = false;
  playing.value = true;
  score.value = 0;
  combo.value = 0;
  bestCombo.value = 0;
  fruits.value = [];
  particles.value = [];
  pinch.reset();
  lastSpawn = performance.now();
  timeLeft.value = 75;
}

function goHome() {
  router.push('/');
}

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

    <!-- 鏡頭 PIP（右下角小框） -->
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
          ⏱ {{ Math.ceil(timeLeft) }} 秒
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
        <h2 class="mb-6 text-center text-3xl font-black">怎麼玩？</h2>
        <ol class="mb-8 space-y-4 text-lg font-semibold leading-relaxed">
          <li class="flex gap-4"><span class="text-3xl">1️⃣</span> 允許鏡頭，把手放在畫面裡</li>
          <li class="flex gap-4"><span class="text-3xl">2️⃣</span> 水果會掉下來，上面有詞語</li>
          <li class="flex gap-4"><span class="text-3xl">3️⃣</span> 用<strong>拇指＋食指捏合</strong>對準水果</li>
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
      <div class="max-w-md rounded-[2rem] bg-gradient-to-br from-[#ffe6fb] to-[#d5f6ff] p-10 text-center text-[#4a235f] shadow-2xl">
        <p class="mb-2 text-2xl font-black">時間到！</p>
        <p class="mb-6 text-5xl font-black text-transparent bg-gradient-to-r from-[#ff3cac] to-[#784ba0] bg-clip-text">
          {{ score }} 分
        </p>
        <p class="mb-8 text-lg font-bold">最佳連擊 {{ bestCombo }}</p>
        <button
          type="button"
          class="mb-4 w-full rounded-3xl bg-[#ff6bcb] py-4 text-xl font-black text-white shadow-lg"
          @click="
            gameOver = false;
            startGame();
          "
        >
          再來一局
        </button>
        <button type="button" class="w-full rounded-3xl bg-white py-4 text-lg font-bold text-[#843fa1]" @click="goHome">
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
