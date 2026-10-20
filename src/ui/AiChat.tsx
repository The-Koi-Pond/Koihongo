import { useEffect, useRef, useState } from "react";
import { claudeCode, type ChatMessage } from "../ai/ai.ts";

/**
 * A chat with Claude that opens by sending `opener` (shown as your first
 * message). `extras` adds controls under a reply, e.g. "Use this" buttons.
 */
export function AiChat({
  title,
  system,
  opener,
  placeholder,
  footnote,
  extras,
  onClose,
}: {
  title: string;
  system: string;
  opener: string;
  placeholder: string;
  footnote: string;
  extras?: (reply: string) => React.ReactNode;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const started = useRef(false);

  async function request(conversation: ChatMessage[]) {
    setMessages(conversation);
    setBusy(true);
    setError(undefined);
    try {
      const reply = await claudeCode.complete({ system, messages: conversation, model: "sonnet" });
      setMessages([...conversation, { role: "assistant", text: reply }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Send the opener once (React runs effects twice in dev).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    request([{ role: "user", text: opener }]);
  }, []);

  const lastIsUser = messages.at(-1)?.role === "user";

  return (
    <div className="workshop">
      <div className="workshop-head">
        <strong>{title}</strong>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="chat">
        {messages.map((m, i) => (
          <li key={i} className={m.role}>
            <p>{m.text}</p>
            {m.role === "assistant" && extras?.(m.text)}
          </li>
        ))}
        {busy && <li className="assistant muted">Thinking… (usually 5–10 seconds)</li>}
      </ol>
      {error && (
        <p className="error">
          {error}{" "}
          {lastIsUser && (
            <button type="button" className="link" onClick={() => request(messages)}>
              Try again
            </button>
          )}
        </p>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          if (!draft.trim() || busy) return;
          request([...messages, { role: "user", text: draft.trim() }]);
          setDraft("");
        }}
      >
        <input className="grow" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} disabled={busy} />
        <button type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
      <p className="muted small">{footnote}</p>
    </div>
  );
}
