<script setup lang="ts">
import { useRouter } from 'vue-router';

import { hkCharsetSize, verifiedChars } from '@/lib/charData';
import { useWordbooks } from '@/stores/wordbooks';

const router = useRouter();
const books = useWordbooks();

const readyCount = verifiedChars().length;
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
    desc: '物品會自動吸到正確位置，並鎖住筆順，一筆一筆帶你寫完。',
  },
  {
    to: '/challenge',
    emoji: '🏆',
    name: '挑戰模式',
    desc: '自己擺、自己轉，按「拼好了」看種類、筆順、位置三項得分。',
  },
  {
    to: '/teacher',
    emoji: '📚',
    name: '老師設定',
    desc: '建字簿、加減練習字、匯出匯入，一課一本。',
  },
];
</script>

<template>
  <div class="home">
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
      目前字庫：{{ readyCount }} 個字的筆畫標註已人工覈核，可玩練習模式；
      白名單涵蓋香港《常用字字形表》{{ charsetSize }} 字。
      正在用的字簿是「{{ books.active?.name ?? '未選擇' }}」。
    </p>
  </div>
</template>
