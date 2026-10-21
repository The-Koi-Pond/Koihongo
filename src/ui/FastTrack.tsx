import { FastForward } from "lucide-react";
import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { isFastTracked, setFastTrack } from "../srs/fastTrack.ts";

const HELP =
  "Fast track: right answers count as easy, so this item passes on its first review and needs fewer reviews. One wrong answer turns it off.";

/**
 * Turns fast track on or off for an item. `offLabel` is what the button says
 * while it's off ("I already know this" in lessons).
 */
export function FastTrackButton({ itemKey, offLabel = "Fast track", className = "fast-track-btn" }: { itemKey: string; offLabel?: string; className?: string }) {
  const [on, setOn] = useState<boolean>();

  useEffect(() => {
    let cancelled = false;
    setOn(undefined);
    isFastTracked(tauriDb, itemKey).then((v) => !cancelled && setOn(v));
    return () => {
      cancelled = true;
    };
  }, [itemKey]);

  if (on === undefined) return null;
  return (
    <button
      type="button"
      className={`${className} ${on ? "on" : ""}`}
      aria-pressed={on}
      title={HELP}
      onClick={async () => {
        await setFastTrack(tauriDb, itemKey, !on, Date.now());
        setOn(!on);
      }}
    >
      <FastForward size={15} strokeWidth={2} aria-hidden="true" /> {on ? "Fast track on" : offLabel}
    </button>
  );
}
