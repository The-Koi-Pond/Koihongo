import { Channel, invoke } from "@tauri-apps/api/core";
import { KeyRound, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { aiComplete } from "../ai/ai.ts";
import {
  LOCAL_MODELS,
  ANTHROPIC_MODELS,
  CLAUDE_CODE_MODELS,
  loadAiSettings,
  PRESETS,
  providerLabel,
  PROVIDERS,
  saveAiSettings,
  type AiSettings,
  type CompatPreset,
  type LocalModel,
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
  const local = draft.provider === "local" || (draft.provider === "openai-compatible" && preset.keySlot === null);

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
        Optional, for the "Ask AI" mnemonic workshop, "Explain" on example sentences and in Reading, and "Read with AI". It's off until you pick a
        helper here, and nothing is sent anywhere before that.
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

      {draft.provider === "local" && <LocalAiSetup model={draft.localModel} onModel={(m) => set({ localModel: m })} />}

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
            ? draft.provider === "local"
              ? "Requests stay on this PC: nothing is sent anywhere. The first request after a while takes 10–20 seconds while the model loads; it's put away again after 10 minutes unused, or when you close Koihongo, to free the graphics card."
              : "Requests stay on this PC: they go to the model running on your own computer. For Japanese, pick a model that's strong in Asian languages, such as a recent Qwen or Gemma (what Koharu, a manga translator, offers too). Bigger models translate better but need more memory: around 8B parameters suits most PCs with 16 GB of RAM."
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

type LocalStatus = { installed: boolean; to_download: number; running: boolean };

/** Settings → AI helper → Built-in: which Gemma 4, and downloading (or removing) it with llama.cpp. */
function LocalAiSetup({ model, onModel }: { model: LocalModel; onModel: (m: LocalModel) => void }) {
  const [status, setStatus] = useState<LocalStatus>();
  const [progress, setProgress] = useState<{ done: number; total: number }>();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string>();
  const refresh = () =>
    invoke<LocalStatus>("local_ai_status", { modelId: model })
      .then(setStatus)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    setError(undefined);
    refresh();
    // The model picked is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  async function download() {
    setError(undefined);
    setProgress({ done: 0, total: status?.to_download ?? 0 });
    try {
      const channel = new Channel<{ done: number; total: number }>();
      channel.onmessage = (p) => setProgress(p);
      await invoke("local_ai_download", { modelId: model, onProgress: channel });
    } catch (e) {
      setError(String(e));
    } finally {
      setProgress(undefined);
      refresh();
    }
  }

  async function remove() {
    if (!confirmRemove) return setConfirmRemove(true);
    setConfirmRemove(false);
    await invoke("local_ai_remove").catch((e) => setError(String(e)));
    refresh();
  }

  const GB = (bytes: number) => (bytes / 1e9).toFixed(1);
  return (
    <div className="setting-list">
      <div className="local-models" role="radiogroup" aria-label="Built-in model">
        {LOCAL_MODELS.map((m) => (
          <label key={m.id} className={`ai-provider ${model === m.id ? "current" : ""}`}>
            <input type="radio" name="local-model" checked={model === m.id} onChange={() => onModel(m.id)} />
            <span>
              <strong>{m.name}</strong>
              <span className="muted small">
                {m.blurb} Download {m.download}; graphics memory {m.memory}.
              </span>
            </span>
          </label>
        ))}
      </div>
      {progress ? (
        <div className="ocr-progress" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
          <span className="ocr-progress-track">
            <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </span>
          <span className="muted small">
            Downloading… {GB(progress.done)} / {GB(progress.total)} GB (you can keep using Koihongo meanwhile)
          </span>
        </div>
      ) : status?.installed ? (
        <div className="row">
          <span className="ocr-ready">✓ Ready{status.running ? " (running now)" : ""}</span>
          <button type="button" className={`icon-text ${confirmRemove ? "danger" : ""}`} onClick={remove} onBlur={() => setConfirmRemove(false)}>
            {confirmRemove ? "Click again to remove (all built-in models)" : "Remove"}
          </button>
        </div>
      ) : (
        status && (
          <div className="row">
            <button type="button" className="primary" onClick={download}>
              Download ({GB(status.to_download)} GB)
            </button>
          </div>
        )
      )}
      {error && <p className="error">{error}</p>}
      <p className="muted small">
        Gemma 4 by Google (Apache-2.0), as GGUF by ggml-org, run by llama.cpp (MIT). Saved in Koihongo's data folder, checked before use. Save, then
        press Test connection to start it.
      </p>
    </div>
  );
}
