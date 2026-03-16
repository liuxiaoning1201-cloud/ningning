/**
 * 測試遠程對戰頁是否顯示「Google 登入」按鈕（需有 VITE_GOOGLE_CLIENT_ID 時才顯示）
 * 執行：VITE_GOOGLE_CLIENT_ID=xxx npx vite --host & 後再 node scripts/test-google-login-button.mjs
 * 或：node scripts/test-google-login-button.mjs（會自動用假 ID 啟動 dev 並測試）
 */
import { spawn } from "child_process";
import { createInterface } from "readline";
import { chromium } from "playwright";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync, existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readEnv() {
  const p = join(root, ".env");
  if (!existsSync(p)) return {};
  const text = readFileSync(p, "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^VITE_GOOGLE_CLIENT_ID=(.*)$/);
    if (m) out.VITE_GOOGLE_CLIENT_ID = m[1].trim();
  }
  return out;
}

function waitForServer(url, maxWait = 15000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryFetch = () => {
      fetch(url)
        .then(() => resolve())
        .catch(() => {
          if (Date.now() - start > maxWait) reject(new Error("Server did not start in time"));
          else setTimeout(tryFetch, 300);
        });
    };
    tryFetch();
  });
}

async function main() {
  const envFromFile = readEnv();
  const clientId = process.env.VITE_GOOGLE_CLIENT_ID || envFromFile.VITE_GOOGLE_CLIENT_ID;
  const useFakeId = !clientId;
  const effectiveId = clientId || "123456789-fake.apps.googleusercontent.com";

  let devProcess = null;
  let baseUrl = "http://localhost:5173";

  if (useFakeId) {
    baseUrl = "http://localhost:5179";
    console.log("未設定 VITE_GOOGLE_CLIENT_ID，使用假 ID 在 port 5179 啟動 dev 以測試按鈕是否顯示…");
    devProcess = spawn("npx", ["vite", "--host", "--port", "5179"], {
      cwd: root,
      env: { ...process.env, VITE_GOOGLE_CLIENT_ID: effectiveId },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForServer(baseUrl, 20000).catch((e) => {
      console.error("Dev server 啟動逾時:", e.message);
      process.exit(1);
    });
  } else {
    console.log("使用 .env 中的 VITE_GOOGLE_CLIENT_ID 進行測試（請先確認 dev server 已啟動）");
    try {
      await waitForServer("http://localhost:5173");
      baseUrl = "http://localhost:5173";
    } catch {
      try {
        await waitForServer("http://localhost:5178");
        baseUrl = "http://localhost:5178";
      } catch {
        console.error("請先執行 npm run dev 並再執行本測試。");
        process.exit(1);
      }
    }
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(`${baseUrl}/#/play/remote`, { waitUntil: "networkidle", timeout: 10000 });
    await page.waitForSelector("button:has-text('Google'), button:has-text('登入')", { timeout: 5000 }).catch(() => null);
    const btn = await page.locator("button:has-text('Google 登入')").first();
    const count = await btn.count();
    if (count === 0) {
      console.error("FAIL: 頁面上未找到「Google 登入」按鈕");
      process.exit(1);
    }
    console.log("OK: 「Google 登入」按鈕已顯示，測試通過。");
  } finally {
    await browser.close();
    if (devProcess) devProcess.kill("SIGTERM");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
