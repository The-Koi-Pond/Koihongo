import { getCurrentWebview } from "@tauri-apps/api/webview";
import { useEffect, useRef, useState } from "react";

/**
 * Files and folders dragged in from Explorer onto the window: `onDrop` gets
 * their paths; `over` is true while they're being dragged over it (for a
 * "drop to add" hint). Tauri catches these drops for the whole window, so only
 * the screen that's showing listens. Does nothing outside the desktop app.
 */
export function useFileDrop(onDrop: (paths: string[]) => void): { over: boolean } {
  const [over, setOver] = useState(false);
  const drop = useRef(onDrop);
  drop.current = onDrop;
  useEffect(() => {
    let stop: (() => void) | undefined;
    let live = true;
    try {
      getCurrentWebview()
        .onDragDropEvent((e) => {
          const p = e.payload;
          if (p.type === "enter" || p.type === "over") setOver(true);
          else if (p.type === "leave") setOver(false);
          else if (p.type === "drop") {
            setOver(false);
            if (p.paths.length) drop.current(p.paths);
          }
        })
        .then(
          (unlisten) => (live ? (stop = unlisten) : unlisten()),
          () => {},
        );
    } catch {
      // Browser mode: no window to drop onto.
    }
    return () => {
      live = false;
      stop?.();
    };
  }, []);
  return { over };
}
