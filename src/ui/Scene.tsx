// The night scene behind banners (Today and item pages).
//
// Visual rule: scenery FRAMES the hero area (greeting, Start, the big character)
// and never sits behind it. Hills and trees are Xel's pixel art along the
// bottom; the moon sits in the top-right corner and the blossoms top-left, so
// the centre stays clear at any window size. The sky is layered colour bands
// with Xel's dither ramp between them, a pixel starfield, sparkles and a
// horizon glow, all as picked in the sky playground.

import { useEffect, useId, useRef } from "react";
import hills from "../assets/scenery/hills.png";
import bushesLeft from "../assets/scenery/newTreesLeft.png";
import bushesRight from "../assets/scenery/newTreesRight.png";
import treelineFront from "../assets/scenery/treeline-front.png";

/** Everything decorative in a banner: sky, glow, stars, sparkles, the moon, hills, trees, blossoms. */
export function BannerScene() {
  return (
    <>
      <Sky />
      <div className="banner-deco banner-glow" aria-hidden="true" />
      <StarField />
      <Sparkles />
      <Moon />
      <div className="banner-deco banner-hills" style={{ backgroundImage: `url(${hills})` }} aria-hidden="true" />
      <Treeline />
      <div className="banner-deco banner-bushes left" style={{ backgroundImage: `url(${bushesLeft})` }} aria-hidden="true" />
      <div className="banner-deco banner-bushes right" style={{ backgroundImage: `url(${bushesRight})` }} aria-hidden="true" />
      <BlossomBranch />
    </>
  );
}

/**
 * The sky's colours, top to horizon (the first is also the banner's own
 * background in CSS). Picked by Xel in the sky playground: key colours
 * #1a2974 → #2837b8 → #4f4fab → #cf7dbd → #e4cddb, blended in OKLab.
 */
const SKY_COLOURS = [
  "#1a2974", "#1d2c82", "#202f90", "#23329e", "#2635ad", "#2a39b7", "#323fb5", "#3b44b2", "#4349af", "#4b4dac",
  "#5c55ad", "#775fb2", "#9269b6", "#ad72b9", "#c87bbc", "#d38ac2", "#d89bc8", "#dcaccf", "#e0bcd5", "#e4cddb",
];

/** Each band is this many times taller than the one below it, so the bands crowd together near the horizon. */
const SKY_SPREAD = 1.08;

/** Each band after the first, with where it starts as a share of the banner's height. */
const SKY_BANDS: [start: number, colour: string][] = (() => {
  const heights = SKY_COLOURS.map((_, i) => SKY_SPREAD ** (SKY_COLOURS.length - 1 - i));
  const total = heights.reduce((a, b) => a + b, 0);
  let above = 0;
  return SKY_COLOURS.map((colour, i): [number, string] => {
    const start = above / total;
    above += heights[i];
    return [start, colour];
  }).slice(1);
})();

/**
 * The sky, one layer per colour: each covers everything below where its band
 * starts, and its top edge is Xel's dither ramp (a CSS mask, always 2×, so
 * the pixels stay square). Bands start at a share of the banner's height
 * (SKY_BANDS), so every banner shows the whole sky.
 */
function Sky() {
  return (
    <div className="banner-deco banner-sky" aria-hidden="true">
      {SKY_BANDS.map(([start, colour]) => (
        <div key={colour} className="sky-band" style={{ top: `${(100 * start).toFixed(2)}%`, background: colour }} />
      ))}
    </div>
  );
}

/** Same seed, same stars: the sky looks the same every time. */
const STAR_SEED = 21;

/** A small seeded random number generator (mulberry32): returns 0 ≤ n < 1. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAR_TINTS = ["255,255,255", "232,226,255", "255,226,244", "255,244,214"];

/**
 * Paints the starfield for a w×h banner, one canvas pixel per screen pixel:
 * star dust (40 specks per 100×100px, thinning toward the horizon), bright
 * 2px stars (16 per 1000×100px) and a 180px shooting star.
 */
function paintStars(g: CanvasRenderingContext2D, w: number, h: number) {
  const rand = seededRandom(STAR_SEED);
  g.clearRect(0, 0, w, h);
  const dust = Math.round((40 * w * h) / 10000);
  for (let i = 0; i < dust; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * rand() ** 1.8); // most specks high up
    g.fillStyle = `rgba(${STAR_TINTS[Math.floor(rand() * STAR_TINTS.length)]},${(0.25 + rand() * 0.6).toFixed(2)})`;
    g.fillRect(x, y, 1, 1);
  }
  const bright = Math.round((16 * w * h) / 100000);
  for (let i = 0; i < bright; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * 0.85 * rand() ** 1.6);
    g.fillStyle = `rgba(255,255,255,${(0.7 + rand() * 0.3).toFixed(2)})`;
    g.fillRect(x, y, 2, 2);
    g.fillStyle = "rgba(255,255,255,0.25)"; // a faint one-pixel halo
    g.fillRect(x - 1, y, 1, 2);
    g.fillRect(x + 2, y, 1, 2);
    g.fillRect(x, y - 1, 2, 1);
    g.fillRect(x, y + 2, 2, 1);
  }
  // Shooting star: head low on the left, tail fading up to the right in 2px steps.
  const length = 180, angle = -0.42, hx = Math.floor(w * 0.08), hy = Math.floor(h * 0.42);
  for (let d = 0; d < length; d++) {
    g.fillStyle = `rgba(230,236,255,${(0.95 * (1 - d / length) ** 1.4).toFixed(3)})`;
    g.fillRect(Math.round(hx + Math.cos(angle) * d), Math.round(hy + Math.sin(angle) * d), 2, 2);
  }
}

/** The starfield canvas, repainted whenever the banner changes size. */
function StarField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const banner = canvas.parentElement!;
    const paint = () => {
      const w = banner.clientWidth, h = banner.clientHeight;
      if (!w || !h || (canvas.width === w && canvas.height === h)) return;
      canvas.width = w;
      canvas.height = h;
      paintStars(canvas.getContext("2d")!, w, h);
    };
    const observer = new ResizeObserver(paint);
    observer.observe(banner);
    paint();
    return () => observer.disconnect();
  }, []);
  return <canvas ref={ref} className="banner-deco banner-starfield" aria-hidden="true" />;
}

/**
 * Seven four-pointed pixel sparkles: [left %, top %, big?, twinkle delay s].
 * Kept off the middle third, where the big character and Start button sit.
 */
const SPARKLES: [number, number, boolean, number][] = (() => {
  const rand = seededRandom(STAR_SEED + 1);
  return Array.from({ length: 7 }, () => {
    let x = rand();
    if (x > 0.33 && x < 0.67) x = x < 0.5 ? x - 0.3 : x + 0.3;
    return [x * 100, (0.08 + rand() * 0.55) * 100, rand() > 0.5, -rand() * 3.2];
  });
})();

function Sparkles() {
  return (
    <div className="banner-deco banner-sparkles" aria-hidden="true">
      {SPARKLES.map(([x, y, big, delay], i) => (
        <svg
          key={i}
          className={`sparkle ${big ? "big" : ""}`}
          viewBox="0 0 13 13"
          shapeRendering="crispEdges"
          style={{ left: `${x.toFixed(1)}%`, top: `${y.toFixed(1)}%`, animationDelay: `${delay.toFixed(2)}s` }}
        >
          {big ? (
            <>
              <g fill="#fff6dc">
                <rect x="6" y="0" width="1" height="13" />
                <rect x="0" y="6" width="13" height="1" />
                <rect x="5" y="4" width="3" height="5" />
                <rect x="4" y="5" width="5" height="3" />
              </g>
              <rect x="6" y="6" width="1" height="1" fill="#fff" />
            </>
          ) : (
            <g fill="#fff6dc">
              <rect x="6" y="3" width="1" height="7" />
              <rect x="3" y="6" width="7" height="1" />
              <rect x="5" y="5" width="3" height="3" />
            </g>
          )}
        </svg>
      ))}
    </div>
  );
}

/** The crescent moon with a faint glow, on the right, halfway between the banner's top and the mountain tops (CSS). */
function Moon() {
  const mask = useId().replace(/:/g, "");
  return (
    <div className="banner-deco banner-moon-sky" aria-hidden="true">
      <svg className="banner-moon" viewBox="0 0 48 48">
        <defs>
          <mask id={mask}>
            <rect width="48" height="48" fill="#fff"></rect>
            <circle cx="14" cy="20" r="12" fill="#000"></circle>
          </mask>
        </defs>
        <circle cx="24" cy="24" r="20" fill="#ffe08a" opacity="0.07"></circle>
        <circle cx="24" cy="24" r="13" fill="#ffe08a" mask={`url(#${mask})`}></circle>
      </svg>
    </div>
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

/** Xel's pixel-art cherry branch, reaching in from the left edge (which one, and its size, is in CSS). */
function BlossomBranch() {
  return <div className="banner-deco banner-branch" aria-hidden="true" />;
}
