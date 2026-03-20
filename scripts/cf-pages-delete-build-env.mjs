#!/usr/bin/env node
/**
 * 從 Cloudflare Pages 專案刪除「建置用」環境變數（例如已刪除的 VITE_GOOGLE_CLIENT_ID）。
 * 優先使用環境變數 CLOUDFLARE_API_TOKEN；否則在 macOS 嘗試讀取 Wrangler 的 oauth_token。
 *
 * 用法：
 *   node scripts/cf-pages-delete-build-env.mjs [變數名]
 * 預設變數名：VITE_GOOGLE_CLIENT_ID
 */
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const PROJECT = process.env.CF_PAGES_PROJECT || "zykongjian";
const ACCOUNT_ID = process.env.CF_ACCOUNT_ID || "9e06e0f0b44c3c0ea56240d583bffe39";
const VAR_NAME = process.argv[2] || "VITE_GOOGLE_CLIENT_ID";

function getToken() {
  if (process.env.CLOUDFLARE_API_TOKEN?.trim()) {
    return process.env.CLOUDFLARE_API_TOKEN.trim();
  }
  const paths = [
    join(homedir(), "Library/Preferences/.wrangler/config/default.toml"),
    join(homedir(), ".wrangler/config/default.toml"),
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    const raw = readFileSync(p, "utf8");
    const m = raw.match(/^oauth_token\s*=\s*"([^"]+)"/m);
    if (m) return m[1];
  }
  return null;
}

const token = getToken();
if (!token) {
  console.error(
    "找不到 API 憑證：請設定 CLOUDFLARE_API_TOKEN，或先執行 wrangler login。",
  );
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/pages/projects/${PROJECT}`;

const body = {
  deployment_configs: {
    production: {
      env_vars: {
        [VAR_NAME]: null,
      },
    },
  },
};

const res = await fetch(url, {
  method: "PATCH",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});

const json = await res.json();
if (!json.success) {
  console.error("Cloudflare API 失敗：", JSON.stringify(json, null, 2));
  process.exit(1);
}

const prodVars = json.result?.deployment_configs?.production?.env_vars ?? {};
const keys = Object.keys(prodVars).filter((k) => !String(k).startsWith("_"));
console.log(`已送出刪除「${VAR_NAME}」的 PATCH。`);
console.log("Production 建置變數鍵名（不含值）：", keys.join(", ") || "(無)");
