import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
import "@fontsource/lxgw-wenkai-tc/400.css";
import "@fontsource/lxgw-wenkai-tc/700.css";
import "./style.css";

const app = createApp(App);
app.use(createPinia());
app.mount("#app");
