import { invoke } from "@tauri-apps/api/core";
import type { Db } from "./db.ts";

/** Db backed by the Rust commands in src-tauri/src/db.rs. */
export const tauriDb: Db = {
  all: (sql, params = []) => invoke("db_query", { sql, params }),
  batch: (statements) =>
    invoke("db_batch", { statements: statements.map((s) => ({ sql: s.sql, params: s.params ?? [] })) }),
};
