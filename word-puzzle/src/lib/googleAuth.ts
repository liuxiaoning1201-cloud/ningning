import { apiPost, setJwt, saveUser, clearAuth } from "./api";
import type { ApiUser } from "./api";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
let gsiLoaded = false;

export function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
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
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Google Client ID not configured (VITE_GOOGLE_CLIENT_ID)");
  }

  await loadGsi();

  return new Promise((resolve, reject) => {
    const google = (window as unknown as { google: { accounts: { id: {
      initialize: (config: unknown) => void;
      prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
    } } } }).google;

    if (!google?.accounts?.id) {
      reject(new Error("Google Sign-In SDK not loaded"));
      return;
    }

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
          resolve(result.user);
        } catch (error) {
          reject(error);
        }
      },
    });

    google.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        // Fallback: user may need to click button
      }
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
