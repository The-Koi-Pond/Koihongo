// Browser mode (dev server only): lets the app run in a plain browser at
// http://localhost:1420, so UI changes can be clicked through with Playwright.
// src/dev/browserBridge.ts sends the app's Tauri calls here, and this answers
// them the way src-tauri does: the database calls run against a fresh copy of
// your progress (made on the first call after the dev server starts) with
// content.db attached. Your real user.db is only read, never written.
// Backups and AI only work in the desktop app.

import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { Plugin } from "vite";

/** Must match src/dev/browserBridge.ts. */
const INVOKE_PATH = "/__koihongo/invoke";

type Statement = { sql: string; params?: unknown[] };

export function browserMode(): Plugin {
  let db: DatabaseSync | undefined;
  let projectRoot = process.cwd();

  const open = (): DatabaseSync => {
    if (db) return db;
    const dir = join(tmpdir(), "koihongo-browser-mode");
    mkdirSync(dir, { recursive: true });
    // Old copies from earlier server starts; one still open by a restarting server is locked, so skip it.
    for (const f of readdirSync(dir)) {
      try {
        rmSync(join(dir, f), { force: true });
      } catch {
        // still in use
      }
    }
    // A new file per server start: Vite restarts its server on config changes, and the old one may still hold its copy.
    const copy = join(dir, `user-${Date.now()}.db`);
    const real = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "com.xel.nihongo", "user.db");
    if (existsSync(real)) {
      // VACUUM INTO gives a consistent copy even while the desktop app has the file open.
      const source = new DatabaseSync(real, { readOnly: true });
      source.prepare("VACUUM INTO ?").run(copy);
      source.close();
    }
    db = new DatabaseSync(copy);
    db.exec("PRAGMA foreign_keys = ON");
    db.prepare("ATTACH DATABASE ? AS content").run(join(projectRoot, "src-tauri", "resources", "content.db"));
    return db;
  };

  const handle = (cmd: string, args: Record<string, unknown>): unknown => {
    switch (cmd) {
      case "db_query": {
        const rows = open().prepare(String(args.sql)).all(...toParams(args.params));
        return rows.map((row) => ({ ...row }));
      }
      case "db_batch": {
        const conn = open();
        conn.exec("BEGIN");
        try {
          for (const s of args.statements as Statement[]) {
            try {
              conn.prepare(s.sql).run(...toParams(s.params));
            } catch (e) {
              throw new Error(`${(e as Error).message} (in: ${s.sql})`);
            }
          }
          conn.exec("COMMIT");
        } catch (e) {
          conn.exec("ROLLBACK");
          throw e;
        }
        return null;
      }
      case "backup_list":
        return [];
      case "ai_complete":
      case "backup_create":
      case "backup_prune":
      case "backup_restore":
      case "backup_open_folder":
        throw new Error("Only available in the desktop app (this is browser mode).");
      default:
        // Window controls and other plugin calls: nothing to do in a browser.
        if (cmd.startsWith("plugin:")) return null;
        throw new Error(`Unknown command in browser mode: ${cmd}`);
    }
  };

  return {
    name: "koihongo-browser-mode",
    apply: "serve",
    configureServer(server) {
      projectRoot = server.config.root;
      server.httpServer?.on("close", () => {
        db?.close();
        db = undefined;
      });
      server.middlewares.use(INVOKE_PATH, (req: IncomingMessage, res: ServerResponse) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end();
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            const { cmd, args } = JSON.parse(body) as { cmd: string; args?: Record<string, unknown> };
            const result = handle(cmd, args ?? {});
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify(result ?? null));
          } catch (e) {
            res.statusCode = 500;
            res.end(e instanceof Error ? e.message : String(e));
          }
        });
      });
    },
  };
}

/** Same conversions as src-tauri/src/db.rs: booleans become 0/1; only null, numbers and strings pass. */
function toParams(values: unknown): SQLInputValue[] {
  return ((values as unknown[] | undefined) ?? []).map((v) => {
    if (v === null || typeof v === "number" || typeof v === "string") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    throw new Error("SQL parameters must be null, boolean, number or string");
  });
}
