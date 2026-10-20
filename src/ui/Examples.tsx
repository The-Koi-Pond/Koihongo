import { CircleCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { EXPLAIN_OPENER, explainSystemPrompt } from "../ai/prompts.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { sentenceWords, type SentenceWord, type WordDetails } from "../items.ts";
import { AiChat } from "./AiChat.tsx";
import { JapaneseText } from "./Popover.tsx";

type Sentence = WordDetails["sentences"][number];

/** A word's example sentences, each with an "Explain" button that opens an AI breakdown under it. */
export function Examples({ item }: { item: WordDetails }) {
  const [explaining, setExplaining] = useState<string>();
  return (
    <ul className="plain examples">
      {item.sentences.map((s) => (
        <li key={s.id}>
          <div className="example">
            <div>
              <JapaneseText text={s.japanese} highlight={s.form} />
              {s.newWords === 0 && (
                <span className="known-words" title="You've started every word in this sentence">
                  <CircleCheck size={14} strokeWidth={2} aria-hidden="true" /> all words known
                </span>
              )}
              <br />
              <span className="muted">{s.english}</span>
            </div>
            {explaining !== s.id && (
              <button type="button" className="explain-btn" onClick={() => setExplaining(s.id)} title="Break this sentence down with AI">
                <Sparkles size={14} strokeWidth={2} aria-hidden="true" /> Explain
              </button>
            )}
          </div>
          {explaining === s.id && <Explainer item={item} sentence={s} onClose={() => setExplaining(undefined)} />}
        </li>
      ))}
    </ul>
  );
}

function Explainer({ item, sentence, onClose }: { item: WordDetails; sentence: Sentence; onClose: () => void }) {
  // The prompt needs the sentence's dictionary words first.
  const [words, setWords] = useState<SentenceWord[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    sentenceWords(tauriDb, sentence.id)
      .then(setWords)
      .catch((e) => setError(String(e)));
  }, [sentence.id]);

  if (error) return <p className="error">{error}</p>;
  if (!words) return null;
  return (
    <AiChat
      title="Sentence breakdown"
      system={explainSystemPrompt(
        {
          japanese: sentence.japanese,
          english: sentence.english,
          word: { written: item.written, reading: item.reading, meaning: item.senses[0]?.glosses.slice(0, 3).join("; ") ?? "" },
        },
        words,
      )}
      opener={EXPLAIN_OPENER}
      placeholder="Ask about it, e.g. why は and not が?"
      footnote="AI explanations can be wrong, especially readings it wasn't given. Runs through your Claude Code login."
      onClose={onClose}
    />
  );
}
