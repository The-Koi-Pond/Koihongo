import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  BookA,
  BookOpenText,
  GraduationCap,
  House,
  LibraryBig,
  Maximize2,
  Minimize2,
  Minus,
  Puzzle,
  RotateCcw,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
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

const SECTIONS: { screen: Screen; icon: LucideIcon; ja: string; en: string; short?: string; soon?: boolean }[] = [
  { screen: "today", icon: House, ja: "今日", en: "Today" },
  { screen: "library", icon: LibraryBig, ja: "図書館", en: "Library" },
  { screen: "dictionary", icon: BookA, ja: "辞書", en: "Dictionary", short: "Dict", soon: true },
  { screen: "grammar", icon: Puzzle, ja: "文法", en: "Grammar", soon: true },
  { screen: "reading", icon: BookOpenText, ja: "読書", en: "Reading", soon: true },
];

const ICON = { size: 19, strokeWidth: 1.75 };

/**
 * The app's title bar (the window has no Windows frame): drag empty space to
 * move, double-click to maximise. Navigation is locked during lessons/reviews
 * so a stray click can't end a session; window controls always work.
 */
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
  const navTitle = (label: string) => (locked ? "Finish or stop the session first" : label);

  return (
    <header className="titlebar" data-tauri-drag-region>
      <button className="brand" onClick={() => go("today")} disabled={locked} title={navTitle("Koihongo")}>
        <span lang="ja" className="brand-mark">
          鯉
        </span>
      </button>

      <nav className={`nav-group ${locked ? "locked" : ""}`} aria-label="Main" data-tauri-drag-region>
        {SECTIONS.map(({ screen: s, icon: Icon, ja, en, short, soon }) => (
          <button
            key={s}
            className={`nav-tab ${screen === s ? "current" : ""}`}
            aria-current={screen === s ? "page" : undefined}
            aria-label={en}
            title={navTitle(`${ja} ${en}${soon ? " (coming soon)" : ""}`)}
            onClick={() => go(s)}
            disabled={locked}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span className="nav-tab-label">{short ?? en}</span>
            {soon && <span className="soon-dot" />}
          </button>
        ))}
      </nav>

      <div className="titlebar-space" data-tauri-drag-region />

      <div className={`nav-group ${locked ? "locked" : ""}`} data-tauri-drag-region>
        <CountButton icon={RotateCcw} label="Reviews" count={summary?.reviewsDue} onClick={() => go("reviews")} locked={locked} />
        <CountButton icon={GraduationCap} label="Lessons" count={summary?.lessons.length} onClick={() => go("lessons")} locked={locked} />
        <button
          className={`icon-btn ${screen === "settings" || screen === "sources" ? "current" : ""}`}
          aria-label="Settings"
          title={navTitle("設定 Settings")}
          onClick={() => go("settings")}
          disabled={locked}
        >
          <Settings {...ICON} />
        </button>
      </div>

      <span className="divider" />
      <WindowControls />
    </header>
  );
}

function CountButton({
  icon: Icon,
  label,
  count,
  onClick,
  locked,
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  onClick: () => void;
  locked: boolean;
}) {
  const empty = !count;
  return (
    <button
      className="icon-btn"
      aria-label={`${label}: ${count ?? 0}`}
      title={locked ? "Finish or stop the session first" : `${label}: ${count ?? 0}${empty ? "" : " (click to start)"}`}
      onClick={onClick}
      disabled={locked || empty}
    >
      <Icon {...ICON} />
      {!empty && <span className="badge">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const win = getCurrentWindow();
    win.isMaximized().then(setMaximized);
    const unlisten = win.onResized(() => win.isMaximized().then(setMaximized));
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const win = getCurrentWindow();
  return (
    <div className="window-controls">
      <button className="icon-btn win-min" aria-label="Minimise" title="Minimise" onClick={() => win.minimize()}>
        <Minus {...ICON} />
      </button>
      <button
        className="icon-btn win-max"
        aria-label={maximized ? "Restore" : "Maximise"}
        title={maximized ? "Restore" : "Maximise"}
        onClick={() => win.toggleMaximize()}
      >
        {maximized ? <Minimize2 {...ICON} /> : <Maximize2 {...ICON} />}
      </button>
      <button className="icon-btn win-close" aria-label="Close" title="Close" onClick={() => win.close()}>
        <X {...ICON} />
      </button>
    </div>
  );
}
