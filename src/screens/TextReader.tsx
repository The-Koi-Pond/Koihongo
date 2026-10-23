import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { explainBoxRequest } from "../ai/prompts.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { askDeki, useDekiPage } from "../deki/store.ts";
import { ReadableBar, WordCard } from "../ui/WordHelp.tsx";
import { coverage, readingOf, wordsIn, type Word } from "../words.ts";

const DRAFT_KEY = "koihongo.pasteText";

function loadDraft(): string {
  try {
    return localStorage.getItem(DRAFT_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveDraft(text: string) {
  try {
    localStorage.setItem(DRAFT_KEY, text);
  } catch {
    // Not remembered this time; harmless.
  }
}

/** The text's lines (blank ones dropped), each split into words; undefined while splitting. */
type Line = { text: string; words: Word[] };

/**
 * Reading → Paste text: any Japanese (a visual novel's lines, a message, an
 * article) shown as words coloured by your progress. Hover a word for its
 * meaning, click it for the full entry and Add to deck (the line comes with
 * it); Deki-senpai can explain each line (and knows the text). The text is remembered
 * on this PC.
 */
export function TextReader({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState(loadDraft);
  const [lines, setLines] = useState<Line[]>();
  const [problem, setProblem] = useState<string>();
  const [open, setOpen] = useState<{ line: number; word: number }>();
  const [readings, setReadings] = useState(false);
  useDekiPage({
    id: "paste-text",
    label: "Reading · Paste text",
    instructions: "They pasted some Japanese (a visual novel's lines, a message, an article…) to read it word by word. Help them understand it.",
    // A long paste is cut, so it doesn't crowd out the chat.
    parts: [{ key: "text", name: "The pasted text", text: text.trim().slice(0, 4000) }],
  });

  useEffect(() => {
    saveDraft(text);
    setOpen(undefined);
    let live = true;
    const timer = window.setTimeout(async () => {
      try {
        const parts = text.split("\n").map((l) => l.trim()).filter(Boolean);
        const out: Line[] = [];
        for (const t of parts) out.push({ text: t, words: await wordsIn(tauriDb, t) });
        if (live) {
          setLines(out);
          setProblem(undefined);
        }
      } catch (e) {
        if (live) setProblem(String(e).replace(/^Error: /, "").replace("Text reading isn't set up yet", "Word help isn't set up yet"));
      }
    }, 400);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [text]);

  const all = lines?.flatMap((l) => l.words) ?? [];
  return (
    <div className="text-reader">
      <button type="button" className="deck-back" onClick={onBack}>
        <ArrowLeft size={16} aria-hidden="true" /> Bookshelf
      </button>
      <h1>
        <span lang="ja">文章</span> Paste text
      </h1>
      <p className="muted">
        Paste any Japanese (lines from a visual novel, a message, an article). Words are coloured by your progress: hover one for its meaning,
        click it for more and to add it to a deck.
      </p>
      <textarea
        lang="ja"
        className="text-reader-input"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste Japanese here (Ctrl+V)"
        aria-label="Japanese text"
      />
      {problem && <p className="muted">{problem}</p>}
      {lines && lines.length > 0 && (
        <>
          <div className="text-reader-bar">
            <ReadableBar label="This text" c={coverage(all)} note="names and grammar not counted" />
            <label className="text-reader-toggle">
              <input type="checkbox" checked={readings} onChange={(e) => setReadings(e.target.checked)} /> Show readings
            </label>
          </div>
          <ol className="text-lines">
            {lines.map((line, li) => (
              <li key={li} className="text-line">
                <div className="text-line-row">
                  <div className="word-chips" lang="ja">
                    {line.words.map((w, wi) =>
                      w.role === "symbol" ? (
                        <span key={wi} className="word-symbol">
                          {w.surface}
                        </span>
                      ) : (
                        <button
                          key={wi}
                          type="button"
                          className={`word-chip status-${w.status} ${open?.line === li && open.word === wi ? "on" : ""}`}
                          onClick={() => setOpen(open?.line === li && open.word === wi ? undefined : { line: li, word: wi })}
                          title={w.entry ? `${w.entry.written} (${w.entry.reading}): ${w.entry.senses[0]?.glosses.join("; ")}` : w.base}
                        >
                          {w.surface}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    className="explain-btn"
                    onClick={() => askDeki(explainBoxRequest({ kind: "Text", text: line.text, unsure: false }))}
                    title="Ask Deki-senpai to break this line down"
                  >
                    <Sparkles size={14} aria-hidden="true" /> Explain
                  </button>
                </div>
                {readings && (
                  <p className="text-line-reading" lang="ja">
                    {readingOf(line.words).reading}
                  </p>
                )}
                {open?.line === li && <WordCard word={line.words[open.word]} bubble={line.text} />}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
