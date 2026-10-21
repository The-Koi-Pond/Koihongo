import { useEffect } from "react";

/** The cards that draw the pastel pattern (see "Card background" in App.css). */
const CARDS = ".card, .split-card:not(.overlap), .field";

/**
 * Points every card inside `page` at one shared pattern area (the box around
 * all of them), so the card background runs on continuously behind them, like
 * windows onto one picture. It sets the --pat-* variables the card CSS reads,
 * and keeps them right as cards resize or come and go. `ready` re-runs it once
 * the cards are on the page.
 */
export function useSharedCardPattern(page: React.RefObject<HTMLElement | null>, ready = true) {
  useEffect(() => {
    const root = page.current;
    if (!root) return;
    let cards: HTMLElement[] = [];

    const place = () => {
      if (!cards.length) return;
      const rects = cards.map((c) => c.getBoundingClientRect());
      const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
      const width = Math.max(...rects.map((r) => r.right)) - left, height = Math.max(...rects.map((r) => r.bottom)) - top;
      cards.forEach((card, i) => {
        card.style.setProperty("--pat-x", `${left - rects[i].left}px`);
        card.style.setProperty("--pat-y", `${top - rects[i].top}px`);
        card.style.setProperty("--pat-w", `${width}px`);
        card.style.setProperty("--pat-h", `${height}px`);
      });
    };

    const resizes = new ResizeObserver(place);
    const collect = () => {
      resizes.disconnect();
      cards = [...root.querySelectorAll<HTMLElement>(CARDS)];
      [root, ...cards].forEach((el) => resizes.observe(el));
      place();
    };

    // Cards come and go (next item, details opening): collect them again, once per frame at most.
    let queued = 0;
    const changes = new MutationObserver(() => {
      if (!queued) queued = requestAnimationFrame(() => ((queued = 0), collect()));
    });
    changes.observe(root, { childList: true, subtree: true });
    collect();
    return () => {
      resizes.disconnect();
      changes.disconnect();
      cancelAnimationFrame(queued);
    };
  }, [page, ready]);
}
