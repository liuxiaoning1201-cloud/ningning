import { createRouter, createWebHashHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: () => import("@/views/Home.vue") },
  { path: "/setup/:templateId?", name: "setup", component: () => import("@/views/Setup.vue") },
  { path: "/play/local/:templateId", name: "play-local", component: () => import("@/views/Battle.vue") },
  { path: "/play/remote/:roomId", name: "play-remote", component: () => import("@/views/Battle.vue") },
  { path: "/room", name: "room", component: () => import("@/views/RemoteRoom.vue") },
  { path: "/teacher", name: "teacher", component: () => import("@/views/TemplateEditor.vue") },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

export default createRouter({
  history: createWebHashHistory(import.meta.env.VITE_BASE_PATH || "/"),
  routes,
});
