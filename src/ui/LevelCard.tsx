import { ChartNoAxesColumnIncreasing } from "lucide-react";
import type { LevelStatus, LevelUpNews, Tally } from "../levels.ts";
import { RANK_ORDER, type Rank } from "../srs/ranks.ts";
import { CardTitle } from "./CardTitle.tsx";
import { GANBARU_CAT, KaomojiArt } from "./CatArt.tsx";
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
        <CardTitle icon={ChartNoAxesColumnIncreasing}>Progress</CardTitle>
        <div className="card-panel level-panel">
          <div className="level-main">
            <div className="level-head">
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
        </div>
      </section>
    );
  }
  const toGo = Math.max(0, status.kanji.needed - status.kanji.passed);
  return (
    <section className="card level-card">
      <CardTitle icon={ChartNoAxesColumnIncreasing}>Progress</CardTitle>
      <div className="card-panel level-panel">
        <div className="level-main">
          <div className="level-head">
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
            // A stat row like the gauges above: the label, then the ranks where the bars start.
            <div className="rank-tally">
              <StatLabel label="RANK" name="Items by rank" />
              <p aria-label="Items by rank">
                {[...RANK_ORDER].reverse().map((r) => (
                  <span key={r} className={ranks[r] ? "" : "none"}>
                    <RankBadge rank={r} /> <span className="num">{ranks[r]}</span>
                  </span>
                ))}
              </p>
            </div>
          )}
        </div>
        <ProgressArt />
      </div>
    </section>
  );
}

/** Text art for the card's right side. Decoration only; it hides when the window is small. */
function ProgressArt() {
  return (
    <aside className="level-art" aria-hidden="true">
      {/* A dotted heart for the cat to sit in. */}
      <svg className="kaomoji-heart-frame" viewBox="0 0 100 90">
        <path d="M50 84 C20 62 4 44 4 26 C4 12 15 4 27 4 C37 4 45 10 50 18 C55 10 63 4 73 4 C85 4 96 12 96 26 C96 44 80 62 50 84 Z" />
      </svg>
      {/* A cat peeking over a がんばる ("I'll do my best") sign. */}
      <KaomojiArt art={GANBARU_CAT} />
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
/** JRPG stat label: pixel caps, one fixed-width cell per letter, so every row's label is the same width. */
function StatLabel({ label, name }: { label: string; name: string }) {
  return (
    <span className="stat-label" title={name} aria-label={name}>
      {[...label].map((ch, i) => (
        <span key={i} aria-hidden="true">
          {ch}
        </span>
      ))}
    </span>
  );
}

function GaugeRow({ label, name, tally, goal }: { label: string; name: string; tally: Tally; goal?: number }) {
  const pct = (n: number) => (tally.total ? (n / tally.total) * 100 : 0);
  const detail = `${tally.passed} passed, ${tally.learning} learning, of ${tally.total}`;
  return (
    <li>
      <StatLabel label={label} name={name} />
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
