import assert from "node:assert/strict";
import { test } from "node:test";
import { AUTO_EVERY_MS, backupKind, backupName, isAutoBackupDue } from "../src/backup.ts";

test("backup names carry their kind and local time, and the kind reads back", () => {
  const at = new Date(2026, 9, 5, 7, 3, 9);
  assert.equal(backupName("manual", at), "manual-2026-10-05_070309.db");
  assert.equal(backupName("before-restore", at), "before-restore-2026-10-05_070309.db");
  for (const kind of ["auto", "manual", "before-restore"] as const) assert.equal(backupKind(backupName(kind, at)), kind);
});

test("an automatic backup is due when the newest automatic one is old enough", () => {
  const now = 10 * AUTO_EVERY_MS;
  assert.equal(isAutoBackupDue([], now), true);
  assert.equal(isAutoBackupDue([{ name: "auto-a.db", size: 1, modified: now - 1000 }], now), false);
  assert.equal(isAutoBackupDue([{ name: "auto-a.db", size: 1, modified: now - AUTO_EVERY_MS }], now), true);
  // A recent manual backup doesn't count.
  assert.equal(isAutoBackupDue([{ name: "manual-a.db", size: 1, modified: now }], now), true);
});
