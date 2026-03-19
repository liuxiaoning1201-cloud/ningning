import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('../views/TeacherDashboard.vue'),
    },
    {
      path: '/classroom',
      name: 'classroom',
      component: () => import('../views/ClassroomControl.vue'),
    },
    {
      path: '/display',
      name: 'display',
      component: () => import('../views/StudentDisplay.vue'),
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('../views/HistoryView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
  ],
})

export default router
