import { useEffect, useState } from "react";
import { tauriDb } from "../db/tauriDb.ts";
import { kanaGroups, startAsKnown, type KanaGroup, type KanaGroupName } from "../srs/progress.ts";
import { FIRST_REVIEW_DELAY_MS } from "../srs/scheduler.ts";

const GROUP_NAME: Record<KanaGroupName, string> = {
  basic: "Basic",
  dakuten: "Dakuten (voiced)",
  combo: "Combinations",
  extended: "Extended",
};

const groupId = (g: KanaGroup) => `${g.script}-${g.group}`;

/**
 * Library → Kana → "I already know these": tick the kana sets you know and
 * they start straight away on fast track, skipping their lessons and the
 * daily kana limit. Their first review still checks you really know them.
 */
export function KnownKana({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const [groups, setGroups] = useState<KanaGroup[]>();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    kanaGroups(tauriDb)
      .then(setGroups)
      .catch((e) => setError(String(e)));
  }, []);

  const chosen = (groups ?? []).filter((g) => picked.has(groupId(g)));
  const count = chosen.reduce((n, g) => n + g.notStarted.length, 0);

  async function start() {
    setBusy(true);
    try {
      const items = chosen.flatMap((g) => g.notStarted.map((item_key) => ({ item_key, kind: "kana" as const })));
      await startAsKnown(tauriDb, items, Date.now());
      setResult(
        `Started ${items.length} kana on fast track. Their first review comes in ${FIRST_REVIEW_DELAY_MS / 3_600_000} hours: get each right once and it passes.`,
      );
      setGroups(await kanaGroups(tauriDb));
      setPicked(new Set());
      onDone();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="known-kana">
      <p className="small">
        Tick the kana you already know. They start right away on fast track, without lessons, and their first review checks you really know them.
      </p>
      {error && <p className="error small">{error}</p>}
      {groups && (
        <div className="known-kana-scripts">
          {(["hiragana", "katakana"] as const).map((script) => (
            <fieldset key={script}>
              <legend>{script === "hiragana" ? "ひらがな Hiragana" : "カタカナ Katakana"}</legend>
              {groups
                .filter((g) => g.script === script)
                .map((g) => {
                  const id = groupId(g);
                  const done = g.notStarted.length === 0;
                  return (
                    <label key={id} className={done ? "muted" : ""}>
                      <input
                        type="checkbox"
                        disabled={done}
                        checked={picked.has(id)}
                        onChange={(e) => {
                          const next = new Set(picked);
                          if (e.target.checked) next.add(id);
                          else next.delete(id);
                          setPicked(next);
                          setResult(undefined);
                        }}
                      />
                      {GROUP_NAME[g.group]}{" "}
                      <span lang="ja" className="known-kana-sample">
                        {g.notStarted
                          .slice(0, 4)
                          .map((k) => k.slice("kana:".length))
                          .join(" ")}
                      </span>{" "}
                      <span className="muted small">{done ? "all started" : `${g.notStarted.length} not started`}</span>
                    </label>
                  );
                })}
            </fieldset>
          ))}
        </div>
      )}
      <div className="row">
        <button type="button" className="primary" disabled={count === 0 || busy} onClick={start}>
          {count === 0 ? "Start as known" : `Start ${count} as known`}
        </button>
        <button type="button" onClick={onClose}>
          Close
        </button>
        {result && <span className="small">{result}</span>}
      </div>
    </div>
  );
}
