// Browser mode (dev only): when the app runs in a plain browser instead of the
// Tauri window, stand in for Tauri's bridge and send every call to the dev
// server (scripts/dev/browser-mode.ts). Inside the desktop app, Tauri's own
// bridge is already there, so this does nothing; production builds drop it.

/** Must match scripts/dev/browser-mode.ts. */
const INVOKE_PATH = "/__koihongo/invoke";

export function installBrowserBridge() {
  if (!import.meta.env.DEV || "__TAURI_INTERNALS__" in window) return;
  let nextCallbackId = 1;
  Object.assign(window, {
    __TAURI_INTERNALS__: {
      async invoke(cmd: string, args: Record<string, unknown> = {}) {
        const res = await fetch(INVOKE_PATH, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cmd, args }),
        });
        // Page images come back as raw bytes (an ArrayBuffer, as in Tauri).
        if (res.ok && res.headers.get("content-type") === "application/octet-stream") return res.arrayBuffer();
        const text = await res.text();
        // Tauri commands reject with their error string; do the same.
        if (!res.ok) throw text;
        return text ? JSON.parse(text) : null;
      },
      transformCallback: () => nextCallbackId++,
      metadata: { currentWindow: { label: "main" }, currentWebview: { windowLabel: "main", label: "main" } },
    },
    // Window event listeners (the title bar's resize listener) call this when they unsubscribe.
    __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener() {} },
  });
  console.info("Koihongo browser mode: using a copy of your progress; backups and AI only work in the desktop app.");
}
