import { ArrowLeft, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Grade } from "ts-fsrs";
import { tauriDb } from "../db/tauriDb.ts";
import {
  addDeckCard,
  createDeck,
  deckCards,
  deleteDeck,
  deleteDeckCard,
  dueDeckCards,
  getDeck,
  listDecks,
  recordDeckReview,
  reviewedFirst,
  renameDeck,
  setDeckInDaily,
  updateDeckCard,
  type Deck,
  type DeckCard,
} from "../decks.ts";
import { Rating } from "../srs/scheduler.ts";
import { answerCurrent, currentQuestion, sessionStats, startSession, type DeckQuestion, type Session } from "../srs/session.ts";
import { DoneView } from "../ui/DoneView.tsx";
import { FlipCard } from "../ui/FlipCard.tsx";
import { SessionGauge } from "../ui/QuestionCard.tsx";

type View = { mode: "list" } | { mode: "deck"; id: number } | { mode: "study"; id: number; all: boolean };

/** Your own flashcard decks: the list, one deck's cards, or studying a deck. */
export function Decks() {
  const [view, setView] = useState<View>({ mode: "list" });
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  if (view.mode === "deck") return <DeckPage id={view.id} onBack={() => setView({ mode: "list" })} onStudy={(all) => setView({ mode: "study", id: view.id, all })} />;
  if (view.mode === "study") return <DeckStudy id={view.id} all={view.all} onExit={() => setView({ mode: "deck", id: view.id })} />;
  return <DeckList onOpen={(id) => setView({ mode: "deck", id })} />;
}

function DeckList({ onOpen }: { onOpen: (id: number) => void }) {
  const [decks, setDecks] = useState<Deck[]>();
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  useEffect(() => {
    listDecks(tauriDb, Date.now())
      .then(setDecks)
      .catch((e) => setError(String(e)));
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onOpen(await createDeck(tauriDb, name, Date.now()));
  }

  return (
    <>
      <h1>
        <span lang="ja">単語帳</span> Decks
      </h1>
      <p className="muted decks-intro">
        Your own flashcards. Flip a card, then rate how well you remembered it. Decks marked "in daily reviews" mix into your normal reviews.
      </p>
      {error && <p className="error">{error}</p>}
      <form className="deck-new" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="New deck name, e.g. Song lyrics" aria-label="New deck name" />
        <button type="submit" className="primary" disabled={!name.trim()}>
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" /> New deck
        </button>
      </form>
      {decks && decks.length === 0 && <p className="muted">No decks yet. Make one above, or use "Add to deck" on any dictionary word or kanji.</p>}
      <ul className="deck-list">
        {decks?.map((d) => (
          <li key={d.id}>
            <button type="button" className="deck-tile" onClick={() => onOpen(d.id)}>
              <span className="deck-name">{d.name}</span>
              <span className="deck-counts">
                <span className="num">{d.cards}</span> {d.cards === 1 ? "card" : "cards"}
                {d.due > 0 && (
                  <>
                    {" · "}
                    <span className="num due">{d.due}</span> due
                  </>
                )}
              </span>
              <span className="deck-daily">{d.in_daily ? "In daily reviews" : "Studied separately"}</span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}

function DeckPage({ id, onBack, onStudy }: { id: number; onBack: () => void; onStudy: (all: boolean) => void }) {
  const [deck, setDeck] = useState<Deck>();
  const [cards, setCards] = useState<DeckCard[]>();
  const [renaming, setRenaming] = useState<string>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    Promise.all([getDeck(tauriDb, id, Date.now()), deckCards(tauriDb, id)])
      .then(([d, c]) => {
        setDeck(d);
        setCards(c);
      })
      .catch((e) => setError(String(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!deck || !cards) return <p className="muted">Loading…</p>;

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    if (renaming?.trim()) await renameDeck(tauriDb, id, renaming);
    setRenaming(undefined);
    load();
  }

  return (
    <>
      <button type="button" className="link deck-back" onClick={onBack}>
        <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" /> Decks
      </button>
      {renaming === undefined ? (
        <h1 className="deck-title">
          {deck.name}
          <button type="button" className="icon-action" aria-label="Rename deck" title="Rename" onClick={() => setRenaming(deck.name)}>
            <Pencil size={16} strokeWidth={1.75} />
          </button>
        </h1>
      ) : (
        <form className="deck-rename" onSubmit={saveName}>
          <input value={renaming} onChange={(e) => setRenaming(e.target.value)} autoFocus aria-label="Deck name" />
          <button type="submit" className="primary">
            Save
          </button>
          <button type="button" onClick={() => setRenaming(undefined)}>
            Cancel
          </button>
        </form>
      )}

      <div className="deck-actions">
        {deck.due > 0 ? (
          <button type="button" className="primary" onClick={() => onStudy(false)}>
            <Play size={16} strokeWidth={2} aria-hidden="true" /> Study {deck.due} due
          </button>
        ) : (
          <button type="button" className="primary" disabled={cards.length === 0} onClick={() => onStudy(true)} title="Nothing is due. Go through every card for practice; your ratings won't change when cards come back.">
            <Play size={16} strokeWidth={2} aria-hidden="true" /> Practice all
          </button>
        )}
        <label className="deck-toggle">
          <input
            type="checkbox"
            checked={!!deck.in_daily}
            onChange={async (e) => {
              await setDeckInDaily(tauriDb, id, e.target.checked);
              load();
            }}
          />
          In daily reviews
        </label>
        <span className="grow" />
        {confirmDelete ? (
          <>
            <span className="muted small">Delete this deck and its {cards.length} cards?</span>
            <button
              type="button"
              className="danger"
              onClick={async () => {
                await deleteDeck(tauriDb, id);
                onBack();
              }}
            >
              Delete
            </button>
            <button type="button" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="icon-action" aria-label="Delete deck" title="Delete deck" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <CardEditor
        submitLabel="Add card"
        onSave={async (front, back) => {
          await addDeckCard(tauriDb, id, front, back, null, Date.now());
          load();
        }}
      />

      <ul className="deck-cards">
        {cards.map((c) => (
          <CardRow key={c.id} card={c} onChange={load} />
        ))}
      </ul>
    </>
  );
}

/** Front and back boxes. Ctrl+Enter saves. */
function CardEditor({
  initial,
  submitLabel,
  onSave,
  onCancel,
}: {
  initial?: { front: string; back: string };
  submitLabel: string;
  onSave: (front: string, back: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [front, setFront] = useState(initial?.front ?? "");
  const [back, setBack] = useState(initial?.back ?? "");
  const ok = front.trim() !== "";

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ok) return;
    await onSave(front, back);
    if (!initial) {
      setFront("");
      setBack("");
    }
  }

  return (
    <form
      className="card-editor"
      onSubmit={save}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.ctrlKey) save();
      }}
    >
      <label>
        <span className="small muted">Front</span>
        <textarea lang="ja" rows={2} value={front} onChange={(e) => setFront(e.target.value)} autoFocus={!!initial} />
      </label>
      <label>
        <span className="small muted">Back</span>
        <textarea lang="ja" rows={2} value={back} onChange={(e) => setBack(e.target.value)} />
      </label>
      <div className="card-editor-actions">
        <button type="submit" className="primary" disabled={!ok}>
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <span className="muted small">Ctrl+Enter</span>
      </div>
    </form>
  );
}

function CardRow({ card, onChange }: { card: DeckCard; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  if (editing)
    return (
      <li className="deck-card editing">
        <CardEditor
          initial={card}
          submitLabel="Save"
          onSave={async (front, back) => {
            await updateDeckCard(tauriDb, card.id, front, back);
            setEditing(false);
            onChange();
          }}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  return (
    <li className="deck-card">
      <span lang="ja" className="deck-card-front">
        {card.front}
      </span>
      <span lang="ja" className="deck-card-back">
        {card.back}
      </span>
      <span className="deck-card-tools">
        <button type="button" className="icon-action" aria-label="Edit card" title="Edit" onClick={() => setEditing(true)}>
          <Pencil size={15} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="icon-action"
          aria-label="Delete card"
          title="Delete"
          onClick={async () => {
            await deleteDeckCard(tauriDb, card.id);
            onChange();
          }}
        >
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </span>
    </li>
  );
}

/** Studying one deck on its own: its due cards, or every card (`all`). */
function DeckStudy({ id, all, onExit }: { id: number; all: boolean; onExit: () => void }) {
  const [deck, setDeck] = useState<Deck>();
  const [cards, setCards] = useState<Map<number, DeckCard>>();
  const [session, setSession] = useState<Session<DeckQuestion>>();
  const [total, setTotal] = useState(0);
  const [turn, setTurn] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [error, setError] = useState<string>();
  /** The session state already rated: a second rating of it (a double press) is ignored. */
  const answered = useRef<Session<DeckQuestion>>(undefined);

  useEffect(() => {
    const now = Date.now();
    Promise.all([getDeck(tauriDb, id, now), all ? deckCards(tauriDb, id).then((c) => reviewedFirst(c, now)) : dueDeckCards(tauriDb, now, id)])
      .then(([d, list]) => {
        setDeck(d);
        setCards(new Map(list.map((c) => [c.id, c])));
        const s = startSession(list.map((c): DeckQuestion => ({ item_key: `deck:${c.id}`, card_type: "flip" })));
        setSession(s);
        setTotal(s.queue.length);
      })
      .catch((e) => setError(String(e)));
  }, [id, all]);

  if (error) return <p className="error">{error}</p>;
  if (!session || !cards) return <p className="muted">Loading…</p>;

  const question = stopped ? undefined : currentQuestion(session);
  const stats = sessionStats(session);
  if (!question) {
    return (
      <DoneView
        title={stopped ? "Nice, that's a wrap" : "Deck done!"}
        actions={
          <button className="primary" onClick={onExit} autoFocus>
            Back to {deck?.name ?? "the deck"}
          </button>
        }
      >
        {stats.answered > 0 && (
          <p className="done-stat">
            {stats.answered} cards · {Math.round((100 * stats.correctFirstTry) / stats.answered)}% not "Again"
          </p>
        )}
      </DoneView>
    );
  }

  const cardId = Number(question.item_key.slice("deck:".length));
  const card = cards.get(cardId)!;

  // "Practice all" (`all`) is just for practice: ratings move you through the
  // deck but aren't saved, so card schedules stay as they were.
  async function onRate(rating: Grade) {
    if (!session || answered.current === session) return;
    answered.current = session;
    const { session: next, firstAttempt } = answerCurrent(session, rating !== Rating.Again);
    try {
      if (firstAttempt && !all) await recordDeckReview(tauriDb, cardId, rating, Date.now());
    } catch (e) {
      answered.current = undefined;
      return setError(String(e));
    }
    setSession(next);
    setTurn((t) => t + 1);
  }

  return (
    <div className="session">
      <FlipCard
        key={turn}
        card={card}
        deckName={deck?.name}
        top={<SessionGauge done={stats.answered} total={total} note={all ? "practice · doesn't count" : undefined} />}
        onRate={onRate}
        onStop={() => setStopped(true)}
      />
    </div>
  );
}
