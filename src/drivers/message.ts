import { defineDriver, ok, type Driver } from "./define.js";

export function messageDriver(kind: "email" | "sms", out: unknown[] = []): Driver {
  return defineDriver({
    kind,
    id: kind,
    async execute(ast) {
      const rec = { to: ast.arguments.to, templateId: ast.arguments.templateId, vars: ast.arguments.vars };
      out.push(rec);
      return ok(rec);
    },
  });
}
