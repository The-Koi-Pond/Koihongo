import { GraduationCap, Play, RotateCcw, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { progressByKind, type KindProgress } from "../library.ts";
import { lessonAllowance, reviewForecast, type Lesson, type TodaySummary } from "../srs/progress.ts";
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

  const now = new Date();
  // Until everything has loaded, draw the page with blank values so it doesn't flash or shift.
  if (!summary || !forecast || !progress) return <TodayShell now={now} />;

  const hello = greeting(now);
  // During catch-up, only today's share counts as "to do".
  const reviews = summary.reviewsToday;
  const catchUp = summary.catchUp;
  const lessons = summary.lessons.length;
  const startDetail =
    reviews && lessons
      ? order === "reviews"
        ? `${plural(reviews, "review")}, then ${plural(lessons, "new item")}`
        : `${plural(lessons, "new item")}, then ${plural(reviews, "review")}`
      : reviews
        ? plural(reviews, "review")
        : lessons
          ? plural(lessons, "new item")
          : "";

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
          {reviews || lessons ? (
            <button className="start-btn" onClick={() => onStart(order)}>
              <Play size={20} strokeWidth={2} aria-hidden="true" />
              <span>Start</span>
              <span className="start-detail">· {startDetail}</span>
            </button>
          ) : (
            <p className="start-rest">
              <span>{catchUp ? "Today's share is done" : "All caught up"}</span>
              {summary.nextReviewAt && <span className="start-detail">· next review {fromNow(summary.nextReviewAt, now.getTime())}</span>}
            </p>
          )}
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
          <p className="tile-big">
            {reviews} <span className="tile-unit">{catchUp ? "left in today's share" : "due now"}</span>
          </p>
          {catchUp && (
            <p className="catch-up small">
              Catch-up mode: the rest is spread over about {plural(catchUp.moreDays, "more day")}.{" "}
              <button className="link" onClick={() => go("extra-reviews")}>
                Do a few more
              </button>
            </p>
          )}
          <Upcoming summary={summary} forecast={forecast} now={now.getTime()} />
        </section>

        <section className="card">
          <h2 className="tile-title">
            <GraduationCap size={16} aria-hidden="true" /> Lessons
          </h2>
          <p className="tile-big">
            {lessons} <span className="tile-unit">new today</span>
          </p>
          <TrackPreview name="Kana" lessons={summary.lessons.filter((l) => l.track === "kana")} />
          <TrackPreview name="Kanji path" lessons={summary.lessons.filter((l) => l.track === "main")} />
          <p className="muted small">{lessonNote(summary)}</p>
        </section>
      </div>

      <ProgressCard rows={progress} />
      <StatusBar />
    </div>
  );
}

function TrackPreview({ name, lessons }: { name: string; lessons: Lesson[] }) {
  if (lessons.length === 0) return null;
  const shown = lessons.slice(0, 4); // one row, even in the smallest window
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

/** Why there are no (more) lessons today, without backlog numbers or settings jargon. */
function lessonNote(summary: TodaySummary): string {
  if (summary.lessonsWaiting === 0) return summary.lessons.length ? "" : "New items unlock as your reviews go well.";
  const throttled =
    lessonAllowance(summary.reviewsDue, 0, summary.pacing.newPerDay, summary.pacing.pauseLessonsAtDue) < summary.pacing.newPerDay;
  return throttled ? "More once your reviews are lighter." : "More tomorrow.";
}

/** Hours with reviews before the forecast is worth a chart rather than a sentence. */
const CHART_MIN_HOURS = 3;

/**
 * What's coming next: a sentence ("10 more around 2 AM"), or the 24-hour
 * chart when reviews are spread over several hours.
 */
function Upcoming({ summary, forecast, now }: { summary: TodaySummary; forecast: number[]; now: number }) {
  const busyHours = forecast.flatMap((n, h) => (n > 0 ? [{ h, n }] : []));
  if (busyHours.length >= CHART_MIN_HOURS) {
    return (
      <>
        <p className="muted small">{summary.reviewsNext24h} more in the next 24 hours</p>
        <Forecast data={forecast} />
      </>
    );
  }
  // In catch-up the waiting reviews are already due; the catch-up line covers them.
  if (summary.catchUp && busyHours.length === 0) return null;
  const around = (h: number) => new Date(now + (h + 0.5) * 3_600_000).toLocaleTimeString(undefined, { hour: "numeric" });
  const text =
    busyHours.length > 0
      ? `${busyHours.map(({ h, n }) => `${n} more around ${around(h)}`).join(", ")}. That's all for the next 24 hours.`
      : summary.reviewsToday > 0
        ? "No more coming in the next 24 hours."
        : summary.nextReviewAt
          ? `Next review ${fromNow(summary.nextReviewAt, now)}.`
          : "No reviews yet. They start after your first lessons.";
  return <p className="muted small">{text}</p>;
}

/** Reviews coming up per hour over the next 24 hours: one series, so no legend; hover a bar for its count. */
function Forecast({ data }: { data: number[] }) {
  const max = Math.max(...data);
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

/** The page while it loads: same layout, blank values, nothing clickable. */
function TodayShell({ now }: { now: Date }) {
  const hello = greeting(now);
  return (
    <div className="fit-page today with-status-bar" aria-busy="true">
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
          <p className="start-rest placeholder">&nbsp;</p>
        </div>
      </header>
      <div className="today-tiles">
        <section className="card">
          <h2 className="tile-title">
            <RotateCcw size={16} aria-hidden="true" /> Reviews
          </h2>
          <p className="tile-big">&nbsp;</p>
          <p className="muted small">&nbsp;</p>
        </section>
        <section className="card">
          <h2 className="tile-title">
            <GraduationCap size={16} aria-hidden="true" /> Lessons
          </h2>
          <p className="tile-big">&nbsp;</p>
          <p className="muted small">&nbsp;</p>
        </section>
      </div>
      <ProgressCard />
      <StatusBar />
    </div>
  );
}

const KINDS = ["kana", "component", "kanji", "word"] as const;

/** Passed and learning per kind; without rows (while loading) the bars are drawn empty. */
function ProgressCard({ rows }: { rows?: KindProgress[] }) {
  return (
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
      <ProgressBars rows={rows ?? KINDS.map((kind) => ({ kind, passed: 0, learning: 0, total: 0 }))} />
    </section>
  );
}

const KIND_LABEL = { kana: "Kana", component: "Components", kanji: "Kanji", word: "Words" } as const;
/** JRPG-style stat labels: always four letters, so they line up like HP/MP. */
const STAT_LABEL = { kana: "KANA", component: "PART", kanji: "KNJI", word: "WORD" } as const;

/** Passed + learning out of the total, per kind. One hue (amount, not identity): rows are labelled by name. */
function ProgressBars({ rows }: { rows: KindProgress[] }) {
  return (
    <ul className="progress-rows">
      {rows.map((r) => {
        const pct = (n: number) => (r.total ? (n / r.total) * 100 : 0);
        return (
          <li key={r.kind}>
            {/* One fixed-width cell per letter, so every label is exactly the same width. */}
            <span className="stat-label" title={KIND_LABEL[r.kind]} aria-label={KIND_LABEL[r.kind]}>
              {[...STAT_LABEL[r.kind]].map((ch, i) => (
                <span key={i} aria-hidden="true">
                  {ch}
                </span>
              ))}
            </span>
            <div className="progress-track" title={`${r.passed} passed, ${r.learning} learning, of ${r.total.toLocaleString()}`}>
              {r.passed > 0 && <div className="progress-fill passed" style={{ width: `${pct(r.passed)}%` }} />}
              {r.learning > 0 && <div className="progress-fill learning" style={{ width: `${pct(r.learning)}%` }} />}
            </div>
            <span className="progress-count">
              {r.total ? (
                <>
                  {(r.passed + r.learning).toLocaleString()} <span className="muted">/ {r.total.toLocaleString()}</span>
                </>
              ) : (
                <>&nbsp;</>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
