import { FastForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isRomaji, toHiragana } from "wanakana";
import { tauriDb } from "../db/tauriDb.ts";
import { libraryItems, STATUS_NAME, type ItemStatus, type LibraryItem } from "../library.ts";
import type { ItemKind } from "../srs/progress.ts";
import { ItemPage } from "../ui/ItemPage.tsx";
import { RankBadge } from "../ui/RankBadge.tsx";
import { ItemHover, OpenItemContext } from "../ui/Popover.tsx";

const PAGE = 300;
const KIND_NAME: Record<ItemKind, string> = { kana: "kana", component: "component", kanji: "kanji", word: "word" };
const KIND_TABS: { kind: ItemKind | "all"; name: string }[] = [
  { kind: "all", name: "All" },
  { kind: "kana", name: "Kana" },
  { kind: "component", name: "Components" },
  { kind: "kanji", name: "Kanji" },
  { kind: "word", name: "Words" },
];

/** Every item on the path, browsable outside lessons. */
export function Library() {
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

  if (error) return <p className="error">Couldn't load the library: {error}</p>;
  if (selected) {
    const back = () => {
      setSelected(undefined);
      setVersion((v) => v + 1); // statuses may have changed meanwhile
    };
    return (
      <OpenItemContext.Provider value={setSelected}>
        <ItemPage itemKey={selected} backLabel="Library" onOpen={setSelected} onBack={back} />
      </OpenItemContext.Provider>
    );
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
      <h1>
        <span lang="ja">図書館</span> Library
      </h1>

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
              <li key={i.item_key} style={{ gridColumn: `span ${tileSpan(i)}` }}>
                <ItemHover itemKey={i.item_key} openOnClick={false}>
                  <button className={`tile ${i.kind} ${i.status}`} onClick={() => setSelected(i.item_key)}>
                    <span className="tile-kind">{KIND_NAME[i.kind]}</span>
                    {i.fast === 1 && (
                      <span className="tile-fast" title="On fast track">
                        <FastForward size={11} strokeWidth={2.5} aria-label="On fast track" />
                      </span>
                    )}
                    {i.rank && (
                      <span className="tile-rank">
                        <RankBadge rank={i.rank} />
                      </span>
                    )}
                    <span className={`tile-glyph ${[...i.label].length > 1 ? "multi" : ""}`} lang="ja">
                      {i.label}
                    </span>
                  </button>
                </ItemHover>
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

/** Grid columns a tile takes: words get about two characters per column, so they never need "…". */
function tileSpan(item: LibraryItem): number {
  return item.kind === "word" ? Math.min(4, Math.max(1, Math.ceil([...item.label].length / 2))) : 1;
}
