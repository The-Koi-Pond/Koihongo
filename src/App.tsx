import { useEffect, useState } from "react";
import { migrate } from "./db/migrations.ts";
import { tauriDb } from "./db/tauriDb.ts";
import { ComingSoon } from "./screens/ComingSoon.tsx";
import { Lessons } from "./screens/Lessons.tsx";
import { Library } from "./screens/Library.tsx";
import { Reviews } from "./screens/Reviews.tsx";
import { Sources } from "./screens/Sources.tsx";
import { Today } from "./screens/Today.tsx";
import { todaySummary, type TodaySummary } from "./srs/progress.ts";
import { NavBar, type Screen } from "./ui/NavBar.tsx";
import "./App.css";

// Shared so React's double-run of effects in dev can't migrate twice at once.
let dbReady: Promise<void> | undefined;
const openDb = () => (dbReady ??= migrate(tauriDb));

const SESSIONS: Screen[] = ["lessons", "reviews", "quick-reviews"];
/** Screens that use the full width (item pages, the library grid). */
const WIDE: Screen[] = [...SESSIONS, "library"];

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [screen, setScreen] = useState<Screen>("today");
  const [summary, setSummary] = useState<TodaySummary>();
  const home = () => setScreen("today");

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
      <NavBar screen={screen} go={setScreen} summary={summary} locked={SESSIONS.includes(screen)} />
      <main className={`app ${WIDE.includes(screen) ? "wide" : ""}`}>
        {error ? (
          <p className="error">Couldn't open your progress database: {error}</p>
        ) : !ready ? (
          <p className="muted">Loading…</p>
        ) : screen === "lessons" ? (
          <Lessons onExit={home} />
        ) : screen === "reviews" ? (
          <Reviews onExit={home} />
        ) : screen === "quick-reviews" ? (
          <Reviews minutes={5} onExit={home} />
        ) : screen === "library" ? (
          <Library />
        ) : screen === "dictionary" || screen === "grammar" || screen === "reading" ? (
          <ComingSoon section={screen} />
        ) : screen === "settings" ? (
          <ComingSoon
            section="settings"
            extra={
              <section className="card row space-between">
                <div>
                  <h2>Sources &amp; licences</h2>
                  <p className="muted">Credits for the dictionary, kanji and sentence data.</p>
                </div>
                <button onClick={() => setScreen("sources")}>Open</button>
              </section>
            }
          />
        ) : screen === "sources" ? (
          <Sources onExit={() => setScreen("settings")} />
        ) : (
          <Today summary={summary} go={setScreen} />
        )}
      </main>
    </>
  );
}

export default App;
