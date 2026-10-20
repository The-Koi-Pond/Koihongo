import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { dueCards, recordReview, todaySummary } from "../srs/progress.ts";
import { answerCurrent, currentQuestion, sessionStats, spreadOutPairs, startSession, type Session } from "../srs/session.ts";
import { DoneView } from "../ui/DoneView.tsx";
import { QuestionCard, SessionGauge } from "../ui/QuestionCard.tsx";
import { useItem } from "../ui/useItem.ts";

/**
 * Due reviews, most at-risk first. With `minutes`, wraps up once time is up.
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
  const [session, setSession] = useState<Session>();
  const [total, setTotal] = useState(0);
  // Due reviews left out of this session by catch-up.
  const [waiting, setWaiting] = useState(0);
  const [turn, setTurn] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [deadline] = useState(() => (minutes ? Date.now() + minutes * 60_000 : undefined));
  const [error, setError] = useState<string>();

  useEffect(() => {
    const now = Date.now();
    Promise.all([dueCards(tauriDb, now), todaySummary(tauriDb, now)])
      .then(([cards, summary]) => {
        const asked = extra ? cards : cards.slice(0, summary.reviewsToday);
        const s = startSession(spreadOutPairs(asked.map((c) => ({ item_key: c.item_key, card_type: c.card_type }))));
        setSession(s);
        setTotal(s.queue.length);
        setWaiting(cards.length - asked.length);
        setStopped(false);
      })
      .catch((e) => setError(String(e)));
  }, [extra]);

  const question = session && !stopped ? currentQuestion(session) : undefined;
  const { item, error: itemError, reload } = useItem(question?.item_key);

  async function onDone(correct: boolean, answer: string) {
    if (!session || !question) return;
    const { session: next, firstAttempt } = answerCurrent(session, correct);
    try {
      if (firstAttempt) await recordReview(tauriDb, question.item_key, question.card_type, correct, answer, Date.now());
    } catch (e) {
      return setError(String(e));
    }
    setSession(next);
    setTurn((t) => t + 1);
    if (deadline && Date.now() >= deadline) setStopped(true);
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

  return (
    <div className="session">
      {item ? (
        <QuestionCard
          key={turn}
          item={item}
          cardType={question.card_type}
          onReload={reload}
          onDone={onDone}
          top={<SessionGauge done={stats.answered} total={total} note={deadline ? "5 minutes" : undefined} />}
          onStop={() => setStopped(true)}
        />
      ) : (
        <p className="muted">Loading…</p>
      )}
    </div>
  );
}

export function ErrorView({ message, onExit }: { message: string; onExit: () => void }) {
  return (
    <div className="card">
      <p className="error">Something went wrong: {message}</p>
      <button onClick={onExit}>Back to Today</button>
    </div>
  );
}
