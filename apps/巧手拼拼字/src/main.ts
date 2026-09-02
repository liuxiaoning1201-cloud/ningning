import { createPinia } from 'pinia';
import { createApp } from 'vue';

import App from '@/App.vue';
import { assertStrokeTableIntegrity } from '@/data/strokes';
import router from '@/router';
import '@/styles.css';

// 一筆一物、一物一筆。撞件要在開發期就炸掉，不要等到課堂上才發現。
assertStrokeTableIntegrity();

createApp(App).use(createPinia()).use(router).mount('#app');
