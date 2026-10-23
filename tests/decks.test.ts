import assert from "node:assert/strict";
import { test } from "node:test";
import type { DatabaseSync } from "node:sqlite";
import { migrate } from "../src/db/migrations.ts";
import {
  addDeckCard,
  cardFromItem,
  createDeck,
  deckCardId,
  deckCards,
  deckQuestion,
  deleteDeck,
  dueDeckCards,
  listDecks,
  recordDeckReview,
  setDeckInDaily,
} from "../src/decks.ts";
import type { KanjiDetails, WordDetails } from "../src/items.ts";
import { reviewForecast, todaySummary } from "../src/srs/progress.ts";
import { Rating } from "../src/srs/scheduler.ts";
import { openTestDb } from "./nodeDb.ts";

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-03-02T10:00:00").getTime();

// One lesson on the path, so lesson pacing can be checked.
function fixture(content: DatabaseSync) {
  content.exec(`
    INSERT INTO components (glyph, display, name, stroke_count) VALUES ('木', '木', 'tree', 4);
    INSERT INTO path (position, item_key, kind, track) VALUES (1, 'component:木', 'component', 'main');
  `);
}

async function setup() {
  const db = openTestDb(fixture);
  await migrate(db);
  return db;
}

test("decks: a new card is due right away and counted on its deck", async () => {
  const db = await setup();
  const id = await createDeck(db, "  Lyrics  ", T0);
  await addDeckCard(db, id, "夜", "night", null, T0);
  const [deck] = await listDecks(db, T0);
  assert.equal(deck.name, "Lyrics");
  assert.equal(deck.cards, 1);
  assert.equal(deck.due, 1);
  assert.equal(deck.in_daily, 1);
  assert.equal((await dueDeckCards(db, T0)).length, 1);
});

test("decks: in-daily decks join daily reviews; separate ones don't", async () => {
  const db = await setup();
  const id = await createDeck(db, "Words", T0);
  await addDeckCard(db, id, "a", "b", null, T0);
  assert.equal((await todaySummary(db, T0)).reviewsDue, 1);

  await setDeckInDaily(db, id, false);
  assert.equal((await dueDeckCards(db, T0)).length, 0, "not in the daily queue");
  assert.equal((await dueDeckCards(db, T0, id)).length, 1, "still studyable on its own");
  assert.equal((await todaySummary(db, T0)).reviewsDue, 0);
});

test("decks: deck cards don't hold back lessons", async () => {
  const db = await setup();
  const before = (await todaySummary(db, T0)).lessons.length;
  const id = await createDeck(db, "Big deck", T0);
  for (let i = 0; i < 200; i++) await addDeckCard(db, id, `f${i}`, `b${i}`, null, T0);
  const after = await todaySummary(db, T0);
  assert.equal(after.lessons.length, before);
  assert.equal(after.reviewsDue, 200);
});

test("decks: rating a card schedules it later and logs the review", async () => {
  const db = await setup();
  const id = await createDeck(db, "D", T0);
  await addDeckCard(db, id, "f", "b", null, T0);
  const [card] = await deckCards(db, id);
  const after = await recordDeckReview(db, card.id, Rating.Good, T0);
  assert.ok(after.due > T0 + 12 * HOUR, "Good pushes it to a later day");
  assert.equal((await dueDeckCards(db, T0 + HOUR)).length, 0);
  const [log] = await db.all<{ rating: number; card_id: number }>("SELECT rating, card_id FROM deck_review_log");
  assert.deepEqual({ ...log }, { rating: Rating.Good, card_id: card.id });
});

test("decks: the 24-hour forecast includes in-daily deck cards", async () => {
  const db = await setup();
  const id = await createDeck(db, "D", T0);
  await addDeckCard(db, id, "f", "b", null, T0);
  await db.batch([{ sql: "UPDATE deck_cards SET due = ?", params: [T0 + 2.5 * HOUR] }]);
  assert.equal((await reviewForecast(db, T0))[2], 1);
  await setDeckInDaily(db, id, false);
  assert.equal((await reviewForecast(db, T0))[2], 0);
});

test("decks: deleting a deck removes its cards and their history", async () => {
  const db = await setup();
  const id = await createDeck(db, "D", T0);
  await addDeckCard(db, id, "f", "b", null, T0);
  const [card] = await deckCards(db, id);
  await recordDeckReview(db, card.id, Rating.Again, T0);
  await deleteDeck(db, id);
  assert.equal((await listDecks(db, T0)).length, 0);
  assert.equal((await db.all("SELECT * FROM deck_cards")).length, 0);
  assert.equal((await db.all("SELECT * FROM deck_review_log")).length, 0);
});

test("decks: session questions round-trip the card id", () => {
  const q = deckQuestion(42);
  assert.equal(deckCardId(q), 42);
  assert.equal(deckCardId({ item_key: "kanji:木", card_type: "meaning" }), null);
});

test("decks: cards made from items fill front and back", () => {
  const common = { item_key: "", notes: {}, synonyms: [] };
  const kanji = { ...common, kind: "kanji", character: "木", meanings: ["tree", "wood"], onReadings: ["モク"], kunReadings: ["き"] } as unknown as KanjiDetails;
  assert.deepEqual(cardFromItem(kanji), { front: "木", back: "tree, wood\nモク、き" });
  const word = {
    ...common,
    kind: "word",
    written: "休み",
    reading: "やすみ",
    senses: [{ pos: [], glosses: ["rest", "break", "holiday", "vacation"] }, { pos: [], glosses: ["absence"] }],
  } as unknown as WordDetails;
  assert.deepEqual(cardFromItem(word), { front: "休み", back: "やすみ\nrest, break, holiday; absence" });
});
