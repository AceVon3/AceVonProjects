import Database from "better-sqlite3";
import path from "node:path";

// Singleton read-only connection to the committed SQLite file. The app
// never writes to filings.db — only scripts/import_filings.py does.
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = path.join(process.cwd(), "data", "filings.db");
  _db = new Database(dbPath, { readonly: true, fileMustExist: true });
  return _db;
}
