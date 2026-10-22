import sleepyCat from "../assets/ui/cat-sleepy.png";

/**
 * Cats for Today's cards. The kaomoji ones are drawn in MS Gothic, where
 * full-width characters are exactly two half-width ones, so the columns line
 * up. In the art, ☆ becomes a gold pixel sparkle, ﾟ and ｡ dim twinkles, and
 * ♡ ♪ pink accents.
 */

/** The Progress card's cat, cheering you on from inside the dotted heart. */
export const GANBARU_CAT = `☆ﾟ                  ﾟ☆
  ｡       ∧＿∧     ｡
         ( ･ω･ )
      ┏━∪━∪━┓
  ♡   ┃ がんばる ┃   ♡
      ┗━━━━━┛
 ﾟ｡☆              ☆｡ﾟ`;

/** Lessons, when there are none left today: "good work". */
export const DONE_CAT = `    ∧＿∧    ♪
   ( ･ω･ )   ☆
┏━∪━∪━┓
┃ おつかれ ┃
┗━━━━━┛`;

const ACCENT: Record<string, string> = {
  "☆": "kaomoji-sparkle",
  ﾟ: "kaomoji-star",
  "｡": "kaomoji-star",
  "♡": "kaomoji-heart",
  "♪": "kaomoji-heart",
};

/** The art as preformatted text, with its accent characters coloured. */
export function KaomojiArt({ art, className = "" }: { art: string; className?: string }) {
  return (
    <pre className={`kaomoji-art ${className}`} lang="ja">
      {[...art].map((ch, i) =>
        ACCENT[ch] ? (
          <span key={i} className={ACCENT[ch]}>
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </pre>
  );
}

/** A kaomoji cat on the right of a Today card's panel. Decoration only; it hides when the window is short. */
export function PanelCat({ art }: { art: string }) {
  return (
    <aside className="panel-cat" aria-hidden="true">
      <KaomojiArt art={art} />
    </aside>
  );
}

/**
 * Reviews, when none are due: Xel's pixel-art cat asleep (assets/ui/cat-sleepy.png,
 * 56×33, lines recoloured lilac), shown at 2× with z's drifting up from it.
 */
export function SleepyCat() {
  return (
    <aside className="panel-cat sleepy-cat" aria-hidden="true">
      <img src={sleepyCat} alt="" width={112} height={66} />
      <span className="sleepy-z">
        z<span>Z</span>
      </span>
    </aside>
  );
}
