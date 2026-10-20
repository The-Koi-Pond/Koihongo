// The library: every path item with its learning status.

import type { Db } from "./db/db.ts";
import type { ItemKind } from "./srs/progress.ts";
import { PASS_STABILITY_DAYS, type CardType } from "./srs/scheduler.ts";

/** locked: needs other items first · available: ready for a lesson · learning: started, not passed · passed */
export type ItemStatus = "locked" | "available" | "learning" | "passed";

export type LibraryItem = {
  item_key: string;
  kind: ItemKind;
  position: number;
  label: string;
  meaning: string;
  /** Kana reading, for words only. */
  reading: string | null;
  status: ItemStatus;
  /** Lowercase text to search: label, meanings, readings. */
  search: string;
};

/** All path items (or just `keys`) in path order, with status. */
export async function libraryItems(db: Db, keys?: string[]): Promise<LibraryItem[]> {
  const filter = keys ? `WHERE p.item_key IN (${keys.map(() => "?").join(", ")})` : "";
  return db.all<LibraryItem>(
    `WITH cards AS (SELECT item_key, min(stability) AS stability FROM srs_cards GROUP BY item_key),
          passed AS (SELECT item_key FROM cards WHERE stability >= ?)
     SELECT p.item_key, p.kind, p.position,
       coalesce(c.display, k.character, w.written) AS label,
       coalesce(c.name, json_extract(k.meanings, '$[0]'), json_extract(w.senses, '$[0].glosses[0]')) AS meaning,
       w.reading AS reading,
       CASE
         WHEN cards.item_key IS NOT NULL THEN CASE WHEN cards.stability >= ? THEN 'passed' ELSE 'learning' END
         WHEN EXISTS (SELECT 1 FROM content.path_requirements r
                      WHERE r.item_key = p.item_key AND r.requires_key NOT IN (SELECT item_key FROM passed)) THEN 'locked'
         ELSE 'available'
       END AS status,
       lower(coalesce(c.display || ' ' || c.name,
                      k.character || ' ' || k.meanings || ' ' || k.on_readings || ' ' || k.kun_readings,
                      w.written || ' ' || w.reading || ' ' ||
                        (SELECT group_concat(g.value, ' ') FROM json_each(w.senses) s, json_each(s.value, '$.glosses') g))) AS search
     FROM content.path p
     LEFT JOIN cards ON cards.item_key = p.item_key
     LEFT JOIN content.components c ON p.kind = 'component' AND c.glyph = substr(p.item_key, 11)
     LEFT JOIN content.kanji k ON p.kind = 'kanji' AND k.character = substr(p.item_key, 7)
     LEFT JOIN content.words w ON p.kind = 'word' AND w.id = substr(p.item_key, 6)
     ${filter}
     ORDER BY p.position`,
    [PASS_STABILITY_DAYS, PASS_STABILITY_DAYS, ...(keys ?? [])],
  );
}

export type ItemProgress = {
  status: ItemStatus;
  cards: { card_type: CardType; due: number; stability: number; reps: number; lapses: number; started_at: number }[];
  /** Items this one needs, with their status. */
  requires: LibraryItem[];
};

export async function itemProgress(db: Db, itemKey: string): Promise<ItemProgress> {
  const [self] = await libraryItems(db, [itemKey]);
  if (!self) throw new Error(`${itemKey} isn't on the path`);
  const cards = await db.all<ItemProgress["cards"][number]>(
    "SELECT card_type, due, stability, reps, lapses, started_at FROM srs_cards WHERE item_key = ? ORDER BY card_type",
    [itemKey],
  );
  const reqKeys = await db.all<{ requires_key: string }>("SELECT requires_key FROM content.path_requirements WHERE item_key = ?", [itemKey]);
  const requires = reqKeys.length ? await libraryItems(db, reqKeys.map((r) => r.requires_key)) : [];
  return { status: self.status, cards, requires };
}
