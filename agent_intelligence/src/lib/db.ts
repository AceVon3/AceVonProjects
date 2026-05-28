import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// Singleton read-only connection to the committed SQLite file. The app
// never writes to filings.db — only scripts/import_filings.py does.
let _db: Database.Database | null = null;
let _asOf: string | null = null;

const DATA_DIR = path.join(process.cwd(), "data");

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(DATA_DIR, "filings.db");
  _db = new Database(dbPath, { readonly: true, fileMustExist: true });
  return _db;
}

// Data freshness date (YYYY-MM-DD) written by scripts/import_filings.py.
// Queries anchor the rolling window to this — NOT date('now') — so that
// production is deterministic per data snapshot and the spec's verification
// numbers don't drift with the wall clock.
export function getDataAsOf(): string {
  if (_asOf) return _asOf;
  const txt = fs.readFileSync(
    path.join(DATA_DIR, "last_updated.txt"),
    "utf-8",
  ).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
    throw new Error(`data/last_updated.txt: expected YYYY-MM-DD, got ${JSON.stringify(txt)}`);
  }
  _asOf = txt;
  return _asOf;
}
