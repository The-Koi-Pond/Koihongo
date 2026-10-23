// Backups of your progress (user.db), stored in Documents\Koihongo\Backups by
// the Rust side (src-tauri/src/backup.rs). One is made automatically each day.

import { SCHEMA_VERSION } from "./db/migrations.ts";
import { invoke } from "@tauri-apps/api/core";

export type BackupKind = "auto" | "manual" | "before-restore";
export type BackupInfo = { name: string; size: number; modified: number };

/** Automatic backups kept; older ones are deleted. Manual ones are never deleted. */
export const AUTO_KEEP = 14;
/** A new automatic backup is made when the newest is older than this (so roughly daily). */
export const AUTO_EVERY_MS = 20 * 60 * 60 * 1000;

const pad = (n: number) => String(n).padStart(2, "0");

/** "manual-2026-10-20_224512.db", in local time. */
export function backupName(kind: BackupKind, at: Date): string {
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
  const time = `${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `${kind}-${date}_${time}.db`;
}

export function backupKind(name: string): BackupKind {
  return name.startsWith("before-restore-") ? "before-restore" : name.startsWith("auto-") ? "auto" : "manual";
}

export function isAutoBackupDue(backups: BackupInfo[], now: number): boolean {
  const newest = Math.max(0, ...backups.filter((b) => backupKind(b.name) === "auto").map((b) => b.modified));
  return now - newest >= AUTO_EVERY_MS;
}

export const listBackups = (): Promise<BackupInfo[]> => invoke("backup_list");
export const createBackup = (kind: BackupKind): Promise<BackupInfo> => invoke("backup_create", { name: backupName(kind, new Date()) });
export const openBackupsFolder = (): Promise<void> => invoke("backup_open_folder");

/** Makes the day's automatic backup if it's due, and deletes old automatic ones. */
export async function autoBackupIfDue(): Promise<void> {
  if (!isAutoBackupDue(await listBackups(), Date.now())) return;
  await createBackup("auto");
  await invoke("backup_prune", { kind: "auto", keep: AUTO_KEEP });
}

/** Backs up your current progress, then replaces it with the named backup. */
export async function restoreBackup(name: string): Promise<void> {
  await createBackup("before-restore");
  await invoke("backup_restore", { name, maxSchema: SCHEMA_VERSION });
}
