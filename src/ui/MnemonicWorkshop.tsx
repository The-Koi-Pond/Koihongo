import { useEffect, useRef, useState } from "react";
import { claudeCode, type ChatMessage } from "../ai/ai.ts";
import { extractMnemonics, mnemonicOpener, mnemonicSystemPrompt, type MnemonicFocus } from "../ai/prompts.ts";
import type { ItemDetails } from "../items.ts";

/** Chat with Claude about a mnemonic; "Use this" saves a suggestion. */
export function MnemonicWorkshop({
  item,
  focus,
  onUse,
  onClose,
}: {
  item: ItemDetails;
  focus: MnemonicFocus;
  onUse: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [used, setUsed] = useState<string>();
  const started = useRef(false);

  async function request(conversation: ChatMessage[]) {
    setMessages(conversation);
    setBusy(true);
    setError(undefined);
    try {
      const reply = await claudeCode.complete({ system: mnemonicSystemPrompt(item, focus), messages: conversation, model: "sonnet" });
      setMessages([...conversation, { role: "assistant", text: reply }]);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Open with a request for options, once (React runs effects twice in dev).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    request([{ role: "user", text: mnemonicOpener(item, focus) }]);
  }, []);

  async function use(text: string) {
    await onUse(text);
    setUsed(text);
  }

  const lastIsUser = messages.at(-1)?.role === "user";

  return (
    <div className="workshop">
      <div className="workshop-head">
        <strong>Mnemonic workshop</strong>
        <button type="button" className="link" onClick={onClose}>
          Close
        </button>
      </div>
      <ol className="chat">
        {messages.map((m, i) => (
          <li key={i} className={m.role}>
            <p>{m.text}</p>
            {m.role === "assistant" &&
              extractMnemonics(m.text).map((option) => (
                <div key={option} className="option">
                  <button type="button" className={used === option ? "" : "primary"} disabled={used === option} onClick={() => use(option)}>
                    {used === option ? "Saved ✓" : "Use this"}
                  </button>
                  <span>{option}</span>
                </div>
              ))}
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
        <input
          className="grow"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="e.g. make it about Pokémon, shorter, use the word 'shin'…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !draft.trim()}>
          Send
        </button>
      </form>
      <p className="muted small">AI suggestions can be wrong; saved ones are marked as AI-written. Runs through your Claude Code login.</p>
    </div>
  );
}
