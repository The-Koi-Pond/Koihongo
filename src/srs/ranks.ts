// Item ranks, game style: B (passed) → A (learned) → S (mastered) → ★ (burned).
// A rank follows memory strength (FSRS stability: days until recall drops to
// 90%), taken from the item's weakest card, so forgetting quietly drops it
// again. ★ items still come up for review, just every couple of years.

import type { Db } from "../db/db.ts";
import { PASS_STABILITY_DAYS, review, type CardRow, type CardType } from "./scheduler.ts";

export type Rank = "B" | "A" | "S" | "★";

/** Highest first: the minimum stability (days) for each rank. */
const RANKS: { rank: Rank; days: number; name: string }[] = [
  { rank: "★", days: 730, name: "Burned" },
  { rank: "S", days: 180, name: "Mastered" },
  { rank: "A", days: 30, name: "Learned" },
  { rank: "B", days: PASS_STABILITY_DAYS, name: "Passed" },
];

export const RANK_ORDER: Rank[] = ["B", "A", "S", "★"];
export const RANK_NAME = Object.fromEntries(RANKS.map((r) => [r.rank, r.name])) as Record<Rank, string>;

/** The rank for an item's weakest stability; null while it's still being learned (or not started). */
export function rankFor(stability: number | null | undefined): Rank | null {
  if (stability == null) return null;
  return RANKS.find((r) => stability >= r.days)?.rank ?? null;
}

/** SQL for the same thing, for queries that list many items. */
export function rankSql(stability: string): string {
  return `CASE ${RANKS.map((r) => `WHEN ${stability} >= ${r.days} THEN '${r.rank}'`).join(" ")} END`;
}

const order = (r: Rank | null) => (r ? RANK_ORDER.indexOf(r) + 1 : 0);

export type RankUp = { from: Rank | null; to: Rank };

/**
 * The rank-up an answer would give, worked out with the same scheduler step
 * as saving it (but without saving). Null when the rank stays or drops:
 * drops happen quietly.
 */
export async function rankUpFor(db: Db, itemKey: string, cardType: CardType, correct: boolean, now: number): Promise<RankUp | null> {
  const cards = await db.all<CardRow>("SELECT * FROM srs_cards WHERE item_key = ?", [itemKey]);
  if (cards.length === 0) return null;
  const from = rankFor(Math.min(...cards.map((c) => c.stability)));
  const after = cards.map((c) => (c.card_type === cardType ? review(c, correct, now).card : c));
  const to = rankFor(Math.min(...after.map((c) => c.stability)));
  return to && order(to) > order(from) ? { from, to } : null;
}

/** How many items hold each rank. */
export async function rankTally(db: Db): Promise<Record<Rank, number>> {
  const rows = await db.all<{ rank: Rank; n: number }>(
    `SELECT ${rankSql("stability")} AS rank, count(*) AS n
     FROM (SELECT min(stability) AS stability FROM srs_cards GROUP BY item_key)
     GROUP BY rank`,
  );
  const tally = { B: 0, A: 0, S: 0, "★": 0 };
  for (const r of rows) if (r.rank) tally[r.rank] = r.n;
  return tally;
}
