import { createRouter, createWebHashHistory } from "vue-router";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", name: "Home", component: () => import("@/views/Home.vue") },
    {
      path: "/settings",
      name: "Settings",
      component: () => import("@/views/settings/Settings.vue"),
    },
    {
      path: "/settings/banks/new",
      name: "WordBankNew",
      component: () => import("@/views/teacher/WordBankEdit.vue"),
    },
    {
      path: "/settings/banks/:bankId",
      name: "WordBankEdit",
      component: () => import("@/views/teacher/WordBankEdit.vue"),
    },
    {
      path: "/settings/puzzles/crossword/new",
      name: "CrosswordNew",
      component: () => import("@/views/teacher/CrosswordEditor.vue"),
    },
    {
      path: "/settings/puzzles/crossword/:setId",
      name: "CrosswordEdit",
      component: () => import("@/views/teacher/CrosswordEditor.vue"),
    },
    {
      path: "/play",
      name: "PlayPick",
      component: () => import("@/views/play/PuzzleSetPick.vue"),
    },
    {
      path: "/play/crossword/:setId",
      name: "CrosswordPlay",
      component: () => import("@/views/play/CrosswordPlay.vue"),
    },
    {
      path: "/play/local/:setId",
      name: "LocalBattle",
      component: () => import("@/views/play/LocalBattle.vue"),
    },
    {
      path: "/play/remote",
      name: "RemoteBattle",
      component: () => import("@/views/play/RemoteBattle.vue"),
    },
    // Legacy redirects
    { path: "/teacher", redirect: "/settings" },
    { path: "/teacher/banks/new", redirect: "/settings/banks/new" },
    { path: "/teacher/banks/:bankId", redirect: to => `/settings/banks/${to.params.bankId}` },
    { path: "/teacher/puzzles", redirect: "/settings" },
  ],
});

export default router;
