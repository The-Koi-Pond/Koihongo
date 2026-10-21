import { useId } from "react";
import type { LevelStatus, LevelUpNews, Tally } from "../levels.ts";
import { RANK_ORDER, type Rank } from "../srs/ranks.ts";
import { RankBadge } from "./RankBadge.tsx";

const REGION_NOTE = "Approximate: based on the pre-2010 JLPT lists. The JLPT no longer publishes official lists.";

/**
 * The Today screen's Progress card: your level, how close the next one is, and
 * this level's kanji, components and words (plus kana until they're all learned).
 * Without a status (while Today loads) it draws the same layout, blank.
 */
export function LevelCard({ status, kana, ranks }: { status?: LevelStatus; kana?: Tally | null; ranks?: Record<Rank, number> }) {
  if (!status) {
    return (
      <section className="card level-card" aria-busy="true">
        <div className="level-main">
          <div className="level-head">
            <h2 className="tile-title">Progress</h2>
            <div className="level-badge">
              <span className="level-lv">LV</span>
              <span className="level-num">&nbsp;</span>
            </div>
          </div>
          <ul className="progress-rows">
            <GaugeRow label="KNJI" name="Kanji in this level" tally={{ passed: 0, learning: 0, total: 0 }} />
            <GaugeRow label="WORD" name="Words in this level" tally={{ passed: 0, learning: 0, total: 0 }} />
          </ul>
        </div>
        <ProgressArt />
      </section>
    );
  }
  const toGo = Math.max(0, status.kanji.needed - status.kanji.passed);
  return (
    <section className="card level-card">
      <div className="level-main">
        <div className="level-head">
          <h2 className="tile-title">Progress</h2>
          <div className="level-badge" aria-label={`Level ${status.level}`}>
            <span className="level-lv">LV</span>
            <span className="level-num">{status.level}</span>
          </div>
          <p className="level-info">
            <span>
              <span className="region-chip" title={REGION_NOTE}>
                {status.region}
              </span>{" "}
              region · level <span className="num">{status.regionLevel}</span> of <span className="num">{status.regionLevels}</span>
            </span>
            <span className="level-next">
              {status.complete ? "Every level cleared!" : `${toGo} more kanji to level up`}
            </span>
          </p>
          <RegionPips current={status.regionLevel} total={status.regionLevels} />
        </div>
        <ul className="progress-rows">
          <GaugeRow label="KNJI" name="Kanji in this level" tally={status.kanji} goal={status.kanji.needed} />
          {status.components.total > 0 && <GaugeRow label="PART" name="Components in this level" tally={status.components} />}
          {status.words.total > 0 && <GaugeRow label="WORD" name="Words in this level" tally={status.words} />}
          {kana && <GaugeRow label="KANA" name="Kana (until you've learned them all)" tally={kana} />}
        </ul>
        {ranks && RANK_ORDER.some((r) => ranks[r] > 0) && (
          <p className="rank-tally" aria-label="Items by rank">
            {[...RANK_ORDER].reverse().map((r) => (
              <span key={r} className={ranks[r] ? "" : "none"}>
                <RankBadge rank={r} /> <span className="num">{ranks[r]}</span>
              </span>
            ))}
          </p>
        )}
      </div>
      <ProgressArt />
    </section>
  );
}

/** Braille text art: a koi (鯉) seen from above, swimming through ripples. */
const KOI_ART = `⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⢤⢶⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣀⢀⠄⠀⠀⠀⢀⣀⣀⣀⣠⢞⢕⢕⢵⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⢠⠔⠉⢈⠤⠔⠐⡲⠦⣪⣥⣆⠂⠂⠋⣓⣳⣋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠁⠀⡞⠁⠀⠀⢸⡁⣽⣿⣿⣿⡇⣁⣿⣿⣿⣿⣷⡢⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢔⠁⠉⠈⡆⠀⠀
⣄⠀⠳⣀⠀⠀⠀⠑⢪⠟⠿⠟⠅⠌⢿⣿⣿⣿⡿⠄⠌⠦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠉⠈⠀⠀⠀
⠀⠑⠢⢄⡉⡑⠒⠂⠒⠑⠢⢆⣂⣂⠂⠋⠛⣿⣿⣿⣦⠂⠓⢖⢖⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠈⠁⠀⠀⠀⠀⠸⣕⢕⢽⠑⠛⠿⣿⣿⡿⡁⣁⣩⣯⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢗⢕⢕⠇⠀⠀⠀⣟⢦⡄⢾⣿⣿⢧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠓⠁⠀⠀⠀⠀⠑⠛⠈⠑⢎⠃⠊⢆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠣⡁⡙⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣟⢖⢗⢕⢕⢦⢄⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢕⢕⢕⢕⢕⢕⢕⢕⢦⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡊⢈⢢⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢕⢕⢕⡕⠓⠓⠓⠓⠓⠛⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⢕⡵⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⠋⠀⠀⠀⠀⡎⠀⠀⠀⠀⠀⠀⠈⡆⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠒⠤⠄⠤⠤⠠⠊⠀⠀`;

/** Which dot each bit of a braille character stands for: [row, column] in its 4×2 cell. */
const BRAILLE_DOTS: [row: number, col: number][] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [3, 0], [3, 1]];

/**
 * Text art for the card's right side. The art is stored as braille text, but
 * drawn dot by dot: Windows fonts give blank braille cells a different width,
 * which would skew the picture. Decoration only; it hides when the window is small.
 */
function ProgressArt() {
  const fade = useId();
  const lines = KOI_ART.split("\n");
  const dots: [number, number][] = [];
  lines.forEach((line, cy) =>
    [...line].forEach((ch, cx) => {
      const bits = ch.codePointAt(0)! - 0x2800;
      BRAILLE_DOTS.forEach(([r, c], i) => bits & (1 << i) && dots.push([cx * 2 + c, cy * 4 + r]));
    }),
  );
  return (
    <aside className="level-art" aria-hidden="true">
      <svg className="braille-art" viewBox={`0 0 ${lines[0].length * 2} ${lines.length * 4}`}>
        <defs>
          <linearGradient id={fade} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd6ee" />
            <stop offset="1" stopColor="#b9b7f0" />
          </linearGradient>
        </defs>
        <g fill={`url(#${fade})`}>
          {dots.map(([x, y]) => (
            <circle key={`${x},${y}`} cx={x + 0.5} cy={y + 0.5} r={0.36} />
          ))}
        </g>
      </svg>
    </aside>
  );
}

/** Regions up to this many levels get one pip per level; longer ones (N3–N1) a thin bar. */
const MAX_PIPS = 24;

/** One pip per level in the region: filled behind you, glowing where you are. */
function RegionPips({ current, total }: { current: number; total: number }) {
  if (total > MAX_PIPS) {
    return (
      <div className="region-bar" role="img" aria-label={`Level ${current} of ${total} in this region`}>
        <div style={{ width: `${((current - 1) / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <ol className="region-pips" aria-label={`Level ${current} of ${total} in this region`}>
      {Array.from({ length: total }, (_, i) => (
        <li key={i} className={i + 1 < current ? "done" : i + 1 === current ? "here" : ""} />
      ))}
    </ol>
  );
}

/** A JRPG stat gauge; `goal` draws a tick where the level is cleared. */
function GaugeRow({ label, name, tally, goal }: { label: string; name: string; tally: Tally; goal?: number }) {
  const pct = (n: number) => (tally.total ? (n / tally.total) * 100 : 0);
  const detail = `${tally.passed} passed, ${tally.learning} learning, of ${tally.total}`;
  return (
    <li>
      <span className="stat-label" title={name} aria-label={name}>
        {[...label].map((ch, i) => (
          <span key={i} aria-hidden="true">
            {ch}
          </span>
        ))}
      </span>
      <div className="progress-track" title={detail}>
        {tally.passed > 0 && <div className="progress-fill passed" style={{ width: `${pct(tally.passed)}%` }} />}
        {tally.learning > 0 && <div className="progress-fill learning" style={{ width: `${pct(tally.learning)}%` }} />}
        {goal !== undefined && goal < tally.total && <div className="gauge-goal" style={{ left: `${pct(goal)}%` }} title="Level up here" />}
      </div>
      {/* How much of the gauge is lit, rounded down so 100% means really all; exact counts are in the tooltip. */}
      <span className="progress-count" title={tally.total ? detail : undefined}>
        {tally.total ? `${Math.floor(pct(tally.passed + tally.learning))}%` : " "}
      </span>
    </li>
  );
}

/**
 * The level-up moment, over the Today banner. Shown once per new level (a new
 * region gets its own line); click or press a key to continue.
 */
export function LevelUp({ news, onDone }: { news: LevelUpNews; onDone: () => void }) {
  return (
    <button type="button" className="level-up" onClick={onDone} autoFocus aria-label={`Level up! You're now level ${news.to}. Click to continue.`}>
      <span className="level-up-sparkles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} style={{ "--i": i } as React.CSSProperties} />
        ))}
      </span>
      <span className="level-up-title">LEVEL UP!</span>
      <span className="level-up-level">
        LV&nbsp;&nbsp;<span className="num">{news.from}</span> ▸ <span className="num">{news.to}</span>
      </span>
      {news.newRegion && <span className="level-up-region">Welcome to the {news.newRegion} region</span>}
      <span className="level-up-hint">click to continue</span>
    </button>
  );
}
