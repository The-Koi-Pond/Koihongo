// Fast track: items you say you basically already know. While an item is on
// fast track, right answers count as "Easy", so it passes on its first review
// and needs about a third fewer reviews; one wrong answer takes it off again.

import type { Db, Statement } from "../db/db.ts";

export async function isFastTracked(db: Db, itemKey: string): Promise<boolean> {
  const rows = await db.all<{ n: number }>("SELECT count(*) AS n FROM fast_track WHERE item_key = ?", [itemKey]);
  return rows[0].n > 0;
}

/** The statements that put many items on fast track (already-flagged ones stay as they are). */
export function fastTrackStatements(itemKeys: string[], now: number): Statement[] {
  return itemKeys.map((key) => ({ sql: "INSERT OR IGNORE INTO fast_track (item_key, since) VALUES (?, ?)", params: [key, now] }));
}

/** Puts many items on fast track at once. */
export async function setFastTrackMany(db: Db, itemKeys: string[], now: number): Promise<void> {
  await db.batch(fastTrackStatements(itemKeys, now));
}

export async function setFastTrack(db: Db, itemKey: string, on: boolean, now: number): Promise<void> {
  await db.batch([
    on
      ? { sql: "INSERT OR IGNORE INTO fast_track (item_key, since) VALUES (?, ?)", params: [itemKey, now] }
      : { sql: "DELETE FROM fast_track WHERE item_key = ?", params: [itemKey] },
  ]);
}
