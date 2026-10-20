import { useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { addSynonym, removeSynonym, saveNote, type ItemDetails, type Note, type NoteKind } from "../items.ts";

const KIND_NAME = { component: "Component", kanji: "Kanji", word: "Word" } as const;

/** Everything about an item: meanings, readings, parts, mnemonics, examples. */
export function ItemInfo({ item, onChange }: { item: ItemDetails; onChange: () => void }) {
  return (
    <div className="item-info">
      <p className={`kind-tag ${item.kind}`}>{KIND_NAME[item.kind]}</p>

      {item.kind === "component" && (
        <>
          <Field label="Name">{item.name}</Field>
          <NoteEditor item={item} kind="mnemonic_meaning" label="Mnemonic" onSaved={onChange} />
          {item.usedIn.length > 0 && (
            <Field label="Found in">
              <Chips items={item.usedIn.map((k) => ({ glyph: k.character, text: k.meaning, kind: "kanji" }))} />
            </Field>
          )}
        </>
      )}

      {item.kind === "kanji" && (
        <>
          <Field label="Meanings">{item.meanings.join(", ")}</Field>
          <Field label="Readings">
            {item.onReadings.length > 0 && (
              <span>
                on'yomi <span lang="ja">{item.onReadings.join("、")}</span>
              </span>
            )}
            {item.onReadings.length > 0 && item.kunReadings.length > 0 && " · "}
            {item.kunReadings.length > 0 && (
              <span>
                kun'yomi <span lang="ja">{item.kunReadings.join("、")}</span>
              </span>
            )}
          </Field>
          <Field label="Components">
            <Chips items={item.components.map((c) => ({ glyph: c.display, text: c.name, kind: "component" }))} />
          </Field>
          <NoteEditor item={item} kind="mnemonic_meaning" label="Meaning mnemonic" onSaved={onChange} />
          <NoteEditor item={item} kind="mnemonic_reading" label="Reading mnemonic" onSaved={onChange} />
          {item.strokeSvg && (
            <Field label="Stroke order">
              <img
                className="strokes"
                alt={`Stroke order for ${item.character}`}
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.strokeSvg)}`}
              />
            </Field>
          )}
          {item.words.length > 0 && (
            <Field label="Words">
              <ul className="plain">
                {item.words.map((w) => (
                  <li key={w.written}>
                    <span lang="ja">{w.written}</span> <span lang="ja" className="muted">【{w.reading}】</span> {w.meaning}
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </>
      )}

      {item.kind === "word" && (
        <>
          <Field label="Meanings">
            <ol className="senses">
              {item.senses.slice(0, 4).map((s, i) => (
                <li key={i}>{s.glosses.join("; ")}</li>
              ))}
            </ol>
          </Field>
          <Field label="Reading">
            <span lang="ja">{item.reading}</span>
          </Field>
          <Field label="Kanji">
            <Chips items={item.kanji.map((k) => ({ glyph: k.character, text: k.meaning, kind: "kanji" }))} />
          </Field>
          <NoteEditor item={item} kind="mnemonic_meaning" label="Meaning mnemonic" onSaved={onChange} />
          <NoteEditor item={item} kind="mnemonic_reading" label="Reading mnemonic" onSaved={onChange} />
          {item.sentences.length > 0 && (
            <Field label="Examples">
              <ul className="plain">
                {item.sentences.map((s) => (
                  <li key={s.japanese}>
                    <span lang="ja">{s.japanese}</span>
                    <br />
                    <span className="muted">{s.english}</span>
                  </li>
                ))}
              </ul>
            </Field>
          )}
        </>
      )}

      <SynonymEditor item={item} onChange={onChange} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="field">
      <h3>{label}</h3>
      <div>{children}</div>
    </section>
  );
}

function Chips({ items }: { items: { glyph: string; text: string; kind: string }[] }) {
  return (
    <ul className="chips">
      {items.map((c) => (
        <li key={c.glyph + c.text}>
          <span lang="ja" className={`chip-glyph ${c.kind}`}>
            {c.glyph}
          </span>
          {c.text}
        </li>
      ))}
    </ul>
  );
}

const AUTHOR_NOTE: Record<Note["author"], string> = { you: "", ai: "written by AI", ai_edited: "AI draft, edited by you" };

function NoteEditor({ item, kind, label, onSaved }: { item: ItemDetails; kind: NoteKind; label: string; onSaved: () => void }) {
  const note = item.notes[kind];
  const [editing, setEditing] = useState(false);
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
    <Field label={label}>
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
        </div>
      )}
    </Field>
  );
}

function SynonymEditor({ item, onChange }: { item: ItemDetails; onChange: () => void }) {
  const [text, setText] = useState("");
  return (
    <Field label="Your synonyms">
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
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Another meaning you'd accept" />
        <button type="submit" disabled={!text.trim()}>
          Add
        </button>
      </form>
    </Field>
  );
}
