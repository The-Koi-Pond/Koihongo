// Review scheduling with FSRS (via ts-fsrs). Pure functions over srs_cards rows.

import { createEmptyCard, fsrs, Rating, type Card, type State } from "ts-fsrs";

export type CardType = "meaning" | "reading";

/** A row of user.db srs_cards. Times are unix milliseconds. */
export type CardRow = {
  item_key: string;
  card_type: CardType;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  last_review: number | null;
  started_at: number;
};

/**
 * An item counts as learned, unlocking whatever needs it, once every card of
 * it is expected to stay remembered this many days. In practice that's two
 * correct reviews about three days apart, similar to WaniKani's "Guru".
 */
export const PASS_STABILITY_DAYS = 3;

/** The first review comes this long after the lesson, so it tests memory, not what was just on screen. */
export const FIRST_REVIEW_DELAY_MS = 4 * 60 * 60 * 1000;

// Day-based intervals only (no 10-minute learning steps): built for one study
// session a day. Fuzz spreads out items learned together so they don't stay clumped.
const scheduler = fsrs({ request_retention: 0.9, enable_short_term: false, enable_fuzz: true });

function toCard(row: CardRow): Card {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: 0, // deprecated in ts-fsrs; it uses last_review instead
    scheduled_days: row.scheduled_days,
    learning_steps: row.learning_steps,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state as State,
    last_review: row.last_review === null ? undefined : new Date(row.last_review),
  };
}

export function newCard(itemKey: string, cardType: CardType, now: number): CardRow {
  const card = createEmptyCard(new Date(now));
  return {
    item_key: itemKey,
    card_type: cardType,
    state: card.state,
    due: now + FIRST_REVIEW_DELAY_MS,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    last_review: null,
    started_at: now,
  };
}

/** Typed answers are simply right or wrong, so we use two ratings: Good and Again. */
export function review(row: CardRow, correct: boolean, now: number): { card: CardRow; rating: Rating } {
  const rating = correct ? Rating.Good : Rating.Again;
  const { card } = scheduler.next(toCard(row), new Date(now), rating);
  return {
    rating,
    card: {
      ...row,
      state: card.state,
      due: card.due.getTime(),
      stability: card.stability,
      difficulty: card.difficulty,
      scheduled_days: card.scheduled_days,
      learning_steps: card.learning_steps,
      reps: card.reps,
      lapses: card.lapses,
      last_review: now,
    },
  };
}

/** Estimated chance (0–1) of remembering the card right now. */
export function retrievability(row: CardRow, now: number): number {
  return scheduler.get_retrievability(toCard(row), new Date(now), false);
}
