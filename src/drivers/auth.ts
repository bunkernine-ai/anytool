import { defineDriver, ok, type Driver } from "./define.js";

export function authDriver(principal = { id: "agent", roles: ["user"] }): Driver {
  return defineDriver({
    kind: "auth",
    id: "auth",
    async execute(ast) {
      if (ast.action === "WHOAMI") return ok(principal);
      return ok({ asserted: ast.arguments.role });
    },
  });
}
