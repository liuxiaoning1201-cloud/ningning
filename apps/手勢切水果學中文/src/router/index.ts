import { createRouter, createWebHistory } from 'vue-router';

const base = import.meta.env.BASE_URL;

export default createRouter({
  history: createWebHistory(base),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/play', name: 'play', component: () => import('@/views/PlayView.vue') },
    { path: '/teacher', name: 'teacher', component: () => import('@/views/TeacherView.vue') },
    { path: '/multi', name: 'multi', component: () => import('@/views/MultiView.vue') },
  ],
});
