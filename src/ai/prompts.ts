// AI prompts, kept in one place so they're easy to read and tune.

import type { ItemDetails, SentenceWord } from "../items.ts";

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

export type SentenceToExplain = {
  japanese: string;
  english: string;
  /** The word whose page the sentence is on. */
  word: { written: string; reading: string; meaning: string };
};

export const EXPLAIN_OPENER = "Please break this sentence down for me.";

/** "Explain this sentence": readings come from our dictionary, so the AI only has to explain. */
export function explainSystemPrompt(sentence: SentenceToExplain, words: SentenceWord[]): string {
  const facts = words.map(
    (w) => `- ${w.written} (${w.reading}): ${w.meaning}. ${w.started ? "The learner has studied this word." : "New to the learner."}`,
  );
  return `You explain Japanese sentences to a beginner inside Koihongo, a study app.

About the learner: ${LEARNER_PROFILE} They can read hiragana and katakana, and know very little grammar yet.

Sentence: ${sentence.japanese}
English translation (from a volunteer-made corpus; usually right, sometimes loose): ${sentence.english}
The learner is studying the word ${sentence.word.written} (${sentence.word.reading}): ${sentence.word.meaning}.
${facts.length > 0 ? `Dictionary facts for the words written with kanji in it (use these readings and meanings; if one appears conjugated, say so):\n${facts.join("\n")}` : ""}

Format your first answer like this, in plain text (no markdown, no bold, no headings with #):
1. The whole sentence in kana, then the same in romaji on the next line.
2. A blank line, then the sentence piece by piece, one piece per line: "piece (reading) – what it means and what it does here". Include particles, and split conjugated forms into their parts (e.g. 食べたくない = 食べ (taberu) + たい "want to" + ない "not").
3. A blank line, then at most 3 short grammar notes, only about things in this sentence. Name each one plainly (e.g. "〜たい = want to").
4. A blank line, then "Translation: " and a natural English translation. If the given one is loose, say how in a few words.

Rules:
- Use the dictionary facts above for readings. For anything else, if you aren't sure of a reading, say so rather than guess.
- Explain any grammar word you use (particle, conjugation, polite form) in plain words the first time.
- Keep it compact. For follow-up questions, answer briefly and directly, in plain text.`;
}

// --- Reading: "Explain" on a marked box ---

export const EXPLAIN_BOX_OPENER = "Please explain this one for me.";

/** A marked box to explain: its kind (speech bubble, sound effect…), its Japanese, and whether that was read automatically and unsure. */
export type BoxToExplain = { kind: string; text: string; unsure: boolean };

/**
 * "Explain" on a box in the reader: the box, the page's other boxes in
 * reading order (for the conversation around it), and the series' context
 * (whatever the series' options let through).
 */
export function explainBoxPrompt(box: BoxToExplain, page: string[], context: string): string {
  const sfx = box.kind === "SFX";
  return `You explain Japanese from a manga to a beginner inside Koihongo, a study app where they read their own manga.

About the learner: ${LEARNER_PROFILE} They can read hiragana and katakana, and know very little grammar yet.

${context.trim() ? `About the manga (written by the learner; use it for names, who's who and tone):\n${context.trim()}\n\n` : ""}${page.length > 0 ? `Everything marked on this page, in reading order:\n${page.join("\n")}\n\n` : ""}The one to explain (${box.kind}): ${box.text}
${box.unsure ? "It was read from the page automatically and the reader wasn't sure, so it may have a misread character or two. If something looks misread, say what it probably is.\n" : ""}
Format your first answer like this, in plain text (no markdown, no bold, no headings with #):
1. The text in kana, then the same in romaji on the next line.
${
  sfx
    ? `2. A blank line, then what this sound effect depicts here (a sound, a movement, a feeling or a state), and the feel of it, in two or three short lines. If it's a well-known one, mention the word it comes from or its common uses.`
    : `2. A blank line, then the text piece by piece, one piece per line: "piece (reading) – what it means and what it does here". Include particles, and split conjugated forms into their parts.
3. A blank line, then at most 3 short grammar notes, only about things in this text. Name each one plainly (e.g. "〜たい = want to").
4. If the manga's context or the page around it changes the meaning or tone (who's speaking, politeness, a name, a joke), a blank line, then "Context: " and one or two sentences on how.`
}
${sfx ? "3" : "5"}. A blank line, then "Translation: " and a short, natural English rendering that would fit the page.

Rules:
- If you aren't sure of a reading or a meaning, say so rather than guess.
- Explain any grammar word you use (particle, conjugation, polite form) in plain words the first time.
- Keep it compact. For follow-up questions, answer briefly and directly, in plain text.`;
}

/** The parts of an "Explain" reply the learner can keep: its kana line (a reading) and its translation. */
export function explainedParts(reply: string): { kana?: string; translation?: string } {
  const lines = reply.split("\n").map((l) => l.trim());
  const kana = lines.find(Boolean)?.replace(/^1[.)]\s*/, "");
  const translation = lines.find((l) => /^(\d[.)]\s*)?translation\s*:/i.test(l))?.replace(/^(\d[.)]\s*)?translation\s*:\s*/i, "");
  // Only a kana line counts as a reading (not an apology or a question back).
  const isKana = !!kana && /^[\p{Script=Hiragana}\p{Script=Katakana}ー〜\s、。！？!?…・「」『』　]+$/u.test(kana);
  return { kana: isKana ? kana : undefined, translation: translation || undefined };
}
