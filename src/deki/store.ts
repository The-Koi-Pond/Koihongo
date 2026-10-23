// Deki-senpai's state, shared by the panel (DekiPanel.tsx) and the pages that
// tell Deki where you are (useDekiPage) or hand it a task (askDeki: Explain on
// a box, the mnemonic workshop…).

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { aiComplete, type ChatMessage } from "../ai/ai.ts";
import { getAiSettings, PROVIDERS, saveAiSettings } from "../ai/settings.ts";
import { tauriDb } from "../db/tauriDb.ts";
import {
  clearThread,
  dekiSystem,
  DEKI_COMMANDS,
  historyBudget,
  loadThread,
  parseCommand,
  saveToThread,
  trimHistory,
  USE_NAMES,
  type DekiPage,
  type DekiScope,
} from "./deki.ts";

/** Something a feature asks Deki to do, opening the panel. */
export type DekiTask = {
  /** The message sent for you (shown as yours). */
  message: string;
  /** Extra instructions for the whole conversation (a mnemonic workshop's rules, say). */
  instructions?: string;
  /** Its own chat, just for now, even where a chapter's chat is kept (a mnemonic isn't part of the manga). */
  apart?: boolean;
  /** Buttons under each of Deki's replies in this task ("Use as meaning"). */
  actions?: (reply: string) => ReactNode;
};

/** A page's registration: where you are, plus its own slash commands (Reading's /explain, /translate). */
export type DekiPageRegistration = DekiPage & {
  commands?: Partial<Record<"explain" | "translate", () => DekiTask | string>>;
};

/** A line in the chat: yours, Deki's, or a note from the app (not sent). */
export type DekiLine = { role: "user" | "assistant" | "note"; text: string; actions?: (reply: string) => ReactNode };

type State = {
  open: boolean;
  /** Docked as a side panel, beside the page. */
  expanded: boolean;
  page?: DekiPageRegistration;
  lines: DekiLine[];
  /** Which chat is showing: "once", "task", "chapter:12", "series:3". */
  session: string;
  task?: DekiTask;
  busy: boolean;
  error?: string;
};

let state: State = { open: false, expanded: false, lines: [], session: "once", busy: false };
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useDeki(): State {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

// Per-page choices, remembered on this PC: parts switched off, and Reading's scope.
function remembered<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(`koihongo.deki.${key}`);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(`koihongo.deki.${key}`, JSON.stringify(value));
  } catch {
    // Not remembered this time; harmless.
  }
}

export const partsOff = (pageId: string) => remembered<string[]>(`off.${pageId}`, []);
export function togglePart(key: string) {
  const id = state.page?.id;
  if (!id) return;
  const off = partsOff(id);
  remember(`off.${id}`, off.includes(key) ? off.filter((k) => k !== key) : [...off, key]);
  set({}); // re-render the chips
}

/** The scope you chose for this page's chats (only pages with scopes keep any). */
export const chosenScope = (pageId: string) => remembered<DekiScope>(`scope.${pageId}`, "once");

/** The chat that fits the page and scope now. */
function sessionFor(page: DekiPageRegistration | undefined): string {
  const scope = page ? chosenScope(page.id) : "once";
  const target = scope !== "once" ? page?.scopes?.[scope] : undefined;
  return target ? `${scope}:${target.id}` : "once";
}

/** Chats just for now, by session, until cleared (a mnemonic task's goes when you leave it). */
const unsaved = new Map<string, DekiLine[]>();

async function switchTo(session: string) {
  if (session === state.session) return;
  if (!state.session.includes(":")) unsaved.set(state.session, state.lines);
  set({ session, lines: unsaved.get(session) ?? [], error: undefined, task: session === "task" ? state.task : undefined });
  const [scope, id] = session.split(":");
  if (id) {
    const lines = await loadThread(tauriDb, scope as "chapter" | "series", Number(id));
    if (state.session === session) set({ lines: lines.map((m) => ({ role: m.role, text: m.text })) });
  }
}

/** A page telling Deki where you are (call it on every render; it only updates when something changed). */
export function useDekiPage(page: DekiPageRegistration | undefined) {
  const key = page ? JSON.stringify([page.id, page.label, page.instructions, page.parts, page.scopes]) : "";
  /** Where you are: changes when you go somewhere else, not when what's here changes (a mnemonic saved). */
  const where = page ? JSON.stringify([page.id, page.label, page.scopes]) : "";
  useEffect(() => {
    if (!page) return;
    set({ page });
    return () => {
      if (state.page?.id !== page.id) return;
      set({ page: undefined });
      // Gone to a page with nothing to tell (Today, Decks…): back to a chat just for now, so a
      // general question doesn't land in a chapter's kept chat. (A page that does register
      // has done so by the time this runs.)
      queueMicrotask(() => {
        if (!state.page) switchTo("once").catch((e) => set({ error: String(e) }));
      });
    };
    // The key says when the page changed (functions inside don't).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (!page) return;
    // A task ends when you go elsewhere (its buttons were for what you had open), and its
    // own chat with it. A kept chat follows the chapter or series you're in.
    if (state.session === "task") unsaved.delete("task");
    set({ task: undefined });
    switchTo(sessionFor(page)).catch((e) => set({ error: String(e) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [where]);
  // Keep the newest commands (they may close over fresh state) without re-registering.
  if (page && state.page?.id === page.id) state.page.commands = page.commands;
}

export const openDeki = () => set({ open: true });
export const closeDeki = () => set({ open: false });
export const toggleExpanded = () => set({ expanded: !state.expanded });

export async function setScope(scope: DekiScope) {
  if (!state.page) return;
  remember(`scope.${state.page.id}`, scope);
  await switchTo(sessionFor(state.page));
}

const note = (text: string) => set({ lines: [...state.lines, { role: "note", text }] });

/** Does what a feature asks: opens the panel and sends its message. */
export async function askDeki(task: DekiTask) {
  set({ open: true });
  if (task.apart) {
    // A fresh chat of its own (another task's, if one was open, is done).
    unsaved.delete("task");
    set({ task });
    if (state.session === "task") set({ lines: [], error: undefined });
    else await switchTo("task");
  } else set({ task });
  await send(task.message);
}

/** Sends a message (or runs a slash command). */
export async function send(text: string) {
  const command = parseCommand(text);
  if (command) return run(command.name, command.arg);
  if (!text.trim() || state.busy) return;
  const settings = await getAiSettings(tauriDb);
  if (settings.provider === "off") return note("Pick a connection for Deki first (the menu at the top, or /use builtin).");
  const actions = state.task?.actions;
  const asked: DekiLine = { role: "user", text: text.trim() };
  set({ lines: [...state.lines, asked], busy: true, error: undefined });
  const session = state.session;
  try {
    const history = trimHistory(
      state.lines.filter((l): l is DekiLine & ChatMessage => l.role !== "note").map(({ role, text }) => ({ role, text })),
      historyBudget(settings.provider),
    );
    const system = dekiSystem(state.page, state.page ? partsOff(state.page.id) : [], state.task?.instructions);
    const reply = (await aiComplete({ system, messages: history })).trim();
    if (state.session !== session) return; // you moved on; the reply would land in another chat
    set({ lines: [...state.lines, { role: "assistant", text: reply, actions }] });
    const [scope, id] = session.split(":");
    if (id) {
      await saveToThread(tauriDb, scope as "chapter" | "series", Number(id), [asked as ChatMessage, { role: "assistant", text: reply }], Date.now());
    }
  } catch (e) {
    if (state.session === session) set({ error: String(e).replace(/^Error: /, "") });
  } finally {
    set({ busy: false });
  }
}

async function run(name: string, arg: string) {
  const page = state.page;
  switch (name) {
    case "help":
      return note(["Commands:", ...DEKI_COMMANDS.map((c) => `/${c.name}${c.args ? ` ${c.args}` : ""}: ${c.help}`)].join("\n"));
    case "clear": {
      const [scope, id] = state.session.split(":");
      if (id) await clearThread(tauriDb, scope as "chapter" | "series", Number(id));
      unsaved.delete(state.session);
      return set({ lines: [], error: undefined });
    }
    case "scope": {
      const scope = arg.toLowerCase() as DekiScope;
      if (!["once", "chapter", "series"].includes(scope)) return note("/scope once, /scope chapter or /scope series.");
      if (scope !== "once" && !page?.scopes?.[scope]) return note(`There's no ${scope} to keep a chat for here (that's for Reading).`);
      await setScope(scope);
      return note(scope === "once" ? "This chat is just for now." : `This chat is kept for the ${scope}: ${page!.scopes![scope]!.label}.`);
    }
    case "use": {
      const provider = USE_NAMES[arg.toLowerCase()];
      if (!provider) return note("/use builtin, /use claude, /use api or /use other.");
      await useConnection(provider);
      return note(`Deki now uses ${PROVIDERS.find((p) => p.id === provider)!.name}.`);
    }
    case "context": {
      if (!page) return note("Nothing from this page is sent: just your chat.");
      const off = partsOff(page.id);
      return note(
        [`Here: ${page.label}`, ...page.parts.filter((p) => p.text.trim()).map((p) => `${off.includes(p.key) ? "✗ not sent" : "✓ sent"}: ${p.name}`)].join("\n"),
      );
    }
    case "explain":
    case "translate": {
      const make = page?.commands?.[name];
      if (!make) return note(`/${name} works in Reading.`);
      const task = make();
      return typeof task === "string" ? note(task) : askDeki(task);
    }
    default:
      return note(`I don't know /${name}. Try /help.`);
  }
}

/** Switches Deki's connection (Settings → Deki-senpai, kept there). */
export async function useConnection(provider: (typeof PROVIDERS)[number]["id"]) {
  const s = await getAiSettings(tauriDb);
  await saveAiSettings(tauriDb, { ...s, provider });
}
