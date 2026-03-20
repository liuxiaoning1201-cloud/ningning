import { apiPost, setJwt, saveUser, clearAuth } from "./api";
import type { ApiUser } from "./api";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let gsiLoaded = false;

/** 建置時 .env 的 ID（若已刪除 Google 用戶端會導致 deleted_client，請勿在 Cloudflare 填舊 ID） */
export function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
}

/** undefined = 尚未請求；已快取字串（可為空） */
let resolvedClientId: string | undefined;

/**
 * 實際用於 GSI 的 Client ID：
 * - **正式建置**：一律向 `/auth/config` 取得（與 Cloudflare Secret 一致），避免 Pages 建置變數裡殘留已刪除的舊 ID 導致 `deleted_client`。
 * - **開發模式**：優先 `VITE_GOOGLE_CLIENT_ID`，否則再請求後端。
 */
export async function resolveGoogleClientId(): Promise<string> {
  if (import.meta.env.PROD) {
    if (resolvedClientId !== undefined) return resolvedClientId;
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const r = await fetch(`${base}/auth/config`, { credentials: "include" });
      const data = (await r.json()) as { googleClientId?: string };
      resolvedClientId = (data.googleClientId || "").trim();
      return resolvedClientId;
    } catch {
      resolvedClientId = "";
      return "";
    }
  }

  const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (fromEnv) return fromEnv;

  if (resolvedClientId !== undefined) return resolvedClientId;

  try {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const r = await fetch(`${base}/auth/config`, { credentials: "include" });
    const data = (await r.json()) as { googleClientId?: string };
    resolvedClientId = (data.googleClientId || "").trim();
    return resolvedClientId;
  } catch {
    resolvedClientId = "";
    return "";
  }
}

/** 是否顯示 Google 按鈕：有 VITE 設定，或正式建置（執行時會向 /auth/config 取 ID） */
export function isGoogleLoginAvailable(): boolean {
  return !!getGoogleClientId() || import.meta.env.PROD;
}

export async function loadGsi(): Promise<void> {
  if (gsiLoaded) return;
  if (typeof document === "undefined") return;

  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`)) {
      gsiLoaded = true;
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      gsiLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

export async function signInWithGoogle(): Promise<ApiUser | null> {
  const clientId = await resolveGoogleClientId();
  if (!clientId) {
    throw new Error(
      "無法取得 Google 用戶端 ID：請在 Cloudflare Pages 設定 GOOGLE_CLIENT_ID，或在 .env 設定 VITE_GOOGLE_CLIENT_ID。"
    );
  }

  await loadGsi();

  return new Promise((resolve, reject) => {
    const google = (window as unknown as { google: { accounts: { id: {
      initialize: (config: unknown) => void;
      renderButton: (el: HTMLElement, opts: unknown) => void;
    } } } }).google;

    if (!google?.accounts?.id) {
      reject(new Error("Google Sign-In SDK not loaded"));
      return;
    }

    const overlay = document.createElement("div");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px";
    const box = document.createElement("div");
    box.style.cssText =
      "background:#fff;padding:20px;border-radius:16px;max-width:100%;display:flex;flex-direction:column;align-items:center;gap:12px;box-shadow:0 8px 32px rgba(0,0,0,.2)";
    const mount = document.createElement("div");
    mount.id = "zy-crossword-gsi-mount";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "取消";
    cancel.style.cssText = "border:none;background:transparent;color:#666;cursor:pointer;text-decoration:underline;font-size:14px";
    cancel.onclick = () => {
      document.body.removeChild(overlay);
      reject(new Error("已取消登入"));
    };
    box.appendChild(mount);
    box.appendChild(cancel);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: { credential: string }) => {
        try {
          const result = await apiPost<{ token: string; user: ApiUser }>(
            "/auth/google",
            { credential: response.credential }
          );
          setJwt(result.token);
          saveUser(result.user);
          if (overlay.parentNode) document.body.removeChild(overlay);
          resolve(result.user);
        } catch (error) {
          if (overlay.parentNode) document.body.removeChild(overlay);
          reject(error);
        }
      },
      auto_select: false,
      use_fedcm_for_prompt: false,
    });

    google.accounts.id.renderButton(mount, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "pill",
      width: 240,
      locale: "zh_TW",
    });
  });
}

export function signOut(): void {
  clearAuth();
  try {
    const google = (window as unknown as { google: { accounts: { id: { disableAutoSelect: () => void } } } }).google;
    google?.accounts?.id?.disableAutoSelect();
  } catch {
    // ignore
  }
}
