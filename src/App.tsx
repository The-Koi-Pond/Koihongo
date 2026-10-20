import { useEffect, useState } from "react";
import { autoBackupIfDue } from "./backup.ts";
import { migrate } from "./db/migrations.ts";
import { tauriDb } from "./db/tauriDb.ts";
import { ComingSoon } from "./screens/ComingSoon.tsx";
import { Dictionary } from "./screens/Dictionary.tsx";
import { Lessons } from "./screens/Lessons.tsx";
import { Library } from "./screens/Library.tsx";
import { Reviews } from "./screens/Reviews.tsx";
import { Settings } from "./screens/Settings.tsx";
import { Sources } from "./screens/Sources.tsx";
import { Today, type StudyOrder } from "./screens/Today.tsx";
import { todaySummary, type TodaySummary } from "./srs/progress.ts";
import { NavBar, type Screen } from "./ui/NavBar.tsx";
import "./App.css";

// Shared so React's double-run of effects in dev can't migrate (or back up) twice at once.
let dbReady: Promise<void> | undefined;
const openDb = () =>
  (dbReady ??= migrate(tauriDb).then(() => {
    // In the background; a failure shows up as a missing backup in Settings, not a broken app.
    autoBackupIfDue().catch((e) => console.warn("Automatic backup failed:", e));
  }));

const SESSIONS: Screen[] = ["lessons", "reviews", "quick-reviews"];
/** Screens that use the full width (item pages, the library grid). */
const WIDE: Screen[] = [...SESSIONS, "library", "dictionary", "today"];

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [screen, setScreen] = useState<Screen>("today");
  const [summary, setSummary] = useState<TodaySummary>();
  // Screens still to come in a "Start" study session (e.g. lessons after reviews).
  const [chain, setChain] = useState<Screen[]>([]);

  // Leaving a screen continues the study session, or goes home.
  const next = () => {
    const [following, ...rest] = chain;
    setChain(rest);
    setScreen(following ?? "today");
  };
  const navigate = (s: Screen) => {
    setChain([]);
    setScreen(s);
  };
  const startStudy = (order: StudyOrder) => {
    const parts: Screen[] = [];
    if (summary?.reviewsDue) parts.push("reviews");
    if (summary?.lessons.length) parts.push("lessons");
    if (order === "lessons") parts.reverse();
    if (parts.length === 0) return;
    setScreen(parts[0]);
    setChain(parts.slice(1));
  };
  const exitLabel = chain[0] === "lessons" ? "Continue to lessons →" : chain[0] === "reviews" ? "Continue to reviews →" : undefined;

  useEffect(() => {
    openDb()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  // Fresh counts for the nav bar and Today whenever the screen changes (e.g. after a session).
  useEffect(() => {
    if (!ready) return;
    todaySummary(tauriDb, Date.now())
      .then(setSummary)
      .catch((e) => setError(String(e)));
  }, [ready, screen]);

  return (
    <>
      <NavBar screen={screen} go={navigate} summary={summary} locked={SESSIONS.includes(screen)} />
      <main className={`app ${WIDE.includes(screen) ? "wide" : ""}`}>
        {error ? (
          <p className="error">Couldn't open your progress database: {error}</p>
        ) : !ready ? (
          <p className="muted">Loading…</p>
        ) : screen === "lessons" ? (
          <Lessons onExit={next} exitLabel={exitLabel} />
        ) : screen === "reviews" ? (
          <Reviews onExit={next} exitLabel={exitLabel} />
        ) : screen === "quick-reviews" ? (
          <Reviews minutes={5} onExit={next} />
        ) : screen === "library" ? (
          <Library />
        ) : screen === "dictionary" ? (
          <Dictionary />
        ) : screen === "grammar" || screen === "reading" ? (
          <ComingSoon section={screen} />
        ) : screen === "settings" ? (
          <Settings onOpenSources={() => setScreen("sources")} />
        ) : screen === "sources" ? (
          <Sources onExit={() => setScreen("settings")} />
        ) : (
          <Today summary={summary} go={navigate} onStart={startStudy} />
        )}
      </main>
    </>
  );
}

export default App;
