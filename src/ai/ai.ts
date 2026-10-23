// "Messages in, text out", through whichever connection you picked in Settings
// (src/ai/settings.ts). The requests themselves are made in Rust
// (src-tauri/src/ai.rs and ai_api.rs), so API keys never reach this side.

import { invoke } from "@tauri-apps/api/core";
import { tauriDb } from "../db/tauriDb.ts";
import { getAiSettings, type AiSettings } from "./settings.ts";

export type ChatMessage = { role: "user" | "assistant"; text: string };
/** `image`: a picture (PNG, base64) shown with the last message, e.g. a box cut out of a manga page. */
export type AiRequest = { system: string; messages: ChatMessage[]; image?: string };

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
 * What to send to the Rust side for these settings. For OpenAI-compatible
 * services it names the service: Rust decides its address and which saved key
 * goes with it (src-tauri/src/ai_api.rs, compat_target).
 */
export function backendRequest(s: AiSettings, { system, messages, image }: AiRequest) {
  switch (s.provider) {
    case "local":
      return { provider: s.provider, model: s.localModel, system, messages, image };
    case "claude-code":
      return { provider: s.provider, model: s.claudeCodeModel, system, messages, prompt: formatConversation(messages), image };
    case "anthropic":
      return { provider: s.provider, model: s.anthropicModel, system, messages, image };
    case "openai-compatible": {
      if (!s.compatModel.trim()) throw new Error("No model is set. Choose one in Settings → Deki-senpai.");
      return {
        provider: s.provider,
        model: s.compatModel.trim(),
        preset: s.compatPreset,
        baseUrl: s.compatPreset === "custom" ? s.compatBaseUrl : undefined,
        system,
        messages,
        image,
      };
    }
    default:
      throw new Error("AI is turned off. You can turn it on in Settings → Deki-senpai.");
  }
}

/** One reply from Deki-senpai. `settings` overrides the saved ones (Settings' test button). */
export async function aiComplete(request: AiRequest, settings?: AiSettings): Promise<string> {
  const s = settings ?? (await getAiSettings(tauriDb));
  return invoke<string>("ai_complete", { request: backendRequest(s, request) });
}
