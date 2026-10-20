import { splitNotes } from "../gloss.ts";

/** A dictionary meaning with its "(…)" notes faded. */
export function Gloss({ text }: { text: string }) {
  return (
    <>
      {splitNotes(text).map((part, i) =>
        part.note ? (
          <span key={i} className="gloss-note">
            {part.text}
          </span>
        ) : (
          part.text
        ),
      )}
    </>
  );
}
