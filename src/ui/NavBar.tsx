import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  BookA,
  BookOpenText,
  GraduationCap,
  House,
  Keyboard,
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
import logo from "../assets/ui/koihongo-title.png";
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
  | "quick-reviews"
  | "extra-reviews";

const SECTIONS: { screen: Screen; icon: LucideIcon; ja: string; en: string; short?: string; soon?: boolean }[] = [
  { screen: "today", icon: House, ja: "今日", en: "Today" },
  { screen: "library", icon: LibraryBig, ja: "図書館", en: "Library" },
  { screen: "dictionary", icon: BookA, ja: "辞書", en: "Dictionary", short: "Dict" },
  { screen: "grammar", icon: Puzzle, ja: "文法", en: "Grammar", soon: true },
  { screen: "reading", icon: BookOpenText, ja: "読書", en: "Reading", soon: true },
];

const ICON = { size: 19, strokeWidth: 1.75 };

/**
 * The app's title bar (the window has no Windows frame): drag empty space to
 * move, double-click to maximise. It always works, even mid-session: reviews
 * save each answer as it's given, and a lesson round only counts once its quiz
 * is done, so leaving early loses nothing (the round just comes back).
 */
export function NavBar({
  screen,
  go,
  summary,
  keyboardOpen,
  onToggleKeyboard,
}: {
  screen: Screen;
  go: (s: Screen) => void;
  summary?: TodaySummary;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}) {
  return (
    <header className="titlebar" data-tauri-drag-region>
      <button className="brand" onClick={() => go("today")} title="Koihongo">
        <img className="brand-logo" src={logo} alt="Koihongo" width={73} height={30} />
      </button>

      <nav className="nav-group" aria-label="Main" data-tauri-drag-region>
        {SECTIONS.map(({ screen: s, icon: Icon, ja, en, short, soon }) => (
          <button
            key={s}
            className={`nav-tab ${screen === s ? "current" : ""}`}
            aria-current={screen === s ? "page" : undefined}
            aria-label={en}
            title={`${ja} ${en}${soon ? " (coming soon)" : ""}`}
            onClick={() => go(s)}
          >
            <Icon size={16} strokeWidth={2} aria-hidden="true" />
            <span className="nav-tab-label">{short ?? en}</span>
            {soon && <span className="soon-dot" />}
          </button>
        ))}
      </nav>

      <div className="titlebar-space" data-tauri-drag-region />

      <div className="nav-group" data-tauri-drag-region>
        <CountButton icon={RotateCcw} label="Reviews" count={summary?.reviewsToday} onClick={() => go("reviews")} />
        <CountButton icon={GraduationCap} label="Lessons" count={summary?.lessons.length} onClick={() => go("lessons")} />
        {/* Keeps the focus where it is (onMouseDown), so you can open it mid-answer. */}
        <button
          className={`icon-btn ${keyboardOpen ? "current" : ""}`}
          aria-label="Kana keyboard"
          aria-pressed={keyboardOpen}
          title="かな Kana keyboard"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onToggleKeyboard}
        >
          <Keyboard {...ICON} />
        </button>
        <button
          className={`icon-btn ${screen === "settings" || screen === "sources" ? "current" : ""}`}
          aria-label="Settings"
          title="設定 Settings"
          onClick={() => go("settings")}
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
}: {
  icon: LucideIcon;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  const empty = !count;
  return (
    <button
      className="icon-btn"
      aria-label={`${label}: ${count ?? 0}`}
      title={`${label}: ${count ?? 0}${empty ? "" : " (click to start)"}`}
      onClick={onClick}
      disabled={empty}
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
