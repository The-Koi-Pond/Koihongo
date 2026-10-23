// Deki-senpai: Koihongo's AI study buddy, as one chat you can open from any page
// (src/deki/DekiPanel.tsx). The page you're on tells Deki where you are and
// what to send (useDekiPage); in Reading a chat can be kept for the whole
// chapter or series, saved here (deki_threads, deki_messages). This file is
// the part without React: the persona, putting a request together, trimming
// long chats, slash commands, saved threads.

import type { ChatMessage } from "../ai/ai.ts";
import { LEARNER_PROFILE } from "../ai/prompts.ts";
import type { Db } from "../db/db.ts";

/** Something about the page Deki can be sent (switchable in the panel). */
export type DekiPart = { key: string; name: string; text: string };

/** Where you are, as a page tells Deki: what to say about it, what to send, which chats it can keep. */
export type DekiPage = {
  /** Which page this is ("reading", "item", "grammar"…): parts you switch off are remembered per page. */
  id: string;
  /** For the panel's header: "Reading · CH.3 · p.12". */
  label: string;
  /** What Deki should know about helping here. */
  instructions: string;
  parts: DekiPart[];
  /** Chats this page can keep (Reading: the chapter, the series). */
  scopes?: Partial<Record<Exclude<DekiScope, "once">, { id: number; label: string }>>;
};

/** How long a chat lasts: until you clear it, or kept (saved) for the chapter or the series you're reading. */
export type DekiScope = "once" | "chapter" | "series";

export const DEKI_NAME = "Deki-senpai";

export const DEKI_PERSONA = `You are Deki-senpai (デキ先輩), the study buddy inside Koihongo, an app for learning Japanese. You're the learner's senpai: warm, encouraging and a little playful (a light tease now and then, never mean), and you explain things clearly and simply, like a friend who's a few years ahead.

You're a mer-koi: a mythical koi-fish being with no gender. If you're asked whether you're male or female (a boy or a girl, a guy or a gal…), your answer is that you're a fish.

About the learner: ${LEARNER_PROFILE}

How you talk:
- English, with Japanese where it helps (give readings in kana for anything with kanji).
- Compact answers in plain text: no markdown headings, no bold, no tables.
- If you aren't sure of a reading or a meaning, say so instead of guessing.
- Only talk about what you were given or told; don't pretend to see the screen.`;

/** What every page says when it has nothing special (Today, Decks, Settings…). */
export const GENERAL_INSTRUCTIONS =
  "The learner is somewhere in the app without anything particular open. Answer questions about Japanese, studying, or the app.";

/**
 * The system prompt for a request: the persona, where the learner is and how
 * to help there, the parts of the page they let through, and a task's own
 * instructions (a mnemonic workshop, say) when one is running.
 */
export function dekiSystem(page: DekiPage | undefined, off: string[], task?: string): string {
  const parts = (page?.parts ?? []).filter((p) => !off.includes(p.key) && p.text.trim());
  return [
    DEKI_PERSONA,
    `Where the learner is: ${page?.label ?? "the app"}.\n${page?.instructions ?? GENERAL_INSTRUCTIONS}`,
    ...parts.map((p) => `${p.name}:\n${p.text.trim()}`),
    task && `For this conversation:\n${task}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The latest messages that fit in `maxChars` (oldest dropped first), always
 * starting with one of yours. Kept chats grow without end; models don't.
 */
export function trimHistory(messages: ChatMessage[], maxChars: number): ChatMessage[] {
  let used = 0;
  let from = messages.length;
  while (from > 0 && used + messages[from - 1].text.length <= maxChars) used += messages[--from].text.length;
  if (from === messages.length && messages.length) from = messages.length - 1; // the newest goes even if it's long
  while (from < messages.length && messages[from].role !== "user") from++;
  return messages.slice(from);
}

/** How much chat history to send, by connection: the built-in model's memory is smaller. */
export function historyBudget(provider: string): number {
  return provider === "local" ? 9_000 : 60_000;
}

export type DekiCommand = { name: string; arg: string };

export const DEKI_COMMANDS: { name: string; args?: string; help: string }[] = [
  { name: "help", help: "what Deki can do" },
  { name: "explain", help: "explain the open box (Reading) or what you're looking at" },
  { name: "translate", help: "translate every box on this page (Reading)" },
  { name: "scope", args: "once | chapter | series", help: "keep this chat just for now, for the chapter, or for the series" },
  { name: "use", args: "builtin | claude | api | other", help: "switch Deki's connection" },
  { name: "context", help: "show what Deki is sent from this page" },
  { name: "clear", help: "start this chat over" },
];

/** A slash command ("/scope series"), or undefined for an ordinary message. */
export function parseCommand(text: string): DekiCommand | undefined {
  const m = /^\/(\w+)\s*(.*)$/s.exec(text.trim());
  return m ? { name: m[1].toLowerCase(), arg: m[2].trim() } : undefined;
}

/** "/use" names for connections. */
export const USE_NAMES: Record<string, "local" | "claude-code" | "anthropic" | "openai-compatible"> = {
  builtin: "local",
  local: "local",
  claude: "claude-code",
  "claude-code": "claude-code",
  api: "anthropic",
  anthropic: "anthropic",
  other: "openai-compatible",
  openai: "openai-compatible",
};

// --- Kept chats (for a chapter or a series) ---

export type DekiMessage = ChatMessage & { id: number; created_at: number };

async function threadId(db: Db, scope: Exclude<DekiScope, "once">, scopeId: number, now: number): Promise<number> {
  await db.batch([
    { sql: "INSERT OR IGNORE INTO deki_threads (scope, scope_id, created_at, updated_at) VALUES (?, ?, ?, ?)", params: [scope, scopeId, now, now] },
  ]);
  const [{ id }] = await db.all<{ id: number }>("SELECT id FROM deki_threads WHERE scope = ? AND scope_id = ?", [scope, scopeId]);
  return id;
}

/** A kept chat's messages, oldest first (none yet: an empty list). */
export async function loadThread(db: Db, scope: Exclude<DekiScope, "once">, scopeId: number): Promise<DekiMessage[]> {
  return db.all<DekiMessage>(
    `SELECT m.id, m.role, m.text, m.created_at FROM deki_messages m JOIN deki_threads t ON t.id = m.thread_id
     WHERE t.scope = ? AND t.scope_id = ? ORDER BY m.id`,
    [scope, scopeId],
  );
}

/** Adds messages to a kept chat. */
export async function saveToThread(db: Db, scope: Exclude<DekiScope, "once">, scopeId: number, messages: ChatMessage[], now: number): Promise<void> {
  const id = await threadId(db, scope, scopeId, now);
  await db.batch([
    ...messages.map((m) => ({ sql: "INSERT INTO deki_messages (thread_id, role, text, created_at) VALUES (?, ?, ?, ?)", params: [id, m.role, m.text, now] })),
    { sql: "UPDATE deki_threads SET updated_at = ? WHERE id = ?", params: [now, id] },
  ]);
}

/** Empties a kept chat. */
export async function clearThread(db: Db, scope: Exclude<DekiScope, "once">, scopeId: number): Promise<void> {
  await db.batch([
    { sql: "DELETE FROM deki_messages WHERE thread_id IN (SELECT id FROM deki_threads WHERE scope = ? AND scope_id = ?)", params: [scope, scopeId] },
  ]);
}
