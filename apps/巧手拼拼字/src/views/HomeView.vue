<script setup lang="ts">
import { useRouter } from 'vue-router';

import HomeLogo from '@/components/HomeLogo.vue';
import MascotHint from '@/components/MascotHint.vue';
import { strokeImage } from '@/data/strokes';
import { hkCharsetSize } from '@/lib/charData';
import { useWordbooks } from '@/stores/wordbooks';

const router = useRouter();
const books = useWordbooks();
const charsetSize = hkCharsetSize();

const menu = [
  {
    to: '/atlas',
    name: '筆畫圖鑑',
    desc: '先來認一認：哪一件是哪一筆。',
    images: [strokeImage('dian'), strokeImage('heng'), strokeImage('zhigou')],
    tone: 'sky',
  },
  {
    to: '/practice',
    name: '練習模式',
    desc: '拖進去就會吸住。慢慢拼，不怕錯。',
    images: [strokeImage('pie'), strokeImage('na')],
    tone: 'mint',
  },
  {
    to: '/challenge',
    name: '挑戰模式',
    desc: '自己擺、自己轉。拼好了再看分數。',
    images: [strokeImage('hengzhi'), strokeImage('zhigou')],
    tone: 'butter',
  },
];
</script>

<template>
  <div class="home">
    <button class="home-gear" title="設定" @click="router.push('/teacher')">⚙</button>

    <HomeLogo />

    <MascotHint mood="idle" message="你看，上面這五個字，都是家裡的東西拼的。" />

    <div class="home-menu">
      <button
        v-for="item in menu"
        :key="item.to"
        class="menu-card"
        :class="`is-${item.tone}`"
        @click="router.push(item.to)"
      >
        <span class="menu-objects" aria-hidden="true">
          <img v-for="src in item.images" :key="src" :src="src" alt="" />
        </span>
        <span class="menu-name">{{ item.name }}</span>
        <span class="menu-desc">{{ item.desc }}</span>
      </button>
    </div>

    <p class="home-sub">
      筷子平放，就是橫。<br />
      蠟燭站直，就是直。<br />
      雨傘往下一鈎，就是鈎。把東西拖進米字格，對了物品、位置和順序，字就站起來了。
    </p>

    <p class="hint home-foot">
      正在用「{{ books.active?.name ?? '未選擇' }}」。老師在設定裡貼生字就可以練。
      字形、筆順依香港《小學學習字詞表》／《常用字字形表》，共 {{ charsetSize }} 字。
    </p>
  </div>
</template>
