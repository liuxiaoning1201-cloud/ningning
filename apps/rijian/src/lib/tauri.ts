import { getCurrentWindow } from "@tauri-apps/api/window";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

export function isTauri(): boolean {
  return typeof window !== "undefined" && Boolean(window.__TAURI_INTERNALS__);
}

export function isCaptureMode(): boolean {
  return new URLSearchParams(window.location.search).get("mode") === "capture";
}

export async function hideCaptureWindow() {
  if (!isTauri()) return;
  try {
    const win = getCurrentWindow();
    if (win.label === "capture") await win.hide();
  } catch {
    /* web */
  }
}

export async function notify(title: string, body: string) {
  if (!isTauri()) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
    return;
  }
  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === "granted";
  }
  if (granted) sendNotification({ title, body });
}
