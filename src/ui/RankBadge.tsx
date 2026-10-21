import { RANK_NAME, type Rank } from "../srs/ranks.ts";

const CLASS: Record<Rank, string> = { B: "b", A: "a", S: "s", "★": "star" };

/** An item's rank as a little pixel chip: B, A, S or ★. */
export function RankBadge({ rank }: { rank: Rank }) {
  return (
    <span className={`rank-badge rank-${CLASS[rank]}`} title={`${rank} rank: ${RANK_NAME[rank]}`}>
      {rank}
    </span>
  );
}
