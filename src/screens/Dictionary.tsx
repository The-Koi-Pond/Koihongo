import { Search, Shapes, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toRomaji } from "wanakana";
import { tauriDb } from "../db/tauriDb.ts";
import { kanjiByParts, listParts, searchDictionary, type DictionaryHit, type DictionaryResults, type Part, type PartsResult } from "../dictionary.ts";
import { STATUS_NAME } from "../library.ts";
import { Gloss } from "../ui/Gloss.tsx";
import { ItemPage } from "../ui/ItemPage.tsx";
import { OpenItemContext } from "../ui/Popover.tsx";

const EXAMPLES = ["cat", "taberu", "みず", "日本"];
/** Senses shown per word in the list; the item page has them all. */
const SENSES_SHOWN = 3;
/** Wait this long after the last keystroke before searching. */
const DEBOUNCE_MS = 120;

/** Look up any word or kanji, on your path or not. */
export function Dictionary() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DictionaryResults>();
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string>();
  // "Find by parts": whether it's open, and the chosen components (kept while you look at a result).
  const [byParts, setByParts] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults(undefined);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchDictionary(tauriDb, query)
        .then((r) => !cancelled && setResults(r))
        .catch((e) => !cancelled && setError(String(e)));
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (error) return <p className="error">Couldn't search the dictionary: {error}</p>;
  if (selected) {
    return (
      <OpenItemContext.Provider value={setSelected}>
        <ItemPage itemKey={selected} backLabel="Dictionary" onOpen={setSelected} onBack={() => setSelected(undefined)} />
      </OpenItemContext.Provider>
    );
  }

  const first = results?.words[0] ?? results?.kanji[0];
  return (
    <div className="dictionary">
      <h1>
        <span lang="ja">辞書</span> Dictionary
      </h1>

      <form
        className="dict-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (first) setSelected(first.item_key);
        }}
      >
        <Search size={20} strokeWidth={2} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setByParts(false);
          }}
          placeholder="English, romaji, kana or kanji"
          aria-label="Search the dictionary"
          autoFocus
        />
        <button
          type="button"
          className={`dict-parts-toggle ${byParts ? "on" : ""}`}
          aria-pressed={byParts}
          title="Find a kanji you can't type by the parts (radicals) it's made of"
          onClick={() => setByParts(!byParts)}
        >
          <Shapes size={16} strokeWidth={2} aria-hidden="true" /> Find by parts
        </button>
      </form>

      {byParts ? (
        <PartsFinder chosen={chosen} setChosen={setChosen} onOpen={setSelected} />
      ) : !query.trim() ? (
        <p className="muted dict-hint">
          Try{" "}
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="dict-example" lang={/[a-z]/.test(ex) ? undefined : "ja"} onClick={() => setQuery(ex)}>
              {ex}
            </button>
          ))}{" "}
          · Enter opens the top result
        </p>
      ) : !results ? null : results.words.length + results.kanji.length === 0 ? (
        <p className="muted">Nothing found for “{query.trim()}”.</p>
      ) : (
        <>
          {results.kanji.length > 0 && (
            <section>
              <h3>Kanji</h3>
              <ul className="dict-kanji">
                {results.kanji.map((k) => (
                  <li key={k.item_key}>
                    <KanjiTile hit={k} onOpen={() => setSelected(k.item_key)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {results.words.length > 0 && (
            <section>
              <h3>Words</h3>
              <ul className="dict-words">
                {results.words.map((w) => (
                  <li key={w.item_key}>
                    <WordRow hit={w} onOpen={() => setSelected(w.item_key)} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Find a kanji by its parts: pick components (grouped by stroke count, like a
 * paper dictionary's radical chart) and see every kanji that contains them all.
 * Parts that can't narrow the results any further are dimmed. The chart has a
 * fixed height, so picking parts never moves it.
 */
function PartsFinder({ chosen, setChosen, onOpen }: { chosen: string[]; setChosen: (parts: string[]) => void; onOpen: (key: string) => void }) {
  const [parts, setParts] = useState<Part[]>();
  const [result, setResult] = useState<PartsResult>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    listParts(tauriDb).then(setParts).catch((e) => setError(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    kanjiByParts(tauriDb, chosen)
      .then((r) => !cancelled && setResult(r))
      .catch((e) => !cancelled && setError(String(e)));
    return () => {
      cancelled = true;
    };
  }, [chosen]);

  if (error) return <p className="error">Couldn't load the parts: {error}</p>;
  if (!parts) return <p className="muted">Loading…</p>;

  const byGlyph = new Map(parts.map((p) => [p.glyph, p]));
  const usable = new Set(result?.usable);
  const toggle = (glyph: string) => setChosen(chosen.includes(glyph) ? chosen.filter((g) => g !== glyph) : [...chosen, glyph]);

  return (
    <>
      <div className="parts-chosen" aria-live="polite">
        {chosen.length === 0 ? (
          <span className="muted">Pick the parts you can see in the kanji. Hover a part for its name.</span>
        ) : (
          <>
            {chosen.map((g) => (
              <button key={g} type="button" className="parts-chip" onClick={() => toggle(g)} title={`Remove ${byGlyph.get(g)?.name}`}>
                <span lang="ja">{byGlyph.get(g)?.display}</span> {byGlyph.get(g)?.name} <X size={13} strokeWidth={2.5} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className="link" onClick={() => setChosen([])}>
              Clear
            </button>
          </>
        )}
      </div>

      <div className="parts-chart" role="group" aria-label="Kanji parts, by stroke count">
        {parts.map((p, i) => {
          const isChosen = chosen.includes(p.glyph);
          const dead = chosen.length > 0 && !isChosen && !usable.has(p.glyph);
          return (
            <span key={p.glyph} className="parts-cell">
              {(i === 0 || parts[i - 1].strokes !== p.strokes) && (
                <span className="parts-strokes num" title={`${p.strokes} stroke${p.strokes === 1 ? "" : "s"}`}>
                  {p.strokes}
                </span>
              )}
              <button
                type="button"
                className={`parts-btn ${isChosen ? "on" : ""}`}
                lang="ja"
                aria-pressed={isChosen}
                aria-label={p.name}
                title={p.name}
                disabled={dead}
                onClick={() => toggle(p.glyph)}
              >
                {p.display}
              </button>
            </span>
          );
        })}
      </div>

      {chosen.length > 0 && result && (
        <section>
          <h3>
            {result.total === 1 ? "1 kanji" : `${result.total} kanji`}
            {result.total > result.kanji.length && ` · showing the first ${result.kanji.length}: add a part to narrow it down`}
          </h3>
          <ul className="dict-kanji">
            {result.kanji.map((k) => (
              <li key={k.item_key}>
                <KanjiTile hit={k} onOpen={() => onOpen(k.item_key)} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function KanjiTile({ hit, onOpen }: { hit: DictionaryHit; onOpen: () => void }) {
  return (
    <button className="dict-kanji-card" onClick={onOpen} title={hit.meanings.join(", ")}>
      <span lang="ja" className="dict-kanji-glyph">
        {hit.label}
      </span>
      <span className="dict-kanji-meaning">{hit.meanings[0]}</span>
      <StatusMark status={hit.status} />
    </button>
  );
}

function WordRow({ hit, onOpen }: { hit: DictionaryHit; onOpen: () => void }) {
  const reading = hit.readings[0];
  return (
    <button className="dict-word" onClick={onOpen}>
      <span className="dict-word-head">
        <span lang="ja" className="dict-word-written">
          {hit.label}
        </span>
        <span className="dict-word-sub">
          {/* The kana reading only when the word isn't already written in kana. */}
          {reading !== hit.label && (
            <span lang="ja" className="dict-word-reading">
              {reading}
            </span>
          )}
          <span className="dict-word-romaji">{toRomaji(reading)}</span>
        </span>
      </span>
      <ol className="dict-senses">
        {hit.meanings.slice(0, SENSES_SHOWN).map((m, i) => (
          <li key={i}>
            <Gloss text={m} />
          </li>
        ))}
        {hit.meanings.length > SENSES_SHOWN && <li className="dict-more">+{hit.meanings.length - SENSES_SHOWN} more</li>}
      </ol>
      <StatusMark status={hit.status} />
    </button>
  );
}

/** Your progress on a result, as a small swatch + label; nothing for items off the path. */
function StatusMark({ status }: { status: DictionaryHit["status"] }) {
  if (!status) return null;
  return (
    <span className="dict-status">
      <span className={`swatch ${status}`} /> {STATUS_NAME[status]}
    </span>
  );
}
