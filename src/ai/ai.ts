// "Messages in, text out", through whichever AI helper you picked in Settings
// (src/ai/settings.ts). The requests themselves are made in Rust
// (src-tauri/src/ai.rs and ai_api.rs), so API keys never reach this side.

import { invoke } from "@tauri-apps/api/core";
import { tauriDb } from "../db/tauriDb.ts";
import { getAiSettings, PRESETS, type AiSettings } from "./settings.ts";

export type ChatMessage = { role: "user" | "assistant"; text: string };
export type AiRequest = { system: string; messages: ChatMessage[] };

/**
 * Claude Code takes one prompt per call, so earlier turns are written out as
 * a transcript. Nothing is stored between calls.
 */
export function formatConversation(messages: ChatMessage[]): string {
  if (messages.length === 0) throw new Error("No messages to send");
  if (messages.length === 1) return messages[0].text;
  const earlier = messages.slice(0, -1).map((m) => `${m.role === "user" ? "Learner" : "You"}: ${m.text}`);
  return [
    "Conversation so far:",
    ...earlier,
    "",
    `Learner's new message: ${messages[messages.length - 1].text}`,
    "",
    "Reply to the learner's new message.",
  ].join("\n\n");
}

/**
 * What to send to the Rust side for these settings. `customKeySaved`: the
 * "custom" service may not need a key, so one is only sent if it's saved.
 */
export function backendRequest(s: AiSettings, { system, messages }: AiRequest, customKeySaved = false) {
  switch (s.provider) {
    case "claude-code":
      return { provider: s.provider, model: s.claudeCodeModel, system, messages, prompt: formatConversation(messages) };
    case "anthropic":
      return { provider: s.provider, model: s.anthropicModel, system, messages };
    case "openai-compatible": {
      const preset = PRESETS[s.compatPreset];
      const keySlot = s.compatPreset === "custom" ? (customKeySaved ? "custom" : undefined) : (preset.keySlot ?? undefined);
      if (!s.compatModel.trim()) throw new Error("No model is set. Choose one in Settings → AI helper.");
      return {
        provider: s.provider,
        model: s.compatModel.trim(),
        baseUrl: s.compatPreset === "custom" ? s.compatBaseUrl : preset.baseUrl,
        keySlot,
        system,
        messages,
      };
    }
    default:
      throw new Error("AI is turned off. You can turn it on in Settings → AI helper.");
  }
}

/** One reply from your AI helper. `settings` overrides the saved ones (Settings' test button). */
export async function aiComplete(request: AiRequest, settings?: AiSettings): Promise<string> {
  const s = settings ?? (await getAiSettings(tauriDb));
  const customKeySaved =
    s.provider === "openai-compatible" && s.compatPreset === "custom" ? await invoke<boolean>("ai_key_status", { slot: "custom" }) : false;
  return invoke<string>("ai_complete", { request: backendRequest(s, request, customKeySaved) });
}
