import assert from "node:assert/strict";
import { test } from "node:test";
import { backendRequest, formatConversation } from "../src/ai/ai.ts";
import { DEFAULT_AI, loadAiSettings, saveAiSettings, type AiSettings } from "../src/ai/settings.ts";
import { migrate } from "../src/db/migrations.ts";
import { describeItem, explainSystemPrompt, extractMnemonics, mnemonicOpener, mnemonicSystemPrompt } from "../src/ai/prompts.ts";
import type { KanjiDetails } from "../src/items.ts";
import { openTestDb } from "./nodeDb.ts";

const mori: KanjiDetails = {
  kind: "kanji",
  item_key: "kanji:森",
  character: "森",
  meanings: ["forest", "woods"],
  onReadings: ["シン"],
  kunReadings: ["もり"],
  components: [{ glyph: "木", display: "木", name: "tree" }],
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

test("the sentence explainer gets the sentence, its word facts and what the learner knows", () => {
  const prompt = explainSystemPrompt(
    { japanese: "休みが欲しい。", english: "I want a break.", word: { written: "休み", reading: "やすみ", meaning: "rest" } },
    [
      { written: "休み", reading: "やすみ", meaning: "rest; break", started: true },
      { written: "欲しい", reading: "ほしい", meaning: "wanted; desired", started: false },
    ],
  );
  assert.match(prompt, /Sentence: 休みが欲しい。/);
  assert.match(prompt, /I want a break\./);
  assert.match(prompt, /- 休み \(やすみ\): rest; break\. The learner has studied this word\./);
  assert.match(prompt, /- 欲しい \(ほしい\): wanted; desired\. New to the learner\./);
  assert.match(prompt, /no markdown/);
});

const chat = { system: "sys", messages: [{ role: "user" as const, text: "hi" }] };

test("AI settings: off until chosen, and saved values come back", async () => {
  const db = openTestDb(() => {});
  await migrate(db);
  assert.equal((await loadAiSettings(db)).provider, "off");
  const mine: AiSettings = { ...DEFAULT_AI, provider: "openai-compatible", compatPreset: "ollama", compatModel: " llama3.1 " };
  await saveAiSettings(db, mine);
  const back = await loadAiSettings(db);
  assert.equal(back.provider, "openai-compatible");
  assert.equal(back.compatModel, "llama3.1");
});

test("AI settings: unknown saved values fall back to safe ones", async () => {
  const db = openTestDb(() => {});
  await migrate(db);
  await db.batch([
    { sql: "INSERT INTO settings VALUES ('ai.provider', 'skynet')" },
    { sql: "INSERT INTO settings VALUES ('ai.compatPreset', 'nope')" },
  ]);
  const s = await loadAiSettings(db);
  assert.equal(s.provider, "off");
  assert.equal(s.compatPreset, DEFAULT_AI.compatPreset);
});

test("AI requests: each helper gets what it needs, and off sends nothing", () => {
  assert.throws(() => backendRequest(DEFAULT_AI, chat), /turned off/);

  const cc = backendRequest({ ...DEFAULT_AI, provider: "claude-code" }, chat);
  assert.equal(cc.model, "sonnet");
  assert.equal(cc.prompt, "hi");

  const api = backendRequest({ ...DEFAULT_AI, provider: "anthropic" }, chat);
  assert.deepEqual(api, { provider: "anthropic", model: "claude-opus-5-5", system: "sys", messages: chat.messages, image: undefined });

  // Known services are named, not addressed: Rust fixes the address and the key.
  const gemini = backendRequest({ ...DEFAULT_AI, provider: "openai-compatible", compatPreset: "gemini", compatModel: "m", compatBaseUrl: "https://evil.example" }, chat);
  assert.equal(gemini.preset, "gemini");
  assert.equal(gemini.baseUrl, undefined, "a stored address isn't sent for a known service");

  const custom = { ...DEFAULT_AI, provider: "openai-compatible" as const, compatPreset: "custom" as const, compatBaseUrl: "http://x/v1", compatModel: "m" };
  assert.equal(backendRequest(custom, chat).baseUrl, "http://x/v1");

  assert.throws(() => backendRequest({ ...DEFAULT_AI, provider: "openai-compatible" }, chat), /No model/);
});

test("explaining a manga box: the box, its page and the series context go in; SFX get their own format", async () => {
  const { explainBoxPrompt } = await import("../src/ai/prompts.ts");
  const speech = explainBoxPrompt({ kind: "Speech", text: "もう待ちません", unsure: false }, ["Speech 2: 邪魔者はもういないのだから…"], "Series: Koi Story\n\nCast:\nLily");
  assert.match(speech, /The one to explain \(Speech\): もう待ちません/);
  assert.match(speech, /Speech 2: 邪魔者はもういないのだから…/);
  assert.match(speech, /Cast:\nLily/);
  assert.match(speech, /piece by piece/);
  assert.doesNotMatch(speech, /misread/);
  const sfx = explainBoxPrompt({ kind: "SFX", text: "コツ", unsure: true }, [], "");
  assert.match(sfx, /what this sound effect depicts/);
  assert.match(sfx, /misread/);
  assert.doesNotMatch(sfx, /About the manga|The text around it/);
});

test("an explanation's kana line and translation can be kept; other first lines aren't a reading", async () => {
  const { explainedParts } = await import("../src/ai/prompts.ts");
  const reply = "1. もう まちません\nmou machimasen\n\nもう (mou) – any more\n\nTranslation: I won't wait any longer.";
  assert.deepEqual(explainedParts(reply), { kana: "もう まちません", translation: "I won't wait any longer." });
  assert.deepEqual(explainedParts("Sorry, I can't read that.\n5. translation: Footsteps (tap, tap)."), { kana: undefined, translation: "Footsteps (tap, tap)." });
  assert.deepEqual(explainedParts(""), { kana: undefined, translation: undefined });
});

test("reading a box with AI: the picture goes to every helper, and the reply is just the text", async () => {
  const { backendRequest } = await import("../src/ai/ai.ts");
  const { readImageReply } = await import("../src/ai/prompts.ts");
  const request = { system: "s", messages: [{ role: "user" as const, text: "read" }], image: "QUJD" };
  for (const provider of ["claude-code", "anthropic"] as const) {
    assert.equal((backendRequest({ ...DEFAULT_AI, provider }, request) as { image?: string }).image, "QUJD");
  }
  assert.equal(readImageReply("「コツ」"), "コツ");
  assert.equal(readImageReply("もう待ちません\n(It means: I won't wait)"), "もう待ちません");
  assert.equal(readImageReply("(none)"), "");
});
