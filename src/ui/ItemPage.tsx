import { useEffect, useState } from "react";
import { describeItem } from "../ai/prompts.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { useDekiPage } from "../deki/store.ts";
import type { ItemDetails } from "../items.ts";
import { itemProgress, STATUS_NAME, type ItemProgress } from "../library.ts";
import { ErrorView } from "../screens/Reviews.tsx";
import { RANK_NAME, rankFor } from "../srs/ranks.ts";
import { AddToDeck } from "./AddToDeck.tsx";
import { FastTrackButton } from "./FastTrack.tsx";
import { RankBadge } from "./RankBadge.tsx";
import { ItemView } from "./ItemView.tsx";
import { useItem } from "./useItem.ts";

/** A browsable item page (Library, Dictionary): the item, a back button, and your progress on it (top right). */
export function ItemPage({ itemKey, backLabel, onOpen, onBack }: { itemKey: string; backLabel: string; onOpen: (key: string) => void; onBack: () => void }) {
  const { item, error, reload } = useItem(itemKey);
  // null: the item exists but isn't on the learning path (most dictionary words).
  const [progress, setProgress] = useState<ItemProgress | null>();

  useEffect(() => {
    setProgress(undefined);
    itemProgress(tauriDb, itemKey)
      .then(setProgress)
      .catch(() => setProgress(null));
  }, [itemKey]);

  useDekiPage(
    item && {
      id: "item",
      label: `${item.kind[0].toUpperCase()}${item.kind.slice(1)} · ${itemName(item)}`,
      instructions: "They're looking at a study item's page (its meanings, readings, their mnemonics and notes). Help them understand and remember it.",
      parts: [
        { key: "item", name: "The item", text: describeItem(item) },
        { key: "notes", name: "Their notes", text: Object.entries(item.notes).map(([k, n]) => `${k.replace("_", " ")}: ${n?.text}`).join("\n") },
      ],
    },
  );

  if (error) return <ErrorView message={error} onExit={onBack} />;

  return (
    <div className="item-body">
      {item ? (
        <ItemView
          item={item}
          onChange={reload}
          bannerStart={
            <button className="banner-back" onClick={onBack}>
              ← {backLabel}
            </button>
          }
          bannerEnd={
            <>
              {progress ? <ProgressPanel itemKey={itemKey} progress={progress} onOpen={onOpen} /> : progress === null && <OffPath />}
              <AddToDeck item={item} />
            </>
          }
        />
      ) : (
        <p className="muted">Loading…</p>
      )}
    </div>
  );
}

/** What the item is called, for Deki's header. */
function itemName(item: ItemDetails): string {
  switch (item.kind) {
    case "kana":
    case "kanji":
      return item.character;
    case "component":
      return item.display;
    case "word":
      return item.written;
  }
}

function OffPath() {
  return (
    <div className="item-progress">
      <p>Not on your learning path</p>
      <p className="muted">Adding any dictionary word to your reviews is planned.</p>
    </div>
  );
}

/** Your progress on the item, in a small panel in the banner's top-right corner. */
function ProgressPanel({ itemKey, progress, onOpen }: { itemKey: string; progress: ItemProgress; onOpen: (key: string) => void }) {
  const missing = progress.requires.filter((r) => r.status !== "passed");
  const nextDue = Math.min(...progress.cards.map((c) => c.due));
  const rank = progress.cards.length ? rankFor(Math.min(...progress.cards.map((c) => c.stability))) : null;
  return (
    <div className="item-progress">
      <div className="item-progress-head">
        <p>
          {rank ? (
            <>
              <RankBadge rank={rank} /> <strong>{RANK_NAME[rank]}</strong>
            </>
          ) : (
            <>
              <span className={`swatch ${progress.status}`} /> <strong>{STATUS_NAME[progress.status]}</strong>
            </>
          )}
        </p>
        <FastTrackButton itemKey={itemKey} />
      </div>
      {progress.cards.length > 0 && (
        <p className="muted">
          Learned {new Date(Math.min(...progress.cards.map((c) => c.started_at))).toLocaleDateString()} · next review {describeDue(nextDue)}
        </p>
      )}
      {progress.status === "locked" && missing.length > 0 && (
        <p className="muted">
          Unlocks after:{" "}
          {missing.map((r) => (
            <button key={r.item_key} className={`chip-link ${r.kind}`} lang="ja" title={r.meaning} onClick={() => onOpen(r.item_key)}>
              {r.label}
            </button>
          ))}
        </p>
      )}
      {progress.status === "available" && <p className="muted">Comes up in lessons when you reach it on the path.</p>}
    </div>
  );
}

function describeDue(due: number): string {
  const hours = (due - Date.now()) / 3_600_000;
  if (hours <= 0) return "now";
  if (hours < 24) return `in ${Math.ceil(hours)} hour${Math.ceil(hours) === 1 ? "" : "s"}`;
  const days = Math.round(hours / 24);
  return days < 14 ? `in ${days} day${days === 1 ? "" : "s"}` : `on ${new Date(due).toLocaleDateString()}`;
}
