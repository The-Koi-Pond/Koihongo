import { BookOpen, Ear, Languages, Lightbulb, List, Pencil, PenLine, Quote, Search, Shapes, Sparkles, Tag, Tags, type LucideIcon, Volume2 } from "lucide-react";
import { useContext, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { addSynonym, removeSynonym, saveNote, type ItemDetails, type Note, type NoteKind } from "../items.ts";
import { Examples } from "./Examples.tsx";
import { Gloss } from "./Gloss.tsx";
import { InfoTip } from "./InfoTip.tsx";
import { MnemonicWorkshop } from "./MnemonicWorkshop.tsx";
import { soundHint } from "../kanaSounds.ts";
import { FindByPartsContext } from "./findByParts.ts";
import { ItemHover } from "./Popover.tsx";
import { SpeakButton } from "./SpeakButton.tsx";
import { StrokeOrder } from "./StrokeOrder.tsx";

const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

/** An item's details as a grid of cards. ItemView adds the hero panel for full pages. */
export function ItemInfo({ item, onChange }: { item: ItemDetails; onChange: () => void }) {
  const findByParts = useContext(FindByPartsContext);
  return (
    <div className="item-info">
      {item.kind === "kana" && (
        <>
          {/* Pronunciation strip: one card, two halves (overlaps the banner on item pages). */}
          <div className="split-card wide overlap">
            <SoundsLike romaji={item.romaji} accept={item.accept} />
            {item.example && (
              <Field>
                {/* One row: speaker, the word in kana (what a kana learner can read), romaji, kanji, meaning. */}
                <div className="example-row">
                  <SpeakButton text={item.example.reading} fallback={<AudioPlaceholder />} />
                  <span lang="ja">
                    {KANA_ONLY.test(item.example.form) ? item.example.form : item.example.reading}
                  </span>
                  <span className="muted">{item.example.romaji}</span>
                  {!KANA_ONLY.test(item.example.form) && (
                    <span lang="ja" className="example-kanji">
                      {item.example.form}
                    </span>
                  )}
                  <span>
                    <Gloss text={item.example.meaning} />
                  </span>
                </div>
              </Field>
            )}
          </div>
          {/* Stroke order and mnemonic share one panel. */}
          <div className="split-card wide">
            {item.strokeSvg && (
              <Field label="Stroke order" icon={PenLine}>
                <StrokeOrder svg={item.strokeSvg} label={item.character} />
              </Field>
            )}
            <NoteEditor item={item} kind="mnemonic_reading" label="Mnemonic" onSaved={onChange} />
          </div>
        </>
      )}

      {item.kind === "component" && (
        <>
          <Field label="Name" icon={Tag} action={findByParts && <FindLink onClick={() => findByParts([item.item_key.slice("component:".length)])} text="Find all kanji with this part" />}>
            <span className="big-reading">{item.name}</span>
          </Field>
          {item.usedIn.length > 0 && (
            <Field label="Found in" icon={Search}>
              <Chips items={item.usedIn.map((k) => ({ glyph: k.character, text: k.meaning, kind: "kanji", itemKey: `kanji:${k.character}` }))} />
            </Field>
          )}
          <NoteEditor item={item} kind="mnemonic_meaning" label="Mnemonic" onSaved={onChange} />
        </>
      )}

      {item.kind === "kanji" && (
        <>
          <Field label="Meanings" icon={BookOpen}>{item.meanings.join(", ")}</Field>
          <Field label="Readings" icon={Ear}>
            {item.onReadings.length > 0 && (
              <p className="reading-line">
                <span className="reading-kind">on'yomi</span> <span lang="ja">{item.onReadings.join("、")}</span>
              </p>
            )}
            {item.kunReadings.length > 0 && (
              <p className="reading-line">
                <span className="reading-kind">kun'yomi</span> <span lang="ja">{item.kunReadings.join("、")}</span>
              </p>
            )}
          </Field>
          <Field
            label="Components"
            icon={Shapes}
            action={findByParts && <FindLink onClick={() => findByParts(item.components.map((c) => c.glyph))} text="Find kanji with these parts" />}
          >
            <Chips items={item.components.map((c) => ({ glyph: c.display, text: c.name, kind: "component", itemKey: `component:${c.glyph}` }))} />
          </Field>
          {item.strokeSvg && (
            <Field label="Stroke order" icon={PenLine} wide>
              <StrokeOrder svg={item.strokeSvg} label={item.character} />
            </Field>
          )}
          <NoteEditor item={item} kind="mnemonic_meaning" label="Meaning mnemonic" onSaved={onChange} />
          <NoteEditor item={item} kind="mnemonic_reading" label="Reading note" onSaved={onChange} />
          {item.words.length > 0 && (
            <Field label="Words" icon={List} wide>
              <ul className="word-list">
                {item.words.map((w) => (
                  <li key={w.written}>
                    <ItemHover itemKey={`word:${w.id}`}>
                      <span lang="ja" className="word-written">
                        {w.written}
                      </span>
                    </ItemHover>
                    <span lang="ja" className="muted">
                      {w.reading}
                    </span>
                    <span>
                      <Gloss text={w.meaning} />
                    </span>
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </>
      )}

      {item.kind === "word" && (
        <>
          <Field label="Meanings" icon={BookOpen}>
            <ol className="senses">
              {item.senses.slice(0, 4).map((s, i) => (
                <li key={i}>
                  <Gloss text={s.glosses.join("; ")} />
                </li>
              ))}
            </ol>
          </Field>
          <Field label="Kanji" icon={Languages}>
            <Chips items={item.kanji.map((k) => ({ glyph: k.character, text: k.meaning, kind: "kanji", itemKey: `kanji:${k.character}` }))} />
          </Field>
          <NoteEditor item={item} kind="mnemonic_meaning" label="Meaning mnemonic" onSaved={onChange} />
          <NoteEditor item={item} kind="mnemonic_reading" label="Reading note" onSaved={onChange} />
          {item.sentences.length > 0 && (
            <Field label="Examples" icon={Quote} wide>
              <Examples item={item} />
            </Field>
          )}
        </>
      )}

      {item.kind !== "kana" && <SynonymEditor item={item} onChange={onChange} />}
    </div>
  );
}

/** The "as in f(a)ther" hint; no heading, the example speaks for itself. */
function SoundsLike({ romaji, accept }: { romaji: string; accept: string[] }) {
  const hint = soundHint(romaji);
  const tip = [hint.tip, accept.length > 0 && `Also accepted when typing: ${accept.join(", ")}.`].filter(Boolean).join(" ");
  return (
    <Field>
      {/* One line: speaker, the sound-alike word (or a respelling), and an ⓘ for any extra advice. */}
      <div className="as-in-row">
        <AudioPlaceholder />
        <p className="as-in">
          {hint.word ? (
            <>
              <span className="muted">as in</span> {hint.word[0]}
              <mark>{hint.word[1]}</mark>
              {hint.word[2]}
            </>
          ) : (
            <>
              <span className="muted">say</span> “<mark>{hint.say}</mark>”
            </>
          )}
        </p>
        {tip && <InfoTip label={tip}>{tip}</InfoTip>}
      </div>
    </Field>
  );
}

/** Placeholder for kana audio (recorded or synthesised), to be wired up later. */
function AudioPlaceholder() {
  return (
    <button type="button" className="speak-btn" disabled aria-label="Audio (coming soon)" title="Audio is coming soon">
      <Volume2 size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}

function Field({
  label,
  icon: Icon,
  action,
  wide,
  children,
}: {
  /** Heading; omit for cards whose content speaks for itself. */
  label?: string;
  icon?: LucideIcon;
  /** Extra control on the heading row, e.g. a speaker button. */
  action?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`field ${wide ? "wide" : ""}`}>
      {(label || action) && (
        <div className="field-head">
          {label && (
            <h3>
              {Icon && <Icon size={15} strokeWidth={2} aria-hidden="true" />}
              {label}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="field-body">{children}</div>
    </section>
  );
}

/** A small header link that opens the Dictionary's "Find by parts". */
function FindLink({ onClick, text }: { onClick: () => void; text: string }) {
  return (
    <button type="button" className="field-action" onClick={onClick}>
      <Search size={13} strokeWidth={2.5} aria-hidden="true" /> {text}
    </button>
  );
}

function Chips({ items }: { items: { glyph: string; text: string; kind: string; itemKey: string }[] }) {
  return (
    <ul className="chips">
      {items.map((c) => (
        <li key={c.glyph + c.text}>
          <ItemHover itemKey={c.itemKey}>
            <span lang="ja" className={`chip-glyph ${c.kind}`}>
              {c.glyph}
            </span>
            <Gloss text={c.text} />
          </ItemHover>
        </li>
      ))}
    </ul>
  );
}

const AUTHOR_NOTE: Record<Note["author"], string> = {
  you: "",
  ai: "written by AI",
  ai_edited: "AI draft, edited by you",
  default: "",
};

function NoteEditor({ item, kind, label, onSaved }: { item: ItemDetails; kind: NoteKind; label: string; onSaved: () => void }) {
  const note = item.notes[kind];
  const [editing, setEditing] = useState(false);
  const [workshop, setWorkshop] = useState(false);
  const [text, setText] = useState(note?.text ?? "");
  const [error, setError] = useState<string>();

  async function save() {
    const author = note?.author === "ai" || note?.author === "ai_edited" ? "ai_edited" : "you";
    try {
      await saveNote(tauriDb, item.item_key, kind, text, author, Date.now());
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <Field label={label} icon={Lightbulb} wide>
      {editing ? (
        <div className="note-edit">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus />
          <div className="row">
            <button type="button" className="primary" onClick={save} disabled={!text.trim()}>
              Save
            </button>
            <button type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </div>
      ) : (
        <div className="note">
          {note ? <p>{note.text}</p> : <p className="muted">No {label.toLowerCase()} yet.</p>}
          {note && AUTHOR_NOTE[note.author] && <p className="muted small">{AUTHOR_NOTE[note.author]}</p>}
          {/* Pinned to the bottom-left of the card. */}
          <div className="note-actions">
            <button
              type="button"
              className="icon-action"
              aria-label={note ? "Edit" : "Write one"}
              title={note ? "Edit" : "Write one"}
              onClick={() => {
                setText(note?.text ?? "");
                setEditing(true);
              }}
            >
              <Pencil size={16} strokeWidth={1.75} />
            </button>
            {kind !== "note" && !workshop && (
              <button type="button" className="icon-action" aria-label="Ask AI" title="Ask AI" onClick={() => setWorkshop(true)}>
                <Sparkles size={16} strokeWidth={1.75} />
              </button>
            )}
          </div>
        </div>
      )}
      {workshop && kind !== "note" && (
        <MnemonicWorkshop
          item={item}
          focus={kind === "mnemonic_meaning" ? "meaning" : "reading"}
          onUse={async (suggestion) => {
            await saveNote(tauriDb, item.item_key, kind, suggestion, "ai", Date.now());
            onSaved();
          }}
          onClose={() => setWorkshop(false)}
        />
      )}
    </Field>
  );
}

function SynonymEditor({ item, onChange }: { item: ItemDetails; onChange: () => void }) {
  const [text, setText] = useState("");
  return (
    <Field label="Your synonyms" icon={Tags}>
      {item.synonyms.length > 0 && (
        <ul className="synonyms">
          {item.synonyms.map((s) => (
            <li key={s}>
              {s}{" "}
              <button type="button" className="link" onClick={() => removeSynonym(tauriDb, item.item_key, s).then(onChange)}>
                remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          addSynonym(tauriDb, item.item_key, text, Date.now()).then(() => {
            setText("");
            onChange();
          });
        }}
      >
        <input className="grow" value={text} onChange={(e) => setText(e.target.value)} placeholder="Another meaning you'd accept" />
        <button type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </Field>
  );
}
