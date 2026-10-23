// Which AI helper to use (Settings → AI helper), saved in user.db `settings`
// as ai.* keys. Off until you choose one: nothing is sent anywhere before that.
// API keys are not here: they live in the OS credential store (src-tauri/src/ai_api.rs).

import { useEffect, useSyncExternalStore } from "react";
import type { Db } from "../db/db.ts";

export type AiProvider = "off" | "claude-code" | "anthropic" | "openai-compatible";
export type ClaudeCodeModel = "haiku" | "sonnet" | "opus";
export type CompatPreset = "openai" | "openrouter" | "gemini" | "ollama" | "lmstudio" | "custom";

export type AiSettings = {
  provider: AiProvider;
  claudeCodeModel: ClaudeCodeModel;
  anthropicModel: string;
  compatPreset: CompatPreset;
  /** Only used by the "custom" preset; the others have a fixed address. */
  compatBaseUrl: string;
  compatModel: string;
};

export const DEFAULT_AI: AiSettings = {
  provider: "off",
  claudeCodeModel: "sonnet",
  anthropicModel: "claude-opus-5-5",
  compatPreset: "openai",
  compatBaseUrl: "",
  compatModel: "",
};

export const PROVIDERS: { id: AiProvider; name: string; blurb: string }[] = [
  { id: "off", name: "Off", blurb: "No AI. The Ask AI and Explain buttons are hidden." },
  { id: "claude-code", name: "Claude Code", blurb: "Uses the Claude Code app on this PC and your own Claude login. No API key needed." },
  { id: "anthropic", name: "Anthropic API", blurb: "Claude models with an API key from console.anthropic.com (pay per use)." },
  {
    id: "openai-compatible",
    name: "OpenAI-compatible",
    blurb: "OpenAI, OpenRouter, Google Gemini, or a free local model with Ollama or LM Studio.",
  },
];

export const CLAUDE_CODE_MODELS: { id: ClaudeCodeModel; name: string }[] = [
  { id: "sonnet", name: "Sonnet" },
  { id: "opus", name: "Opus" },
  { id: "haiku", name: "Haiku (fastest)" },
];

export const ANTHROPIC_MODELS: { id: string; name: string }[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5 (best)" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5 (cheaper)" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5 (cheapest)" },
];

/**
 * OpenAI-compatible services, for Settings. keySlot: where its API key is
 * saved (null: none needed). The addresses here are for display; the ones
 * actually used are fixed in src-tauri/src/ai_api.rs (compat_target).
 */
export const PRESETS: Record<CompatPreset, { name: string; baseUrl: string; keySlot: string | null; modelHint: string; keyUrl?: string }> = {
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", keySlot: "openai", modelHint: "e.g. gpt-4o-mini", keyUrl: "platform.openai.com" },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keySlot: "openrouter",
    modelHint: "a model id from openrouter.ai/models",
    keyUrl: "openrouter.ai",
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keySlot: "gemini",
    modelHint: "e.g. gemini-2.0-flash",
    keyUrl: "aistudio.google.com",
  },
  ollama: { name: "Ollama (on this PC)", baseUrl: "http://localhost:11434/v1", keySlot: null, modelHint: "a model you've pulled, e.g. llama3.1" },
  lmstudio: { name: "LM Studio (on this PC)", baseUrl: "http://localhost:1234/v1", keySlot: null, modelHint: "the model loaded in LM Studio" },
  custom: { name: "Other (enter an address)", baseUrl: "", keySlot: "custom", modelHint: "the service's model name" },
};

const KEYS = Object.keys(DEFAULT_AI) as (keyof AiSettings)[];

export async function loadAiSettings(db: Db): Promise<AiSettings> {
  const rows = await db.all<{ key: string; value: string }>("SELECT key, value FROM settings WHERE key LIKE 'ai.%'");
  const s: AiSettings = { ...DEFAULT_AI };
  for (const { key, value } of rows) {
    const name = key.slice("ai.".length) as keyof AiSettings;
    if (KEYS.includes(name)) (s as Record<string, string>)[name] = value;
  }
  if (!PROVIDERS.some((p) => p.id === s.provider)) s.provider = "off";
  if (!(s.compatPreset in PRESETS)) s.compatPreset = DEFAULT_AI.compatPreset;
  if (!CLAUDE_CODE_MODELS.some((m) => m.id === s.claudeCodeModel)) s.claudeCodeModel = DEFAULT_AI.claudeCodeModel;
  return s;
}

export async function saveAiSettings(db: Db, s: AiSettings): Promise<void> {
  await db.batch(KEYS.map((key) => ({ sql: "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", params: [`ai.${key}`, s[key].trim()] })));
  setCurrent(s);
}

/** A short name for where requests go, for footnotes ("Runs through …"). */
export function providerLabel(s: AiSettings): string {
  switch (s.provider) {
    case "claude-code":
      return "your Claude Code login";
    case "anthropic":
      return "the Anthropic API";
    case "openai-compatible":
      return PRESETS[s.compatPreset].name.replace(" (on this PC)", ", on this PC");
    default:
      return "nothing (AI is off)";
  }
}

// The current settings, shared by every screen, so turning AI on or off in
// Settings shows or hides the AI buttons everywhere at once.
let current: AiSettings | undefined;
let loading: Promise<AiSettings> | undefined;
const listeners = new Set<() => void>();

function setCurrent(s: AiSettings) {
  current = s;
  listeners.forEach((l) => l());
}

/** The current AI settings (loaded once, then kept up to date by saveAiSettings). */
export function getAiSettings(db: Db): Promise<AiSettings> {
  if (current) return Promise.resolve(current);
  loading ??= loadAiSettings(db).then((s) => {
    setCurrent(s);
    return s;
  });
  return loading;
}

/** The AI settings for a component; undefined until loaded. */
export function useAiSettings(db: Db): AiSettings | undefined {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  useEffect(() => {
    getAiSettings(db).catch(() => {});
  }, [db]);
  return s;
}
