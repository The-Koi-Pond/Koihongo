// Test stand-in for the app database: same SQLite engine, run in-process.
// Mirrors src-tauri/src/db.rs: user db in memory, content db attached as `content`.

import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Db } from "../src/db/db.ts";

const CONTENT_SCHEMA = readFileSync(join(import.meta.dirname, "..", "scripts", "content", "schema.sql"), "utf8");

/** Opens a fresh user db with a content db built by `fill` (on top of the real content schema). */
export function openTestDb(fill: (content: DatabaseSync) => void): Db {
  const contentPath = join(mkdtempSync(join(tmpdir(), "nihongo-test-")), "content.db");
  const content = new DatabaseSync(contentPath);
  content.exec(CONTENT_SCHEMA);
  fill(content);
  content.close();
  return openDbWithContent(contentPath);
}

/** Opens a fresh in-memory user db with an existing content db attached. */
export function openDbWithContent(contentPath: string): Db {
  const conn = new DatabaseSync(":memory:");
  conn.prepare("ATTACH DATABASE ? AS content").run(contentPath);
  return {
    all: async <T>(sql: string, params: (string | number | null)[] = []) =>
      conn.prepare(sql).all(...params).map((row) => ({ ...row }) as T),
    batch: async (statements) => {
      conn.exec("BEGIN");
      try {
        for (const s of statements) conn.prepare(s.sql).run(...(s.params ?? []));
        conn.exec("COMMIT");
      } catch (e) {
        conn.exec("ROLLBACK");
        throw e;
      }
    },
  };
}
