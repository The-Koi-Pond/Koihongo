// Placeholder pages for planned sections (see docs/04-roadmap.md).

export type PlannedSection = "reading";

const PLANS: Record<PlannedSection, { ja: string; en: string; phase: string; intro: string; planned: string[] }> = {
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
};

export function ComingSoon({ section }: { section: PlannedSection }) {
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
    </>
  );
}
