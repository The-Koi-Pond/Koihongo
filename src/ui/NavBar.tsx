import type { TodaySummary } from "../srs/progress.ts";

export type Screen =
  | "today"
  | "library"
  | "dictionary"
  | "grammar"
  | "reading"
  | "settings"
  | "sources"
  | "lessons"
  | "reviews"
  | "quick-reviews";

const SECTIONS: { screen: Screen; ja: string; en: string; soon?: boolean }[] = [
  { screen: "today", ja: "今日", en: "Today" },
  { screen: "library", ja: "図書館", en: "Library" },
  { screen: "dictionary", ja: "辞書", en: "Dictionary", soon: true },
  { screen: "grammar", ja: "文法", en: "Grammar", soon: true },
  { screen: "reading", ja: "読書", en: "Reading", soon: true },
];

/** Top bar. Locked during lessons/reviews, so a stray click can't end a session. */
export function NavBar({
  screen,
  go,
  summary,
  locked,
}: {
  screen: Screen;
  go: (s: Screen) => void;
  summary?: TodaySummary;
  locked: boolean;
}) {
  return (
    <header className={`navbar ${locked ? "locked" : ""}`} title={locked ? "Finish or stop the session to use the menu" : undefined}>
      <nav className="navbar-inner" aria-label="Main">
        <button className="brand" onClick={() => go("today")} disabled={locked}>
          <span lang="ja" className="brand-mark">
            鯉
          </span>
          Koihongo
        </button>

        <ul className="nav-sections">
          {SECTIONS.map((s) => (
            <li key={s.screen}>
              <button
                className={`nav-item ${screen === s.screen ? "current" : ""}`}
                aria-current={screen === s.screen ? "page" : undefined}
                onClick={() => go(s.screen)}
                disabled={locked}
              >
                <span lang="ja" className="nav-ja">
                  {s.ja}
                </span>
                <span className="nav-en">
                  {s.en}
                  {s.soon && <span className="soon">soon</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="nav-actions">
          <button className="nav-count" onClick={() => go("reviews")} disabled={locked || !summary?.reviewsDue}>
            Reviews <span className="count">{summary?.reviewsDue ?? "–"}</span>
          </button>
          <button className="nav-count" onClick={() => go("lessons")} disabled={locked || !summary?.lessons.length}>
            Lessons <span className="count">{summary?.lessons.length ?? "–"}</span>
          </button>
          <button
            className={`nav-icon ${screen === "settings" || screen === "sources" ? "current" : ""}`}
            onClick={() => go("settings")}
            disabled={locked}
            aria-label="Settings"
            title="Settings"
          >
            ⚙
          </button>
        </div>
      </nav>
    </header>
  );
}
