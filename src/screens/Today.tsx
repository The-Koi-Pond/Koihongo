import { GraduationCap, Play, RotateCcw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { progressByKind, type KindProgress } from "../library.ts";
import { lessonAllowance, reviewForecast, type Lesson, type TodaySummary } from "../srs/progress.ts";
import { KANA_PER_DAY, NEW_PER_DAY } from "../srs/settings.ts";
import type { Screen } from "../ui/NavBar.tsx";
import { BannerScene } from "../ui/Scene.tsx";
import { StatusBar } from "../ui/StatusBar.tsx";

export type StudyOrder = "reviews" | "lessons";

const ORDER_KEY = "koihongo.studyOrder";

/** Remembered per device; falls back to reviews-first if storage is unavailable. */
function loadOrder(): StudyOrder {
  try {
    return localStorage.getItem(ORDER_KEY) === "lessons" ? "lessons" : "reviews";
  } catch {
    return "reviews";
  }
}

function saveOrder(order: StudyOrder) {
  try {
    localStorage.setItem(ORDER_KEY, order);
  } catch {
    // Not remembered this time; harmless.
  }
}

function greeting(now: Date): { ja: string; en: string } {
  const h = now.getHours();
  if (h >= 5 && h < 11) return { ja: "おはよう", en: "Good morning" };
  if (h >= 11 && h < 18) return { ja: "こんにちは", en: "Good afternoon" };
  return { ja: "こんばんは", en: "Good evening" };
}

/** "in 3h 20m", "in 2 days" */
function fromNow(time: number, now: number): string {
  const minutes = Math.max(1, Math.round((time - now) / 60_000));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `in ${hours}h ${minutes % 60}m` : `in ${hours}h`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function Today({
  summary,
  go,
  onStart,
}: {
  summary?: TodaySummary;
  go: (screen: Screen) => void;
  onStart: (order: StudyOrder) => void;
}) {
  const [order, setOrder] = useState<StudyOrder>(loadOrder);
  const [forecast, setForecast] = useState<number[]>();
  const [progress, setProgress] = useState<KindProgress[]>();

  useEffect(() => {
    reviewForecast(tauriDb, Date.now()).then(setForecast);
    progressByKind(tauriDb).then(setProgress);
  }, []);

  if (!summary) return <p className="muted">Loading…</p>;

  const now = new Date();
  const hello = greeting(now);
  const reviews = summary.reviewsDue;
  const lessons = summary.lessons.length;
  const startDetail =
    reviews && lessons
      ? order === "reviews"
        ? `${plural(reviews, "review")}, then ${lessons} new`
        : `${lessons} new, then ${plural(reviews, "review")}`
      : reviews
        ? plural(reviews, "review")
        : lessons
          ? `${plural(lessons, "new item")}`
          : "all caught up";

  const pickOrder = (o: StudyOrder) => {
    setOrder(o);
    saveOrder(o);
  };

  return (
    <div className="fit-page today with-status-bar">
      <header className="banner bleed today-banner">
        <BannerScene />
        <div className="banner-top">
          <div>
            <p lang="ja" className="greeting-ja">
              {hello.ja}
            </p>
            <p className="greeting-en">{hello.en}</p>
          </div>
          <p className="today-date">{now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</p>
        </div>

        <div className="start-stack">
          <button className="start-btn" disabled={!reviews && !lessons} onClick={() => onStart(order)}>
            <Play size={20} strokeWidth={2} aria-hidden="true" />
            <span>{reviews || lessons ? "Start" : "All caught up"}</span>
            {(reviews > 0 || lessons > 0) && <span className="start-detail">· {startDetail}</span>}
          </button>
          <div className="start-options">
          {reviews > 0 && lessons > 0 && (
            <div className="order-toggle" role="group" aria-label="What comes first">
              <button aria-pressed={order === "reviews"} onClick={() => pickOrder("reviews")}>
                Reviews first
              </button>
              <button aria-pressed={order === "lessons"} onClick={() => pickOrder("lessons")}>
                Lessons first
              </button>
            </div>
          )}
          {reviews > 0 && (
            <button className="link-light" onClick={() => go("quick-reviews")}>
              Just 5 minutes
            </button>
          )}
          </div>
        </div>
      </header>

      <div className="today-tiles">
        <section className="card">
          <h2 className="tile-title">
            <RotateCcw size={16} aria-hidden="true" /> Reviews
          </h2>
          {reviews > 0 ? (
            <p className="tile-big">
              {reviews} <span className="tile-unit">due now</span>
            </p>
          ) : (
            <p className="tile-big done">All caught up ✓</p>
          )}
          <p className="muted small">
            {summary.reviewsNext24h > 0
              ? `${summary.reviewsNext24h} more in the next 24 hours${!reviews && summary.nextReviewAt ? ` · next ${fromNow(summary.nextReviewAt, now.getTime())}` : ""}`
              : summary.nextReviewAt
                ? `Next review ${fromNow(summary.nextReviewAt, now.getTime())}`
                : "No reviews scheduled yet. They start after your first lessons."}
          </p>
          {forecast && <Forecast data={forecast} />}
        </section>

        <section className="card">
          <h2 className="tile-title">
            <GraduationCap size={16} aria-hidden="true" /> Lessons
          </h2>
          {lessons > 0 ? (
            <p className="tile-big">
              {lessons} <span className="tile-unit">available today</span>
            </p>
          ) : (
            <p className="tile-big done">{summary.lessonsWaiting > 0 ? "Done for today ✓" : "Nothing new yet"}</p>
          )}
          <TrackPreview name="Kana" lessons={summary.lessons.filter((l) => l.track === "kana")} />
          <TrackPreview name="Kanji path" lessons={summary.lessons.filter((l) => l.track === "main")} />
          <p className="muted small">
            {summary.lessonsWaiting > 0
              ? lessonAllowance(summary.reviewsDue, 0) < NEW_PER_DAY
                ? `${summary.lessonsWaiting} more unlocked · clear some reviews first`
                : `${summary.lessonsWaiting} more unlocked, saved for tomorrow (daily limits: ${KANA_PER_DAY} kana, ${NEW_PER_DAY} others)`
              : lessons === 0
                ? "New items unlock as your reviews go well."
                : ""}
          </p>
        </section>
      </div>

      {progress && (
        <section className="card">
          <div className="tile-head">
            <h2 className="tile-title">
              <TrendingUp size={16} aria-hidden="true" /> Progress
            </h2>
            <ul className="legend" aria-label="Legend">
              <li>
                <span className="swatch-bar passed" /> passed
              </li>
              <li>
                <span className="swatch-bar learning" /> learning
              </li>
            </ul>
          </div>
          <ProgressBars rows={progress} />
        </section>
      )}
      <StatusBar />
    </div>
  );
}

function TrackPreview({ name, lessons }: { name: string; lessons: Lesson[] }) {
  if (lessons.length === 0) return null;
  const shown = lessons.slice(0, 6); // one row, even in a narrow window
  return (
    <div className="track-preview">
      <span className="track-name">{name}</span>
      <ul className="mini-glyphs">
        {shown.map((l) => (
          <li key={l.item_key} className={l.kind} lang="ja">
            {l.label}
          </li>
        ))}
        {lessons.length > shown.length && <li className="more">+{lessons.length - shown.length}</li>}
      </ul>
    </div>
  );
}

/** Reviews coming up per hour over the next 24 hours: one series, so no legend; hover a bar for its count. */
function Forecast({ data }: { data: number[] }) {
  const max = Math.max(...data);
  if (max === 0) return <p className="muted small forecast-empty">Nothing coming up in the next 24 hours.</p>;
  return (
    <figure className="forecast" aria-label="Reviews coming up per hour, next 24 hours">
      <div className="forecast-bars">
        {data.map((n, h) => (
          <div key={h} className="forecast-slot" title={`${plural(n, "review")} in ${h}–${h + 1}h`}>
            {n > 0 && <div className="forecast-bar" style={{ height: `${Math.max(8, (n / max) * 100)}%` }} />}
          </div>
        ))}
      </div>
      <figcaption className="forecast-axis">
        <span>now</span>
        <span>+12h</span>
        <span>+24h</span>
      </figcaption>
    </figure>
  );
}

const KIND_LABEL = { kana: "Kana", component: "Components", kanji: "Kanji", word: "Words" } as const;

/** Passed + learning out of the total, per kind. One hue (amount, not identity): rows are labelled by name. */
function ProgressBars({ rows }: { rows: KindProgress[] }) {
  return (
    <ul className="progress-rows">
      {rows.map((r) => {
        const pct = (n: number) => (r.total ? (n / r.total) * 100 : 0);
        return (
          <li key={r.kind}>
            <span className="progress-name">{KIND_LABEL[r.kind]}</span>
            <div className="progress-track" title={`${r.passed} passed, ${r.learning} learning, of ${r.total.toLocaleString()}`}>
              {r.passed > 0 && <div className="progress-fill passed" style={{ width: `${pct(r.passed)}%` }} />}
              {r.learning > 0 && <div className="progress-fill learning" style={{ width: `${pct(r.learning)}%` }} />}
            </div>
            <span className="progress-count">
              {(r.passed + r.learning).toLocaleString()} <span className="muted">/ {r.total.toLocaleString()}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
