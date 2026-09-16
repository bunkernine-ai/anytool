import { defineDriver, ok, type Driver } from "./define.js";

export function loggerDriver(sink: Array<{ level: string; event: string; data: unknown }> = []): Driver {
  return defineDriver({
    kind: "logger",
    id: "logger",
    async execute(ast) {
      const data = { ...((ast.arguments.data as object) ?? {}) } as Record<string, unknown>;
      sink.push({ level: ast.action.toLowerCase(), event: String(ast.arguments.event), data });
      return ok({ logged: true });
    },
  });
}
