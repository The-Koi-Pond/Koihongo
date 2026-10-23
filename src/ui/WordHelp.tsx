import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { GRAMMAR_NOTES, POS_NAME, readingOf, wordsIn, type Coverage, type Word } from "../words.ts";
import { AddToDeck } from "./AddToDeck.tsx";

const STATUS_NAME: Partial<Record<Word["status"], string>> = { known: "Known", learning: "Learning", new: "New to you", name: "A name" };

/** What a grammar piece does, if we have a note for it. */
const note = (base: string) => GRAMMAR_NOTES[base];

/**
 * Word help under a box's Japanese (Reading, MarkEditor): its words as chips,
 * coloured by your progress; click one for its dictionary entry, what its
 * endings do, and Add to deck. `onReading` gets the text's kana reading once
 * it's split.
 */
export function WordHelp({
  text,
  picture,
  onReading,
}: {
  text: string;
  /** The panel the text is in, as a picture for cards. */
  picture?: () => Promise<string | undefined>;
  onReading: (reading: string, unsure: boolean) => void;
}) {
  const [words, setWords] = useState<Word[]>();
  const [open, setOpen] = useState<number>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    setOpen(undefined);
    if (!text.trim()) return setWords(undefined);
    let live = true;
    // Wait for typing to pause.
    const timer = window.setTimeout(() => {
      wordsIn(tauriDb, text.trim()).then(
        (w) => {
          if (!live) return;
          setWords(w);
          setProblem(undefined);
          const { reading, unsure } = readingOf(w);
          onReading(reading, unsure);
        },
        (e) => live && setProblem(String(e).replace(/^Error: /, "")),
      );
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
    // onReading changes every render; the text is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (problem) return <p className="muted word-help-note">Word help: {problem.replace("Text reading isn't set up yet", "Not set up yet")}</p>;
  if (!words?.length) return null;
  const word = open === undefined ? undefined : words[open];
  return (
    <div className="word-help">
      <div className="word-chips" lang="ja">
        {words.map((w, i) =>
          w.role === "symbol" ? (
            <span key={i} className="word-symbol">
              {w.surface}
            </span>
          ) : (
            <button
              key={i}
              type="button"
              className={`word-chip status-${w.status} ${open === i ? "on" : ""}`}
              onClick={() => setOpen(open === i ? undefined : i)}
              title={w.entry ? `${w.entry.written} (${w.entry.reading}): ${w.entry.senses[0]?.glosses.join("; ")}` : (note(w.base) ?? w.base)}
            >
              {w.surface}
            </button>
          ),
        )}
      </div>
      {word && <WordCard word={word} bubble={text.trim()} picture={picture} />}
    </div>
  );
}

/** A word's details: its entry, what its endings do, and Add to deck (with `bubble`, the line it's in, and the panel's picture if given). */
export function WordCard({ word, bubble, picture }: { word: Word; bubble: string; picture?: () => Promise<string | undefined> }) {
  const head = word.pieces[0];
  const entry = word.entry;
  // A noun + する (約束する): a verb, and its する is part of the word, not an ending.
  const suru = head.pos[1] === "サ変接続" && word.pieces[1]?.base === "する";
  const endings = word.pieces.slice(suru ? 2 : 1);
  const meanings = entry?.senses.map((s) => s.glosses.join("; ")) ?? [];
  const pos = suru ? POS_NAME["動詞"] : (POS_NAME[head.pos[0]] ?? head.pos[0]);
  return (
    <div className="word-card">
      <div className="word-card-head">
        <span lang="ja" className="word-card-written">
          {entry?.written ?? word.base}
        </span>
        {entry && entry.reading !== entry.written && (
          <span lang="ja" className="word-card-reading">
            {entry.reading}
          </span>
        )}
        <span className="muted small">{pos}</span>
        {STATUS_NAME[word.status] && <span className={`word-status status-${word.status}`}>{STATUS_NAME[word.status]}</span>}
      </div>
      {word.role === "grammar" ? (
        <p className="word-card-note">{note(word.base) ?? "A grammar word."}</p>
      ) : meanings.length > 0 ? (
        <ol className="word-card-meanings">
          {meanings.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ol>
      ) : (
        <p className="muted word-card-note">{word.role === "name" ? "A name: the reading is a guess." : "Not in the dictionary (slang, a name, or a misread?)."}</p>
      )}
      {endings.length > 0 && (
        <p className="word-card-endings">
          <span className="muted">Endings: </span>
          {endings.map((p, i) => (
            <span key={i}>
              {i > 0 && " · "}
              <span lang="ja">{p.surface}</span>
              {note(p.base) && <span className="muted"> ({p.base !== p.surface ? `${p.base}: ` : ""}{note(p.base)})</span>}
            </span>
          ))}
        </p>
      )}
      {entry && word.role !== "grammar" && (
        <div className="word-card-actions">
          <AddToDeck
            card={{
              id: `${entry.id}:${bubble}`,
              front: entry.written,
              back: [entry.reading !== entry.written ? entry.reading : "", meanings.slice(0, 2).join("; "), "", `「${bubble}」`].join("\n").trim(),
              itemKey: entry.itemKey,
              image: picture,
            }}
            label="Add to deck"
          />
        </div>
      )}
    </div>
  );
}

/** "This page: you know 8 of 14 words": a bar of known, learning and new. `note`: what was counted. */
export function ReadableBar({ label, c, note }: { label: string; c: Coverage; note: string }) {
  const total = c.known + c.learning + c.new;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="readable" title={`${c.known} known, ${c.learning} learning, ${c.new} new (${note})`}>
      <span className="readable-text">
        {label}: you know <strong>{c.known}</strong> of {total} words ({Math.round((c.known / total) * 100)}%)
      </span>
      <span className="readable-bar" aria-hidden="true">
        <span className="status-known" style={{ width: pct(c.known) }} />
        <span className="status-learning" style={{ width: pct(c.learning) }} />
      </span>
    </div>
  );
}
