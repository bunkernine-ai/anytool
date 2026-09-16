import { PolicyDenied } from "../errors.js";
import { defineDriver, ok, type Driver } from "./define.js";

export function secretDriver(store: Record<string, string>): Driver {
  return defineDriver({
    kind: "secret",
    id: "secret",
    async execute(ast) {
      const name = String(ast.arguments.name);
      if (!(name in store)) throw new PolicyDenied("secret not bound");
      return ok({ ref: `secret:${name}`, purpose: ast.arguments.purpose });
    },
  });
}
