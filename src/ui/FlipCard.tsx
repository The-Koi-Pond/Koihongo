import { useEffect, useState } from "react";
import type { Grade } from "ts-fsrs";
import type { DeckCard } from "../decks.ts";
import { nextDues, Rating } from "../srs/scheduler.ts";
import { BannerScene } from "./Scene.tsx";

const GRADES: { rating: Grade; label: string; key: string }[] = [
  { rating: Rating.Again, label: "Again", key: "1" },
  { rating: Rating.Hard, label: "Hard", key: "2" },
  { rating: Rating.Good, label: "Good", key: "3" },
  { rating: Rating.Easy, label: "Easy", key: "4" },
];

/** Fronts longer than this get normal text size instead of the big banner glyph. */
const SHORT_FRONT = 8;

/** "in 3d", "in 2mo": how long until a rating would bring the card back. */
export function untilLabel(due: number, now: number): string {
  const hours = (due - now) / 3_600_000;
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1).replace(/\.0$/, "")}y`;
}

/**
 * A deck card in a session, Anki-style: the front in the banner, "Show
 * answer" (Space or Enter) reveals the back, then you rate yourself Again,
 * Hard, Good or Easy (keys 1–4); each button shows when the card would come
 * back.
 */
export function FlipCard({
  card,
  deckName,
  top,
  onRate,
  onStop,
}: {
  card: DeckCard;
  deckName?: string;
  top?: React.ReactNode;
  onRate: (rating: Grade) => void;
  onStop?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [now] = useState(() => Date.now());
  const dues = nextDues(card, now);
  const short = [...card.front].length <= SHORT_FRONT && !card.front.includes("\n");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.repeat) return;
      if (!flipped && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        setFlipped(true);
      } else if (flipped) {
        const grade = GRADES.find((g) => g.key === e.key);
        if (grade) onRate(grade.rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, onRate]);

  return (
    <div className="item-view question-page deck">
      <header className="banner bleed deck">
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
        {short ? (
          <div className="banner-glyph" lang="ja" style={{ "--chars": [...card.front].length } as React.CSSProperties}>
            {card.front}
          </div>
        ) : (
          <div className="flip-front-long" lang="ja">
            {card.front}
          </div>
        )}
      </header>

      <section className="flip-dock">
        {deckName && <p className="flip-deck">{deckName}</p>}
        {flipped ? (
          <>
            <p className="flip-back" lang="ja">
              {card.back || <span className="muted">(no back)</span>}
            </p>
            {card.image && <img className="flip-image" src={card.image} alt="Where it came from" />}
            <div className="flip-grades" role="group" aria-label="How well did you remember it?">
              {GRADES.map((g) => (
                <button key={g.rating} type="button" className={`flip-grade grade-${g.label.toLowerCase()}`} onClick={() => onRate(g.rating)}>
                  <span>{g.label}</span>
                  <span className="flip-when">
                    {untilLabel(dues[g.rating], now)} · {g.key}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <button type="button" className="primary flip-show" autoFocus onClick={() => setFlipped(true)}>
            Show answer <span className="flip-key">Space</span>
          </button>
        )}
      </section>
    </div>
  );
}
