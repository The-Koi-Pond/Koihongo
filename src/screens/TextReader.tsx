import { ArrowLeft, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { EXPLAIN_BOX_OPENER, explainBoxPrompt } from "../ai/prompts.ts";
import { useAiSettings } from "../ai/settings.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { AiChat } from "../ui/AiChat.tsx";
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
 * it); each line can be explained by the AI helper. The text is remembered
 * on this PC.
 */
export function TextReader({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState(loadDraft);
  const [lines, setLines] = useState<Line[]>();
  const [problem, setProblem] = useState<string>();
  const [open, setOpen] = useState<{ line: number; word: number }>();
  const [explaining, setExplaining] = useState<number>();
  const [readings, setReadings] = useState(false);
  const ai = useAiSettings(tauriDb);
  const aiOn = !!ai && ai.provider !== "off";

  useEffect(() => {
    saveDraft(text);
    setOpen(undefined);
    setExplaining(undefined);
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
                  {aiOn && explaining !== li && (
                    <button type="button" className="explain-btn" onClick={() => setExplaining(li)} title="Break this line down with AI">
                      <Sparkles size={14} aria-hidden="true" /> Explain
                    </button>
                  )}
                </div>
                {readings && (
                  <p className="text-line-reading" lang="ja">
                    {readingOf(line.words).reading}
                  </p>
                )}
                {open?.line === li && <WordCard word={line.words[open.word]} bubble={line.text} />}
                {explaining === li && (
                  <AiChat
                    title={`Line: ${line.text}`}
                    system={explainBoxPrompt(
                      { kind: "Text", text: line.text, unsure: false },
                      lines.flatMap((l, i) => (i !== li && Math.abs(i - li) <= 4 ? [`Line ${i + 1}: ${l.text}`] : [])),
                      "",
                      "a text they pasted in",
                    )}
                    opener={EXPLAIN_BOX_OPENER}
                    placeholder="Ask about it"
                    footnote="Sent: this line and the lines around it. AI explanations can be wrong."
                    onClose={() => setExplaining(undefined)}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
