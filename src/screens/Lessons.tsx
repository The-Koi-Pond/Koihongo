import { useCallback, useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { cardTypesFor, startLessons, todaySummary, type Lesson } from "../srs/progress.ts";
import { FIRST_REVIEW_DELAY_MS } from "../srs/scheduler.ts";
import { answerCurrent, currentQuestion, spreadOutPairs, startSession, type Question, type Session } from "../srs/session.ts";
import { ItemView } from "../ui/ItemView.tsx";
import { DoneView } from "../ui/DoneView.tsx";
import { QuestionCard } from "../ui/QuestionCard.tsx";
import { useItem } from "../ui/useItem.ts";
import { ErrorView } from "./Reviews.tsx";

/** Items per lesson round: read them, then a practice quiz that doesn't affect scheduling. */
const BATCH_SIZE = 5;

type Phase = { name: "loading" } | { name: "learn"; page: number } | { name: "quiz"; session: Session; turn: number } | { name: "done" };

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Lesson rounds. `exitLabel` replaces "Back to Today" when this is part of a longer study session. */
export function Lessons({ onExit, exitLabel = "Back to Today" }: { onExit: () => void; exitLabel?: string }) {
  const [batch, setBatch] = useState<Lesson[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [moreAvailable, setMoreAvailable] = useState(false);
  const [error, setError] = useState<string>();

  const loadBatch = useCallback(() => {
    setPhase({ name: "loading" });
    todaySummary(tauriDb, Date.now())
      .then((s) => {
        setBatch(s.lessons.slice(0, BATCH_SIZE));
        setPhase({ name: "learn", page: 0 });
      })
      .catch((e) => setError(String(e)));
  }, []);
  useEffect(loadBatch, [loadBatch]);

  // ← / → flip lesson pages (→ on the last page starts the quiz), except while typing.
  useEffect(() => {
    if (phase.name !== "learn") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea")) return;
      if (e.key === "ArrowRight") {
        if (phase.page < batch.length - 1) setPhase({ name: "learn", page: phase.page + 1 });
        else startQuiz();
      } else if (e.key === "ArrowLeft" && phase.page > 0) {
        setPhase({ name: "learn", page: phase.page - 1 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, batch]);

  const currentKey =
    phase.name === "learn" ? batch[phase.page]?.item_key : phase.name === "quiz" ? currentQuestion(phase.session)?.item_key : undefined;
  const { item, error: itemError, reload } = useItem(currentKey);

  function startQuiz() {
    const questions: Question[] = batch.flatMap((l) => cardTypesFor(l.kind).map((card_type) => ({ item_key: l.item_key, card_type })));
    setPhase({ name: "quiz", session: startSession(spreadOutPairs(shuffle(questions))), turn: 0 });
  }

  async function onQuizAnswer(correct: boolean) {
    if (phase.name !== "quiz") return;
    const { session } = answerCurrent(phase.session, correct);
    if (currentQuestion(session)) return setPhase({ name: "quiz", session, turn: phase.turn + 1 });
    try {
      await startLessons(tauriDb, batch, Date.now());
      const after = await todaySummary(tauriDb, Date.now());
      setMoreAvailable(after.lessons.length > 0);
      setPhase({ name: "done" });
    } catch (e) {
      setError(String(e));
    }
  }

  if (error || itemError) return <ErrorView message={error ?? itemError!} onExit={onExit} />;
  if (phase.name === "loading") return <p className="muted">Loading…</p>;

  if (batch.length === 0) {
    return (
      <DoneView
        title="No lessons right now"
        actions={
          <button className="primary" onClick={onExit} autoFocus>
            {exitLabel}
          </button>
        }
      >
        <p>Either today's lessons are done, or new items unlock as your reviews go well.</p>
      </DoneView>
    );
  }

  if (phase.name === "done") {
    return (
      <DoneView
        title={`Learned ${batch.length} new items!`}
        actions={
          <>
            {moreAvailable && (
              <button className="primary" onClick={loadBatch} autoFocus>
                Next {BATCH_SIZE} lessons
              </button>
            )}
            <button onClick={onExit} autoFocus={!moreAvailable}>
              {exitLabel}
            </button>
          </>
        }
      >
        <p>Their first review comes in {FIRST_REVIEW_DELAY_MS / 3_600_000} hours.</p>
      </DoneView>
    );
  }

  if (phase.name === "quiz") {
    const q = currentQuestion(phase.session)!;
    return (
      <div className="session">
        {item ? (
          <QuestionCard
            key={phase.turn}
            item={item}
            cardType={q.card_type}
            onReload={reload}
            onDone={onQuizAnswer}
            top={
              <p className="quiz-note" title="Answer each one right to finish. This doesn't affect your reviews.">
                Practice quiz · doesn't count
              </p>
            }
          />
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    );
  }

  const page = phase.page;
  const last = page === batch.length - 1;
  return (
    <div className="session with-bottom-bar">
      {item ? <ItemView item={item} onChange={reload} /> : <p className="muted">Loading…</p>}

      {/* Pinned to the bottom of the window, so Back/Next never move. */}
      <nav className="bottom-bar" aria-label="Lesson pages">
        <div className="bottom-bar-inner">
          <button disabled={page === 0} onClick={() => setPhase({ name: "learn", page: page - 1 })}>
            ← Back
          </button>
          <div className="bottom-bar-center">
            <ol className="lesson-dots">
              {batch.map((l, i) => (
                <li key={l.item_key}>
                  <button
                    className={`dot ${l.kind} ${i === page ? "current" : ""}`}
                    lang="ja"
                    aria-current={i === page ? "step" : undefined}
                    onClick={() => setPhase({ name: "learn", page: i })}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ol>
            <span className="muted small">← → keys flip pages</span>
          </div>
          {last ? (
            <button className="primary" onClick={startQuiz}>
              Start quiz →
            </button>
          ) : (
            <button className="primary" onClick={() => setPhase({ name: "learn", page: page + 1 })}>
              Next →
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
