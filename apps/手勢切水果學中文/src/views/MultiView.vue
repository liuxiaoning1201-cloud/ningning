<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import { useWordPackStore } from '@/stores/wordPack';
import { apiUrl, wsUrl } from '@/lib/api';
import { readInputMode, writeInputMode, type InputMode } from '@/types/level';

const router = useRouter();
const route = useRoute();
const wordStore = useWordPackStore();
const { entries } = storeToRefs(wordStore);

const inputMode = ref<InputMode>(
  route.query.input === 'click' ? 'click' : route.query.input === 'pinch' ? 'pinch' : readInputMode()
);

function pickMode(m: InputMode) {
  inputMode.value = m;
  writeInputMode(m);
}

const roomCode = ref('');
const nickname = ref(sessionStorage.getItem('fruit-player-name') || '');
const creating = ref(false);
const joining = ref(false);
const err = ref('');
const board = ref<Record<string, { name: string; score: number }>>({});

let ws: WebSocket | null = null;

const sorted = computed(() =>
  Object.entries(board.value)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.score - a.score)
);

async function createRoom() {
  err.value = '';
  creating.value = true;
  try {
    const res = await fetch(apiUrl('/api/create-room'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wordPack: entries.value }),
    });
    const data = (await res.json()) as { roomId?: string; error?: string };
    if (!res.ok || !data.roomId) throw new Error(data.error || '建立失敗');
    roomCode.value = data.roomId;
    connectWs(data.roomId);
  } catch (e) {
    err.value = e instanceof Error ? e.message : '網路錯誤（請確認 Worker 已啟動）';
  } finally {
    creating.value = false;
  }
}

function joinTypedRoom() {
  const code = roomCode.value.trim().toUpperCase();
  if (code.length < 4) {
    err.value = '請輸入房間碼';
    return;
  }
  err.value = '';
  connectWs(code);
}

function connectWs(code: string) {
  ws?.close();
  ws = new WebSocket(wsUrl(`/ws?room=${encodeURIComponent(code)}`));
  ws.addEventListener('open', () => {
    let pid = sessionStorage.getItem('fruit-player-id');
    if (!pid) {
      pid = `p_${Math.random().toString(36).slice(2, 11)}`;
      sessionStorage.setItem('fruit-player-id', pid);
    }
    const name = (nickname.value || `勇者${Math.floor(Math.random() * 900 + 100)}`).slice(0, 16);
    sessionStorage.setItem('fruit-player-name', name);
    nickname.value = name;
    ws!.send(JSON.stringify({ type: 'join', playerId: pid, name }));
  });
  ws.addEventListener('message', (ev) => {
    try {
      const m = JSON.parse(ev.data as string);
      if (m.players) board.value = m.players;
    } catch {
      /* ignore */
    }
  });
  ws.addEventListener('close', () => {
    ws = null;
  });
}

function goPlay() {
  const code = roomCode.value.trim().toUpperCase();
  if (!code) {
    err.value = '請先建立或加入房間';
    return;
  }
  router.push({ path: '/play', query: { room: code, input: inputMode.value } });
}

function disconnect() {
  ws?.close();
  board.value = {};
}
</script>

<template>
  <div class="min-h-full bg-gradient-to-br from-[#6f9dff] via-[#b388ff] to-[#ff9de2] px-5 py-12 text-white">
    <div class="mx-auto max-w-lg">
      <RouterLink to="/" class="mb-6 inline-block font-bold text-white/90 hover:underline">← 回首頁</RouterLink>

      <h1 class="mb-2 text-4xl font-black drop-shadow">多人房間</h1>
      <p class="mb-6 text-lg font-semibold text-white/95 drop-shadow">
        由一人建立房間，其他人輸入相同房間碼加入；大家各自在本機玩，分數會同步到這裡。
      </p>

      <!-- 玩法切換 -->
      <div class="mb-6 rounded-full bg-white/35 p-1.5 ring-2 ring-white/40 backdrop-blur">
        <div class="grid grid-cols-2 gap-1">
          <button
            type="button"
            class="flex flex-col items-center justify-center rounded-full px-3 py-2 text-sm font-black transition"
            :class="inputMode === 'pinch' ? 'bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d] text-white shadow' : 'text-white/85'"
            @click="pickMode('pinch')"
          >
            <span class="flex items-center gap-1.5"><span class="text-lg">🖐</span>捏爆模式</span>
            <span class="mt-0.5 text-[10px] font-semibold opacity-90">開鏡頭・捏合手勢</span>
          </button>
          <button
            type="button"
            class="flex flex-col items-center justify-center rounded-full px-3 py-2 text-sm font-black transition"
            :class="inputMode === 'click' ? 'bg-gradient-to-r from-[#5d6dff] to-[#7ee8fa] text-white shadow' : 'text-white/85'"
            @click="pickMode('click')"
          >
            <span class="flex items-center gap-1.5"><span class="text-lg">👆</span>點擊模式</span>
            <span class="mt-0.5 text-[10px] font-semibold opacity-90">滑鼠/觸控直接點</span>
          </button>
        </div>
      </div>

      <div class="mb-6 rounded-[2rem] bg-white/25 p-6 shadow-xl backdrop-blur-md ring-4 ring-white/30">
        <label class="mb-2 block text-sm font-black uppercase tracking-wider text-[#2a1050]/80">暱稱</label>
        <input
          v-model="nickname"
          maxlength="16"
          class="mb-6 w-full rounded-2xl border-2 border-white/50 bg-white/95 px-4 py-3 text-lg font-bold text-[#4a235f] outline-none focus:border-[#ff6bcb]"
          placeholder="顯示在榜單上的名字"
        />

        <button
          type="button"
          class="mb-4 w-full rounded-3xl bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d] py-4 text-lg font-black shadow-lg transition hover:brightness-110 disabled:opacity-60"
          :disabled="creating"
          @click="createRoom"
        >
          {{ creating ? '建立中…' : '建立新房間（帶上目前詞表）' }}
        </button>

        <div class="mb-4 flex gap-3">
          <input
            v-model="roomCode"
            class="flex-1 rounded-2xl border-2 border-white/60 bg-white/95 px-4 py-3 text-center text-2xl font-black tracking-[0.3em] text-[#4a235f] outline-none focus:border-[#7ee8fa]"
            placeholder="房間碼"
            maxlength="8"
          />
          <button
            type="button"
            class="rounded-2xl bg-[#39d98a] px-5 py-3 font-black text-[#06351f] shadow-md"
            :disabled="joining"
            @click="joinTypedRoom"
          >
            加入
          </button>
        </div>

        <p v-if="err" class="mb-4 rounded-xl bg-red-500/90 px-4 py-3 text-sm font-bold text-white">{{ err }}</p>

        <div class="flex flex-wrap gap-3">
          <button
            type="button"
            class="flex-1 rounded-2xl bg-white/95 py-4 text-lg font-black text-[#843fa1] shadow-md"
            @click="goPlay"
          >
            進入遊戲畫面
          </button>
          <button type="button" class="rounded-2xl bg-black/25 px-5 py-4 font-bold text-white" @click="disconnect">
            斷開連線
          </button>
        </div>
      </div>

      <div class="rounded-[2rem] bg-black/25 p-6 backdrop-blur-md ring-2 ring-white/20">
        <h2 class="mb-4 text-xl font-black">即時榜</h2>
        <p v-if="!sorted.length" class="font-semibold text-white/80">尚未連線或尚無玩家。</p>
        <ol v-else class="space-y-3">
          <li
            v-for="(p, i) in sorted"
            :key="p.id"
            class="flex items-center justify-between rounded-2xl bg-white/20 px-4 py-3 font-bold"
          >
            <span>{{ i + 1 }}. {{ p.name }}</span>
            <span class="tabular-nums text-yellow-200">{{ p.score }}</span>
          </li>
        </ol>
      </div>

      <p class="mt-8 text-center text-sm font-semibold text-white/85">
        開發模式請同時執行 <code class="rounded bg-black/30 px-2 py-1">wrangler dev</code>（8787）與
        <code class="rounded bg-black/30 px-2 py-1">npm run dev</code>，以便 API 與 WS 代理生效。
      </p>
    </div>
  </div>
</template>
