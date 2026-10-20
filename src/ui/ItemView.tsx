import type { ItemDetails } from "../items.ts";
import { ItemInfo } from "./ItemInfo.tsx";
import { itemLabel } from "./useItem.ts";

const GROUP_NAME = { basic: "basic", dakuten: "゛/゜ marks", combo: "combination", extended: "extended" } as const;

/** Full item page: a hero panel (character, key answer, stroke order) beside the detail cards. */
export function ItemView({ item, onChange, above }: { item: ItemDetails; onChange: () => void; above?: React.ReactNode }) {
  return (
    <div className="item-view">
      <ItemHero item={item} />
      <div className="item-body">
        {above}
        <ItemInfo item={item} onChange={onChange} />
      </div>
    </div>
  );
}

function heroFacts(item: ItemDetails): { kicker: string; primary: string; secondary?: string } {
  switch (item.kind) {
    case "kana":
      return { kicker: `${item.script} · ${GROUP_NAME[item.group]}`, primary: item.romaji, secondary: item.counterpart ?? undefined };
    case "component":
      return { kicker: "component", primary: item.name };
    case "kanji":
      return {
        kicker: "kanji",
        primary: item.meanings.slice(0, 2).join(", "),
        secondary: [item.onReadings[0], item.kunReadings[0]].filter(Boolean).join(" · "),
      };
    case "word":
      return { kicker: "word", primary: item.senses[0]?.glosses.slice(0, 2).join(", ") ?? "", secondary: item.reading };
  }
}

/** Shrinks long words so they still fit the panel. */
function glyphSize(label: string): string {
  const n = [...label].length;
  return n <= 1 ? "7rem" : n === 2 ? "4.6rem" : n === 3 ? "3.4rem" : "2.6rem";
}

function ItemHero({ item }: { item: ItemDetails }) {
  const { kicker, primary, secondary } = heroFacts(item);
  const label = itemLabel(item);
  const strokeSvg = item.kind === "kanji" || item.kind === "kana" ? item.strokeSvg : null;
  return (
    <aside className={`hero ${item.kind}`}>
      <p className="hero-kind">{kicker}</p>
      <div className="hero-glyph" lang="ja" style={{ fontSize: glyphSize(label) }}>
        {label}
      </div>
      <p className="hero-primary">{primary}</p>
      {secondary && (
        <p className="hero-secondary" lang="ja">
          {secondary}
        </p>
      )}
      {strokeSvg && (
        <img className="strokes" alt={`Stroke order for ${label}`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(strokeSvg)}`} />
      )}
    </aside>
  );
}
