import { BookOpen, Ear, Languages, Lightbulb, List, PenLine, Quote, Search, Shapes, Tag, Tags, Volume2, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { addSynonym, removeSynonym, saveNote, type ItemDetails, type Note, type NoteKind } from "../items.ts";
import { MnemonicWorkshop } from "./MnemonicWorkshop.tsx";
import { soundHint } from "../kanaSounds.ts";
import { ItemHover, JapaneseText } from "./Popover.tsx";
import { SpeakButton } from "./SpeakButton.tsx";
import { StrokeOrder } from "./StrokeOrder.tsx";

const KANA_ONLY = /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u;

/** An item's details as a grid of cards. ItemView adds the hero panel for full pages. */
export function ItemInfo({ item, onChange }: { item: ItemDetails; onChange: () => void }) {
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
                  <span>{item.example.meaning}</span>
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
          <Field label="Name" icon={Tag}>
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
          <Field label="Components" icon={Shapes}>
            <Chips items={item.components.map((c) => ({ glyph: c.display, text: c.name, kind: "component", itemKey: `component:${c.glyph}` }))} />
          </Field>
          {item.strokeSvg && (
            <Field label="Stroke order" icon={PenLine} wide>
              <StrokeOrder svg={item.strokeSvg} label={item.character} />
            </Field>
          )}
          <NoteEditor item={item} kind="mnemonic_meaning" label="Meaning mnemonic" onSaved={onChange} />
          <NoteEditor item={item} kind="mnemonic_reading" label="Reading mnemonic" onSaved={onChange} />
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
                    <span>{w.meaning}</span>
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
                <li key={i}>{s.glosses.join("; ")}</li>
              ))}
            </ol>
          </Field>
          <Field label="Kanji" icon={Languages}>
            <Chips items={item.kanji.map((k) => ({ glyph: k.character, text: k.meaning, kind: "kanji", itemKey: `kanji:${k.character}` }))} />
          </Field>
          <NoteEditor item={item} kind="mnemonic_meaning" label="Meaning mnemonic" onSaved={onChange} />
          <NoteEditor item={item} kind="mnemonic_reading" label="Reading mnemonic" onSaved={onChange} />
          {item.sentences.length > 0 && (
            <Field label="Examples" icon={Quote} wide>
              <ul className="plain">
                {item.sentences.map((s) => (
                  <li key={s.japanese}>
                    <JapaneseText text={s.japanese} />
                    <br />
                    <span className="muted">{s.english}</span>
                  </li>
                ))}
              </ul>
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
  return (
    <Field>
      {/* Speaker + "as in" sit together at the right, beside the centre divider and the example word. */}
      <div className="as-in-row">
        <AudioPlaceholder />
        {hint.asIn && (
          <p className="as-in">
            <span className="muted">as in</span> {hint.asIn[0]}
            <mark>{hint.asIn[1]}</mark>
            {hint.asIn[2]}
          </p>
        )}
      </div>
      {hint.note && <p className="small">{hint.note}</p>}
      {accept.length > 0 && <p className="muted small">Also accepted: {accept.join(", ")}</p>}
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
      <div>{children}</div>
    </section>
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
            {c.text}
          </ItemHover>
        </li>
      ))}
    </ul>
  );
}

const AUTHOR_NOTE: Record<Note["author"], string> = { you: "", ai: "written by AI", ai_edited: "AI draft, edited by you" };

function NoteEditor({ item, kind, label, onSaved }: { item: ItemDetails; kind: NoteKind; label: string; onSaved: () => void }) {
  const note = item.notes[kind];
  const [editing, setEditing] = useState(false);
  const [workshop, setWorkshop] = useState(false);
  const [text, setText] = useState(note?.text ?? "");
  const [error, setError] = useState<string>();

  async function save() {
    const author = note && note.author !== "you" ? "ai_edited" : "you";
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
          {note ? <p>{note.text}</p> : <p className="muted">No mnemonic yet.</p>}
          {note && AUTHOR_NOTE[note.author] && <p className="muted small">{AUTHOR_NOTE[note.author]}</p>}
          <button
            type="button"
            className="link"
            onClick={() => {
              setText(note?.text ?? "");
              setEditing(true);
            }}
          >
            {note ? "Edit" : "Write one"}
          </button>
          {kind !== "note" && !workshop && (
            <button type="button" className="link" onClick={() => setWorkshop(true)}>
              Ask AI
            </button>
          )}
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
