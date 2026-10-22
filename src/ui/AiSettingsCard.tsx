import { invoke } from "@tauri-apps/api/core";
import { KeyRound, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { aiComplete } from "../ai/ai.ts";
import {
  ANTHROPIC_MODELS,
  CLAUDE_CODE_MODELS,
  loadAiSettings,
  PRESETS,
  providerLabel,
  PROVIDERS,
  saveAiSettings,
  type AiSettings,
  type CompatPreset,
} from "../ai/settings.ts";
import { tauriDb } from "../db/tauriDb.ts";

/**
 * Settings → AI helper: off by default; pick Claude Code, the Anthropic API or
 * an OpenAI-compatible service. API keys are saved straight into Windows
 * Credential Manager (never in the app's data or backups).
 */
export function AiSettingsCard() {
  const [saved, setSaved] = useState<AiSettings>();
  const [draft, setDraft] = useState<AiSettings>();
  const [claudeFound, setClaudeFound] = useState<boolean>();
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadAiSettings(tauriDb).then((s) => {
      setSaved(s);
      setDraft(s);
    });
    invoke<boolean>("ai_claude_code_found")
      .then(setClaudeFound)
      .catch(() => setClaudeFound(false));
  }, []);

  if (!saved || !draft) return <section className="card muted">Loading…</section>;

  const changed = JSON.stringify(saved) !== JSON.stringify(draft);
  const set = (patch: Partial<AiSettings>) => {
    setDraft({ ...draft, ...patch });
    setStatus(undefined);
  };
  const preset = PRESETS[draft.compatPreset];
  const local = draft.provider === "openai-compatible" && preset.keySlot === null;

  async function save() {
    await saveAiSettings(tauriDb, draft!);
    setSaved(draft);
    setStatus({ ok: true, text: draft!.provider === "off" ? "Saved ✓ AI is off." : "Saved ✓" });
  }

  async function test() {
    setTesting(true);
    setStatus(undefined);
    try {
      const reply = await aiComplete({ system: "This is a connection test. Reply with exactly: OK", messages: [{ role: "user", text: "Test" }] }, draft);
      setStatus({ ok: true, text: `Connected ✓ It replied: “${reply.trim().slice(0, 60)}”` });
    } catch (e) {
      setStatus({ ok: false, text: String(e).replace(/^Error: /, "") });
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="card ai-settings">
      <h2>
        <Sparkles size={16} aria-hidden="true" /> AI helper
      </h2>
      <p className="muted small">
        Optional, for the "Ask AI" mnemonic workshop and "Explain" on example sentences. It's off until you pick a helper here, and nothing is sent anywhere
        before that.
      </p>

      <div className="ai-providers" role="radiogroup" aria-label="AI helper">
        {PROVIDERS.map((p) => (
          <label key={p.id} className={`ai-provider ${draft.provider === p.id ? "current" : ""}`}>
            <input type="radio" name="ai-provider" checked={draft.provider === p.id} onChange={() => set({ provider: p.id })} />
            <span>
              <strong>{p.name}</strong>
              <span className="muted small">{p.blurb}</span>
            </span>
          </label>
        ))}
      </div>

      {draft.provider === "claude-code" && (
        <div className="setting-list">
          <p className={`small ${claudeFound ? "" : "error"}`}>
            {claudeFound === undefined ? "Looking for Claude Code…" : claudeFound ? "Claude Code is installed on this PC ✓" : "Claude Code wasn't found on this PC."}
          </p>
          <Choice label="Model" value={draft.claudeCodeModel} options={CLAUDE_CODE_MODELS} onChange={(v) => set({ claudeCodeModel: v as AiSettings["claudeCodeModel"] })} />
        </div>
      )}

      {draft.provider === "anthropic" && (
        <div className="setting-list">
          <KeyField slot="anthropic" where="console.anthropic.com" />
          <Choice label="Model" value={draft.anthropicModel} options={ANTHROPIC_MODELS} onChange={(v) => set({ anthropicModel: v })} />
        </div>
      )}

      {draft.provider === "openai-compatible" && (
        <div className="setting-list">
          <Choice
            label="Service"
            value={draft.compatPreset}
            options={Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name }))}
            onChange={(v) => set({ compatPreset: v as CompatPreset })}
          />
          {draft.compatPreset === "custom" ? (
            <div className="setting">
              <label htmlFor="ai-base-url">Address</label>
              <input
                id="ai-base-url"
                className="grow"
                value={draft.compatBaseUrl}
                placeholder="https://…/v1"
                spellCheck={false}
                onChange={(e) => set({ compatBaseUrl: e.target.value })}
              />
            </div>
          ) : (
            <p className="muted small">Address: {preset.baseUrl}</p>
          )}
          {preset.keySlot && <KeyField slot={preset.keySlot} where={preset.keyUrl} optional={draft.compatPreset === "custom"} />}
          <div className="setting">
            <label htmlFor="ai-model">Model</label>
            <input
              id="ai-model"
              className="grow"
              value={draft.compatModel}
              placeholder={preset.modelHint}
              spellCheck={false}
              onChange={(e) => set({ compatModel: e.target.value })}
            />
          </div>
        </div>
      )}

      {draft.provider !== "off" && (
        <p className="muted small ai-privacy">
          {local
            ? "Requests stay on this PC: they go to the model running on your own computer."
            : `When you use Ask AI or Explain, the item you're on (its character, meanings, readings and mnemonic) and your chat messages are sent to ${providerLabel(draft)}. Nothing else from the app is sent.`}
        </p>
      )}

      <div className="row">
        <button type="button" className="primary" disabled={!changed} onClick={save}>
          Save
        </button>
        {draft.provider !== "off" && (
          <button type="button" disabled={testing} onClick={test}>
            {testing ? "Testing…" : "Test connection"}
          </button>
        )}
        {status && <span className={status.ok ? "small" : "error small"}>{status.text}</span>}
      </div>
    </section>
  );
}

function Choice({ label, value, options, onChange }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (v: string) => void }) {
  const id = `ai-${label.toLowerCase()}`;
  return (
    <div className="setting">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** An API key: saved straight into Windows Credential Manager; the app only ever shows whether one is saved. */
function KeyField({ slot, where, optional }: { slot: string; where?: string; optional?: boolean }) {
  const [saved, setSaved] = useState<boolean>();
  const [replacing, setReplacing] = useState(false);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    setSaved(undefined);
    setReplacing(false);
    invoke<boolean>("ai_key_status", { slot })
      .then(setSaved)
      .catch(() => setSaved(false));
  }, [slot]);

  async function store() {
    try {
      await invoke("ai_key_set", { slot, key });
      setSaved(true);
      setReplacing(false);
      setKey("");
      setError(undefined);
    } catch (e) {
      setError(String(e));
    }
  }

  async function remove() {
    await invoke("ai_key_delete", { slot });
    setSaved(false);
  }

  return (
    <div className="setting ai-key">
      <div>
        <label htmlFor={`ai-key-${slot}`}>
          <KeyRound size={14} aria-hidden="true" /> API key{optional ? " (if it needs one)" : ""}
        </label>
        <p className="muted small">
          {where ? `Get one at ${where}. ` : ""}Saved in Windows Credential Manager, not in the app's data or backups.
        </p>
      </div>
      {saved && !replacing ? (
        <div className="row">
          <span className="small">Saved ✓</span>
          <button type="button" onClick={() => setReplacing(true)}>
            Replace
          </button>
          <button type="button" onClick={remove}>
            Remove
          </button>
        </div>
      ) : (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) store();
          }}
        >
          <input id={`ai-key-${slot}`} type="password" autoComplete="off" value={key} placeholder="Paste the key" onChange={(e) => setKey(e.target.value)} />
          <button type="submit" disabled={!key.trim()}>
            Save key
          </button>
          {replacing && (
            <button type="button" onClick={() => setReplacing(false)}>
              Cancel
            </button>
          )}
        </form>
      )}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
