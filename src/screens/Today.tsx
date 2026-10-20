import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { lessonAllowance, todaySummary, type TodaySummary } from "../srs/progress.ts";
import { NEW_PER_DAY } from "../srs/settings.ts";

export type Go = (screen: "lessons" | "reviews" | "quick-reviews" | "sources") => void;

export function Today({ go }: { go: Go }) {
  const [summary, setSummary] = useState<TodaySummary>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    todaySummary(tauriDb, Date.now())
      .then(setSummary)
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="error">Couldn't load your progress: {error}</p>;
  if (!summary) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>
        <span lang="ja">今日</span> Today
      </h1>

      <section className="card">
        <h2>Reviews</h2>
        <p className="big">{summary.reviewsDue}</p>
        <p className="muted">due now · {summary.reviewsNext24h} more in the next 24 hours</p>
        <div className="row">
          <button className="primary" disabled={summary.reviewsDue === 0} onClick={() => go("reviews")}>
            Start reviews
          </button>
          <button disabled={summary.reviewsDue === 0} onClick={() => go("quick-reviews")}>
            Just 5 minutes
          </button>
        </div>
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
            <li key={l.item_key} className={l.kind} lang="ja">
              {l.label}
            </li>
          ))}
        </ul>
        <button className="primary" disabled={summary.lessons.length === 0} onClick={() => go("lessons")}>
          Start lessons
        </button>
      </section>

      <footer>
        <button className="link" onClick={() => go("sources")}>
          Sources &amp; licences
        </button>
      </footer>
    </>
  );
}
