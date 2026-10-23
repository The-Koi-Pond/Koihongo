// Browser mode (dev server only): lets the app run in a plain browser at
// http://localhost:1420, so UI changes can be clicked through with Playwright.
// src/dev/browserBridge.ts sends the app's Tauri calls here, and this answers
// them the way src-tauri does: the database calls run against a fresh copy of
// your progress (made on the first call after the dev server starts) with
// content.db attached. Your real user.db is only read, never written.
// Backups and AI only work in the desktop app. Reading's file pickers are
// stood in for by KOIHONGO_TEST_BOOKS ("picking" adds the books in that
// folder) and KOIHONGO_TEST_IMAGES ("Add images" adds every image in it).
// Chapters you make and covers you pick go in temp folders, not Documents
// (covers picked in the desktop app are read from Documents, never written).

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { unzipSync } from "fflate";
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
      case "book_pick": {
        const dir = process.env.KOIHONGO_TEST_BOOKS;
        if (!dir) throw new Error("Browser mode: start the dev server with KOIHONGO_TEST_BOOKS set to a folder of test books.");
        return scanBooks(dir);
      }
      case "book_pages":
        return bookPages(String(args.path));
      case "book_page": {
        const path = String(args.path);
        const name = String(args.name);
        if (!bookPages(path).includes(name)) throw new Error(`${name} isn't a page of this book`);
        return statSync(path).isDirectory() ? readFileSync(join(path, name)) : unzipSync(readFileSync(path), { filter: (f) => f.name === name })[name];
      }
      case "book_new": {
        const title = String(args.title).trim();
        const root = join(tmpdir(), "koihongo-browser-mode-books");
        let dir = join(root, title.replace(/[<>:"/\\|?*]/g, " ") || "Chapter");
        for (let n = 2; existsSync(dir); n++) dir = `${dir.replace(/ \(\d+\)$/, "")} (${n})`;
        mkdirSync(dir, { recursive: true });
        return { path: dir, title, kind: "made", pages: 0, series: null };
      }
      case "book_add_images": {
        const from = process.env.KOIHONGO_TEST_IMAGES;
        if (!from) throw new Error("Browser mode: start the dev server with KOIHONGO_TEST_IMAGES set to a folder of test images.");
        const dir = String(args.path);
        const order = bookPages(dir);
        const added = readdirSync(from)
          .filter((n) => IMAGE.test(n))
          .sort(naturally)
          .map((n) => {
            let name = n;
            for (let i = 2; existsSync(join(dir, name)); i++) name = n.replace(/(\.[^.]+)$/, ` (${i})$1`);
            copyFileSync(join(from, n), join(dir, name));
            return name;
          });
        writeFileSync(join(dir, ORDER_FILE), [...order, ...added].join("\n"));
        return added;
      }
      case "series_cover_pick": {
        const from = process.env.KOIHONGO_TEST_IMAGES;
        if (!from) throw new Error("Browser mode: start the dev server with KOIHONGO_TEST_IMAGES set to a folder of test images.");
        const image = readdirSync(from).filter((n) => IMAGE.test(n)).sort(naturally)[0];
        const prefix = `series-${Number(args.seriesId)}-`;
        mkdirSync(COVERS, { recursive: true });
        for (const old of readdirSync(COVERS).filter((n) => n.startsWith(prefix))) rmSync(join(COVERS, old));
        const name = `${prefix}${Date.now()}.${image.split(".").pop()!.toLowerCase()}`;
        copyFileSync(join(from, image), join(COVERS, name));
        return name;
      }
      case "series_cover": {
        const name = String(args.name);
        if (!/^series-[\w.-]+$/.test(name) || name.includes("..")) throw new Error("not a cover");
        // Covers picked here, or else (only read) the ones the copied user.db names, picked in the desktop app.
        const here = join(COVERS, name);
        return readFileSync(existsSync(here) ? here : join(homedir(), "Documents", "Koihongo", "Covers", name));
      }
      case "series_cover_remove": {
        const prefix = `series-${Number(args.seriesId)}-`;
        if (existsSync(COVERS)) for (const old of readdirSync(COVERS).filter((n) => n.startsWith(prefix))) rmSync(join(COVERS, old));
        return null;
      }
      case "book_rename_page": {
        const dir = String(args.path);
        const from = String(args.page);
        const order = bookPages(dir);
        const ext = from.split(".").pop()!;
        const stem = String(args.name).replace(new RegExp(`\\.${ext}$`), "").replace(/[<>:"/\\|?*]/g, " ").trim();
        if (!stem) throw new Error("Give the page a name.");
        const to = `${stem}.${ext}`;
        if (to.toLowerCase() !== from.toLowerCase() && existsSync(join(dir, to))) throw new Error(`There's already a page called ${stem}.`);
        renameSync(join(dir, from), join(dir, to));
        writeFileSync(join(dir, ORDER_FILE), order.map((p) => (p === from ? to : p)).join("\n"));
        return to;
      }
      case "book_arrange": {
        const dir = String(args.path);
        const pages = args.pages as string[];
        const current = bookPages(dir);
        if (pages.some((p, i) => !current.includes(p) || pages.indexOf(p) !== i)) throw new Error("not a page of this chapter");
        for (const gone of current.filter((p) => !pages.includes(p))) rmSync(join(dir, gone));
        writeFileSync(join(dir, ORDER_FILE), pages.join("\n"));
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
            // Page images go as raw bytes, like Tauri's ipc::Response.
            if (result instanceof Uint8Array) {
              res.setHeader("content-type", "application/octet-stream");
              return res.end(result);
            }
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

// Reading, as src-tauri/src/books.rs does it (close enough for trying the UI).
const IMAGE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const ORDER_FILE = ".koihongo-order.txt";
const COVERS = join(tmpdir(), "koihongo-browser-mode-covers");
const naturally = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;

function bookPages(path: string): string[] {
  if (!existsSync(path)) throw new Error("Koihongo can't find this book's pages any more.");
  const names = statSync(path).isDirectory()
    ? readdirSync(path, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name)
    : Object.keys(unzipSync(readFileSync(path), { filter: (f) => IMAGE.test(f.name) }));
  const sorted = names.filter((n) => IMAGE.test(n) && !basename(n).startsWith(".") && !n.startsWith("__MACOSX")).sort(naturally);
  const orderFile = join(path, ORDER_FILE);
  if (!existsSync(orderFile)) return sorted;
  const ordered = [...new Set(readFileSync(orderFile, "utf8").split("\n"))].filter((n) => sorted.includes(n));
  return [...ordered, ...sorted.filter((n) => !ordered.includes(n))];
}

function scanBooks(path: string) {
  const name = (p: string) => basename(p).replace(/\.(cbz|zip)$/i, "");
  const found = (p: string, series: string | null) => {
    try {
      const pages = bookPages(p).length;
      return pages ? [{ path: p, title: name(p), kind: statSync(p).isDirectory() ? "folder" : "cbz", pages, series }] : [];
    } catch {
      return [];
    }
  };
  const self = found(path, null);
  if (self.length) return self;
  return readdirSync(path)
    .sort(naturally)
    .flatMap((child) => found(join(path, child), name(path)));
}

/** Same conversions as src-tauri/src/db.rs: booleans become 0/1; only null, numbers and strings pass. */
function toParams(values: unknown): SQLInputValue[] {
  return ((values as unknown[] | undefined) ?? []).map((v) => {
    if (v === null || typeof v === "number" || typeof v === "string") return v;
    if (typeof v === "boolean") return v ? 1 : 0;
    throw new Error("SQL parameters must be null, boolean, number or string");
  });
}
