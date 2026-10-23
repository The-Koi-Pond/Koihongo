import assert from "node:assert/strict";
import { test } from "node:test";
import { migrate } from "../src/db/migrations.ts";
import { clearThread, dekiSystem, historyBudget, loadThread, parseCommand, saveToThread, trimHistory, DEKI_PERSONA, type DekiPage } from "../src/deki/deki.ts";
import { openTestDb } from "./nodeDb.ts";

const READING: DekiPage = {
  id: "reading",
  label: "Reading · Koi Story · CH.3 · p.12",
  instructions: "Help them read.",
  parts: [
    { key: "series", name: "About the manga", text: "Cast: Lily" },
    { key: "page", name: "The boxes on this page", text: "Speech 1: もう待ちません" },
    { key: "empty", name: "Nothing", text: "  " },
  ],
};

test("Deki's request: persona, where you are, the parts you let through, and a task's own instructions", () => {
  const all = dekiSystem(READING, []);
  assert.ok(all.startsWith(DEKI_PERSONA));
  assert.match(all, /Where the learner is: Reading · Koi Story · CH\.3 · p\.12\.\nHelp them read\./);
  assert.match(all, /About the manga:\nCast: Lily/);
  assert.doesNotMatch(all, /Nothing:/, "empty parts are left out");
  const someOff = dekiSystem(READING, ["series"], "Suggest mnemonics.");
  assert.doesNotMatch(someOff, /Cast: Lily/);
  assert.match(someOff, /For this conversation:\nSuggest mnemonics\.$/);
  assert.match(dekiSystem(undefined, []), /Where the learner is: the app\./);
});

test("long chats send their latest messages, starting with one of yours", () => {
  const chat = [
    { role: "user" as const, text: "a".repeat(50) },
    { role: "assistant" as const, text: "b".repeat(50) },
    { role: "user" as const, text: "c".repeat(30) },
    { role: "assistant" as const, text: "d".repeat(30) },
    { role: "user" as const, text: "e" },
  ];
  assert.deepEqual(trimHistory(chat, 1000), chat);
  assert.deepEqual(trimHistory(chat, 70).map((m) => m.text[0]), ["c", "d", "e"]);
  assert.deepEqual(trimHistory(chat, 40).map((m) => m.text[0]), ["e"], "never starts with Deki's reply");
  assert.deepEqual(trimHistory([{ role: "user", text: "x".repeat(500) }], 10).length, 1, "the newest goes even if it's long");
  assert.ok(historyBudget("local") < historyBudget("claude-code"));
});

test("slash commands", () => {
  assert.deepEqual(parseCommand("/scope series"), { name: "scope", arg: "series" });
  assert.deepEqual(parseCommand("  /HELP "), { name: "help", arg: "" });
  assert.equal(parseCommand("what does /this mean"), undefined);
  assert.equal(parseCommand("もう待ちません"), undefined);
});

test("kept chats: per chapter or series, in order, cleared on request", async () => {
  const db = openTestDb(() => {});
  await migrate(db);
  await saveToThread(db, "chapter", 3, [{ role: "user", text: "Who's Lily?" }, { role: "assistant", text: "The heroine." }], 1);
  await saveToThread(db, "chapter", 3, [{ role: "user", text: "And 様?" }], 2);
  await saveToThread(db, "series", 3, [{ role: "user", text: "Series chat" }], 3);
  assert.deepEqual((await loadThread(db, "chapter", 3)).map((m) => [m.role, m.text]), [
    ["user", "Who's Lily?"],
    ["assistant", "The heroine."],
    ["user", "And 様?"],
  ]);
  assert.equal((await loadThread(db, "series", 3)).length, 1, "a series and a chapter with the same id are different chats");
  await clearThread(db, "chapter", 3);
  assert.deepEqual(await loadThread(db, "chapter", 3), []);
  assert.equal((await loadThread(db, "series", 3)).length, 1);
});
