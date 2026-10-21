// The night scene behind banners (Today and item pages).
//
// Visual rule: scenery FRAMES the hero area (greeting, Start, the big character)
// and never sits behind it. Mountains, moon and blossoms are separate pieces
// pinned to the left and right edges, each capped in width, so the centre stays
// clear at any window size. The sky itself is the .banner background in CSS,
// with the horizon tinted by the item's --kind colour.

import { useId } from "react";
import treelineFront from "../assets/scenery/treeline-front.png";

/** Everything decorative in a banner: stars, both side sceneries, low ridges, blossoms. */
export function BannerScene() {
  return (
    <>
      <div className="banner-deco banner-stars" aria-hidden="true" />
      <SideScenery side="left" />
      <SideScenery side="right" />
      <Ridges />
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

/** Mountains for one side. Drawn for the left; the right is the same mountains mirrored, plus the moon. */
function SideScenery({ side }: { side: "left" | "right" }) {
  const left = side === "left";
  const moonMask = useId().replace(/:/g, "");
  return (
    <svg
      className={`banner-deco banner-side ${side}`}
      viewBox="0 0 240 160"
      preserveAspectRatio={left ? "xMinYMax meet" : "xMaxYMax meet"}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <g transform={left ? undefined : "translate(240 0) scale(-1 1)"}>
        {/* Far ridge */}
        <polygon points="0,160 0,96 40,80 80,98 120,86 170,112 210,132 240,160" fill="#3d3591" opacity="0.9"></polygon>
        {/* Main peak, its lit face, and the snow cap */}
        <polygon points="0,160 0,122 30,98 70,62 84,54 96,52 108,56 122,64 160,98 200,130 232,160" fill="#5a4fb0"></polygon>
        <polygon points="96,52 108,56 122,64 160,98 200,130 232,160 150,160 120,110 100,70" fill="#6c60c4"></polygon>
        <polygon points="70,62 84,54 96,52 108,56 122,64 113,70 104,64 96,72 88,64 78,70" fill="#eef0ff"></polygon>
        {/* Low pink clouds: stepped pixel puffs */}
        <g fill="#f7b8de" opacity="0.6">
          <rect x="16" y="102" width="12" height="3"></rect>
          <rect x="30" y="104" width="8" height="3"></rect>
          <rect x="10" y="105" width="32" height="3"></rect>
          <rect x="4" y="108" width="44" height="4"></rect>
          <rect x="158" y="116" width="10" height="3"></rect>
          <rect x="152" y="119" width="26" height="3"></rect>
          <rect x="146" y="122" width="40" height="3"></rect>
        </g>
      </g>
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
          <defs>
            <mask id={moonMask}>
              <rect width="240" height="160" fill="#fff"></rect>
              <circle cx="186" cy="30" r="12" fill="#000"></circle>
            </mask>
          </defs>
          <circle cx="196" cy="34" r="20" fill="#ffe08a" opacity="0.07"></circle>
          <circle cx="196" cy="34" r="13" fill="#ffe08a" mask={`url(#${moonMask})`}></circle>
          <Sparkle x={150} y={22} />
          <Sparkle x={222} y={70} size={1} />
        </>
      )}
    </svg>
  );
}

/**
 * A low far ridge across the whole bottom edge, then Xel's pixel-art treeline
 * in front. The treeline is drawn in the page colour, so
 * the banner melts into the page below. They stay in the bottom strip, under
 * the hero area.
 */
function Ridges() {
  return (
    <>
      <svg className="banner-deco banner-ridges" viewBox="0 0 400 40" preserveAspectRatio="none" shapeRendering="crispEdges" aria-hidden="true">
        <polygon points="0,16 40,9 85,15 130,7 175,14 215,11 255,5 300,13 345,8 400,14 400,40 0,40" fill="#3d3893" opacity="0.75"></polygon>
      </svg>
      <div className="banner-deco banner-treeline" style={{ backgroundImage: `url(${treelineFront})` }} aria-hidden="true" />
    </>
  );
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
