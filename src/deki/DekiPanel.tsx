import { Maximize2, Minimize2, Sparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PROVIDERS, useAiSettings } from "../ai/settings.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { DEKI_COMMANDS, DEKI_NAME, type DekiScope } from "./deki.ts";
import { chosenScope, closeDeki, openDeki, partsOff, send, setScope, toggleExpanded, togglePart, useConnection, useDeki } from "./store.ts";

/**
 * Deki-senpai, on every page: a button in the corner opens a chat that knows
 * where you are (the chips show what's sent; click one to leave it out), can
 * dock beside the page, switch connection, and in Reading keep the chat for
 * the chapter or series. Type / for commands. In lessons and reviews there's
 * no button (no peeking at answers): Deki only opens there when asked to (Ask
 * Deki on a mnemonic, once an answer is shown).
 */
export function DekiPanel({ inSession }: { inSession: boolean }) {
  const deki = useDeki();
  const hidden = inSession && !deki.open;
  // Going into lessons or reviews closes Deki.
  useEffect(() => {
    if (inSession) closeDeki();
  }, [inSession]);
  const ai = useAiSettings(tauriDb);
  const [draft, setDraft] = useState("");
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  // Docked: the page makes room.
  useEffect(() => {
    document.body.classList.toggle("deki-docked", deki.open && deki.expanded && !hidden);
    return () => document.body.classList.remove("deki-docked");
  }, [deki.open, deki.expanded, hidden]);
  // The newest message in view.
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [deki.lines, deki.busy, deki.open]);
  useEffect(() => {
    if (deki.open) input.current?.focus();
  }, [deki.open]);

  if (hidden) return null;
  if (!deki.open) {
    return (
      <button type="button" className="deki-fab" onClick={openDeki} title={`Ask ${DEKI_NAME}`}>
        <Sparkles size={18} aria-hidden="true" /> Deki
      </button>
    );
  }

  const page = deki.page;
  const off = page ? partsOff(page.id) : [];
  const scope: DekiScope = page?.scopes ? chosenScope(page.id) : "once";
  const sendDraft = () => {
    const text = draft;
    setDraft("");
    send(text);
  };
  const hints = draft.startsWith("/") && !draft.includes(" ") ? DEKI_COMMANDS.filter((c) => `/${c.name}`.startsWith(draft.toLowerCase())) : [];

  return (
    <aside
      className={`deki ${deki.expanded ? "docked" : ""}`}
      aria-label={DEKI_NAME}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          closeDeki();
        }
      }}
    >
      <header className="deki-head">
        <span className="deki-avatar" aria-hidden="true">
          デ
        </span>
        <strong className="deki-name">{DEKI_NAME}</strong>
        <select
          className="deki-connection"
          value={ai?.provider ?? "off"}
          onChange={(e) => useConnection(e.target.value as (typeof PROVIDERS)[number]["id"])}
          aria-label="Deki's connection"
          title="Which AI Deki uses (set each one up in Settings)"
        >
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === "off" ? "Off" : p.name}
            </option>
          ))}
        </select>
        <button type="button" className="icon-action" onClick={toggleExpanded} title={deki.expanded ? "Pop over the page" : "Dock beside the page"} aria-label="Dock">
          {deki.expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
        <button type="button" className="icon-action" onClick={closeDeki} title="Close (Esc)" aria-label="Close">
          <X size={16} />
        </button>
      </header>

      <div className="deki-context">
        <span className="deki-where">{page?.label ?? "Anywhere"}</span>
        {page?.scopes && (
          <div className="deki-scope" role="radiogroup" aria-label="Keep this chat for">
            {(["once", "chapter", "series"] as const).map((s) =>
              s === "once" || page.scopes?.[s] ? (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={scope === s}
                  className={scope === s ? "on" : ""}
                  onClick={() => setScope(s)}
                  title={s === "once" ? "A chat just for now" : `Keep this chat for the ${s}, and pick it up again next time (${page.scopes![s]!.label})`}
                >
                  {s === "once" ? "Just now" : s === "chapter" ? "Chapter" : "Series"}
                </button>
              ) : null,
            )}
          </div>
        )}
        {page && page.parts.some((p) => p.text.trim()) && (
          <div className="deki-chips" aria-label="What Deki is sent from this page">
            {page.parts
              .filter((p) => p.text.trim())
              .map((p) => (
                <button
                  key={p.key}
                  type="button"
                  className={`deki-chip ${off.includes(p.key) ? "off" : ""}`}
                  onClick={() => togglePart(p.key)}
                  aria-pressed={!off.includes(p.key)}
                  title={off.includes(p.key) ? `Not sent. Click to send it: ${p.text.slice(0, 200)}` : `Sent to Deki. Click to leave it out: ${p.text.slice(0, 200)}`}
                >
                  {p.name}
                </button>
              ))}
          </div>
        )}
      </div>

      <ol className="deki-chat" ref={list}>
        {deki.lines.length === 0 && (
          <li className="note">
            <p>
              {ai?.provider === "off"
                ? "Pick a connection above to start (set them up in Settings → Deki-senpai)."
                : "Hi! Ask me anything about Japanese, or what's on this page. Type / for shortcuts."}
            </p>
          </li>
        )}
        {deki.lines.map((l, i) => (
          <li key={i} className={l.role}>
            <p>{l.text}</p>
            {l.role === "assistant" && l.actions?.(l.text)}
          </li>
        ))}
        {deki.busy && <li className="assistant muted">Deki is thinking…</li>}
      </ol>
      {deki.error && <p className="error deki-error">{deki.error}</p>}

      <div className="deki-input">
        {hints.length > 0 && (
          <ul className="deki-hints">
            {hints.map((c) => (
              <li key={c.name}>
                <button type="button" onClick={() => (setDraft(`/${c.name}${c.args ? " " : ""}`), input.current?.focus())}>
                  <strong>/{c.name}</strong> {c.args && <span className="muted">{c.args}</span>} <span className="muted">· {c.help}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <textarea
          ref={input}
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendDraft();
            }
          }}
          placeholder={deki.busy ? "Deki is answering…" : "Ask Deki… (/ for commands)"}
          aria-label="Message to Deki"
        />
        <button type="button" className="primary" onClick={sendDraft} disabled={deki.busy || !draft.trim()}>
          Send
        </button>
      </div>
    </aside>
  );
}
