// The dusk landscape behind banners (item pages and Today): sky tinted by the
// --kind CSS variable, sun, mountain ridges, and blossom branches in the corners.

import { useId } from "react";

// Blossom clusters: [x, y, size] along the two corner branches.
const BLOSSOMS: [number, number, number][] = [
  [30, 58, 9], [52, 46, 7], [70, 66, 10], [92, 58, 7], [110, 84, 9], [128, 100, 7], [46, 84, 6], [16, 92, 7],
  [770, 58, 9], [748, 44, 7], [726, 70, 10], [752, 86, 7], [706, 96, 8], [784, 104, 6], [732, 116, 6],
];

/** A five-petal blossom. */
function Blossom({ x, y, size }: { x: number; y: number; size: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {[0, 72, 144, 216, 288].map((angle) => (
        <circle key={angle} cx={0} cy={-size * 0.55} r={size * 0.5} transform={`rotate(${angle})`} className="petal" />
      ))}
      <circle r={size * 0.22} className="blossom-centre" />
    </g>
  );
}

/**
 * Dusk landscape behind the character: sky in the item's kind colour, a low
 * sun, three mountain ridges and two blossom branches. Pure SVG, tinted via
 * the --kind CSS variable, so it needs no image files.
 */
export function BannerScene() {
  // Unique gradient ids, in case two banners are ever on screen at once.
  const id = useId().replace(/:/g, "");
  return (
    <svg className="banner-scene" viewBox="0 0 800 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "color-mix(in srgb, var(--kind) 45%, #120a1c)" }} />
          <stop offset="0.75" style={{ stopColor: "var(--kind)" }} />
          <stop offset="1" style={{ stopColor: "color-mix(in srgb, var(--kind) 70%, #ffd9a8)" }} />
        </linearGradient>
        <radialGradient id={`${id}-sun`}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#ffe3c4" stopOpacity="0.25" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="300" fill={`url(#${id}-sky)`} />
      <circle cx="400" cy="215" r="150" fill={`url(#${id}-sun)`} />
      <path d="M0 205 L80 172 L150 190 L240 140 L320 182 L400 158 L480 186 L570 132 L660 176 L740 150 L800 170 L800 300 L0 300Z" fill="#000" opacity="0.16" />
      <path d="M0 236 L110 200 L210 222 L300 196 L370 160 L400 150 L430 160 L500 196 L600 222 L700 198 L800 228 L800 300 L0 300Z" fill="#000" opacity="0.26" />
      <path d="M0 268 Q 140 240 290 262 T 560 255 T 800 264 L800 300 L0 300Z" fill="#000" opacity="0.38" />
    </svg>
  );
}

const LEFT_BRANCHES = ["M-10 36 Q 40 48 72 66 T 136 104", "M40 52 Q 54 74 44 96", "M86 72 Q 104 70 112 86"];
const RIGHT_BRANCHES = ["M812 30 Q 770 52 742 74 T 700 102", "M752 66 Q 760 88 778 104"];

/**
 * A blossom branch pinned to one side of the banner. Separate from the
 * landscape so it keeps a sensible size and stays in frame at any banner size.
 */
export function CornerBranch({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <svg
      className={`banner-branch ${side}`}
      viewBox={left ? "-10 20 160 110" : "650 20 160 110"}
      preserveAspectRatio={left ? "xMinYMin meet" : "xMaxYMin meet"}
      aria-hidden="true"
    >
      <g className="branches">
        {(left ? LEFT_BRANCHES : RIGHT_BRANCHES).map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {BLOSSOMS.filter(([x]) => (x < 400) === left).map(([x, y, size], i) => (
        <Blossom key={i} x={x} y={y} size={size} />
      ))}
    </svg>
  );
}
