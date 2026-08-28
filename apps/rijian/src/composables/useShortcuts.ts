import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { onMounted, onUnmounted } from "vue";
import { isTauri } from "../lib/tauri";
import { useJournal } from "../stores/journal";

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable;
}

export function useShortcuts() {
  const journal = useJournal();
  let unlisten: UnlistenFn | undefined;

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      journal.paletteOpen = false;
      return;
    }

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if (e.key.toLowerCase() === "k") {
      e.preventDefault();
      journal.paletteOpen = true;
      return;
    }
    if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      journal.newForView();
      return;
    }
    if (e.key === "Enter") {
      if (isTyping(e.target)) return;
      e.preventDefault();
      if (journal.selectedId) journal.complete(journal.selectedId);
      return;
    }
    if (e.key === "1") {
      e.preventDefault();
      journal.view = "today";
    } else if (e.key === "2") {
      e.preventDefault();
      journal.view = "inbox";
    } else if (e.key === "3") {
      e.preventDefault();
      journal.view = "lists";
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", onKey);
    if (isTauri()) {
      void listen("rijian-focus-composer", () => {
        journal.newForView();
      }).then((fn) => {
        unlisten = fn;
      });
    }
  });
  onUnmounted(() => {
    window.removeEventListener("keydown", onKey);
    unlisten?.();
  });
}
