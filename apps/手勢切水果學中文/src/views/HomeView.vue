<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { computed, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useLevelStore } from '@/stores/levels';
import { readInputMode, writeInputMode, type InputMode } from '@/types/level';

const router = useRouter();
const levelStore = useLevelStore();
const { items: levels, selectedId } = storeToRefs(levelStore);

const inputMode = ref<InputMode>(readInputMode());

function pickMode(m: InputMode) {
  inputMode.value = m;
  writeInputMode(m);
}

const selectedLevel = computed(() => levels.value.find((l) => l.id === selectedId.value) || levels.value[0] || null);

function playSelected() {
  const q: Record<string, string> = { input: inputMode.value };
  if (selectedLevel.value) q.level = selectedLevel.value.id;
  router.push({ path: '/play', query: q });
}

function multiHref() {
  return { path: '/multi', query: { input: inputMode.value } };
}
</script>

<template>
  <div
    class="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#ff9edb] via-[#c9b6ff] to-[#7ee8fa] px-6 pb-24 pt-14 text-[#3b1c4f]"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-35"
      style="
        background-image:
          radial-gradient(circle at 20% 30%, white 0, transparent 55%),
          radial-gradient(circle at 80% 70%, #fff59d 0, transparent 45%);
      "
    />

    <RouterLink
      to="/settings"
      class="absolute right-4 top-4 z-20 flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-black text-[#6b2f8f] shadow backdrop-blur hover:bg-white"
    >
      ⚙ 教師設定
    </RouterLink>

    <div class="relative z-10 flex max-w-lg flex-col items-center text-center">
      <p class="mb-3 rounded-full bg-white/35 px-5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[#6b3f7f] backdrop-blur">
        MediaPipe × 點擊雙模式
      </p>
      <h1 class="mb-3 text-4xl font-black leading-tight text-white drop-shadow-md md:text-5xl">
        捏爆識字果
      </h1>
      <p class="mb-6 text-lg font-medium text-white/90 drop-shadow">
        對準水果——聽發音、記詞語、闖關拿三星！
      </p>

      <!-- 玩法切換 -->
      <div class="mb-4 w-full max-w-xs rounded-full bg-white/85 p-1.5 shadow-lg ring-2 ring-white/50 backdrop-blur">
        <div class="grid grid-cols-2 gap-1">
          <button
            type="button"
            class="flex flex-col items-center justify-center rounded-full px-3 py-2 text-sm font-black transition"
            :class="inputMode === 'pinch' ? 'bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d] text-white shadow' : 'text-[#7a4a96]'"
            @click="pickMode('pinch')"
          >
            <span class="flex items-center gap-1.5"><span class="text-lg">🖐</span>捏爆模式</span>
            <span class="mt-0.5 text-[10px] font-semibold opacity-90">
              {{ inputMode === 'pinch' ? '開鏡頭・拇指食指捏合' : '需要鏡頭' }}
            </span>
          </button>
          <button
            type="button"
            class="flex flex-col items-center justify-center rounded-full px-3 py-2 text-sm font-black transition"
            :class="inputMode === 'click' ? 'bg-gradient-to-r from-[#5d6dff] to-[#7ee8fa] text-white shadow' : 'text-[#476ab8]'"
            @click="pickMode('click')"
          >
            <span class="flex items-center gap-1.5"><span class="text-lg">👆</span>點擊模式</span>
            <span class="mt-0.5 text-[10px] font-semibold opacity-90">
              {{ inputMode === 'click' ? '單機就能玩・滑鼠/觸控' : '老師示範用' }}
            </span>
          </button>
        </div>
      </div>

      <!-- 關卡選擇 -->
      <div v-if="levels.length" class="mb-4 w-full max-w-xs rounded-3xl bg-white/85 p-4 shadow-xl ring-2 ring-white/50 backdrop-blur">
        <div class="mb-2 text-xs font-black uppercase tracking-widest text-[#8a3fbf]">本次闖關</div>
        <select
          :value="selectedId"
          class="w-full rounded-2xl border-2 border-[#e6d0f5] bg-white px-3 py-3 text-base font-bold text-[#3d2255] outline-none focus:border-[#d56fff]"
          @change="(e: Event) => levelStore.select((e.target as HTMLSelectElement).value)"
        >
          <option v-for="l in levels" :key="l.id" :value="l.id">{{ l.name }}</option>
        </select>
        <div v-if="selectedLevel" class="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[#6b2f8f]">
          <span v-for="t in selectedLevel.topics.length ? selectedLevel.topics : ['全部詞']" :key="t" class="rounded-full bg-[#fde8ff] px-2 py-0.5">
            #{{ t }}
          </span>
          <span class="rounded-full bg-[#e0f2ff] px-2 py-0.5 text-[#2f6f9c]">
            {{ selectedLevel.voice === 'cantonese' ? '粵語' : selectedLevel.voice === 'mandarin' ? '普通話' : '依詞條' }}
          </span>
          <span class="rounded-full bg-[#e8ffe3] px-2 py-0.5 text-[#2e7d32]">
            {{ selectedLevel.mode === 'timed' ? `${selectedLevel.duration}s` : selectedLevel.mode === 'count' ? `${selectedLevel.targetCount}顆` : selectedLevel.mode === 'survival' ? `漏${selectedLevel.missAllowance}` : '自由' }}
          </span>
        </div>
      </div>

      <button
        type="button"
        class="group mb-4 flex w-full max-w-xs items-center justify-center rounded-3xl px-10 py-5 text-xl font-black text-white shadow-[0_12px_40px_-10px_rgba(255,80,180,.8)] ring-4 ring-white/40 transition hover:scale-[1.03] hover:shadow-[0_18px_50px_-12px_rgba(255,80,180,.9)] active:scale-[0.98]"
        :class="inputMode === 'pinch' ? 'bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d]' : 'bg-gradient-to-r from-[#5d6dff] to-[#7ee8fa]'"
        @click="playSelected"
      >
        <span class="mr-3 text-3xl transition group-hover:rotate-12">{{ inputMode === 'pinch' ? '🎯' : '👆' }}</span>
        {{ inputMode === 'pinch' ? '開始捏爆' : '開始點擊闖關' }}
      </button>

      <RouterLink
        :to="multiHref()"
        class="mb-4 flex w-full max-w-xs items-center justify-center rounded-3xl bg-white/90 px-8 py-4 text-lg font-bold text-[#843fa1] shadow-lg backdrop-blur transition hover:bg-white"
      >
        👯 多人房間（比分同步）
      </RouterLink>

      <div class="flex gap-4 text-sm font-semibold">
        <RouterLink to="/settings" class="rounded-2xl px-4 py-2 text-[#5a2f6c] underline decoration-2 underline-offset-4 hover:text-[#842f9e]">
          關卡・詞表設定
        </RouterLink>
      </div>

      <p class="mt-10 max-w-sm text-sm leading-relaxed text-[#5a3268]/90">
        <template v-if="inputMode === 'pinch'">
          小技巧：鏡頭要亮、手離鏡頭不要太遠；用<strong>大拇指與食指捏合</strong>對準水果。
        </template>
        <template v-else>
          適合一台電腦上課：<strong>用滑鼠或觸控直接點</strong>水果，老師可以投影示範，學生輪流上來操作。
        </template>
      </p>
    </div>

    <div class="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center gap-6 text-5xl opacity-80">
      <span class="animate-bounce" style="animation-duration: 2s">🍎</span>
      <span class="animate-bounce" style="animation-duration: 2.3s">🍊</span>
      <span class="animate-bounce" style="animation-duration: 2.7s">🍇</span>
    </div>
  </div>
</template>
