import { Delete, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { applyMark, CHART, keyText, type Mark } from "../kanaKeys.ts";

type TextField = HTMLInputElement | HTMLTextAreaElement;

const POS_KEY = "koihongo.kanaKeyboardPos";
/** Where you dragged the keyboard: its distance from the window's right and bottom edges. */
type Pos = { right: number; bottom: number };

function loadPos(): Pos | null {
  try {
    const p = JSON.parse(localStorage.getItem(POS_KEY) ?? "null");
    return typeof p?.right === "number" && typeof p?.bottom === "number" ? p : null;
  } catch {
    return null;
  }
}

function savePos(p: Pos) {
  try {
    localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    // Not remembered this time; harmless.
  }
}

/** Text boxes the keyboard can type into (not checkboxes, number fields and the like). */
function isTextField(el: Element | null): el is TextField {
  if (el instanceof HTMLTextAreaElement) return true;
  return el instanceof HTMLInputElement && ["text", "search", ""].includes(el.type);
}

/**
 * Sets a text box's value the way typing would, so React's onChange runs (the
 * review answer box, for example, converts as you type), then puts the cursor
 * at `caret`.
 */
function setFieldValue(el: TextField, value: string, caret: number) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const at = Math.min(caret, el.value.length);
  el.setSelectionRange(at, at);
}

/**
 * The on-screen kana keyboard: a gojūon chart that types into whichever text
 * box you used last, on any screen. Keys never take the focus, so you can mix
 * clicking and typing. Floats over the page (bottom-right at first); drag its
 * header to move it, and it remembers where you put it.
 */
export function KanaKeyboard({ onClose }: { onClose: () => void }) {
  const [katakana, setKatakana] = useState(false);
  const target = useRef<TextField | null>(isTextField(document.activeElement) ? document.activeElement : null);
  const [hasTarget, setHasTarget] = useState(target.current !== null);
  const [pos, setPos] = useState<Pos | null>(loadPos);
  const panel = useRef<HTMLDivElement>(null);

  /** The position for a panel whose top-left corner is at (left, top), kept inside the window and below the title bar. */
  function clamp(left: number, top: number): Pos {
    const box = panel.current!.getBoundingClientRect();
    const titlebar = document.querySelector(".titlebar")?.getBoundingClientRect().bottom ?? 0;
    const x = Math.min(Math.max(0, left), window.innerWidth - box.width);
    const y = Math.min(Math.max(titlebar, top), window.innerHeight - box.height);
    return { right: Math.round(window.innerWidth - x - box.width), bottom: Math.round(window.innerHeight - y - box.height) };
  }

  /** Drag by the header. */
  function startDrag(e: React.PointerEvent) {
    if ((e.target as Element).closest("button")) return;
    const box = panel.current!.getBoundingClientRect();
    const grabX = e.clientX - box.left, grabY = e.clientY - box.top;
    let last: Pos | null = null;
    const move = (ev: PointerEvent) => setPos((last = clamp(ev.clientX - grabX, ev.clientY - grabY)));
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (last) savePos(last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  // A remembered spot from a bigger window, or a window made smaller: pull it back inside.
  useEffect(() => {
    const keepInside = () => {
      const box = panel.current?.getBoundingClientRect();
      if (box) setPos((p) => (p ? clamp(box.left, box.top) : p));
    };
    keepInside();
    window.addEventListener("resize", keepInside);
    return () => window.removeEventListener("resize", keepInside);
  }, []);

  // Remember the last text box you were in.
  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if (isTextField(e.target as Element)) {
        target.current = e.target as TextField;
        setHasTarget(true);
      }
    };
    document.addEventListener("focusin", onFocus);
    return () => document.removeEventListener("focusin", onFocus);
  }, []);

  /** The live, editable text box to type into, focused; null if there isn't one. */
  function field(): TextField | null {
    const el = target.current;
    if (!el || !el.isConnected || el.readOnly || el.disabled) return null;
    if (document.activeElement !== el) el.focus();
    return el;
  }

  function type(text: string) {
    const el = field();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start;
    setFieldValue(el, el.value.slice(0, start) + text + el.value.slice(end), start + text.length);
  }

  function mark(m: Mark) {
    const el = field();
    if (!el) return;
    const at = el.selectionStart ?? el.value.length;
    const changed = at > 0 ? applyMark(el.value[at - 1], m) : null;
    if (changed) setFieldValue(el, el.value.slice(0, at - 1) + changed + el.value.slice(at), at);
  }

  function backspace() {
    const el = field();
    if (!el) return;
    const start = el.selectionStart ?? el.value.length, end = el.selectionEnd ?? start;
    if (start !== end) setFieldValue(el, el.value.slice(0, start) + el.value.slice(end), start);
    else if (start > 0) setFieldValue(el, el.value.slice(0, start - 1) + el.value.slice(start), start - 1);
  }

  function enter() {
    field()?.form?.requestSubmit();
  }

  return (
    // Pressing anywhere on the panel keeps the focus (and cursor) in the text box.
    <div
      ref={panel}
      className="kana-keyboard"
      role="group"
      aria-label="Kana keyboard"
      style={pos ? { right: pos.right, bottom: pos.bottom } : undefined}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="kana-keyboard-head" title="Drag to move" onPointerDown={startDrag}>
        <span>{katakana ? "カタカナ" : "ひらがな"}</span>
        {!hasTarget && <span className="kana-keyboard-hint">Click a text box to type into</span>}
        <button type="button" className="kana-key-close" aria-label="Close the kana keyboard" title="Close" onClick={onClose}>
          <X size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
      <div className="kana-chart" lang="ja">
        {CHART.map((column) =>
          column.map((kana, row) =>
            kana ? (
              <button key={kana} type="button" className="kana-key" style={{ gridRow: row + 1 }} onClick={() => type(keyText(kana, katakana))}>
                {keyText(kana, katakana)}
              </button>
            ) : (
              <span key={`${column[0]}-${row}`} style={{ gridRow: row + 1 }} />
            ),
          ),
        )}
      </div>
      <div className="kana-keyboard-row">
        <button type="button" className="kana-key mod" title="Voice the kana before the cursor (か → が)" onClick={() => mark("dakuten")}>
          ゛
        </button>
        <button type="button" className="kana-key mod" title="Make it a p sound (は → ぱ)" onClick={() => mark("handakuten")}>
          ゜
        </button>
        <button type="button" className="kana-key mod" title="Make it small (つ → っ, や → ゃ)" onClick={() => mark("small")}>
          小
        </button>
        <button type="button" className="kana-key mod wide" aria-pressed={katakana} onClick={() => setKatakana(!katakana)}>
          {katakana ? "カタ → ひら" : "ひら → カタ"}
        </button>
        <button type="button" className="kana-key mod" aria-label="Backspace" title="Delete" onClick={backspace}>
          <Delete size={16} strokeWidth={2} aria-hidden="true" />
        </button>
        <button type="button" className="kana-key mod" aria-label="Enter" title="Enter (check or submit)" onClick={enter}>
          ⏎
        </button>
      </div>
    </div>
  );
}
