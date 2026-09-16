import { dbDriver, type DbBackend } from "./driver.js";

/** Postgres driver: host supplies how each DbCommand becomes SQL. */
export function postgres(run: DbBackend) {
  return dbDriver({ id: "postgres", run });
}
