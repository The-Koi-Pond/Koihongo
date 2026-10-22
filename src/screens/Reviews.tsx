import { useCallback, useEffect, useState } from "react";
import type { Grade } from "ts-fsrs";
import { tauriDb } from "../db/tauriDb.ts";
import { byRisk, deckCardId, deckQuestion, dueDeckCards, getDeckCard, recordDeckReview, type DeckCard } from "../decks.ts";
import { dueCards, recordReview, todaySummary } from "../srs/progress.ts";
import { rankUpFor } from "../srs/ranks.ts";
import { Rating } from "../srs/scheduler.ts";
import {
  answerCurrent,
  currentQuestion,
  questionId,
  sessionStats,
  spreadOutPairs,
  startSession,
  type DeckQuestion,
  type Question,
  type Session,
} from "../srs/session.ts";
import { DoneView } from "../ui/DoneView.tsx";
import { FlipCard } from "../ui/FlipCard.tsx";
import { QuestionCard, SessionGauge } from "../ui/QuestionCard.tsx";
import { useItem } from "../ui/useItem.ts";

type ReviewQuestion = Question | DeckQuestion;

/**
 * Due reviews, most at-risk first: path cards plus cards from decks that are
 * in daily reviews (flip and rate). With `minutes`, wraps up once time is up.
 * During catch-up only today's share is asked, unless `extra` (or you pick
 * "Do extra anyway" at the end). `exitLabel` replaces "Back to Today" when
 * this is part of a longer study session.
 */
export function Reviews({
  minutes,
  extra: startExtra = false,
  onExit,
  exitLabel = "Back to Today",
}: {
  minutes?: number;
  extra?: boolean;
  onExit: () => void;
  exitLabel?: string;
}) {
  const [extra, setExtra] = useState(startExtra);
  const [session, setSession] = useState<Session<ReviewQuestion>>();
  const [total, setTotal] = useState(0);
  // Due reviews left out of this session by catch-up.
  const [waiting, setWaiting] = useState(0);
  const [turn, setTurn] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [deadline] = useState(() => (minutes ? Date.now() + minutes * 60_000 : undefined));
  const [error, setError] = useState<string>();

  useEffect(() => {
    const now = Date.now();
    Promise.all([dueCards(tauriDb, now), dueDeckCards(tauriDb, now), todaySummary(tauriDb, now)])
      .then(([pathCards, deckCards, summary]) => {
        // One queue, most likely to be forgotten first, whichever kind of card.
        const cards = byRisk(
          [
            ...pathCards.map((c) => ({ ...c, q: { item_key: c.item_key, card_type: c.card_type } as ReviewQuestion })),
            ...deckCards.map((c) => ({ ...c, q: deckQuestion(c.id) as ReviewQuestion })),
          ],
          now,
        );
        const asked = extra ? cards : cards.slice(0, summary.reviewsToday);
        const s = startSession(spreadOutPairs(asked.map((c) => c.q)));
        setSession(s);
        setTotal(s.queue.length);
        setWaiting(cards.length - asked.length);
        setStopped(false);
      })
      .catch((e) => setError(String(e)));
  }, [extra]);

  const question = session && !stopped ? currentQuestion(session) : undefined;
  const deckId = question ? deckCardId(question) : null;
  const { item, error: itemError, reload } = useItem(question && deckId === null ? question.item_key : undefined);
  const deckCard = useDeckCard(deckId);
  const rankUp = useCallback(
    (correct: boolean) =>
      question && question.card_type !== "flip" && session && !(questionId(question) in session.firstTry)
        ? rankUpFor(tauriDb, question.item_key, question.card_type, correct, Date.now())
        : Promise.resolve(null),
    [question, session],
  );

  /** Moves on after an answer; `record` saves it for scheduling (first attempts only). */
  async function advance(correct: boolean, record: () => Promise<unknown>) {
    if (!session) return;
    const { session: next, firstAttempt } = answerCurrent(session, correct);
    try {
      if (firstAttempt) await record();
    } catch (e) {
      return setError(String(e));
    }
    setSession(next);
    setTurn((t) => t + 1);
    if (deadline && Date.now() >= deadline) setStopped(true);
  }

  function onDone(correct: boolean, answer: string) {
    if (question && question.card_type !== "flip") {
      const { item_key, card_type } = question;
      return advance(correct, () => recordReview(tauriDb, item_key, card_type, correct, answer, Date.now()));
    }
  }

  // "Again" counts as a miss: the card comes back later in the session.
  function onRate(rating: Grade) {
    if (deckId !== null) return advance(rating !== Rating.Again, () => recordDeckReview(tauriDb, deckId, rating, Date.now()));
  }

  if (error || itemError) return <ErrorView message={error ?? itemError!} onExit={onExit} />;
  if (!session) return <p className="muted">Loading…</p>;

  const stats = sessionStats(session);
  if (!question) {
    const left = total - stats.answered;
    return (
      <DoneView
        title={
          total === 0
            ? waiting > 0
              ? "Today's share is done ✓"
              : "No reviews due"
            : stopped
              ? "Nice, that's a wrap"
              : waiting > 0
                ? "Today's share done!"
                : "All reviews done!"
        }
        actions={
          <>
            <button className="primary" onClick={onExit} autoFocus>
              {exitLabel}
            </button>
            {waiting > 0 && !stopped && (
              <button onClick={() => setExtra(true)}>Do extra anyway</button>
            )}
          </>
        }
      >
        {stats.answered > 0 && (
          <p className="done-stat">
            {stats.answered} answered · {Math.round((100 * stats.correctFirstTry) / stats.answered)}% right first try
          </p>
        )}
        {left > 0 && <p>{left} still due. They'll keep until next time.</p>}
        {waiting > 0 && !stopped && <p>{waiting} more are waiting for the coming days, so the pile shrinks one share at a time.</p>}
      </DoneView>
    );
  }

  const top = <SessionGauge done={stats.answered} total={total} note={deadline ? "5 minutes" : undefined} />;
  return (
    <div className="session">
      {question.card_type === "flip" ? (
        deckCard && deckCard.id === deckId ? (
          <FlipCard key={turn} card={deckCard} top={top} onRate={onRate} onStop={() => setStopped(true)} />
        ) : (
          <p className="muted">Loading…</p>
        )
      ) : item ? (
        <QuestionCard
          key={turn}
          item={item}
          cardType={question.card_type}
          onReload={reload}
          onDone={onDone}
          top={top}
          onStop={() => setStopped(true)}
          rankUp={rankUp}
        />
      ) : (
        <p className="muted">Loading…</p>
      )}
    </div>
  );
}

/** The deck card with this id, loaded from the database (undefined while loading or for null). */
export function useDeckCard(id: number | null): DeckCard | undefined {
  const [card, setCard] = useState<DeckCard>();
  useEffect(() => {
    if (id === null) return setCard(undefined);
    let cancelled = false;
    getDeckCard(tauriDb, id).then((c) => !cancelled && setCard(c));
    return () => {
      cancelled = true;
    };
  }, [id]);
  return card;
}

export function ErrorView({ message, onExit }: { message: string; onExit: () => void }) {
  return (
    <div className="card">
      <p className="error">Something went wrong: {message}</p>
      <button onClick={onExit}>Back to Today</button>
    </div>
  );
}
