import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
    },
    {
      path: '/translate',
      name: 'translate',
      component: () => import('../pages/PasteTranslate.vue'),
    },
    {
      path: '/asr',
      name: 'asr',
      component: () => import('../pages/AsrUpload.vue'),
    },
    {
      path: '/ocr',
      name: 'ocr',
      component: () => import('../pages/OcrUpload.vue'),
    },
    {
      path: '/vocab',
      name: 'vocab',
      component: () => import('../pages/VocabBook.vue'),
    },
    {
      path: '/review',
      name: 'review',
      component: () => import('../pages/ReviewPage.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('../pages/DashboardPage.vue'),
    },
    {
      path: '/apikeys',
      name: 'apikeys',
      component: () => import('../pages/ApiKeysPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: { name: 'home' },
    },
  ],
})

export default router
