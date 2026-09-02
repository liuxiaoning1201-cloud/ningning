<script setup lang="ts">
import { useRouter } from 'vue-router';

import { hkCharsetSize } from '@/lib/charData';
import { useWordbooks } from '@/stores/wordbooks';

const router = useRouter();
const books = useWordbooks();
const charsetSize = hkCharsetSize();

const menu = [
  {
    to: '/atlas',
    emoji: '🎒',
    name: '筆畫圖鑑',
    desc: '23 件生活物品各代表哪一筆。玩之前先認一認。',
  },
  {
    to: '/practice',
    emoji: '✏️',
    name: '練習模式',
    desc: '把對應的物品拖進米字格，自動對齊位置、長短和角度。',
  },
  {
    to: '/challenge',
    emoji: '🏆',
    name: '挑戰模式',
    desc: '靠近正確位置時自動對齊長短和角度，再按「拼好了」看種類、筆順、位置。',
  },
];
</script>

<template>
  <div class="home">
    <button class="home-gear" title="設定" @click="router.push('/teacher')">⚙</button>

    <div>
      <h1 class="home-logo">巧手猜猜字</h1>
      <p class="home-sub">
        漢字的每一筆，都是生活裡的一件東西。筷子是橫、蠟燭是直、雨傘是直鈎——
        把物品拖進米字格，字就站起來了。字形與筆順依香港《常用字字形表》。
      </p>
    </div>

    <div class="home-menu">
      <button v-for="item in menu" :key="item.to" class="menu-card" @click="router.push(item.to)">
        <span class="menu-emoji">{{ item.emoji }}</span>
        <span class="menu-name">{{ item.name }}</span>
        <span class="menu-desc">{{ item.desc }}</span>
      </button>
    </div>

    <p class="hint">
      正在用「{{ books.active?.name ?? '未選擇' }}」。
      老師把生字貼進設定即可練，涵蓋香港《常用字字形表》{{ charsetSize }} 字。
    </p>
  </div>
</template>
