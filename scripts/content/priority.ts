// Word frequency from raw JMdict priority tags. jmdict-simplified only keeps a
// common yes/no flag, so we read the ranks from the original XML.
// Lower score = more frequent.

export const NO_PRIORITY = 99;

// The nf ranks come from newspaper text, which favours political jargon (国会)
// and fragments of longer words (国人 from 外国人). Words that only the
// newspaper lists vouch for are pushed back by this much.
export const NEWS_ONLY_PENALTY = 15;
const EVERYDAY_TAGS = new Set(["ichi1", "spec1", "spec2", "gai1"]);

export function priorityScore(tag: string): number {
  // nf01..nf48: rank band of 500 words in a newspaper word-frequency list.
  const nf = /^nf(\d\d)$/.exec(tag);
  if (nf) return Number(nf[1]);
  if (tag === "news1" || tag === "ichi1" || tag === "spec1") return 49;
  if (tag === "spec2" || tag === "gai1") return 50;
  if (tag === "news2" || tag === "ichi2" || tag === "gai2") return 60;
  return NO_PRIORITY;
}

/** JMdict entry id → priority score (best across all its forms). */
export function parsePriorities(xml: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const entry of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const body = entry[1];
    const id = /<ent_seq>(\d+)<\/ent_seq>/.exec(body)?.[1];
    if (!id) continue;
    const tags = [...body.matchAll(/<(?:ke|re)_pri>([^<]+)<\/(?:ke|re)_pri>/g)].map((m) => m[1]);
    if (tags.length === 0) {
      out.set(id, NO_PRIORITY);
      continue;
    }
    const best = Math.min(...tags.map(priorityScore));
    out.set(id, tags.some((t) => EVERYDAY_TAGS.has(t)) ? best : best + NEWS_ONLY_PENALTY);
  }
  return out;
}
