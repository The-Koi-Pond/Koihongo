import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { itemProgress, STATUS_NAME, type ItemProgress } from "../library.ts";
import { ErrorView } from "../screens/Reviews.tsx";
import { RANK_NAME, rankFor } from "../srs/ranks.ts";
import { FastTrackButton } from "./FastTrack.tsx";
import { RankBadge } from "./RankBadge.tsx";
import { ItemView } from "./ItemView.tsx";
import { useItem } from "./useItem.ts";

/** A browsable item page (Library, Dictionary): the item, a back button, and your progress on it. */
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
          below={progress ? <ProgressLine itemKey={itemKey} progress={progress} onOpen={onOpen} /> : progress === null && <OffPath />}
        />
      ) : (
        <p className="muted">Loading…</p>
      )}
    </div>
  );
}

function OffPath() {
  return (
    <div className="card progress-line">
      <p className="muted">Not on your learning path. (Adding any dictionary word to your reviews is planned.)</p>
    </div>
  );
}

function ProgressLine({ itemKey, progress, onOpen }: { itemKey: string; progress: ItemProgress; onOpen: (key: string) => void }) {
  const missing = progress.requires.filter((r) => r.status !== "passed");
  const nextDue = Math.min(...progress.cards.map((c) => c.due));
  const rank = progress.cards.length ? rankFor(Math.min(...progress.cards.map((c) => c.stability))) : null;
  return (
    <div className="card progress-line">
      <FastTrackButton itemKey={itemKey} />
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
        {progress.cards.length > 0 && (
          <span className="muted">
            {" "}
            · learned {new Date(Math.min(...progress.cards.map((c) => c.started_at))).toLocaleDateString()} · next review {describeDue(nextDue)}
          </span>
        )}
      </p>
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
