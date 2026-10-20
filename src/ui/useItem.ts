import { useCallback, useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { getItemDetails, type ItemDetails } from "../items.ts";

/** Loads an item's details; `reload` refetches after edits (notes, synonyms). */
export function useItem(itemKey: string | undefined): { item?: ItemDetails; error?: string; reload: () => void } {
  const [item, setItem] = useState<ItemDetails>();
  const [error, setError] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!itemKey) return;
    let cancelled = false;
    getItemDetails(tauriDb, itemKey)
      .then((d) => !cancelled && setItem(d))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [itemKey, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  // Don't show a previous item's details while the next one loads.
  return { item: item?.item_key === itemKey ? item : undefined, error, reload };
}

export function itemLabel(item: ItemDetails): string {
  switch (item.kind) {
    case "component":
      return item.display;
    case "kanji":
      return item.character;
    case "word":
      return item.written;
  }
}
