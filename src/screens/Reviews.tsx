import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { dueCards, recordReview } from "../srs/progress.ts";
import { answerCurrent, currentQuestion, sessionStats, spreadOutPairs, startSession, type Session } from "../srs/session.ts";
import { DoneView } from "../ui/DoneView.tsx";
import { QuestionCard, SessionGauge } from "../ui/QuestionCard.tsx";
import { useItem } from "../ui/useItem.ts";

/**
 * Due reviews, most at-risk first. With `minutes`, wraps up once time is up.
 * `exitLabel` replaces "Back to Today" when this is part of a longer study session.
 */
export function Reviews({ minutes, onExit, exitLabel = "Back to Today" }: { minutes?: number; onExit: () => void; exitLabel?: string }) {
  const [session, setSession] = useState<Session>();
  const [total, setTotal] = useState(0);
  const [turn, setTurn] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [deadline] = useState(() => (minutes ? Date.now() + minutes * 60_000 : undefined));
  const [error, setError] = useState<string>();

  useEffect(() => {
    dueCards(tauriDb, Date.now())
      .then((cards) => {
        const s = startSession(spreadOutPairs(cards.map((c) => ({ item_key: c.item_key, card_type: c.card_type }))));
        setSession(s);
        setTotal(s.queue.length);
      })
      .catch((e) => setError(String(e)));
  }, []);

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
        title={total === 0 ? "No reviews due" : stopped ? "Nice, that's a wrap" : "All reviews done!"}
        actions={
          <button className="primary" onClick={onExit} autoFocus>
            {exitLabel}
          </button>
        }
      >
        {stats.answered > 0 && (
          <p className="done-stat">
            {stats.answered} answered · {Math.round((100 * stats.correctFirstTry) / stats.answered)}% right first try
          </p>
        )}
        {left > 0 && <p>{left} still due. They'll keep until next time.</p>}
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
