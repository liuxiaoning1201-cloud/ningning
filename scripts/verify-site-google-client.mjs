#!/usr/bin/env node
/**
 * 對照線上 /auth/config 與本機預期：提醒在 Google Cloud 憑證頁確認該「用戶端 ID」仍存在且已啟用。
 */
const base = process.argv[2] || "https://zykongjian.pages.dev";
const url = new URL("/auth/config", base).href;

const res = await fetch(url);
const data = await res.json();
const id = data.googleClientId || "";

console.log("線上 /auth/config 回傳的 Google Client ID：");
console.log(id || "(空)");
console.log("");
console.log("請到 Google Cloud Console → API 和服務 → 憑證：");
console.log("https://console.cloud.google.com/apis/credentials");
console.log("確認列表中仍有「完全相同」的 OAuth 2.0 用戶端 ID，且：");
console.log("  • 類型為「網頁應用程式」");
console.log("  • 已授權的 JavaScript 來源含：" + new URL(base).origin);
console.log("若列表中沒有這一串 ID，請新建用戶端並更新 Cloudflare Secret GOOGLE_CLIENT_ID。");
