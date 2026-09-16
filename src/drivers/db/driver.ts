import type { CommandAst } from "../../kinds";
import { defineDriver, ok, type Driver, type DriverResult } from "../define";
import { dbCommandFromAst, type DbCommand } from "./command";

/** Host/community backends implement this. They never see SQL from the agent. */
export type DbBackend = (command: DbCommand) => Promise<unknown>;

export function dbDriver(spec: { id: string; run: DbBackend }): Driver {
  return defineDriver({
    kind: "db",
    id: spec.id,
    async execute(ast: CommandAst): Promise<DriverResult> {
      const command = dbCommandFromAst(ast);
      return ok(await spec.run(command));
    },
  });
}
