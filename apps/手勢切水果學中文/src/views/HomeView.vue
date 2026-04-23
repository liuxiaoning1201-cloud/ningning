<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <div
    class="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-[#ff9edb] via-[#c9b6ff] to-[#7ee8fa] px-6 pb-24 pt-16 text-[#3b1c4f]"
  >
    <div
      class="pointer-events-none absolute inset-0 opacity-35"
      style="
        background-image:
          radial-gradient(circle at 20% 30%, white 0, transparent 55%),
          radial-gradient(circle at 80% 70%, #fff59d 0, transparent 45%);
      "
    />

    <div class="relative z-10 flex max-w-lg flex-col items-center text-center">
      <p class="mb-3 rounded-full bg-white/35 px-5 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[#6b3f7f] backdrop-blur">
        MediaPipe × 中文
      </p>
      <h1 class="mb-3 text-4xl font-black leading-tight text-white drop-shadow-md md:text-5xl">
        捏水果<br /><span class="text-[#fff59d]">學中文</span>
      </h1>
      <p class="mb-10 text-lg font-medium text-white/90 drop-shadow">
        對準水果捏一下——聽發音、記詞語！
      </p>

      <RouterLink
        to="/play"
        class="group mb-5 flex w-full max-w-xs items-center justify-center rounded-3xl bg-gradient-to-r from-[#ff6bcb] to-[#ff9e6d] px-10 py-5 text-xl font-black text-white shadow-[0_12px_40px_-10px_rgba(255,80,180,.8)] ring-4 ring-white/40 transition hover:scale-[1.03] hover:shadow-[0_18px_50px_-12px_rgba(255,80,180,.9)] active:scale-[0.98]"
      >
        <span class="mr-3 text-3xl transition group-hover:rotate-12">🎯</span>
        開始單機遊戲
      </RouterLink>

      <RouterLink
        to="/multi"
        class="mb-5 flex w-full max-w-xs items-center justify-center rounded-3xl bg-white/90 px-8 py-4 text-lg font-bold text-[#843fa1] shadow-lg backdrop-blur transition hover:bg-white"
      >
        👯 多人房間（比分同步）
      </RouterLink>

      <RouterLink
        to="/teacher"
        class="rounded-2xl px-6 py-3 text-base font-semibold text-[#5a2f6c] underline decoration-2 underline-offset-4 hover:text-[#842f9e]"
      >
        教師：匯入詞表（Excel／貼上）
      </RouterLink>

      <p class="mt-14 max-w-sm text-sm leading-relaxed text-[#5a3268]/90">
        小技巧：鏡頭要亮、手離鏡頭不要太遠；用<strong>大拇指與食指捏合</strong>對準水果。
      </p>
    </div>

    <div class="pointer-events-none absolute bottom-8 left-0 right-0 flex justify-center gap-6 text-5xl opacity-80">
      <span class="animate-bounce" style="animation-duration: 2s">🍎</span>
      <span class="animate-bounce" style="animation-duration: 2.3s">🍊</span>
      <span class="animate-bounce" style="animation-duration: 2.7s">🍇</span>
    </div>
  </div>
</template>
