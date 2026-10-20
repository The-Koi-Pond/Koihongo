import assert from "node:assert/strict";
import { test } from "node:test";
import { formatConversation } from "../src/ai/ai.ts";
import { describeItem, extractMnemonics, mnemonicOpener, mnemonicSystemPrompt } from "../src/ai/prompts.ts";
import type { KanjiDetails } from "../src/items.ts";

const mori: KanjiDetails = {
  kind: "kanji",
  item_key: "kanji:森",
  character: "森",
  meanings: ["forest", "woods"],
  onReadings: ["シン"],
  kunReadings: ["もり"],
  components: [{ display: "木", name: "tree" }],
  strokeSvg: null,
  words: [],
  notes: {},
  synonyms: [],
};

test("a single message is sent as-is; longer chats become a transcript", () => {
  assert.equal(formatConversation([{ role: "user", text: "hi" }]), "hi");
  const t = formatConversation([
    { role: "user", text: "Ideas?" },
    { role: "assistant", text: "Mnemonic: trees" },
    { role: "user", text: "Funnier please" },
  ]);
  assert.match(t, /Learner: Ideas\?/);
  assert.match(t, /You: Mnemonic: trees/);
  assert.match(t, /Learner's new message: Funnier please/);
  assert.throws(() => formatConversation([]));
});

test("item facts come from the database, not the model", () => {
  const d = describeItem(mori);
  assert.match(d, /kanji 森/);
  assert.match(d, /forest, woods/);
  assert.match(d, /シン/);
  assert.match(d, /もり/);
  assert.match(d, /木 "tree"/);
});

test("the system prompt includes the current mnemonic and the opener adapts", () => {
  const withNote: KanjiDetails = { ...mori, notes: { mnemonic_meaning: { text: "Three trees.", author: "you", created_at: 1 } } };
  assert.match(mnemonicSystemPrompt(withNote, "meaning"), /Current meaning mnemonic: "Three trees."/);
  assert.match(mnemonicSystemPrompt(mori, "reading"), /Current reading mnemonic: none yet/);
  assert.match(mnemonicOpener(withNote, "meaning"), /isn't working/);
  assert.match(mnemonicOpener(mori, "meaning"), /3 options/);
});

test("mnemonic lines are found, even with numbering or bold markers", () => {
  const reply = [
    "Here are three:",
    "Mnemonic: Three TREES crowd into a FOREST.",
    "1. Mnemonic: A shinobi hides in the FOREST.",
    "**Mnemonic:** The FOREST spirit says hi.",
    "mnemonic:   lowercase works too  ",
    "Not a mnemonic line.",
  ].join("\n");
  assert.deepEqual(extractMnemonics(reply), [
    "Three TREES crowd into a FOREST.",
    "A shinobi hides in the FOREST.",
    "The FOREST spirit says hi.",
    "lowercase works too",
  ]);
});
