import { useState } from "react";
import { toKana } from "wanakana";
import { tauriDb } from "../db/tauriDb.ts";
import { acceptedAnswers, addSynonym, type ItemDetails } from "../items.ts";
import { checkMeaning, checkReading, type Verdict } from "../srs/answers.ts";
import type { CardType } from "../srs/scheduler.ts";
import { ItemInfo } from "./ItemInfo.tsx";
import { itemLabel } from "./useItem.ts";

const PROMPT = {
  component: { meaning: "Component name" },
  kanji: { meaning: "Kanji meaning", reading: "Kanji reading" },
  word: { meaning: "Word meaning", reading: "Word reading" },
} as const;

/**
 * Asks one question. Enter checks the answer, Enter again moves on; the result
 * is reported on moving on, so "I was right" can still change it.
 */
export function QuestionCard({
  item,
  cardType,
  onReload,
  onDone,
}: {
  item: ItemDetails;
  cardType: CardType;
  onReload: () => void;
  onDone: (correct: boolean, answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<Verdict>();
  const [showInfo, setShowInfo] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const accepted = acceptedAnswers(item);
  const prompt = cardType === "reading" && item.kind !== "component" ? PROMPT[item.kind].reading : PROMPT[item.kind].meaning;
  const graded = verdict && verdict.result !== "retry";
  const correct = overridden || verdict?.result === "correct";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (graded) return onDone(correct, answer);
    const v = cardType === "meaning" ? checkMeaning(answer, accepted.meanings, accepted.readings) : checkReading(answer, accepted.readings);
    setVerdict(v);
    if (v.result === "wrong") setShowInfo(true);
  }

  async function acceptMine() {
    await addSynonym(tauriDb, item.item_key, answer, Date.now());
    setOverridden(true);
    onReload();
  }

  const expected = cardType === "meaning" ? accepted.meanings.slice(0, 4).join(", ") : accepted.readings.join("、");

  return (
    <div className="question">
      <div className={`glyph ${item.kind}`} lang="ja">
        {itemLabel(item)}
      </div>
      <form onSubmit={submit} className={`answer-row ${cardType}`}>
        <label htmlFor="answer">{prompt}</label>
        <input
          id="answer"
          key={`${item.item_key}|${cardType}`}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          lang={cardType === "reading" ? "ja" : "en"}
          readOnly={graded}
          className={graded ? (correct ? "right" : "wrong") : ""}
          value={answer}
          placeholder={cardType === "reading" ? "かな (type romaji)" : "English"}
          onChange={(e) => {
            setAnswer(cardType === "reading" ? toKana(e.target.value, { IMEMode: true }) : e.target.value);
            if (verdict?.result === "retry") setVerdict(undefined);
          }}
        />
        <button type="submit" className="primary">
          {graded ? "Next ⏎" : "Check ⏎"}
        </button>
      </form>

      <div className="feedback" aria-live="polite">
        {verdict?.result === "retry" && <p className="hint">{verdict.message}</p>}
        {verdict?.result === "correct" && verdict.typo && <p className="hint">Close enough. Watch the spelling: {expected}</p>}
        {verdict?.result === "wrong" && !overridden && (
          <p className="miss">
            Answer: <span lang={cardType === "reading" ? "ja" : "en"}>{expected}</span>
            {cardType === "meaning" && answer.trim() && (
              <button type="button" className="link" onClick={acceptMine}>
                I was right: accept “{answer.trim()}” from now on
              </button>
            )}
          </p>
        )}
        {overridden && <p className="hint">Added “{answer.trim()}” as a synonym and counted as correct.</p>}
        {graded && (
          <button type="button" className="link" onClick={() => setShowInfo((s) => !s)}>
            {showInfo ? "Hide details" : "Show details"}
          </button>
        )}
      </div>

      {graded && showInfo && <ItemInfo item={item} onChange={onReload} />}
    </div>
  );
}
