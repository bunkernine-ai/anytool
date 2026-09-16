import { PolicyDenied } from "../../errors.js";
import type { CommandAst } from "../../kinds.js";

export type DbAction = "find" | "insert" | "update" | "remove";

/** What the operation is — never SQL, MQL, or a vendor payload. */
export type DbCommand = {
  action: DbAction;
  table: string;
  where?: Record<string, unknown>;
  columns?: string[];
  limit?: number;
  row?: Record<string, unknown>;
};

const ACTIONS: DbAction[] = ["find", "insert", "update", "remove"];

export function dbCommandFromAst(ast: CommandAst): DbCommand {
  const action = ast.action.toLowerCase() as DbAction;
  if (!ACTIONS.includes(action)) throw new PolicyDenied("db unknown action");
  const table = String(ast.arguments.table ?? ast.target);
  const where = ast.arguments.where;
  const columns = ast.arguments.columns;
  const limit = ast.arguments.limit;
  const row = ast.arguments.row;
  return {
    action,
    table,
    where: where && typeof where === "object" && !Array.isArray(where) ? (where as Record<string, unknown>) : undefined,
    columns: Array.isArray(columns) ? columns.map(String) : undefined,
    limit: typeof limit === "number" ? limit : undefined,
    row: row && typeof row === "object" && !Array.isArray(row) ? (row as Record<string, unknown>) : undefined,
  };
}

/** `{ country: "BD" }` is equality. `{ eq, in, and }` remain available. */
export function rowMatches(row: Record<string, unknown>, where: Record<string, unknown> | undefined): boolean {
  if (!where) return true;
  const eq =
    where.eq && typeof where.eq === "object" && !Array.isArray(where.eq)
      ? (where.eq as Record<string, unknown>)
      : undefined;
  for (const [k, v] of Object.entries(where)) {
    if (k === "eq" || k === "in" || k === "and") continue;
    if (row[k] !== v) return false;
  }
  if (eq) {
    for (const [k, v] of Object.entries(eq)) {
      if (row[k] !== v) return false;
    }
  }
  if (where.in && typeof where.in === "object") {
    for (const [k, vs] of Object.entries(where.in as Record<string, unknown>)) {
      if (!Array.isArray(vs) || !vs.includes(row[k])) return false;
    }
  }
  if (Array.isArray(where.and)) {
    return where.and.every((clause) =>
      clause && typeof clause === "object" ? rowMatches(row, clause as Record<string, unknown>) : false,
    );
  }
  return true;
}

export function projectRow(row: Record<string, unknown>, columns: string[] | undefined): Record<string, unknown> {
  if (!columns?.length) return { ...row };
  const out: Record<string, unknown> = {};
  for (const c of columns) {
    if (c in row) out[c] = row[c];
  }
  return out;
}
