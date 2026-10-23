// Your own flashcard decks: free-text cards (or copies of dictionary items),
// studied by flipping and rating yourself, scheduled with the same FSRS as
// everything else. Decks with in_daily on join your daily reviews.

import type { Db } from "./db/db.ts";
import type { ItemDetails } from "./items.ts";
import { emptyFsrs, retrievability, schedule, type FsrsFields } from "./srs/scheduler.ts";
import type { Grade } from "ts-fsrs";
import type { DeckQuestion } from "./srs/session.ts";

export type Deck = { id: number; name: string; in_daily: number; created_at: number; cards: number; due: number };

export type DeckCard = FsrsFields & {
  id: number;
  deck_id: number;
  front: string;
  back: string;
  item_key: string | null;
  created_at: number;
};

/** Every deck with its card count and how many are due now, oldest first. */
export async function listDecks(db: Db, now: number): Promise<Deck[]> {
  return db.all<Deck>(
    `SELECT d.id, d.name, d.in_daily, d.created_at,
            count(c.id) AS cards, coalesce(sum(c.due <= ?), 0) AS due
     FROM decks d LEFT JOIN deck_cards c ON c.deck_id = d.id
     GROUP BY d.id ORDER BY d.created_at, d.id`,
    [now],
  );
}

export async function getDeck(db: Db, id: number, now: number): Promise<Deck | undefined> {
  return (await listDecks(db, now)).find((d) => d.id === id);
}

/** Creates a deck (in daily reviews by default) and returns its id. */
export async function createDeck(db: Db, name: string, now: number): Promise<number> {
  await db.batch([{ sql: "INSERT INTO decks (name, in_daily, created_at) VALUES (?, 1, ?)", params: [name.trim(), now] }]);
  const [{ id }] = await db.all<{ id: number }>("SELECT max(id) AS id FROM decks");
  return id;
}

export async function renameDeck(db: Db, id: number, name: string): Promise<void> {
  await db.batch([{ sql: "UPDATE decks SET name = ? WHERE id = ?", params: [name.trim(), id] }]);
}

export async function setDeckInDaily(db: Db, id: number, inDaily: boolean): Promise<void> {
  await db.batch([{ sql: "UPDATE decks SET in_daily = ? WHERE id = ?", params: [inDaily ? 1 : 0, id] }]);
}

/** Deletes a deck with its cards and their review history. */
export async function deleteDeck(db: Db, id: number): Promise<void> {
  await db.batch([
    { sql: "DELETE FROM deck_review_log WHERE card_id IN (SELECT id FROM deck_cards WHERE deck_id = ?)", params: [id] },
    { sql: "DELETE FROM deck_cards WHERE deck_id = ?", params: [id] },
    { sql: "DELETE FROM decks WHERE id = ?", params: [id] },
  ]);
}

/** A deck's cards, newest first. */
export async function deckCards(db: Db, deckId: number): Promise<DeckCard[]> {
  return db.all<DeckCard>("SELECT * FROM deck_cards WHERE deck_id = ? ORDER BY created_at DESC, id DESC", [deckId]);
}

export async function getDeckCard(db: Db, id: number): Promise<DeckCard | undefined> {
  const [card] = await db.all<DeckCard>("SELECT * FROM deck_cards WHERE id = ?", [id]);
  return card;
}

/** Adds a card, due right away (a new card's first look is its first review). */
export async function addDeckCard(db: Db, deckId: number, front: string, back: string, itemKey: string | null, now: number): Promise<void> {
  const f = emptyFsrs(now, now);
  await db.batch([
    {
      sql: `INSERT INTO deck_cards (deck_id, front, back, item_key, created_at, state, due, stability, difficulty,
            scheduled_days, learning_steps, reps, lapses, last_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [deckId, front.trim(), back.trim(), itemKey, now, f.state, f.due, f.stability, f.difficulty, f.scheduled_days, f.learning_steps, f.reps, f.lapses, f.last_review],
    },
  ]);
}

export async function updateDeckCard(db: Db, id: number, front: string, back: string): Promise<void> {
  await db.batch([{ sql: "UPDATE deck_cards SET front = ?, back = ? WHERE id = ?", params: [front.trim(), back.trim(), id] }]);
}

export async function deleteDeckCard(db: Db, id: number): Promise<void> {
  await db.batch([
    { sql: "DELETE FROM deck_review_log WHERE card_id = ?", params: [id] },
    { sql: "DELETE FROM deck_cards WHERE id = ?", params: [id] },
  ]);
}

/**
 * Deck cards due now, most likely to be forgotten first: from one deck, or
 * (without `deckId`) from every deck that's in daily reviews.
 */
export async function dueDeckCards(db: Db, now: number, deckId?: number): Promise<DeckCard[]> {
  const rows =
    deckId === undefined
      ? await db.all<DeckCard>(
          "SELECT c.* FROM deck_cards c JOIN decks d ON d.id = c.deck_id WHERE d.in_daily = 1 AND c.due <= ?",
          [now],
        )
      : await db.all<DeckCard>("SELECT * FROM deck_cards WHERE deck_id = ? AND due <= ?", [deckId, now]);
  return reviewedFirst(rows, now);
}

/**
 * Cards you've reviewed before, most at risk first, then brand-new cards in
 * the order they were added. (FSRS rates every new card as "most at risk", so
 * plain risk order would put a fresh deck ahead of overdue reviews.)
 */
export function reviewedFirst<T extends FsrsFields & { id?: number }>(rows: T[], now: number): T[] {
  const fresh = rows.filter((r) => r.state === 0).sort((a, b) => a.due - b.due || (a.id ?? 0) - (b.id ?? 0));
  return [...byRisk(rows.filter((r) => r.state !== 0), now), ...fresh];
}

/** Most likely to be forgotten first, then oldest due. */
export function byRisk<T extends FsrsFields>(rows: T[], now: number): T[] {
  return rows
    .map((row) => ({ row, r: retrievability(row, now) }))
    .sort((a, b) => a.r - b.r || a.row.due - b.row.due)
    .map((x) => x.row);
}

/** Schedules the card's next review from your rating and logs it. */
export async function recordDeckReview(db: Db, id: number, rating: Grade, now: number): Promise<DeckCard> {
  const row = await getDeckCard(db, id);
  if (!row) throw new Error(`No deck card ${id}`);
  const card = schedule(row, rating, now);
  await db.batch([
    {
      sql: `UPDATE deck_cards SET state = ?, due = ?, stability = ?, difficulty = ?, scheduled_days = ?,
            learning_steps = ?, reps = ?, lapses = ?, last_review = ? WHERE id = ?`,
      params: [card.state, card.due, card.stability, card.difficulty, card.scheduled_days, card.learning_steps, card.reps, card.lapses, card.last_review, id],
    },
    {
      sql: "INSERT INTO deck_review_log (card_id, rating, state_before, due_before, reviewed_at) VALUES (?, ?, ?, ?, ?)",
      params: [id, rating, row.state, row.due, now],
    },
  ]);
  return card;
}

/** The front and back for a card made from a dictionary or path item (a copy; edit it freely). */
export function cardFromItem(item: ItemDetails): { front: string; back: string } {
  switch (item.kind) {
    case "kana":
      return { front: item.character, back: item.romaji };
    case "component":
      return { front: item.display, back: item.name };
    case "kanji": {
      const readings = [...item.onReadings, ...item.kunReadings].join("、");
      return { front: item.character, back: [item.meanings.join(", "), readings].filter(Boolean).join("\n") };
    }
    case "word": {
      const meaning = item.senses
        .slice(0, 2)
        .map((s) => s.glosses.slice(0, 3).join(", "))
        .join("; ");
      return { front: item.written, back: [item.reading !== item.written ? item.reading : "", meaning].filter(Boolean).join("\n") };
    }
  }
}

/** A deck card as a session question (src/srs/session.ts). */
export const deckQuestion = (id: number): DeckQuestion => ({ item_key: `deck:${id}`, card_type: "flip" });

/** The deck card id of a session question, or null for a path card. */
export const deckCardId = (q: { item_key: string; card_type: string }): number | null =>
  q.card_type === "flip" ? Number(q.item_key.slice("deck:".length)) : null;
