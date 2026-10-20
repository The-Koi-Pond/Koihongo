import { useEffect, useState } from "react";
import { migrate } from "./db/migrations.ts";
import { tauriDb } from "./db/tauriDb.ts";
import { lessonAllowance, todaySummary, type TodaySummary } from "./srs/progress.ts";
import { NEW_PER_DAY } from "./srs/settings.ts";
import "./App.css";

// Shared so React's double-run of effects in dev can't migrate twice at once.
let dbReady: Promise<void> | undefined;
const openDb = () => (dbReady ??= migrate(tauriDb));

const KIND_LABEL = { component: "component", kanji: "kanji", word: "word" } as const;

function App() {
  const [summary, setSummary] = useState<TodaySummary>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    openDb()
      .then(() => todaySummary(tauriDb, Date.now()))
      .then(setSummary)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <main className="today"><p className="error">Couldn't load your progress: {error}</p></main>;
  if (!summary) return <main className="today"><p className="muted">Loading…</p></main>;

  return (
    <main className="today">
      <h1>
        <span lang="ja">今日</span> Today
      </h1>

      <section className="card">
        <h2>Reviews</h2>
        <p className="big">{summary.reviewsDue}</p>
        <p className="muted">due now · {summary.reviewsNext24h} more in the next 24 hours</p>
        <button disabled>Start reviews (coming next)</button>
      </section>

      <section className="card">
        <h2>Lessons</h2>
        <p className="big">{summary.lessons.length}</p>
        <p className="muted">
          available today · {summary.lessonsDoneToday} done today
          {summary.lessonsWaiting > 0 &&
            (lessonAllowance(summary.reviewsDue, 0) < NEW_PER_DAY
              ? ` · ${summary.lessonsWaiting} more unlocked, waiting until you've cleared some reviews`
              : ` · ${summary.lessonsWaiting} more unlocked, saved for another day (limit: ${NEW_PER_DAY} a day)`)}
        </p>
        <ul className="lesson-preview">
          {summary.lessons.map((l) => (
            <li key={l.item_key} className={l.kind} title={KIND_LABEL[l.kind]} lang="ja">
              {l.label}
            </li>
          ))}
        </ul>
        <button disabled>Start lessons (coming next)</button>
      </section>
    </main>
  );
}

export default App;
