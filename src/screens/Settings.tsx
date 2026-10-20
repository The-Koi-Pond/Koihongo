import { ArchiveRestore, FolderOpen, Gauge, HardDriveDownload, ScrollText } from "lucide-react";
import { useEffect, useState } from "react";
import { backupKind, createBackup, listBackups, openBackupsFolder, restoreBackup, AUTO_KEEP, type BackupInfo, type BackupKind } from "../backup.ts";
import { migrate } from "../db/migrations.ts";
import { tauriDb } from "../db/tauriDb.ts";
import { DEFAULT_PACING, loadPacing, PACING_LIMITS, savePacing, type Pacing } from "../srs/settings.ts";

export function Settings({ onOpenSources }: { onOpenSources: () => void }) {
  return (
    <div className="settings">
      <h1>
        <span lang="ja">設定</span> Settings
      </h1>
      <PacingCard />
      <BackupsCard />
      <section className="card row space-between">
        <div>
          <h2>
            <ScrollText size={16} aria-hidden="true" /> Sources &amp; licences
          </h2>
          <p className="muted">Credits for the dictionary, kanji and sentence data.</p>
        </div>
        <button onClick={onOpenSources}>Open</button>
      </section>
    </div>
  );
}

const FIELDS: { key: keyof Pacing; label: string; help: string; unit: string }[] = [
  { key: "newPerDay", label: "Lessons per day", help: "New components, kanji and words each day.", unit: "items" },
  { key: "kanaPerDay", label: "Kana per day", help: "New kana each day, on top of the lessons above.", unit: "kana" },
  {
    key: "pauseLessonsAtDue",
    label: "Pause lessons at",
    help: "New lessons shrink as due reviews pile up, and stop at this many, so a missed day can't snowball.",
    unit: "due reviews",
  },
  { key: "dayStartsAtHour", label: "New day starts at", help: "Study after midnight still counts as the day before until this hour.", unit: "" },
];

const hourLabel = (h: number) => (h === 0 ? "midnight" : h === 12 ? "noon" : `${h} am`);

function PacingCard() {
  const [saved, setSaved] = useState<Pacing>();
  const [draft, setDraft] = useState<Record<keyof Pacing, string>>();
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    loadPacing(tauriDb).then((p) => {
      setSaved(p);
      setDraft(asText(p));
    });
  }, []);

  if (!saved || !draft) return <section className="card muted">Loading…</section>;

  const values = Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, Number(v)])) as Pacing;
  const changed = (Object.keys(saved) as (keyof Pacing)[]).some((k) => String(saved[k]) !== draft[k]);
  const isDefault = (Object.keys(DEFAULT_PACING) as (keyof Pacing)[]).every((k) => String(DEFAULT_PACING[k]) === draft[k]);

  async function save() {
    try {
      await savePacing(tauriDb, values);
      setSaved(values);
      setStatus({ ok: true, text: "Saved ✓" });
    } catch (e) {
      setStatus({ ok: false, text: String(e).replace(/^Error: /, "") });
    }
  }

  return (
    <section className="card">
      <h2>
        <Gauge size={16} aria-hidden="true" /> Pacing
      </h2>
      <form
        className="setting-list"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {FIELDS.map((f) => {
          const { min, max } = PACING_LIMITS[f.key];
          const id = `pacing-${f.key}`;
          return (
            <div key={f.key} className="setting">
              <div>
                <label htmlFor={id}>{f.label}</label>
                <p className="muted small">{f.help}</p>
              </div>
              <div className="setting-input">
                {f.key === "dayStartsAtHour" ? (
                  <select id={id} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                    {Array.from({ length: max - min + 1 }, (_, i) => min + i).map((h) => (
                      <option key={h} value={h}>
                        {hourLabel(h)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type="number"
                    min={min}
                    max={max}
                    step={1}
                    value={draft[f.key]}
                    onChange={(e) => {
                      setDraft({ ...draft, [f.key]: e.target.value });
                      setStatus(undefined);
                    }}
                  />
                )}
                <span className="muted small setting-unit">{f.unit}</span>
              </div>
            </div>
          );
        })}
        <div className="row">
          <button type="submit" className="primary" disabled={!changed}>
            Save
          </button>
          <button
            type="button"
            disabled={isDefault}
            onClick={() => {
              setDraft(asText(DEFAULT_PACING));
              setStatus(undefined);
            }}
          >
            Reset to defaults
          </button>
          {status && <span className={status.ok ? "saved" : "error"}>{status.text}</span>}
        </div>
      </form>
    </section>
  );
}

const asText = (p: Pacing) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)])) as Record<keyof Pacing, string>;

const KIND_LABEL: Record<BackupKind, string> = { auto: "Automatic", manual: "Manual", "before-restore": "Before a restore" };

function BackupsCard() {
  const [backups, setBackups] = useState<BackupInfo[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState<string>();

  const refresh = () =>
    listBackups()
      .then(setBackups)
      .catch((e) => setError(String(e)));
  useEffect(() => {
    refresh();
  }, []);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function restore(name: string) {
    await run(async () => {
      await restoreBackup(name);
      await migrate(tauriDb); // an older backup may need the newer tables
    });
    // Start fresh so every screen shows the restored progress.
    location.reload();
  }

  return (
    <section className="card">
      <h2>
        <HardDriveDownload size={16} aria-hidden="true" /> Backups
      </h2>
      <p className="muted">
        Your progress is backed up automatically once a day (the last {AUTO_KEEP} are kept) to <code>Documents\Koihongo\Backups</code>. Copy that
        folder to a USB stick or cloud drive for extra safety.
      </p>
      <div className="row">
        <button className="primary" disabled={busy} onClick={() => run(() => createBackup("manual"))}>
          Back up now
        </button>
        <button disabled={busy} onClick={() => run(openBackupsFolder)}>
          <FolderOpen size={16} aria-hidden="true" /> Open folder
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {backups && backups.length > 0 && (
        <ul className="backup-list">
          {backups.map((b) => (
            <li key={b.name}>
              <span>{new Date(b.modified).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
              <span className="muted small">
                {KIND_LABEL[backupKind(b.name)]} · {Math.max(1, Math.round(b.size / 1024))} KB
              </span>
              {confirming === b.name ? (
                <span className="backup-confirm">
                  <span className="small">Replace your current progress with this? (It's backed up first.)</span>
                  <button className="primary" disabled={busy} onClick={() => restore(b.name)}>
                    Restore
                  </button>
                  <button disabled={busy} onClick={() => setConfirming(undefined)}>
                    Cancel
                  </button>
                </span>
              ) : (
                <button className="icon-text" disabled={busy} onClick={() => setConfirming(b.name)}>
                  <ArchiveRestore size={15} aria-hidden="true" /> Restore
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {backups && backups.length === 0 && <p className="muted small">No backups yet.</p>}
    </section>
  );
}
