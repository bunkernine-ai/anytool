import { dbDriver, type DbBackend } from "./driver.js";
import { projectRow, rowMatches, type DbCommand } from "./command.js";

type Row = Record<string, unknown>;

function runStore(tables: Map<string, Row[]>): DbBackend {
  return async (command: DbCommand) => {
    const rows = tables.get(command.table) ?? [];
    const limit = command.limit ?? (command.action === "find" ? rows.length : 1);

    if (command.action === "insert") {
      const row = { ...(command.row ?? {}) };
      rows.push(row);
      tables.set(command.table, rows);
      return { inserted: 1, row };
    }

    if (command.action === "find") {
      return rows.filter((r) => rowMatches(r, command.where)).slice(0, limit).map((r) => projectRow(r, command.columns));
    }

    if (command.action === "update") {
      const patch = command.row ?? {};
      let n = 0;
      for (let i = 0; i < rows.length && n < limit; i += 1) {
        if (!rowMatches(rows[i], command.where)) continue;
        rows[i] = { ...rows[i], ...patch };
        n += 1;
      }
      tables.set(command.table, rows);
      return { updated: n };
    }

    if (command.action === "remove") {
      const keep: Row[] = [];
      let n = 0;
      for (const r of rows) {
        if (n < limit && rowMatches(r, command.where)) {
          n += 1;
          continue;
        }
        keep.push(r);
      }
      tables.set(command.table, keep);
      return { removed: n };
    }

    return { ok: false };
  };
}

/** SQLite-shaped db driver. Translates the command DSL; does not accept SQL from the agent. */
export function sqlite(seed?: Record<string, Row[]>) {
  const tables = new Map<string, Row[]>();
  if (seed) {
    for (const [name, rows] of Object.entries(seed)) {
      tables.set(name, rows.map((r) => ({ ...r })));
    }
  }
  return dbDriver({ id: "sqlite", run: runStore(tables) });
}
