// The app's view of the database: user.db with content.db attached as
// `content`. In the app this goes through Rust (tauriDb.ts); tests use an
// in-process SQLite (tests/nodeDb.ts) with the same behaviour.

export type SqlValue = string | number | null;
export type Statement = { sql: string; params?: SqlValue[] };

export interface Db {
  /** Runs a read query and returns its rows. */
  all<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  /** Runs write statements in one transaction: all succeed or none do. */
  batch(statements: Statement[]): Promise<void>;
}
