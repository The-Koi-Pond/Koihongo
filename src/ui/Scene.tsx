// The night scene behind banners (Today and item pages).
//
// Visual rule: scenery FRAMES the hero area (greeting, Start, the big character)
// and never sits behind it. Hills and trees are Xel's pixel art along the
// bottom with cherry branches in front in both corners; the moon sits on the right, so
// the centre stays clear at any window size. The sky is layered colour bands
// with Xel's dither ramp between them, a pixel starfield, sparkles and a
// horizon glow, all as picked in the sky playground.
//
// Each colour theme (src/theme.ts) has its own sky, star, sparkle and moon
// colours and its own recoloured hills and bushes (SCENES below). The
// recoloured pictures are made by scripts/scenery/recolour.py.

import { useEffect, useId, useRef } from "react";
import hills from "../assets/scenery/hills.png";
import bushesLeft from "../assets/scenery/newTreesLeft.png";
import bushesRight from "../assets/scenery/newTreesRight.png";
import nightWaterHills from "../assets/scenery/night-water/hills.png";
import nightWaterBushesLeft from "../assets/scenery/night-water/newTreesLeft.png";
import nightWaterBushesRight from "../assets/scenery/night-water/newTreesRight.png";
import lanternDuskHills from "../assets/scenery/lantern-dusk/hills.png";
import lanternDuskBushesLeft from "../assets/scenery/lantern-dusk/newTreesLeft.png";
import lanternDuskBushesRight from "../assets/scenery/lantern-dusk/newTreesRight.png";
import treelineFront from "../assets/scenery/treeline-front.png";
import { useTheme, type ThemeId } from "../theme.ts";

/** Everything decorative in a banner: sky, glow, stars, sparkles, the moon, hills, trees, blossoms. */
export function BannerScene() {
  const scene = SCENES[useTheme()];
  return (
    <>
      <Sky bands={scene.skyBands} />
      <div className="banner-deco banner-glow" aria-hidden="true" />
      <StarField stars={scene.stars} />
      <Sparkles colour={scene.sparkle} />
      <Moon colour={scene.moon} />
      <div className="banner-deco banner-hills" style={{ backgroundImage: `url(${scene.hills})` }} aria-hidden="true" />
      <Treeline />
      <div className="banner-deco banner-bushes left" style={{ backgroundImage: `url(${scene.bushesLeft})` }} aria-hidden="true" />
      <div className="banner-deco banner-bushes right" style={{ backgroundImage: `url(${scene.bushesRight})` }} aria-hidden="true" />
      <BlossomBranches />
      {/* A calming veil over the whole scene, everywhere except Today (CSS). */}
      <div className="banner-deco banner-tint" aria-hidden="true" />
    </>
  );
}

/**
 * Each theme's sky colours, top to horizon (the first is also the banner's
 * own background in CSS): 20 colours blended in OKLab between 5 evenly spaced
 * key colours.
 */
const SKY_COLOURS: Record<ThemeId, string[]> = {
  // Picked by Xel in the sky playground: #1a2974 → #2837b8 → #4f4fab → #cf7dbd → #e4cddb.
  purple: [
    "#1a2974", "#1d2c82", "#202f90", "#23329e", "#2635ad", "#2a39b7", "#323fb5", "#3b44b2", "#4349af", "#4b4dac",
    "#5c55ad", "#775fb2", "#9269b6", "#ad72b9", "#c87bbc", "#d38ac2", "#d89bc8", "#dcaccf", "#e0bcd5", "#e4cddb",
  ],
  // Teal-black to a pale moonlit horizon: #0c2229 → #11343e → #1b525a → #4a9294 → #b4e0d8.
  "night-water": [
    "#0c2229", "#0d262d", "#0e2932", "#0f2d36", "#10313b", "#12363f", "#143c45", "#16424b", "#184851", "#1a4f57",
    "#205860", "#2a666c", "#337378", "#3d8184", "#478e91", "#5b9e9e", "#72aead", "#88bfbb", "#9ecfc9", "#b4e0d8",
  ],
  // Dark teal-stone to a warm amber horizon: #121f24 → #1f3538 → #3a4a4c → #946a50 → #efc690.
  "lantern-dusk": [
    "#121f24", "#152328", "#17282c", "#1a2d30", "#1d3135", "#203639", "#263a3d", "#2c3f41", "#314346", "#37484a",
    "#444e4d", "#57554e", "#6a5b4f", "#7c6250", "#8f6850", "#a2785a", "#b58b67", "#c89e74", "#dbb282", "#efc690",
  ],
};

/** Each band is this many times taller than the one below it, so the bands crowd together near the horizon. */
const SKY_SPREAD = 1.08;

/** Each band after the first, with where it starts as a share of the banner's height. */
function skyBands(colours: string[]): [start: number, colour: string][] {
  const heights = colours.map((_, i) => SKY_SPREAD ** (colours.length - 1 - i));
  const total = heights.reduce((a, b) => a + b, 0);
  let above = 0;
  return colours.map((colour, i): [number, string] => {
    const start = above / total;
    above += heights[i];
    return [start, colour];
  }).slice(1);
}

/** Each theme's scenery. Star colours are "r,g,b", for rgba() with an opacity. */
const SCENES: Record<
  ThemeId,
  {
    skyBands: [start: number, colour: string][];
    hills: string;
    bushesLeft: string;
    bushesRight: string;
    stars: StarTheme;
    sparkle: string;
    moon: string;
  }
> = {
  purple: {
    skyBands: skyBands(SKY_COLOURS.purple),
    hills,
    bushesLeft,
    bushesRight,
    stars: {
      dust: 40,
      bright: 16,
      tints: ["255,255,255", "232,226,255", "255,226,244", "255,244,214"],
      brightTint: "255,255,255",
      shootingTint: "230,236,255",
    },
    sparkle: "#fff6dc",
    moon: "#ffe08a",
  },
  // Cold and moonlit: fewer, cooler stars.
  "night-water": {
    skyBands: skyBands(SKY_COLOURS["night-water"]),
    hills: nightWaterHills,
    bushesLeft: nightWaterBushesLeft,
    bushesRight: nightWaterBushesRight,
    stars: {
      dust: 26,
      bright: 11,
      tints: ["223,247,242", "200,236,234", "232,244,255", "184,236,234"],
      brightTint: "232,250,246",
      shootingTint: "214,244,240",
    },
    sparkle: "#dff7f2",
    moon: "#f2c46d",
  },
  // Warm dusk: the fewest stars, and warm ones.
  "lantern-dusk": {
    skyBands: skyBands(SKY_COLOURS["lantern-dusk"]),
    hills: lanternDuskHills,
    bushesLeft: lanternDuskBushesLeft,
    bushesRight: lanternDuskBushesRight,
    stars: {
      dust: 16,
      bright: 8,
      tints: ["255,233,196", "255,244,214", "255,214,170", "246,226,206"],
      brightTint: "255,240,214",
      shootingTint: "255,226,184",
    },
    sparkle: "#ffe4b8",
    moon: "#f2c46d",
  },
};

/**
 * The sky, one layer per colour: each covers everything below where its band
 * starts, and its top edge is Xel's dither ramp (a CSS mask, always 2×, so
 * the pixels stay square). Bands start at a share of the banner's height
 * (skyBands), so every banner shows the whole sky.
 */
function Sky({ bands }: { bands: [start: number, colour: string][] }) {
  return (
    <div className="banner-deco banner-sky" aria-hidden="true">
      {bands.map(([start, colour]) => (
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

/** A theme's stars. Colours are "r,g,b", for rgba() with an opacity. */
type StarTheme = {
  /** Star dust specks per 100×100px. */
  dust: number;
  /** Bright 2px stars per 1000×100px. */
  bright: number;
  /** Each speck of dust picks one of these at random. */
  tints: string[];
  brightTint: string;
  shootingTint: string;
};

/**
 * Paints the starfield for a w×h banner, one canvas pixel per screen pixel:
 * star dust (thinning toward the horizon), bright 2px stars with a faint halo
 * and a 180px shooting star, in the theme's colours and numbers.
 */
function paintStars(g: CanvasRenderingContext2D, w: number, h: number, stars: StarTheme) {
  const rand = seededRandom(STAR_SEED);
  g.clearRect(0, 0, w, h);
  const dust = Math.round((stars.dust * w * h) / 10000);
  for (let i = 0; i < dust; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * rand() ** 1.8); // most specks high up
    g.fillStyle = `rgba(${stars.tints[Math.floor(rand() * stars.tints.length)]},${(0.25 + rand() * 0.6).toFixed(2)})`;
    g.fillRect(x, y, 1, 1);
  }
  const bright = Math.round((stars.bright * w * h) / 100000);
  for (let i = 0; i < bright; i++) {
    const x = Math.floor(rand() * w);
    const y = Math.floor(h * 0.85 * rand() ** 1.6);
    g.fillStyle = `rgba(${stars.brightTint},${(0.7 + rand() * 0.3).toFixed(2)})`;
    g.fillRect(x, y, 2, 2);
    g.fillStyle = `rgba(${stars.brightTint},0.25)`; // a faint one-pixel halo
    g.fillRect(x - 1, y, 1, 2);
    g.fillRect(x + 2, y, 1, 2);
    g.fillRect(x, y - 1, 2, 1);
    g.fillRect(x, y + 2, 2, 1);
  }
  // Shooting star: head low on the left, tail fading up to the right in 2px steps.
  const length = 180, angle = -0.42, hx = Math.floor(w * 0.08), hy = Math.floor(h * 0.42);
  for (let d = 0; d < length; d++) {
    g.fillStyle = `rgba(${stars.shootingTint},${(0.95 * (1 - d / length) ** 1.4).toFixed(3)})`;
    g.fillRect(Math.round(hx + Math.cos(angle) * d), Math.round(hy + Math.sin(angle) * d), 2, 2);
  }
}

/** The starfield canvas, repainted whenever the banner changes size or the theme changes. */
function StarField({ stars }: { stars: StarTheme }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const banner = canvas.parentElement!;
    // A resize only repaints when the size really changed; a new theme always repaints.
    const paint = (always: boolean) => {
      const w = banner.clientWidth, h = banner.clientHeight;
      if (!w || !h || (!always && canvas.width === w && canvas.height === h)) return;
      canvas.width = w;
      canvas.height = h;
      paintStars(canvas.getContext("2d")!, w, h, stars);
    };
    const observer = new ResizeObserver(() => paint(false));
    observer.observe(banner);
    paint(true);
    return () => observer.disconnect();
  }, [stars]);
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

function Sparkles({ colour }: { colour: string }) {
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
              <g fill={colour}>
                <rect x="6" y="0" width="1" height="13" />
                <rect x="0" y="6" width="13" height="1" />
                <rect x="5" y="4" width="3" height="5" />
                <rect x="4" y="5" width="5" height="3" />
              </g>
              <rect x="6" y="6" width="1" height="1" fill="#fff" />
            </>
          ) : (
            <g fill={colour}>
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
function Moon({ colour }: { colour: string }) {
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
        <circle cx="24" cy="24" r="20" fill={colour} opacity="0.07"></circle>
        <circle cx="24" cy="24" r="13" fill={colour} mask={`url(#${mask})`}></circle>
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

/** Xel's pixel-art cherry branches, one in each bottom corner, in front of the scene (images and sizes in CSS). */
function BlossomBranches() {
  return (
    <>
      <div className="banner-deco banner-branch left" aria-hidden="true" />
      <div className="banner-deco banner-branch right" aria-hidden="true" />
    </>
  );
}
