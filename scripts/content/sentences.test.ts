import assert from "node:assert/strict";
import { test } from "node:test";
import { linkSentences, parseTanaka, type SentenceWord } from "./sentences.ts";

const SAMPLE = [
  "A: 彼は忙しい人だ。しないで。\tHe is a busy man. Don't.#ID=303696_100001",
  "B: 彼(かれ)[01] は 忙しい(いそがしい)~ 人(ひと) だ 為る(する){しない} で(#2028980)",
  "A: 南西に行く。\tGo southwest.#ID=5_6",
  "B: 何か に 行く 彼(かれ)",
  "",
].join("\n");

test("parses Tanaka pairs and their word index", () => {
  const [first, second] = parseTanaka(SAMPLE);
  assert.equal(first.id, "100001");
  assert.equal(first.japanese, "彼は忙しい人だ。しないで。");
  assert.equal(first.english, "He is a busy man. Don't.");
  assert.deepEqual(first.tokens[0], { head: "彼", reading: "かれ", checked: false });
  assert.deepEqual(first.tokens[2], { head: "忙しい", reading: "いそがしい", checked: true });
  assert.deepEqual(first.tokens[5], { head: "為る", reading: "する", form: "しない", checked: false });
  assert.deepEqual(first.tokens[6], { head: "で", jmdictId: "2028980", checked: false });
  assert.equal(second.tokens.length, 4);
});

const word = (id: string, written: string, reading: string, extra: Partial<SentenceWord> = {}): SentenceWord => ({
  id,
  written,
  reading,
  otherForms: [],
  priority: 10,
  usuallyKana: false,
  ...extra,
});

test("links sentences to words, counting the kanji words you'd need to learn", () => {
  const words = [
    word("1", "彼", "かれ"),
    word("2", "忙しい", "いそがしい"),
    word("3", "為る", "する", { usuallyKana: true }),
    word("4", "南西", "なんせい"),
    word("5", "行く", "いく"),
    word("6", "で", "で"),
  ];
  const { sentences, links } = linkSentences(parseTanaka(SAMPLE), words, 20);
  const busy = sentences.find((s) => s.id === "100001")!;
  // 為る is usually kana and で has no kanji: neither counts; 人 isn't in this dictionary.
  assert.deepEqual(busy.kanjiWords, ["1", "2"]);
  assert.equal(busy.unlisted, 1);
  assert.deepEqual(
    links.filter((l) => l.wordId === "2"),
    [{ wordId: "2", sentenceId: "100001", form: "忙しい", checked: true }],
  );
  assert.equal(links.find((l) => l.wordId === "3")?.form, "しない");
  // 彼 is indexed for the second sentence too, but its text doesn't contain 彼.
  assert.deepEqual(
    links.filter((l) => l.wordId === "1").map((l) => l.sentenceId),
    ["100001"],
  );
  // 南西 isn't in the index, but the text contains it.
  assert.deepEqual(links.find((l) => l.wordId === "4"), { wordId: "4", sentenceId: "6", form: "南西", checked: false });
});

test("keeps checked examples first, then the shortest, up to the limit", () => {
  const text = ["長い長い文です。", "短い文。", "普通の文だよ。"]
    .map((jp, i) => `A: ${jp}\tEnglish.#ID=0_${i + 1}\nB: 文${i === 2 ? "~" : ""} 短い`)
    .join("\n");
  const { links } = linkSentences(parseTanaka(text), [word("1", "文", "ぶん")], 2);
  assert.deepEqual(
    links.map((l) => l.sentenceId),
    ["3", "2"],
  );
});
