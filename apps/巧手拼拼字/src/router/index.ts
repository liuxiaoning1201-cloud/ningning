import { createRouter, createWebHashHistory } from 'vue-router';

/**
 * 用 hash 路由：這個 app 走 Cloudflare Pages 的靜態子路徑，
 * 沒有伺服器改寫規則，hash 才不會在重新整理時掉到 404。
 */
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/atlas', name: 'atlas', component: () => import('@/views/AtlasView.vue') },
    { path: '/practice', name: 'practice', component: () => import('@/views/PracticeView.vue') },
    { path: '/challenge', name: 'challenge', component: () => import('@/views/ChallengeView.vue') },
    { path: '/teacher', name: 'teacher', component: () => import('@/views/TeacherView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

export default router;
