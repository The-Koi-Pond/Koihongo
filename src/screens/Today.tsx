import { GraduationCap, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { kanaTally, levelStatus, levelUpToShow, markLevelSeen, type LevelStatus, type LevelUpNews, type Tally } from "../levels.ts";
import { lessonAllowance, reviewForecast, type Lesson, type TodaySummary } from "../srs/progress.ts";
import type { Screen } from "../ui/NavBar.tsx";
import { LevelCard, LevelUp } from "../ui/LevelCard.tsx";
import { rankTally, type Rank } from "../srs/ranks.ts";
import { CardTitle } from "../ui/CardTitle.tsx";
import { DONE_CAT, PanelCat, SLEEPY_CAT } from "../ui/CatArt.tsx";
import { BannerScene } from "../ui/Scene.tsx";
import { StatusBar } from "../ui/StatusBar.tsx";
import { useSharedCardPattern } from "../ui/useSharedCardPattern.ts";

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

type Flair = { mark: string; tone: "pink" | "gold" | "lilac" };

/** The greeting for the time of day, with a little flair after it (symbols DotGothic16 has, so they stay pixel art). */
function greeting(now: Date): { ja: string; en: string; flair: Flair[] } {
  const h = now.getHours();
  if (h >= 5 && h < 11)
    return { ja: "おはよう", en: "Good morning", flair: [{ mark: "♪", tone: "pink" }, { mark: "◆", tone: "lilac" }, { mark: "★", tone: "gold" }] };
  if (h >= 11 && h < 18)
    return { ja: "こんにちは", en: "Good afternoon", flair: [{ mark: "♥", tone: "pink" }, { mark: "◆", tone: "lilac" }, { mark: "★", tone: "gold" }] };
  return { ja: "こんばんは", en: "Good evening", flair: [{ mark: "★彡", tone: "gold" }, { mark: "♥", tone: "pink" }] };
}

/** The greeting in kana; the English shows on hover. */
function Greeting({ hello }: { hello: ReturnType<typeof greeting> }) {
  return (
    <p lang="ja" className="greeting-ja" title={hello.en}>
      {hello.ja}
      <span className="greeting-flair" aria-hidden="true">
        {hello.flair.map((f, i) => (
          <span key={i} className={f.tone}>
            {f.mark}
          </span>
        ))}
      </span>
    </p>
  );
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
  const [progress, setProgress] = useState<{ status: LevelStatus | null; kana: Tally | null; ranks: Record<Rank, number> }>();
  const [levelUp, setLevelUp] = useState<LevelUpNews | null>(null);
  const page = useRef<HTMLDivElement>(null);
  useSharedCardPattern(page, !!(summary && forecast && progress));

  useEffect(() => {
    reviewForecast(tauriDb, Date.now()).then(setForecast);
    Promise.all([levelStatus(tauriDb), kanaTally(tauriDb), rankTally(tauriDb)]).then(async ([status, kana, ranks]) => {
      setProgress({ status, kana, ranks });
      if (status) setLevelUp(await levelUpToShow(tauriDb, status.level));
    });
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
    <div className="fit-page today with-status-bar" ref={page}>
      <header className="banner bleed today-banner">
        <BannerScene />
        <div className="banner-top">
          <Greeting hello={hello} />
        </div>

        {levelUp && (
          <LevelUp
            news={levelUp}
            onDone={() => {
              markLevelSeen(tauriDb, levelUp.to);
              setLevelUp(null);
            }}
          />
        )}

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
            {reviews > 0 && (
              <button className="link-light" onClick={() => go("quick-reviews")}>
                Just 5 minutes
              </button>
            )}
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
          </div>
        </div>
      </header>

      <div className="today-tiles">
        <section className="card">
          <CardTitle icon={RotateCcw}>Reviews</CardTitle>
          <div className={`card-panel ${reviews === 0 ? "with-cat" : ""}`}>
            <div className="panel-main">
              <p className="tile-big">
                <span className="tile-num">{reviews}</span> <span className="tile-unit">{catchUp ? "left in today's share" : "due now"}</span>
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
            </div>
            {reviews === 0 && <PanelCat art={SLEEPY_CAT} />}
          </div>
        </section>

        <section className="card">
          <CardTitle icon={GraduationCap}>Lessons</CardTitle>
          <div className={`card-panel ${lessons === 0 ? "with-cat" : ""}`}>
            <div className="panel-main">
              <p className="tile-big">
                <span className="tile-num">{lessons}</span> <span className="tile-unit">new today</span>
              </p>
              <TrackPreview name="Kana" lessons={summary.lessons.filter((l) => l.track === "kana")} />
              <TrackPreview name="Kanji path" lessons={summary.lessons.filter((l) => l.track === "main")} />
              <p className="muted small">{lessonNote(summary)}</p>
            </div>
            {lessons === 0 && <PanelCat art={DONE_CAT} />}
          </div>
        </section>
      </div>

      {progress.status && <LevelCard status={progress.status} kana={progress.kana} ranks={progress.ranks} />}
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
  const page = useRef<HTMLDivElement>(null);
  useSharedCardPattern(page, true);
  return (
    <div className="fit-page today with-status-bar" aria-busy="true" ref={page}>
      <header className="banner bleed today-banner">
        <BannerScene />
        <div className="banner-top">
          <Greeting hello={hello} />
        </div>
        <div className="start-stack">
          <p className="start-rest placeholder">&nbsp;</p>
        </div>
      </header>
      <div className="today-tiles">
        <section className="card">
          <CardTitle icon={RotateCcw}>Reviews</CardTitle>
          <div className="card-panel">
            <p className="tile-big">&nbsp;</p>
            <p className="muted small">&nbsp;</p>
          </div>
        </section>
        <section className="card">
          <CardTitle icon={GraduationCap}>Lessons</CardTitle>
          <div className="card-panel">
            <p className="tile-big">&nbsp;</p>
            <p className="muted small">&nbsp;</p>
          </div>
        </section>
      </div>
      <LevelCard />
      <StatusBar />
    </div>
  );
}
