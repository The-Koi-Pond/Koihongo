import { useRef } from "react";
import { useSharedCardPattern } from "./useSharedCardPattern.ts";
import type { ItemDetails } from "../items.ts";
import { ArrowLeftRight, Info } from "lucide-react";
import { Gloss } from "./Gloss.tsx";
import { InfoTip } from "./InfoTip.tsx";
import { ItemInfo } from "./ItemInfo.tsx";
import { BannerScene } from "./Scene.tsx";
import { SpeakButton } from "./SpeakButton.tsx";
import { itemLabel } from "./useItem.ts";

const GROUP_NAME = { basic: "basic", dakuten: "dakuten (voiced)", combo: "combination", extended: "extended" } as const;

/** What each kind of item is, for the label's tooltip (new learners meet "component" before they know the word). */
const KIND_HELP: Record<ItemDetails["kind"], string> = {
  kana: "One of the two Japanese sound alphabets: each character is one sound.",
  component: "A building-block shape that appears inside kanji. Learning these first makes kanji much easier to remember.",
  kanji: "A character with meanings and readings, built from components.",
  word: "Vocabulary, written with the kanji and kana you've learned.",
};

/**
 * Full item page, sized to the window: the detail cards anchor to the bottom,
 * and the scenic banner takes the remaining height, with the character scaled
 * to fit it. `bannerStart` goes in the banner's top-left corner (e.g. a back
 * button).
 */
export function ItemView({
  item,
  onChange,
  bannerStart,
  bannerEnd,
}: {
  item: ItemDetails;
  onChange: () => void;
  bannerStart?: React.ReactNode;
  /** Goes first in the banner's top-right corner (e.g. the lesson's fast-track button, or your progress on Library pages). */
  bannerEnd?: React.ReactNode;
}) {
  const page = useRef<HTMLDivElement>(null);
  useSharedCardPattern(page);
  return (
    <div className={`item-view ${item.kind}`} ref={page}>
      <ItemBanner item={item} start={bannerStart} end={bannerEnd} />
      <ItemInfo item={item} onChange={onChange} />
    </div>
  );
}

/**
 * kind: the item type, shown as a coloured label top-left (detail: a quieter note after it).
 * badge: the answer in a chip top-right (kana romaji).
 * primary/secondary: lines under the character. speak: what the speaker button reads out.
 */
function bannerFacts(item: ItemDetails): {
  kind: string;
  detail?: string;
  badge?: string;
  primary?: string;
  secondary?: string;
  /** More about the secondary line, behind an ⓘ (a component's Japanese name: what it means). */
  secondaryNote?: string;
  speak?: string;
} {
  switch (item.kind) {
    case "kana":
      return {
        kind: item.script,
        detail: GROUP_NAME[item.group],
        badge: item.romaji,
        speak: item.character,
      };
    case "component":
      // Its Japanese name under the English one (くにがまえ), spoken by the speaker button.
      return {
        kind: "component",
        primary: item.name,
        secondary: item.jaName ?? undefined,
        secondaryNote: item.jaNote ?? undefined,
        speak: item.jaName?.split(" / ")[0],
      };
    case "kanji": {
      const reading = item.kunReadings[0] ?? item.onReadings[0];
      return {
        kind: "kanji",
        primary: item.meanings.slice(0, 2).join(", "),
        secondary: [item.onReadings[0], item.kunReadings[0]].filter(Boolean).join(" · "),
        speak: reading?.replace(/[.-]/g, ""),
      };
    }
    case "word":
      return { kind: "word", primary: item.senses[0]?.glosses.slice(0, 2).join(", ") ?? "", secondary: item.reading, speak: item.reading };
  }
}

function ItemBanner({ item, start, end }: { item: ItemDetails; start?: React.ReactNode; end?: React.ReactNode }) {
  const { kind, detail, badge, primary, secondary, secondaryNote, speak } = bannerFacts(item);
  const label = itemLabel(item);
  return (
    <header className={`banner bleed ${item.kind}`}>
      <BannerScene />
      <div className="banner-top">
        <div className="banner-top-start">
          {start}
          <KindLabel kind={kind} detail={detail} help={KIND_HELP[item.kind]} />
        </div>
        <div className="banner-top-end">
          {end}
          {item.kind === "kana" && item.counterpart && (
            // The same sound in the other script, tucked away until hovered or clicked.
            <InfoTip
              label={`Show the ${item.script === "hiragana" ? "katakana" : "hiragana"} version`}
              icon={ArrowLeftRight}
              placement="below"
              align="end"
              buttonClassName="speak-btn banner-speak"
            >
              <span className="counterpart-tip">
                <span className="muted">{item.script === "hiragana" ? "katakana" : "hiragana"}</span>
                <span lang="ja" className="counterpart-glyph">
                  {item.counterpart}
                </span>
              </span>
            </InfoTip>
          )}
          {speak && <SpeakButton text={speak} className="banner-speak" />}
          {badge && <p className="banner-badge">{badge}</p>}
        </div>
      </div>
      {/* The character and its name in one see-through panel, so they read clearly over the
          scenery. The stage is the space the panel can grow into (the character sizes itself from it). */}
      <div className="banner-stage">
        <div className="banner-window">
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
                <p className="banner-secondary">
                  <span lang="ja">{secondary}</span>
                  {secondaryNote && (
                    <InfoTip label="What this name means" icon={Info} placement="below" buttonClassName="banner-note-btn">
                      <span className="banner-note">{secondaryNote}</span>
                    </InfoTip>
                  )}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

/** The item type as a coloured pixel label (the banner's --kind colour), with a short explanation on hover. */
export function KindLabel({ kind, detail, help }: { kind: string; detail?: string; help?: string }) {
  return (
    <p className="banner-kind">
      <span className="kind-chip" title={help ? `${kind[0].toUpperCase()}${kind.slice(1)}: ${help}` : undefined}>
        {kind}
      </span>
      {detail && <span className="banner-kind-detail">{detail}</span>}
    </p>
  );
}
