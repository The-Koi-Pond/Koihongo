import { Check, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { addDeckCard, cardFromItem, createDeck, listDecks, type Deck } from "../decks.ts";
import type { ItemDetails } from "../items.ts";

/**
 * "Add to deck" on an item page: pick one of your decks (or name a new one)
 * and the item becomes a flashcard there, its front and back filled in from
 * the item (a copy you can edit in the deck).
 */
export function AddToDeck({ item }: { item: ItemDetails }) {
  const [open, setOpen] = useState(false);
  const [decks, setDecks] = useState<Deck[]>();
  const [name, setName] = useState("");
  const [added, setAdded] = useState<string>();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listDecks(tauriDb, Date.now()).then(setDecks);
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", esc);
    };
  }, [open]);

  // A new item page starts fresh.
  useEffect(() => setAdded(undefined), [item.item_key]);

  async function addTo(deckId: number, deckName: string) {
    const { front, back } = cardFromItem(item);
    await addDeckCard(tauriDb, deckId, front, back, item.item_key, Date.now());
    setAdded(deckName);
    setOpen(false);
  }

  async function addToNew(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const id = await createDeck(tauriDb, name, Date.now());
    await addTo(id, name.trim());
    setName("");
  }

  return (
    <div className="add-to-deck" ref={box}>
      <button
        type="button"
        className="speak-btn banner-speak add-to-deck-btn"
        aria-expanded={open}
        title={added ? `Added to ${added}` : "Add to one of your decks"}
        onClick={() => setOpen(!open)}
      >
        {added ? <Check size={18} strokeWidth={2.5} aria-hidden="true" /> : <Layers size={18} strokeWidth={2} aria-hidden="true" />}
      </button>
      {open && (
        <div className="add-to-deck-menu" role="menu">
          <p className="small muted">Add to deck</p>
          {decks?.map((d) => (
            <button key={d.id} type="button" role="menuitem" onClick={() => addTo(d.id, d.name)}>
              {d.name} <span className="muted small">{d.cards}</span>
            </button>
          ))}
          <form onSubmit={addToNew}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New deck…" aria-label="New deck name" />
          </form>
        </div>
      )}
    </div>
  );
}
