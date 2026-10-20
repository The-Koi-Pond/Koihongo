// Placeholder pages for planned sections (see docs/04-roadmap.md).

export type PlannedSection = "dictionary" | "grammar" | "reading" | "settings";

const PLANS: Record<PlannedSection, { ja: string; en: string; phase: string; intro: string; planned: string[] }> = {
  dictionary: {
    ja: "辞書",
    en: "Dictionary",
    phase: "Phase 3",
    intro: "Look up any word or kanji, not just the ones on your path.",
    planned: [
      "Search by English, kana, romaji or kanji",
      "Find kanji by picking the components you can see",
      "Example sentences for every word, preferring words you already know",
      "Add any word to your reviews",
      "“Explain this sentence” with AI",
    ],
  },
  grammar: {
    ja: "文法",
    en: "Grammar",
    phase: "Phase 4",
    intro: "Grammar points in a beginner-to-intermediate order, reviewed in the same daily session as kanji.",
    planned: [
      "Plain-English explanations and sentence patterns",
      "Example sentences built from vocabulary you've learned",
      "Fill-in-the-blank reviews",
      "Links between related grammar points",
    ],
  },
  reading: {
    ja: "読書",
    en: "Reading",
    phase: "Phase 5",
    intro: "Read real Japanese with help, and save what you find.",
    planned: [
      "Paste text and hover any word for its meaning",
      "Words you know are marked; unknown ones are easy to add",
      "Save sentences as review cards (sentence mining)",
      "Maybe: AI-written graded readings at your level",
    ],
  },
  settings: {
    ja: "設定",
    en: "Settings",
    phase: "Phase 1",
    intro: "Pacing and housekeeping.",
    planned: [
      "Lessons per day and review backlog limit",
      "Backup and restore your progress",
      "Catch-up mode after a break",
      "AI model choice per feature",
    ],
  },
};

export function ComingSoon({ section, extra }: { section: PlannedSection; extra?: React.ReactNode }) {
  const plan = PLANS[section];
  return (
    <>
      <h1>
        <span lang="ja">{plan.ja}</span> {plan.en}
      </h1>
      <section className="card coming-soon">
        <p className="soon-tag">Coming in {plan.phase}</p>
        <p>{plan.intro}</p>
        <h3>Planned</h3>
        <ul>
          {plan.planned.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
      {extra}
    </>
  );
}
