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

/** The mnemonic workshop's instructions for Deki-senpai (on top of its persona). */
export function mnemonicInstructions(item: ItemDetails, focus: MnemonicFocus): string {
  const current = item.notes[focus === "meaning" ? "mnemonic_meaning" : "mnemonic_reading"]?.text;
  const goal =
    item.kind === "kana"
      ? "the character's shape to its sound (describe what the shape looks like, and tie that image to the sound)"
      : focus === "meaning"
      ? item.kind === "word"
        ? "the word's look (its kanji) to its meaning"
        : "the shape (its components) to its meaning"
      : "the item to its reading, through a sound-alike English word or image";
  return `You're helping them write a ${focus} mnemonic: a short, vivid story that links ${goal}.

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

/**
 * A request to Deki-senpai: the short message shown as yours in the chat, and
 * the instructions sent with it behind the scenes (the facts, the shape of the answer).
 */
export type DekiRequest = { message: string; instructions: string };

/** "Explain" on an example sentence: readings come from our dictionary, so Deki only has to explain. */
export function explainSentenceRequest(sentence: SentenceToExplain, words: SentenceWord[]): DekiRequest {
  const facts = words.map(
    (w) => `- ${w.written} (${w.reading}): ${w.meaning}. ${w.started ? "The learner has studied this word." : "New to the learner."}`,
  );
  return {
    message: `Break this sentence down for me: ${sentence.japanese}`,
    instructions: `They asked about an example sentence on a word's page.
Sentence: ${sentence.japanese}
English translation (from a volunteer-made corpus; usually right, sometimes loose): ${sentence.english}
The learner is studying the word ${sentence.word.written} (${sentence.word.reading}): ${sentence.word.meaning}.
${facts.length > 0 ? `Dictionary facts for the words written with kanji in it (use these readings and meanings; if one appears conjugated, say so):\n${facts.join("\n")}\n` : ""}
Answer the breakdown request like this, starting straight with 1., in plain text:
1. The whole sentence in kana, then the same in romaji on the next line.
2. The sentence piece by piece, one piece per line: "piece (reading) – what it means and what it does here". Include particles, and split conjugated forms into their parts (e.g. 食べたくない = 食べ (taberu) + たい "want to" + ない "not").
3. At most 3 short grammar notes, only about things in this sentence (e.g. "〜たい = want to"). Explain any grammar word the first time.
4. "Translation: " and a natural English translation. If the given one is loose, say how in a few words.
Answer follow-up questions briefly and directly.`,
  };
}

// --- Reading: "Explain" on a marked box ---

/** A marked box to explain: its kind (speech bubble, sound effect…), its Japanese, and whether that was read automatically and unsure. */
export type BoxToExplain = { kind: string; text: string; unsure: boolean };

/**
 * "Explain" on a box (or a pasted line): the box and the shape of the answer.
 * Where it is (the series' notes, the page's other boxes) Deki already knows
 * from the page (src/deki).
 */
export function explainBoxRequest(box: BoxToExplain): DekiRequest {
  const sfx = box.kind === "SFX";
  return {
    message: `Explain this ${box.kind === "Text" ? "line" : box.kind.toLowerCase()} for me: ${box.text}`,
    instructions: `They asked you to explain a ${box.kind === "Text" ? "line of text" : box.kind.toLowerCase()}: ${box.text}
${box.unsure ? "It was read off the page automatically and the reader wasn't sure, so it may have a misread character or two. If something looks misread, say what it probably is.\n" : ""}
Answer like this, starting straight with 1., in plain text:
1. The text in kana, then the same in romaji on the next line.
${
  sfx
    ? `2. What this sound effect depicts here (a sound, a movement, a feeling or a state) and its feel, in two or three short lines. If it's a well-known one, mention the word it comes from.`
    : `2. The text piece by piece, one piece per line: "piece (reading) – what it means and what it does here". Include particles, and split conjugated forms into their parts.
3. At most 3 short grammar notes, only about things in this text (e.g. "〜たい = want to"). Explain any grammar word the first time.
4. If the context or the text around it changes the meaning or tone (who's speaking, politeness, a name, a joke), "Context: " and one or two sentences on how.`
}
${sfx ? "3" : "5"}. "Translation: " and a short, natural English rendering that fits.
Answer follow-up questions briefly and directly.`,
  };
}

/** /translate in Reading: every box on the page, in order. */
export const TRANSLATE_PAGE_REQUEST: DekiRequest = {
  message: "Translate this page for me.",
  instructions:
    'They asked for a translation of every box on this page. Give it in order, one per line: "Speech 1: (natural English)". Keep names and tone consistent with what you know of the manga. If a box looks misread, say so after its line.',
};

/** The parts of an "Explain" reply the learner can keep: its kana line (a reading) and its translation. */
export function explainedParts(reply: string): { kana?: string; translation?: string } {
  const lines = reply.split("\n").map((l) => l.trim());
  // The "1." line (Deki may say hello first), else the first line.
  const kana = (lines.find((l) => /^1[.)]\s*\S/.test(l)) ?? lines.find(Boolean))?.replace(/^1[.)]\s*/, "");
  const translation = lines.find((l) => /^(\d[.)]\s*)?translation\s*:/i.test(l))?.replace(/^(\d[.)]\s*)?translation\s*:\s*/i, "");
  // Only a kana line counts as a reading (not an apology or a question back).
  const isKana = !!kana && /^[\p{Script=Hiragana}\p{Script=Katakana}ー〜\s、。！？!?…・「」『』　]+$/u.test(kana);
  return { kana: isKana ? kana : undefined, translation: translation || undefined };
}

// --- Reading: "Read with AI" (a box's picture to its text) ---

export const READ_IMAGE_SYSTEM = "You read Japanese text out of manga images, exactly as written.";

/** What to ask with a box's picture; `kind`: Speech, SFX, Sign… */
export function readImagePrompt(kind: string): string {
  return `This is a box cut out of a manga page (${kind}). Write out the Japanese text in it, exactly as drawn, as one line:
- Keep small kana (っ, ゃ), long marks (ー) and punctuation (！？…) as drawn.
- Leave out furigana (the small reading hints beside kanji).
- For a stylised sound effect, write the kana it spells.
- If there's no Japanese text in it, reply with exactly: (none)
Reply with only the text, nothing else.`;
}

/** The text from a "Read with AI" reply: quotes and a "(none)" taken off. */
export function readImageReply(reply: string): string {
  const text = reply.trim().split("\n")[0].trim().replace(/^[「『"“]+|[」』"”]+$/g, "");
  return /^\(none\)$/i.test(text) ? "" : text;
}
