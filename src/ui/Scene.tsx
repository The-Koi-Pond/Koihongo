// The night scene behind banners (Today and item pages).
//
// Visual rule: scenery FRAMES the hero area (greeting, Start, the big character)
// and never sits behind it. Hills and trees are Xel's pixel art along the
// bottom; the moon sits in the top-right corner and the blossoms top-left, so
// the centre stays clear at any window size. The sky itself is the .banner
// background in CSS (Xel's sky.png).

import { useId } from "react";
import hills from "../assets/scenery/hills.png";
import bushesLeft from "../assets/scenery/newTreesLeft.png";
import bushesRight from "../assets/scenery/newTreesRight.png";
import treelineFront from "../assets/scenery/treeline-front.png";

/** Everything decorative in a banner: stars, side sparkles, the moon, hills, trees, blossoms. */
export function BannerScene() {
  return (
    <>
      <div className="banner-deco banner-stars" aria-hidden="true" />
      <SideScenery side="left" />
      <SideScenery side="right" />
      <Moon />
      <div className="banner-deco banner-hills" style={{ backgroundImage: `url(${hills})` }} aria-hidden="true" />
      <Treeline />
      <div className="banner-deco banner-bushes left" style={{ backgroundImage: `url(${bushesLeft})` }} aria-hidden="true" />
      <div className="banner-deco banner-bushes right" style={{ backgroundImage: `url(${bushesRight})` }} aria-hidden="true" />
      <BlossomBranch />
    </>
  );
}

/** A small four-point sparkle centred on (x, y). */
function Sparkle({ x, y, size = 2 }: { x: number; y: number; size?: number }) {
  return (
    <g fill="#fff3c4">
      <rect x={x} y={y - size} width="1" height={size * 2 + 1}></rect>
      <rect x={x - size} y={y} width={size * 2 + 1} height="1"></rect>
    </g>
  );
}

/** Sky details for one side: a shooting star on the left, sparkles on both. */
function SideScenery({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  return (
    <svg
      className={`banner-deco banner-side ${side}`}
      viewBox="0 0 240 160"
      preserveAspectRatio={left ? "xMinYMax meet" : "xMaxYMax meet"}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {left ? (
        <>
          {/* Shooting star */}
          <g fill="#ffffff">
            <rect x="150" y="18" width="3" height="1"></rect>
            <rect x="144" y="21" width="4" height="1" opacity="0.7"></rect>
            <rect x="137" y="24" width="4" height="1" opacity="0.45"></rect>
            <rect x="130" y="27" width="4" height="1" opacity="0.25"></rect>
          </g>
          <Sparkle x={196} y={44} />
          <Sparkle x={40} y={58} size={1} />
        </>
      ) : (
        <>
          <Sparkle x={150} y={22} />
          <Sparkle x={222} y={70} size={1} />
        </>
      )}
    </svg>
  );
}

/** The crescent moon with a faint glow, pinned to the banner's top-right corner (CSS). */
function Moon() {
  const mask = useId().replace(/:/g, "");
  return (
    <svg className="banner-deco banner-moon" viewBox="0 0 48 48" aria-hidden="true">
      <defs>
        <mask id={mask}>
          <rect width="48" height="48" fill="#fff"></rect>
          <circle cx="14" cy="20" r="12" fill="#000"></circle>
        </mask>
      </defs>
      <circle cx="24" cy="24" r="20" fill="#ffe08a" opacity="0.07"></circle>
      <circle cx="24" cy="24" r="13" fill="#ffe08a" mask={`url(#${mask})`}></circle>
    </svg>
  );
}

/**
 * Xel's pixel-art treeline along the whole bottom edge, joining the two bush
 * corners. Its shape is used as a stencil painted in the page colour, so the
 * banner melts into the page below whatever that colour is.
 */
function Treeline() {
  return <div className="banner-deco banner-treeline" style={{ maskImage: `url(${treelineFront})` }} aria-hidden="true" />;
}

// Blossom clusters: [x, y, size] along the top-left branch.
const BLOSSOMS: [number, number, number][] = [
  [30, 58, 9], [52, 46, 7], [70, 66, 10], [92, 58, 7], [110, 84, 9], [128, 100, 7], [46, 84, 6], [16, 92, 7],
];
const BRANCHES = ["M-10 36 Q 40 48 72 66 T 136 104", "M40 52 Q 54 74 44 96", "M86 72 Q 104 70 112 86"];

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

/** A cherry-blossom branch reaching in from the top-left corner. */
function BlossomBranch() {
  return (
    <svg className="banner-deco banner-branch left" viewBox="-10 20 160 110" preserveAspectRatio="xMinYMin meet" aria-hidden="true">
      <g className="branches">
        {BRANCHES.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
      {BLOSSOMS.map(([x, y, size], i) => (
        <Blossom key={i} x={x} y={y} size={size} />
      ))}
    </svg>
  );
}
