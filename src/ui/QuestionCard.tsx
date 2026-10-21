import { Check, FastForward, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toKana } from "wanakana";
import { tauriDb } from "../db/tauriDb.ts";
import { acceptedAnswers, addSynonym, type ItemDetails } from "../items.ts";
import { checkKana, checkMeaning, checkReading, type Verdict } from "../srs/answers.ts";
import { isFastTracked, setFastTrack } from "../srs/fastTrack.ts";
import type { RankUp } from "../srs/ranks.ts";
import type { CardType } from "../srs/scheduler.ts";
import { ItemInfo } from "./ItemInfo.tsx";
import { RankBadge } from "./RankBadge.tsx";
import { BannerScene } from "./Scene.tsx";
import { itemLabel } from "./useItem.ts";

const KIND_NAME = { kana: "Kana", component: "Component", kanji: "Kanji", word: "Word" } as const;

/** What the answer box asks for: "Reading" (sound) or "Meaning" (English/name). */
function askFor(item: ItemDetails, cardType: CardType): { kind: "reading" | "meaning"; label: string } {
  if (item.kind === "kana") return { kind: "reading", label: "Kana reading · romaji" };
  if (item.kind === "component") return { kind: "meaning", label: "Component name" };
  return { kind: cardType, label: `${KIND_NAME[item.kind]} ${cardType}` };
}

/**
 * Asks one question, as a full page: the item in the night-sky banner, the
 * answer dock below. Enter checks the answer, Enter again moves on; the result
 * is reported on moving on, so "I was right" can still change it.
 */
export function QuestionCard({
  item,
  cardType,
  onReload,
  onDone,
  top,
  onStop,
  rankUp,
}: {
  item: ItemDetails;
  cardType: CardType;
  onReload: () => void;
  onDone: (correct: boolean, answer: string) => void;
  /** Shown top-left in the banner (session progress). */
  top?: React.ReactNode;
  /** Adds a "Stop here" button top-right. */
  onStop?: () => void;
  /** Reviews: the rank-up a right answer would give, asked once it's graded (and again after "I was right"). */
  rankUp?: (correct: boolean) => Promise<RankUp | null>;
}) {
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<Verdict>();
  const [showInfo, setShowInfo] = useState(false);
  const [overridden, setOverridden] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const accepted = acceptedAnswers(item);
  const ask = askFor(item, cardType);
  // Kanji/word readings are typed in romaji that turns into kana; kana questions are answered in romaji itself.
  const kanaInput = cardType === "reading" && item.kind !== "kana";
  const graded = verdict && verdict.result !== "retry";
  const correct = overridden || verdict?.result === "correct";
  const label = itemLabel(item);
  const [rankNews, setRankNews] = useState<RankUp | null>(null);
  // Reviews only (they pass rankUp): whether the item is on fast track.
  const [fast, setFast] = useState<boolean>();

  useEffect(() => {
    if (!graded || !rankUp) return;
    let cancelled = false;
    isFastTracked(tauriDb, item.item_key).then((v) => !cancelled && setFast(v));
    return () => {
      cancelled = true;
    };
  }, [graded, rankUp, item.item_key]);

  useEffect(() => {
    if (!graded || !correct || !rankUp) return setRankNews(null);
    let cancelled = false;
    rankUp(true)
      .then((r) => !cancelled && setRankNews(r))
      .catch(() => {}); // a missing flourish isn't worth an error
    return () => {
      cancelled = true;
    };
  }, [graded, correct, rankUp, fast]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (graded) return onDone(correct, answer);
    const v =
      item.kind === "kana"
        ? checkKana(answer, item.character, item.romaji, item.accept)
        : cardType === "meaning"
          ? checkMeaning(answer, accepted.meanings, accepted.readings)
          : checkReading(answer, accepted.readings);
    setVerdict(v);
    // Open on the next frames, so the panel first renders closed and then animates open.
    if (v.result === "wrong") requestAnimationFrame(() => requestAnimationFrame(() => setShowInfo(true)));
  }

  async function acceptMine() {
    await addSynonym(tauriDb, item.item_key, answer, Date.now());
    setOverridden(true);
    onReload();
    inputRef.current?.focus(); // the link is gone now; Enter should still move on
  }

  async function tooEasy() {
    await setFastTrack(tauriDb, item.item_key, true, Date.now());
    setFast(true);
    inputRef.current?.focus();
  }

  const expected =
    item.kind === "kana"
      ? accepted.readings.join(" / ")
      : cardType === "meaning"
        ? accepted.meanings.slice(0, 4).join(", ")
        : accepted.readings.join("、");

  return (
    // One window-high column: banner on top takes whatever the answer dock and the
    // details (anchored to the bottom, sized to their content) leave over.
    <div className={`item-view question-page ${item.kind}`}>
      <header className={`banner bleed ${item.kind}`}>
        <BannerScene />
        <div className="banner-top">
          <div className="banner-top-start">{top}</div>
          <div className="banner-top-end">
            {onStop && (
              <button type="button" className="ghost-light" onClick={onStop}>
                Stop here
              </button>
            )}
          </div>
        </div>
        <div className="banner-glyph" lang="ja" style={{ "--chars": [...label].length } as React.CSSProperties}>
          {label}
        </div>
      </header>

      <section className={`answer-dock ${ask.kind} ${graded ? (correct ? "right" : "wrong") : ""}`}>
        <form onSubmit={submit} className="answer-form">
          <label htmlFor="answer" className="ask-tag">
            {ask.label}
          </label>
          <div className="answer-field">
            {/* Always takes its space, so the typed answer doesn't shift when it appears. */}
            <span className="verdict-icon" aria-label={graded ? (correct ? "Correct" : "Wrong") : undefined}>
              {graded && (correct ? <Check size={22} strokeWidth={3} /> : <X size={22} strokeWidth={3} />)}
            </span>
            <input
              id="answer"
              ref={inputRef}
              key={`${item.item_key}|${cardType}`}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              lang={kanaInput ? "ja" : "en"}
              readOnly={graded}
              value={answer}
              placeholder={item.kind === "kana" ? "romaji, e.g. ka" : kanaInput ? "かな (type romaji)" : "English"}
              onChange={(e) => {
                setAnswer(kanaInput ? toKana(e.target.value, { IMEMode: true }) : e.target.value);
                if (verdict?.result === "retry") setVerdict(undefined);
              }}
            />
            <button type="submit" className="check-btn">
              {graded ? "Next ⏎" : "Check ⏎"}
            </button>
          </div>
        </form>

        <div className="feedback" aria-live="polite">
          {verdict?.result === "retry" && <p className="hint">{verdict.message}</p>}
          {verdict?.result === "correct" && !verdict.typo && !overridden && <p className="yay">Correct!</p>}
          {verdict?.result === "correct" && verdict.typo && <p className="hint">Close enough. Watch the spelling: {expected}</p>}
          {verdict?.result === "wrong" && !overridden && (
            <p className="miss">
              Answer: <strong lang={kanaInput ? "ja" : "en"}>{expected}</strong>
            </p>
          )}
          {overridden && <p className="hint">Added “{answer.trim()}” as a synonym and counted as correct.</p>}
          {graded && (
            <p className="feedback-links">
              {rankNews && (
                <span className="rank-up">
                  <span lang="ja">{label}</span> ▸ <RankBadge rank={rankNews.to} /> RANK UP!
                </span>
              )}
              {correct && fast === false && (
                <button
                  type="button"
                  className="link"
                  title="Put this item on fast track: right answers count as easy until you miss one"
                  onClick={tooEasy}
                >
                  Too easy <FastForward size={13} strokeWidth={2.5} aria-hidden="true" />
                </button>
              )}
              {correct && fast && (
                <span className="fast-track-note" title="Right answers on this item count as easy">
                  <FastForward size={13} strokeWidth={2.5} aria-hidden="true" /> fast track
                </span>
              )}
              {verdict?.result === "wrong" && !overridden && cardType === "meaning" && answer.trim() && (
                <button type="button" className="link" onClick={acceptMine}>
                  I was right: accept “{answer.trim()}”
                </button>
              )}
              <button type="button" className="link" onClick={() => setShowInfo((s) => !s)}>
                {showInfo ? "Hide details" : "Show details"}
              </button>
            </p>
          )}
        </div>
      </section>

      {/* Always in the layout (0px high while closed), so answering doesn't shift the page. */}
      <div className={`question-details ${graded && showInfo ? "open" : ""}`} aria-hidden={!(graded && showInfo)}>
        <div className="question-details-inner">{graded && <ItemInfo item={item} onChange={onReload} />}</div>
      </div>
    </div>
  );
}

/** Session progress for the banner: a retro gauge plus "7 / 20". */
export function SessionGauge({ done, total, note }: { done: number; total: number; note?: string }) {
  return (
    <div className="session-gauge">
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        {done > 0 && <div className="progress-fill passed" style={{ width: `${(100 * done) / Math.max(1, total)}%` }} />}
      </div>
      <span className="session-count">
        {done} / {total}
        {note && <span className="session-note"> · {note}</span>}
      </span>
    </div>
  );
}
