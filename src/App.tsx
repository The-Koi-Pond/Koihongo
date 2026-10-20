import { useEffect, useState } from "react";
import { migrate } from "./db/migrations.ts";
import { tauriDb } from "./db/tauriDb.ts";
import { Lessons } from "./screens/Lessons.tsx";
import { Reviews } from "./screens/Reviews.tsx";
import { Sources } from "./screens/Sources.tsx";
import { Today } from "./screens/Today.tsx";
import "./App.css";

// Shared so React's double-run of effects in dev can't migrate twice at once.
let dbReady: Promise<void> | undefined;
const openDb = () => (dbReady ??= migrate(tauriDb));

type Screen = "today" | "lessons" | "reviews" | "quick-reviews" | "sources";

function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string>();
  const [screen, setScreen] = useState<Screen>("today");
  const home = () => setScreen("today");

  useEffect(() => {
    openDb()
      .then(() => setReady(true))
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <main className="app">
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
      ) : screen === "sources" ? (
        <Sources onExit={home} />
      ) : (
        <Today go={setScreen} />
      )}
    </main>
  );
}

export default App;
