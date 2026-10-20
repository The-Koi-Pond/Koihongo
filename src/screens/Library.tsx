import { useEffect, useMemo, useState } from "react";
import { isRomaji, toHiragana } from "wanakana";
import { tauriDb } from "../db/tauriDb.ts";
import { itemProgress, libraryItems, type ItemProgress, type ItemStatus, type LibraryItem } from "../library.ts";
import type { ItemKind } from "../srs/progress.ts";
import { ItemInfo } from "../ui/ItemInfo.tsx";
import { itemLabel, useItem } from "../ui/useItem.ts";
import { ErrorView } from "./Reviews.tsx";

const PAGE = 300;
const STATUS_NAME: Record<ItemStatus, string> = { locked: "Locked", available: "Ready to learn", learning: "Learning", passed: "Passed" };
const KIND_TABS: { kind: ItemKind | "all"; name: string }[] = [
  { kind: "all", name: "All" },
  { kind: "component", name: "Components" },
  { kind: "kanji", name: "Kanji" },
  { kind: "word", name: "Words" },
];

/** Every item on the path, browsable outside lessons. */
export function Library({ onExit }: { onExit: () => void }) {
  const [items, setItems] = useState<LibraryItem[]>();
  const [error, setError] = useState<string>();
  const [kind, setKind] = useState<ItemKind | "all">("all");
  const [statuses, setStatuses] = useState<Set<ItemStatus>>(new Set());
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [selected, setSelected] = useState<string>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    libraryItems(tauriDb)
      // Katakana → hiragana so "にち" and "nichi" both find ニチ.
      .then((list) => setItems(list.map((i) => ({ ...i, search: toHiragana(i.search, { passRomaji: true }) }))))
      .catch((e) => setError(String(e)));
  }, [version]);

  const matches = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const kana = q && isRomaji(q) ? toHiragana(q) : toHiragana(q, { passRomaji: true });
    return items.filter(
      (i) =>
        (kind === "all" || i.kind === kind) &&
        (statuses.size === 0 || statuses.has(i.status)) &&
        (!q || i.search.includes(q) || i.search.includes(kana)),
    );
  }, [items, kind, statuses, query]);

  const counts = useMemo(() => {
    const c: Record<ItemStatus, number> = { locked: 0, available: 0, learning: 0, passed: 0 };
    for (const i of items ?? []) if (kind === "all" || i.kind === kind) c[i.status]++;
    return c;
  }, [items, kind]);

  if (error) return <ErrorView message={error} onExit={onExit} />;
  if (selected) {
    const back = () => {
      setSelected(undefined);
      setVersion((v) => v + 1); // statuses may have changed meanwhile
    };
    return <ItemPage itemKey={selected} onOpen={setSelected} onBack={back} />;
  }

  const toggleStatus = (s: ItemStatus) =>
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <>
      <div className="row space-between">
        <h1>
          <span lang="ja">図書館</span> Library
        </h1>
        <button onClick={onExit}>Back to Today</button>
      </div>

      <div className="library-controls">
        <div className="tabs" role="tablist">
          {KIND_TABS.map((t) => (
            <button key={t.kind} role="tab" aria-selected={kind === t.kind} className={kind === t.kind ? "tab current" : "tab"} onClick={() => setKind(t.kind)}>
              {t.name}
            </button>
          ))}
        </div>
        <input
          className="grow"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShown(PAGE);
          }}
          placeholder="Search: 木, tree, moku, もく…"
        />
        <div className="status-filters">
          {(Object.keys(STATUS_NAME) as ItemStatus[]).map((s) => (
            <button key={s} className={`status-chip ${s} ${statuses.has(s) ? "on" : ""}`} aria-pressed={statuses.has(s)} onClick={() => toggleStatus(s)}>
              <span className={`swatch ${s}`} /> {STATUS_NAME[s]} {counts[s]}
            </button>
          ))}
        </div>
      </div>

      {!items ? (
        <p className="muted">Loading…</p>
      ) : matches.length === 0 ? (
        <p className="muted">Nothing matches.</p>
      ) : (
        <>
          <ul className="tiles">
            {matches.slice(0, shown).map((i) => (
              <li key={i.item_key}>
                <button className={`tile ${i.kind} ${i.status}`} title={`${i.meaning} · ${STATUS_NAME[i.status]}`} onClick={() => setSelected(i.item_key)}>
                  <span className="tile-glyph" lang="ja">
                    {i.label}
                  </span>
                  <span className="tile-meaning">{i.meaning}</span>
                </button>
              </li>
            ))}
          </ul>
          {matches.length > shown && (
            <button className="show-more" onClick={() => setShown((n) => n + PAGE)}>
              Show more ({matches.length - shown} left)
            </button>
          )}
        </>
      )}
    </>
  );
}

function ItemPage({ itemKey, onOpen, onBack }: { itemKey: string; onOpen: (key: string) => void; onBack: () => void }) {
  const { item, error, reload } = useItem(itemKey);
  const [progress, setProgress] = useState<ItemProgress>();

  useEffect(() => {
    setProgress(undefined);
    itemProgress(tauriDb, itemKey).then(setProgress);
  }, [itemKey]);

  if (error) return <ErrorView message={error} onExit={onBack} />;

  return (
    <div className="lesson">
      <div className="row">
        <button onClick={onBack}>← Library</button>
      </div>
      {item && (
        <div className={`glyph ${item.kind} ${progress?.status === "locked" ? "is-locked" : ""}`} lang="ja">
          {itemLabel(item)}
        </div>
      )}
      {progress && <ProgressLine progress={progress} onOpen={onOpen} />}
      {item ? <ItemInfo item={item} onChange={reload} /> : <p className="muted">Loading…</p>}
    </div>
  );
}

function ProgressLine({ progress, onOpen }: { progress: ItemProgress; onOpen: (key: string) => void }) {
  const missing = progress.requires.filter((r) => r.status !== "passed");
  const nextDue = Math.min(...progress.cards.map((c) => c.due));
  return (
    <div className="card progress-line">
      <p>
        <span className={`swatch ${progress.status}`} /> <strong>{STATUS_NAME[progress.status]}</strong>
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
