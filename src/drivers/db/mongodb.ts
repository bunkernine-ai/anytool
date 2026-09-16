import { dbDriver, type DbBackend } from "./driver.js";

/** MongoDB driver: host supplies how each DbCommand becomes a collection call. */
export function mongodb(run: DbBackend) {
  return dbDriver({ id: "mongodb", run });
}
