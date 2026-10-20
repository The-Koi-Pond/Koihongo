// Dictionary meanings often carry notes in parentheses ("dog (Canis (lupus)
// familiaris)", "president (of a society)"). These split them out so the UI can
// fade them.

export type GlossPart = { text: string; note: boolean };

/** Splits text into plain parts and "(…)" notes, treating nested parentheses as one note. */
export function splitNotes(text: string): GlossPart[] {
  const parts: GlossPart[] = [];
  let current = "";
  let depth = 0;
  const flush = (note: boolean) => {
    if (current) parts.push({ text: current, note });
    current = "";
  };
  for (const ch of text) {
    if (ch === "(" && depth === 0) {
      flush(false);
      depth = 1;
      current = ch;
    } else if (ch === "(") {
      depth++;
      current += ch;
    } else if (ch === ")" && depth > 0) {
      current += ch;
      if (--depth === 0) flush(true);
    } else {
      current += ch;
    }
  }
  flush(depth > 0); // an unclosed "(" still counts as a note
  return parts;
}
