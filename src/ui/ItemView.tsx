import type { ItemDetails } from "../items.ts";
import { Gloss } from "./Gloss.tsx";
import { ItemInfo } from "./ItemInfo.tsx";
import { BannerScene } from "./Scene.tsx";
import { SpeakButton } from "./SpeakButton.tsx";
import { itemLabel } from "./useItem.ts";

const GROUP_NAME = { basic: "basic", dakuten: "゛/゜ marks", combo: "combination", extended: "extended" } as const;

/**
 * Full item page, sized to the window: the detail cards anchor to the bottom,
 * and the scenic banner takes the remaining height, with the character scaled
 * to fit it. `bannerStart` goes in the banner's top-left corner (e.g. a back
 * button); `below` goes under the cards.
 */
export function ItemView({
  item,
  onChange,
  below,
  bannerStart,
}: {
  item: ItemDetails;
  onChange: () => void;
  below?: React.ReactNode;
  bannerStart?: React.ReactNode;
}) {
  return (
    <div className={`item-view ${item.kind}`}>
      <ItemBanner item={item} start={bannerStart} />
      <ItemInfo item={item} onChange={onChange} />
      {below}
    </div>
  );
}

/**
 * kicker: small label top-left. badge: the answer in a chip top-right (kana romaji).
 * primary/secondary: lines under the character. speak: what the speaker button reads out.
 */
function bannerFacts(item: ItemDetails): { kicker: string; badge?: string; primary?: string; secondary?: string; speak?: string } {
  switch (item.kind) {
    case "kana":
      return {
        kicker: `${item.script} · ${GROUP_NAME[item.group]}`,
        badge: item.romaji,
        primary: item.counterpart ? (item.script === "hiragana" ? "katakana" : "hiragana") : undefined,
        secondary: item.counterpart ?? undefined,
        speak: item.character,
      };
    case "component":
      return { kicker: "component", primary: item.name };
    case "kanji": {
      const reading = item.kunReadings[0] ?? item.onReadings[0];
      return {
        kicker: "kanji",
        primary: item.meanings.slice(0, 2).join(", "),
        secondary: [item.onReadings[0], item.kunReadings[0]].filter(Boolean).join(" · "),
        speak: reading?.replace(/[.-]/g, ""),
      };
    }
    case "word":
      return { kicker: "word", primary: item.senses[0]?.glosses.slice(0, 2).join(", ") ?? "", secondary: item.reading, speak: item.reading };
  }
}

function ItemBanner({ item, start }: { item: ItemDetails; start?: React.ReactNode }) {
  const { kicker, badge, primary, secondary, speak } = bannerFacts(item);
  const label = itemLabel(item);
  return (
    <header className={`banner bleed ${item.kind}`}>
      <BannerScene />
      <div className="banner-top">
        <div className="banner-top-start">
          {start}
          <p className="banner-kind">{kicker}</p>
        </div>
        <div className="banner-top-end">
          {speak && <SpeakButton text={speak} className="banner-speak" />}
          {badge && <p className="banner-badge">{badge}</p>}
        </div>
      </div>
      {/* Sized in CSS from the banner's height and width (container query units); --chars lets long words shrink. */}
      <div className="banner-glyph" lang="ja" style={{ "--chars": [...label].length } as React.CSSProperties}>
        {label}
      </div>
      {(primary || secondary) && (
        <div className="banner-facts">
          {primary && (
            <p className="banner-primary">
              <Gloss text={primary} />
            </p>
          )}
          {secondary && (
            <p className="banner-secondary" lang="ja">
              {secondary}
            </p>
          )}
        </div>
      )}
    </header>
  );
}
