// "Messages in, text out." The only backend today is the Claude Code CLI
// (src-tauri/src/ai.rs); an API-key backend could implement the same shape.

import { invoke } from "@tauri-apps/api/core";

export type AiModel = "haiku" | "sonnet";
export type ChatMessage = { role: "user" | "assistant"; text: string };
export type AiRequest = { system: string; messages: ChatMessage[]; model: AiModel };

export interface AiBackend {
  complete(request: AiRequest): Promise<string>;
}

/**
 * The CLI takes one prompt per call, so earlier turns are written out as a
 * transcript. Nothing is stored between calls.
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

export const claudeCode: AiBackend = {
  complete: ({ system, messages, model }) => invoke("ai_complete", { system, prompt: formatConversation(messages), model }),
};
