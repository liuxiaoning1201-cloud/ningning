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

const route = useRoute();
const router = useRouter();
const wordStore = useWordPackStore();
const { entries: wordList } = storeToRefs(wordStore);

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const showHow = ref(true);
const status = ref<'loading' | 'ready' | 'need_camera' | 'error'>('loading');
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

const EMOJIS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍒', '🥝', '🍑', '🥭'];

type Fruit = {
  id: number;
  x: number;
  y: number;
  vy: number;
  r: number;
  w: WordEntry;
  emoji: string;
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

function spawn(now: number) {
  const w = rndWord();
  const r = easyMode.value ? 76 : 64;
  fruits.value.push({
    id: ++fruitId,
    x: r + Math.random() * (cw - r * 2),
    y: -r - 10,
    vy: 1.55 + Math.random() * 1.2 + Math.min(score.value / 220, 1.4),
    r,
    w,
    emoji: EMOJIS[(fruitId + tick) % EMOJIS.length],
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
    video: { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 720 } },
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
    modelComplexity: 1,
    minDetectionConfidence: 0.62,
    minTrackingConfidence: 0.45,
  });
  h.onResults((res) => {
    lastResults = res;
  });
  await h.initialize();
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
    await bootHands();
    status.value = 'ready';
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

function loop() {
  const step = async (now: number) => {
    raf = requestAnimationFrame(step);
    tick = now;
    const dt = Math.min(0.052, (now - lastFrameT) / 1000);
    lastFrameT = now;

    const v = videoRef.value;
    const c = canvasRef.value;
    const ctx = c?.getContext('2d');
    if (!ctx || !c) return;

    if (hands && v && v.readyState >= 2) {
      try {
        await hands.send({ image: v });
      } catch {
        /* throttle */
      }
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

    /* 水果 */
    const gravity = 0.045;
    fruits.value = fruits.value.filter((f) => {
      f.vy += gravity;
      f.y += f.vy;

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
        burst(f.x, f.y, combo.value > 6 ? '#fffb8d' : '#ffffff');
        emitScore(pts);
        void speakWithBackend(f.w.word, f.w.langRead).then((r) => {
          if (!r.ok && r.error) lastTtsError.value = r.error;
          else lastTtsError.value = '';
        });
        return false;
      }

      if (f.y - f.r > ch + 40) {
        combo.value = 0;
        return false;
      }

      /* 繪製 */
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate((now - f.t) / 2200);
      const grad = ctx.createRadialGradient(-10, -10, 8, 0, 0, f.r);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.45, 'rgba(255,210,120,0.9)');
      grad.addColorStop(1, 'rgba(255,120,180,0.65)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, f.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = `${f.r * 0.9}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.emoji, 0, -4);
      ctx.font = `bold ${Math.max(14, f.r * 0.22)}px "PingFang TC","Noto Sans TC","Microsoft JhengHei",sans-serif`;
      ctx.fillStyle = 'rgba(55,25,75,0.92)';
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      const label = f.w.hanzi || f.w.word;
      ctx.strokeText(label, 0, f.r * 0.58);
      ctx.fillText(label, 0, f.r * 0.58);
      if (f.w.pinyin) {
        ctx.font = `${Math.max(11, f.r * 0.14)}px "PingFang TC",sans-serif`;
        ctx.fillStyle = 'rgba(70,35,95,0.85)';
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeText(f.w.pinyin, 0, f.r * 0.92);
        ctx.fillText(f.w.pinyin, 0, f.r * 0.92);
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

    /* 生成節奏 */
    const interval = Math.max(720, 1500 - Math.min(score.value, 420));
    if (now - lastSpawn > interval && fruits.value.length < (easyMode.value ? 6 : 8)) {
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
  <div class="relative h-full min-h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#6a3d8c] via-[#4a2a6b] to-[#1f1233] text-white">
    <video
      ref="videoRef"
      class="absolute inset-0 h-full w-full object-cover"
      style="transform: scaleX(-1)"
      muted
      playsinline
    />

    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />

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

    <!-- 載入／鏡頭錯誤 -->
    <div
      v-if="status !== 'ready'"
      class="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/55 px-8 text-center backdrop-blur-md"
    >
      <p v-if="status === 'loading'" class="text-xl font-bold">載入手勢模型…</p>
      <p v-else class="max-w-md text-lg leading-relaxed">{{ errMsg }}</p>
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
