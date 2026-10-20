import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerCurrent,
  currentQuestion,
  REQUEUE_GAP,
  sessionStats,
  spreadOutPairs,
  startSession,
  type Question,
} from "../src/srs/session.ts";

const q = (item: string, card_type: "meaning" | "reading" = "meaning"): Question => ({ item_key: item, card_type });
const ids = (qs: Question[]) => qs.map((x) => `${x.item_key}/${x.card_type[0]}`);

test("correct answers leave the queue", () => {
  let s = startSession([q("a"), q("b")]);
  ({ session: s } = answerCurrent(s, true));
  assert.deepEqual(currentQuestion(s), q("b"));
  ({ session: s } = answerCurrent(s, true));
  assert.equal(currentQuestion(s), undefined);
  assert.deepEqual(sessionStats(s), { answered: 2, correctFirstTry: 2, remaining: 0 });
});

test("a wrong answer comes back a few questions later; only the first try counts", () => {
  const items = ["a", "b", "c", "d", "e", "f"].map((x) => q(x));
  let s = startSession(items);
  const first = answerCurrent(s, false);
  assert.equal(first.firstAttempt, true);
  s = first.session;
  assert.deepEqual(ids(s.queue), ids([...items.slice(1, 1 + REQUEUE_GAP), q("a"), ...items.slice(1 + REQUEUE_GAP)]));

  for (let i = 0; i < REQUEUE_GAP; i++) s = answerCurrent(s, true).session;
  const retry = answerCurrent(s, true);
  assert.equal(retry.firstAttempt, false);
  assert.equal(retry.session.firstTry["a|meaning"], false, "still counted as missed");
});

test("a missed card near the end goes to the back", () => {
  let s = startSession([q("a"), q("b")]);
  s = answerCurrent(s, false).session;
  assert.deepEqual(ids(s.queue), ["b/m", "a/m"]);
});

test("answering with an empty queue is an error", () => {
  assert.throws(() => answerCurrent(startSession([]), true));
});

test("meaning and reading of one item aren't asked back to back", () => {
  const spread = spreadOutPairs([q("a"), q("a", "reading"), q("b"), q("b", "reading"), q("c")]);
  assert.deepEqual(ids(spread), ["a/m", "b/m", "a/r", "b/r", "c/m"]);
  for (let i = 1; i < spread.length; i++) assert.notEqual(spread[i].item_key, spread[i - 1].item_key);
});

test("spreading keeps everything even when it can't separate them", () => {
  assert.deepEqual(ids(spreadOutPairs([q("a"), q("a", "reading")])), ["a/m", "a/r"]);
});
