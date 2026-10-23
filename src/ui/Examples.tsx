import { CircleCheck, Sparkles } from "lucide-react";
import { useState } from "react";
import { explainSentenceRequest } from "../ai/prompts.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { askDeki } from "../deki/store.ts";
import { sentenceWords, type WordDetails } from "../items.ts";
import { useAiSettings } from "../ai/settings.ts";
import { JapaneseText } from "./Popover.tsx";

type Sentence = WordDetails["sentences"][number];

/** A word's example sentences, each with an "Explain" button that asks Deki-senpai for a breakdown. */
export function Examples({ item }: { item: WordDetails }) {
  const [error, setError] = useState<string>();
  const ai = useAiSettings(tauriDb);
  const aiOn = !!ai && ai.provider !== "off";
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
            {aiOn && (
              <button type="button" className="explain-btn" onClick={() => explain(item, s).catch((e) => setError(String(e)))} title="Ask Deki-senpai to break this sentence down">
                <Sparkles size={14} strokeWidth={2} aria-hidden="true" /> Explain
              </button>
            )}
          </div>
        </li>
      ))}
      {error && <li className="error">{error}</li>}
    </ul>
  );
}

/** The sentence's dictionary words first (Deki gets their readings), then Deki explains. */
async function explain(item: WordDetails, sentence: Sentence) {
  const words = await sentenceWords(tauriDb, sentence.id);
  await askDeki(
    explainSentenceRequest(
      {
        japanese: sentence.japanese,
        english: sentence.english,
        word: { written: item.written, reading: item.reading, meaning: item.senses[0]?.glosses.slice(0, 3).join("; ") ?? "" },
      },
      words,
    ),
  );
}
