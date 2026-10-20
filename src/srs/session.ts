// One sitting of questions (reviews, or the quiz at the end of a lesson).
// Wrong answers come back a few questions later until answered right, but only
// the first attempt at each card counts for scheduling.

import type { CardType } from "./scheduler.ts";

export type Question = { item_key: string; card_type: CardType };

export type Session = {
  queue: Question[];
  /** First-attempt result per card ("item_key|card_type"). */
  firstTry: Record<string, boolean>;
};

/** A missed card comes back after this many other questions (or at the end). */
export const REQUEUE_GAP = 4;

export const questionId = (q: Question) => `${q.item_key}|${q.card_type}`;

export function startSession(questions: Question[]): Session {
  return { queue: [...questions], firstTry: {} };
}

export const currentQuestion = (s: Session): Question | undefined => s.queue[0];

/**
 * Applies the answer to the current question. `firstAttempt` tells the caller
 * whether to record this answer for scheduling.
 */
export function answerCurrent(s: Session, correct: boolean): { session: Session; firstAttempt: boolean } {
  const [q, ...rest] = s.queue;
  if (!q) throw new Error("No question to answer");
  const id = questionId(q);
  const firstAttempt = !(id in s.firstTry);
  const firstTry = firstAttempt ? { ...s.firstTry, [id]: correct } : s.firstTry;
  const queue = correct ? rest : [...rest.slice(0, REQUEUE_GAP), q, ...rest.slice(REQUEUE_GAP)];
  return { session: { queue, firstTry }, firstAttempt };
}

export function sessionStats(s: Session): { answered: number; correctFirstTry: number; remaining: number } {
  const results = Object.values(s.firstTry);
  return { answered: results.length, correctFirstTry: results.filter(Boolean).length, remaining: s.queue.length };
}

/**
 * Interleaves cards so a meaning and reading of the same item aren't asked
 * back to back (the first gives the second away). Keeps the order otherwise.
 */
export function spreadOutPairs(questions: Question[]): Question[] {
  const out: Question[] = [];
  const held: Question[] = [];
  for (const q of questions) {
    if (out.length && out[out.length - 1].item_key === q.item_key) held.push(q);
    else out.push(q);
    // Place a held card as soon as it wouldn't sit next to its partner.
    const i = held.findIndex((h) => out[out.length - 1].item_key !== h.item_key);
    if (i >= 0) out.push(...held.splice(i, 1));
  }
  return [...out, ...held];
}
