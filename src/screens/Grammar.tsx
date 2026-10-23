import { Link2, ListOrdered, NotebookPen, Quote } from "lucide-react";
import { useEffect, useState } from "react";
import { GRAMMAR, grammarPoint, markedParts, patternParts, type GrammarPoint } from "../grammar/points.ts";
import { useDekiPage } from "../deki/store.ts";
import { JapaneseText } from "../ui/Popover.tsx";
import { KindLabel } from "../ui/ItemView.tsx";
import { BannerScene } from "../ui/Scene.tsx";

/** The Grammar section: the list of grammar points, or one point's page. */
export function Grammar() {
  const [selected, setSelected] = useState<string>();
  const point = selected ? grammarPoint(selected) : undefined;
  // Each page (or the list) starts at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [selected]);
  if (point) return <GrammarPage point={point} onOpen={setSelected} onBack={() => setSelected(undefined)} />;

  return (
    <>
      <h1>
        <span lang="ja">文法</span> Grammar
      </h1>
      <p className="muted grammar-intro">Beginner grammar, in the order most textbooks teach it. Lessons and reviews come later; for now, read and look things up.</p>
      <ol className="grammar-list">
        {GRAMMAR.map((p, i) => (
          <li key={p.key}>
            <button type="button" className="grammar-tile" onClick={() => setSelected(p.key)}>
              <span className="grammar-num">{i + 1}</span>
              <span lang="ja" className="grammar-title">
                <BreakAfterDots text={p.title} />
              </span>
              <span className="grammar-meaning">{p.meaning}</span>
            </button>
          </li>
        ))}
      </ol>
    </>
  );
}

/** A title that may only wrap after its ・ dots (これ・それ・あれ・どれ), never mid-word. */
function BreakAfterDots({ text }: { text: string }) {
  return text.split("・").map((part, i, all) => (
    <span key={i}>
      {part}
      {i < all.length - 1 && (
        <>
          ・<wbr />
        </>
      )}
    </span>
  ));
}

function GrammarPage({ point, onOpen, onBack }: { point: GrammarPoint; onOpen: (key: string) => void; onBack: () => void }) {
  const number = GRAMMAR.indexOf(point) + 1;
  useDekiPage({
    id: "grammar",
    label: `Grammar · ${point.title}`,
    instructions: "They're reading a grammar point's page. Help them understand the pattern; make up more examples or quiz them if they ask.",
    parts: [
      {
        key: "point",
        name: "The grammar point",
        text: [`${point.title} (${point.meaning})`, `Pattern: ${point.pattern}`, ...point.explanation, "Examples:", ...point.examples.map((e) => `${e.ja} = ${e.en}`)].join("\n"),
      },
    ],
  });
  return (
    <div className="item-body">
      <div className="item-view grammar">
        <header className="banner bleed grammar">
          <BannerScene />
          <div className="banner-top">
            <div className="banner-top-start">
              <button className="banner-back" onClick={onBack}>
                ← Grammar
              </button>
              <KindLabel kind="grammar" detail={`#${number}`} help="A grammar point: a pattern for building sentences." />
            </div>
            <div className="banner-top-end" />
          </div>
          <div className="banner-stage">
            <div className="banner-window">
              <div className="banner-glyph" lang="ja" style={{ "--chars": [...point.title].length } as React.CSSProperties}>
                {point.title}
              </div>
              <div className="banner-facts">
                <p className="banner-primary">{point.meaning}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="item-info">
          <Field label="Pattern" icon={ListOrdered}>
            <p className="grammar-pattern">
              {patternParts(point.pattern).map((part, i) =>
                part.slot ? (
                  <span key={i} className="pattern-slot">
                    {part.text}
                  </span>
                ) : (
                  <span key={i} lang="ja" className="pattern-fixed">
                    {part.text}
                  </span>
                ),
              )}
            </p>
          </Field>
          <Field label="Explanation" icon={NotebookPen}>
            {point.explanation.map((para, i) => (
              <p key={i} className="grammar-para">
                {para}
              </p>
            ))}
            {!point.checked && <p className="muted small">Draft written with AI help; not checked yet.</p>}
          </Field>
          <Field label="Examples" icon={Quote}>
            <ul className="plain grammar-examples">
              {point.examples.map((ex) => (
                <li key={ex.ja}>
                  <span className="grammar-ja">
                    {markedParts(ex.ja).map((part, i) =>
                      part.mark ? (
                        <mark key={i} className="jp-highlight">
                          <JapaneseText text={part.text} />
                        </mark>
                      ) : (
                        <JapaneseText key={i} text={part.text} />
                      ),
                    )}
                  </span>
                  {ex.kana && (
                    <span lang="ja" className="grammar-kana">
                      {ex.kana}
                    </span>
                  )}
                  <span className="muted">{ex.en}</span>
                </li>
              ))}
            </ul>
          </Field>
          {point.related.length > 0 && (
            <Field label="Related" icon={Link2}>
              <ul className="chips">
                {point.related.map((key) => {
                  const r = grammarPoint(key);
                  return (
                    r && (
                      <li key={key}>
                        <button type="button" className="grammar-related" onClick={() => onOpen(key)}>
                          <span lang="ja">{r.title}</span> <span className="muted">{r.meaning}</span>
                        </button>
                      </li>
                    )
                  );
                })}
              </ul>
            </Field>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon: typeof Quote; children: React.ReactNode }) {
  return (
    <section className="field wide">
      <div className="field-head">
        <h3>
          <Icon size={15} strokeWidth={2} aria-hidden="true" />
          {label}
        </h3>
      </div>
      <div className="field-body">{children}</div>
    </section>
  );
}
