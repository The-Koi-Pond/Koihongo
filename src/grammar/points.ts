// Grammar points, in the order most beginner textbooks teach them (roughly
// Genki chapters 1–3, JLPT N5). Explanations are our own, drafted with AI
// help; `checked` turns true once Xel has read and approved a point.
//
// Markup:
// - pattern: words separated by spaces; [Noun] is a slot you fill in, anything
//   else is the fixed grammar.
// - examples: {braces} mark the grammar piece, highlighted on the page.
//   `kana` is the reading, given when the sentence has kanji.

export type GrammarExample = { ja: string; kana?: string; en: string };

export type GrammarPoint = {
  key: string;
  title: string;
  /** Short English gloss, shown under the title. */
  meaning: string;
  pattern: string;
  explanation: string[];
  examples: GrammarExample[];
  related: string[];
  checked?: boolean;
};

export const GRAMMAR: GrammarPoint[] = [
  {
    key: "wa-desu",
    title: "は … です",
    meaning: "X is Y",
    pattern: "[Noun] は [Noun] です",
    explanation: [
      "The first sentence shape most learners meet. It says one thing is another: \"X is Y\".",
      "は marks the topic, the thing you're talking about. It's written with the hiragana は (ha), but as a particle it's always said \"wa\".",
      "です goes at the end and makes the sentence polite. It works like \"is / am / are\", and it never changes for I, you or they.",
      "Japanese often leaves the topic out when it's obvious, so 学生です on its own can mean \"I'm a student.\"",
    ],
    examples: [
      { ja: "わたし{は}学生{です}。", kana: "わたしはがくせいです。", en: "I'm a student." },
      { ja: "田中さん{は}先生{です}。", kana: "たなかさんはせんせいです。", en: "Mr./Ms. Tanaka is a teacher." },
      { ja: "これ{は}本{です}。", kana: "これはほんです。", en: "This is a book." },
    ],
    related: ["ka", "mo", "janai"],
  },
  {
    key: "ka",
    title: "か",
    meaning: "question marker",
    pattern: "[Sentence] か",
    explanation: [
      "Put か at the end of a polite sentence to turn it into a question. The word order stays the same.",
      "In writing, a question with か usually ends in 。 rather than ？, though you'll see ？ in casual text.",
      "Question words like なん (what) and だれ (who) go where the answer would go: それはなんですか, \"What is that?\"",
    ],
    examples: [
      { ja: "学生です{か}。", kana: "がくせいですか。", en: "Are you a student?" },
      { ja: "山田さんは日本人です{か}。", kana: "やまださんはにほんじんですか。", en: "Is Mr./Ms. Yamada Japanese?" },
      { ja: "それはなんです{か}。", en: "What is that?" },
    ],
    related: ["wa-desu", "ne-yo"],
  },
  {
    key: "no",
    title: "の",
    meaning: "'s / of: links two nouns",
    pattern: "[Noun] の [Noun]",
    explanation: [
      "の joins two nouns, with the first one describing the second. Often it works like English 's: わたしの本 is \"my book\".",
      "It covers more than owning things: 日本語の先生 is \"a Japanese teacher\" (one who teaches Japanese), and 大学の学生 is \"a university student\".",
      "The order is the reverse of English \"of\": the describing noun comes first.",
    ],
    examples: [
      { ja: "わたし{の}本です。", kana: "わたしのほんです。", en: "It's my book." },
      { ja: "日本語{の}先生です。", kana: "にほんごのせんせいです。", en: "(They're) a Japanese teacher." },
      { ja: "これはだれ{の}かさですか。", en: "Whose umbrella is this?" },
    ],
    related: ["kono-sono", "wa-desu"],
  },
  {
    key: "kore-sore",
    title: "これ・それ・あれ・どれ",
    meaning: "this one / that one / that one over there / which one",
    pattern: "これ/それ/あれ は [Noun] です",
    explanation: [
      "These point at things. Japanese has three distances where English has two:",
      "これ is near me (the speaker), それ is near you (the listener), and あれ is away from both of us. どれ asks \"which one?\" out of three or more.",
      "They stand on their own like nouns, so they can take は: これは…",
    ],
    examples: [
      { ja: "{これ}はペンです。", en: "This is a pen." },
      { ja: "{それ}はなんですか。", en: "What's that (near you)?" },
      { ja: "{どれ}ですか。", en: "Which one is it?" },
    ],
    related: ["kono-sono", "koko-soko"],
  },
  {
    key: "kono-sono",
    title: "この・その・あの・どの",
    meaning: "this ~ / that ~ / that ~ over there / which ~",
    pattern: "この/その/あの [Noun]",
    explanation: [
      "The same three distances as これ・それ・あれ, but these can't stand alone: they always come right before a noun.",
      "これ is \"this one\"; この本 is \"this book\". どの asks \"which…?\".",
    ],
    examples: [
      { ja: "{この}本はわたしのです。", kana: "このほんはわたしのです。", en: "This book is mine." },
      { ja: "{あの}人はだれですか。", kana: "あのひとはだれですか。", en: "Who is that person over there?" },
      { ja: "{どの}かさですか。", en: "Which umbrella is it?" },
    ],
    related: ["kore-sore", "no"],
  },
  {
    key: "koko-soko",
    title: "ここ・そこ・あそこ・どこ",
    meaning: "here / there / over there / where",
    pattern: "[Noun] は ここ/そこ/あそこ です",
    explanation: [
      "The place versions of これ・それ・あれ, with the same three distances: ここ is near me, そこ near you, あそこ away from both of us. どこ asks \"where?\".",
      "トイレはどこですか (\"Where's the toilet?\") is one of the most useful sentences you'll learn.",
    ],
    examples: [
      { ja: "トイレは{どこ}ですか。", en: "Where is the toilet?" },
      { ja: "駅は{あそこ}です。", kana: "えきはあそこです。", en: "The station is over there." },
      { ja: "{ここ}はわたしの大学です。", kana: "ここはわたしのだいがくです。", en: "This is my university." },
    ],
    related: ["kore-sore", "kono-sono"],
  },
  {
    key: "mo",
    title: "も",
    meaning: "also, too",
    pattern: "[Noun] も …",
    explanation: [
      "も means \"also\" or \"too\". It takes the place of は rather than being added to it.",
      "If Tanaka is a student and Yamada is one too: 山田さんも学生です.",
    ],
    examples: [
      { ja: "わたし{も}学生です。", kana: "わたしもがくせいです。", en: "I'm a student too." },
      { ja: "これ{も}わたしの本です。", kana: "これもわたしのほんです。", en: "This is my book too." },
      { ja: "山田さん{も}日本人ですか。", kana: "やまださんもにほんじんですか。", en: "Is Mr./Ms. Yamada Japanese too?" },
    ],
    related: ["wa-desu"],
  },
  {
    key: "janai",
    title: "じゃないです",
    meaning: "is not",
    pattern: "[Noun] じゃないです",
    explanation: [
      "The negative of です: \"is not / am not / are not\".",
      "じゃありません means the same and sounds a little more formal. ではありません is more formal still, mostly seen in writing.",
      "じゃ is the everyday contraction of では (said \"de wa\").",
    ],
    examples: [
      { ja: "わたしは先生{じゃないです}。", kana: "わたしはせんせいじゃないです。", en: "I'm not a teacher." },
      { ja: "それはわたしのかさ{じゃないです}。", en: "That isn't my umbrella." },
      { ja: "田中さんは学生{じゃありません}。", kana: "たなかさんはがくせいじゃありません。", en: "Mr./Ms. Tanaka isn't a student." },
    ],
    related: ["wa-desu"],
  },
  {
    key: "ne-yo",
    title: "ね・よ",
    meaning: "right? / you know",
    pattern: "[Sentence] ね / よ",
    explanation: [
      "Little words at the very end of a sentence that add feeling.",
      "ね looks for agreement, like \"isn't it?\" or \"right?\". Use it when you expect the other person to already know or agree.",
      "よ tells the other person something they may not know, like \"you know\" or a friendly \"I tell you\". Too much よ can sound pushy.",
    ],
    examples: [
      { ja: "いい天気です{ね}。", kana: "いいてんきですね。", en: "Nice weather, isn't it?" },
      { ja: "それはわたしのです{よ}。", en: "That one's mine, you know." },
      { ja: "田中さんは先生です{よ}。", kana: "たなかさんはせんせいですよ。", en: "Mr./Ms. Tanaka is a teacher, you know." },
    ],
    related: ["ka"],
  },
  {
    key: "masu",
    title: "ます",
    meaning: "polite verb ending",
    pattern: "[Verb stem] ます",
    explanation: [
      "Verbs in their polite form end in ます. The same form covers now and the future: 行きます is \"I go\" or \"I'll go\".",
      "Japanese verbs don't change for I, you, he or they, and the verb comes at the end of the sentence.",
      "For \"don't / won't\", swap ます for ません: 行きません.",
    ],
    examples: [
      { ja: "毎日、日本語を勉強し{ます}。", kana: "まいにち、にほんごをべんきょうします。", en: "I study Japanese every day." },
      { ja: "あした、東京に行き{ます}。", kana: "あした、とうきょうにいきます。", en: "I'll go to Tokyo tomorrow." },
      { ja: "コーヒーを飲み{ません}。", kana: "コーヒーをのみません。", en: "I don't drink coffee." },
    ],
    related: ["wa-desu"],
  },
];

export const grammarPoint = (key: string) => GRAMMAR.find((p) => p.key === key);

/** Splits example markup into plain and {highlighted} parts. */
export function markedParts(text: string): { text: string; mark: boolean }[] {
  return text
    .split(/(\{[^}]*\})/)
    .filter(Boolean)
    .map((part) => (part.startsWith("{") ? { text: part.slice(1, -1), mark: true } : { text: part, mark: false }));
}

/** Splits a pattern into [slots] and fixed grammar. */
export function patternParts(pattern: string): { text: string; slot: boolean }[] {
  return pattern.split(" ").map((part) => (part.startsWith("[") ? { text: part.slice(1, -1), slot: true } : { text: part, slot: false }));
}
