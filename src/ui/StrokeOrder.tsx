import { strokePaths, strokeStart } from "../strokes.ts";

/**
 * Step-by-step stroke order: one small frame per stroke, earlier strokes faded,
 * the new stroke highlighted with a dot where it starts. Drawn from KanjiVG
 * paths, so it follows light/dark mode.
 */
export function StrokeOrder({ svg, label }: { svg: string; label: string }) {
  const paths = strokePaths(svg);
  if (paths.length === 0) return null;
  return (
    <ol className="stroke-steps" aria-label={`Stroke order for ${label}: ${paths.length} strokes`}>
      {paths.map((d, i) => {
        const start = strokeStart(d);
        return (
          <li key={i}>
            <svg viewBox="0 0 109 109" className="stroke-frame" aria-hidden="true">
              <line x1="54.5" y1="4" x2="54.5" y2="105" className="guide" />
              <line x1="4" y1="54.5" x2="105" y2="54.5" className="guide" />
              {paths.slice(0, i).map((prev, j) => (
                <path key={j} d={prev} className="done" />
              ))}
              <path d={d} className="current" />
              {start && <circle cx={start[0]} cy={start[1]} r="4.5" className="start" />}
            </svg>
            <span className="stroke-num">{i + 1}</span>
          </li>
        );
      })}
    </ol>
  );
}
