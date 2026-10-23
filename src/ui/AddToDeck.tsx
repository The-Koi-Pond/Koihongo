import { Check, Layers } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { addDeckCard, cardFromItem, createDeck, listDecks, type Deck } from "../decks.ts";
import type { ItemDetails } from "../items.ts";

/** A card made elsewhere (e.g. a word from a manga bubble); `id` tells cards apart, `itemKey` links it to the learning path. */
export type ReadyCard = { id: string; front: string; back: string; itemKey: string | null; /** Makes the card's picture, when it's added. */ image?: () => Promise<string | undefined> };

/**
 * "Add to deck" on an item page (or with a ready-made `card`): pick one of
 * your decks (or name a new one) and it becomes a flashcard there, its front
 * and back filled in (a copy you can edit in the deck). `label`: text beside the icon.
 */
export function AddToDeck({ item, card, label }: { item?: ItemDetails; card?: ReadyCard; label?: string }) {
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

  // A new item page (or card) starts fresh.
  const key = card?.id ?? item?.item_key;
  useEffect(() => setAdded(undefined), [key]);

  async function addTo(deckId: number, deckName: string) {
    const { front, back } = card ?? cardFromItem(item!);
    // A picture that can't be made (the page moved, say) just leaves the card without one.
    const image = (await card?.image?.().catch(() => undefined)) ?? null;
    await addDeckCard(tauriDb, deckId, front, back, card ? card.itemKey : item!.item_key, Date.now(), image);
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
        className={label ? "add-to-deck-btn labelled" : "speak-btn banner-speak add-to-deck-btn"}
        aria-expanded={open}
        title={added ? `Added to ${added}` : "Add to one of your decks"}
        onClick={() => setOpen(!open)}
      >
        {added ? <Check size={18} strokeWidth={2.5} aria-hidden="true" /> : <Layers size={18} strokeWidth={2} aria-hidden="true" />}
        {label && <span>{added ? `Added to ${added}` : label}</span>}
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
