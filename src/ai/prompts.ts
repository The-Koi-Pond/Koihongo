// AI prompts, kept in one place so they're easy to read and tune.

import type { ItemDetails } from "../items.ts";

/** Who the AI is talking to. Edit freely; it shapes the style of every mnemonic. */
export const LEARNER_PROFILE =
  "A beginner relearning kana and learning kanji. Loves anime, games and koi fish, and enjoys silly or vivid humour.";

export type MnemonicFocus = "meaning" | "reading";

/** Facts from our database, so the AI never has to recall readings or meanings itself. */
export function describeItem(item: ItemDetails): string {
  switch (item.kind) {
    case "kana":
      return [
        `Item: the ${item.script} character ${item.character}, read "${item.romaji}".`,
        item.counterpart && `The same sound in ${item.script === "hiragana" ? "katakana" : "hiragana"} is ${item.counterpart}.`,
        item.example &&
          `A common word starting with it: ${item.example.form} (${item.example.romaji}, "${item.example.meaning}"). It can make a good mnemonic hook, e.g. if the shape resembles the thing.`,
      ]
        .filter(Boolean)
        .join("\n");
    case "component":
      return [
        `Item: the kanji component ${item.display}, named "${item.name}".`,
        item.usedIn.length > 0 && `It appears in: ${item.usedIn.map((k) => `${k.character} (${k.meaning})`).join(", ")}.`,
      ]
        .filter(Boolean)
        .join("\n");
    case "kanji":
      return [
        `Item: the kanji ${item.character}.`,
        `Meanings: ${item.meanings.join(", ")}.`,
        item.onReadings.length > 0 && `On'yomi (katakana): ${item.onReadings.join(", ")}.`,
        item.kunReadings.length > 0 && `Kun'yomi (a "." marks where the kanji ends and kana follow): ${item.kunReadings.join(", ")}.`,
        `Components (use these names in meaning mnemonics): ${item.components.map((c) => `${c.display} "${c.name}"`).join(", ")}.`,
      ]
        .filter(Boolean)
        .join("\n");
    case "word":
      return [
        `Item: the word ${item.written}, read ${item.reading}.`,
        `Meanings: ${item.senses
          .slice(0, 3)
          .map((s) => s.glosses.join("; "))
          .join(" / ")}.`,
        item.kanji.length > 0 && `Kanji in it: ${item.kanji.map((k) => `${k.character} (${k.meaning})`).join(", ")}.`,
      ]
        .filter(Boolean)
        .join("\n");
  }
}

export function mnemonicSystemPrompt(item: ItemDetails, focus: MnemonicFocus): string {
  const current = item.notes[focus === "meaning" ? "mnemonic_meaning" : "mnemonic_reading"]?.text;
  const goal =
    item.kind === "kana"
      ? "the character's shape to its sound (describe what the shape looks like, and tie that image to the sound)"
      : focus === "meaning"
      ? item.kind === "word"
        ? "the word's look (its kanji) to its meaning"
        : "the shape (its components) to its meaning"
      : "the item to its reading, through a sound-alike English word or image";
  return `You help a Japanese learner write mnemonics inside Koihongo, a study app.
A mnemonic is a short, vivid story that links ${goal}.

About the learner: ${LEARNER_PROFILE}

${describeItem(item)}
Current ${focus} mnemonic: ${current ? `"${current}"` : "none yet"}

Rules:
- Use only the facts above for meanings, readings and component names. Never invent others.
- Meaning mnemonics: build the story from the component names (for kanji) or the kanji meanings (for words), and write the meaning in CAPITALS.
- Reading mnemonics: tie the reading's sound to a similar-sounding English word or image (e.g. しん → "shin"), write the reading in CAPITAL romaji, and connect it to the meaning.
- 1 to 3 sentences per mnemonic. Weird and funny is good: it just has to stick.
- Put every mnemonic you suggest on its own line, starting with "Mnemonic: ". The app turns those lines into "use this" buttons.
- Keep any other chat short and friendly. Plain text only, no markdown.`;
}

export function mnemonicOpener(item: ItemDetails, focus: MnemonicFocus): string {
  const hasCurrent = Boolean(item.notes[focus === "meaning" ? "mnemonic_meaning" : "mnemonic_reading"]);
  return hasCurrent
    ? `My current ${focus} mnemonic isn't working for me. Can you suggest 3 different ones?`
    : `Can you suggest 3 options for a ${focus} mnemonic?`;
}

/** Pulls the "Mnemonic: …" lines out of a reply. */
export function extractMnemonics(reply: string): string[] {
  return reply
    .split("\n")
    .map((line) => /^\s*(?:\d+[.)]\s*)?(?:\*\*)?mnemonic(?:\*\*)?\s*:\s*(?:\*\*)?\s*(.+?)\s*$/i.exec(line)?.[1])
    .filter((m): m is string => Boolean(m));
}
