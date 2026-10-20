import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { tauriDb } from "../db/tauriDb.ts";
import { Gloss } from "./Gloss.tsx";
import { itemPreview, STATUS_NAME, type ItemPreview } from "../library.ts";

/**
 * Set where clicking a hovered item may open its page (the library). Left
 * unset in lessons and reviews, where navigating away would end the session.
 */
export const OpenItemContext = createContext<((itemKey: string) => void) | undefined>(undefined);

const SHOW_DELAY_MS = 250;
const HIDE_DELAY_MS = 150; // time to move the mouse from the text onto the popover
const WIDTH = 280;

/** Shows a summary popover for `itemKey` while hovering `children`. */
export function ItemHover({ itemKey, children, openOnClick = true }: { itemKey: string; children: React.ReactNode; openOnClick?: boolean }) {
  const openItem = useContext(OpenItemContext);
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<number>(undefined);
  const [pos, setPos] = useState<{ x: number; y: number; above: boolean }>();
  // undefined = not loaded yet, null = not in our data
  const [preview, setPreview] = useState<ItemPreview | null>();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function show() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current!.getBoundingClientRect();
      const above = r.bottom + 240 > window.innerHeight;
      setPos({
        x: Math.min(Math.max(8, r.left + r.width / 2 - WIDTH / 2), window.innerWidth - WIDTH - 8),
        y: above ? r.top - 6 : r.bottom + 6,
        above,
      });
      if (preview === undefined) itemPreview(tauriDb, itemKey).then(setPreview, () => setPreview(null));
    }, SHOW_DELAY_MS);
  }

  function hide() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setPos(undefined), HIDE_DELAY_MS);
  }

  const canOpen = openOnClick && openItem && preview?.status != null;

  return (
    <span
      ref={ref}
      className={`hover-target ${canOpen ? "can-open" : ""}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onClick={canOpen ? () => openItem(itemKey) : undefined}
    >
      {children}
      {pos &&
        createPortal(
          <div
            className={`popover ${pos.above ? "above" : ""}`}
            style={{ left: pos.x, top: pos.y, width: WIDTH }}
            onMouseEnter={() => window.clearTimeout(timer.current)}
            onMouseLeave={hide}
          >
            {preview === undefined ? (
              <p className="muted">Loading…</p>
            ) : preview === null ? (
              <p className="muted">Not in Koihongo's data.</p>
            ) : (
              <PreviewBody preview={preview} canOpen={Boolean(canOpen)} />
            )}
          </div>,
          document.body,
        )}
    </span>
  );
}

function PreviewBody({ preview, canOpen }: { preview: ItemPreview; canOpen: boolean }) {
  return (
    <>
      <div className={`popover-head ${preview.kind}`}>
        <span lang="ja" className="popover-glyph">
          {preview.label}
        </span>
        <span className="popover-kind">{preview.kind}</span>
      </div>
      <p>
        <Gloss text={preview.meanings.slice(0, 5).join(", ")} />
      </p>
      {preview.readings.length > 0 && (
        <p lang="ja" className="popover-readings">
          {preview.readings.join("、")}
        </p>
      )}
      <p className="muted small">
        {preview.status ? (
          <>
            <span className={`swatch ${preview.status}`} /> {STATUS_NAME[preview.status]}
          </>
        ) : (
          "Not on your learning path"
        )}
        {canOpen && " · click to open"}
      </p>
    </>
  );
}

const isKanji = (ch: string) => /\p{Script=Han}/u.test(ch) && ch !== "々";

/** Japanese text where every kanji shows its popover on hover. */
export function JapaneseText({ text }: { text: string }) {
  return (
    <span lang="ja">
      {[...text].map((ch, i) =>
        isKanji(ch) ? (
          <ItemHover key={i} itemKey={`kanji:${ch}`}>
            {ch}
          </ItemHover>
        ) : (
          ch
        ),
      )}
    </span>
  );
}
