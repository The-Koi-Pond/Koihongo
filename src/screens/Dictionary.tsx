import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { toRomaji } from "wanakana";
import { tauriDb } from "../db/tauriDb.ts";
import { searchDictionary, type DictionaryHit, type DictionaryResults } from "../dictionary.ts";
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="English, romaji, kana or kanji"
          aria-label="Search the dictionary"
          autoFocus
        />
      </form>

      {!query.trim() ? (
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
                    <button className="dict-kanji-card" onClick={() => setSelected(k.item_key)} title={k.meanings.join(", ")}>
                      <span lang="ja" className="dict-kanji-glyph">
                        {k.label}
                      </span>
                      <span className="dict-kanji-meaning">{k.meanings[0]}</span>
                      <StatusMark status={k.status} />
                    </button>
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
