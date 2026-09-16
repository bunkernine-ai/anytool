import { defineDriver, ok, type Driver } from "./define.js";

export function eventDriver(bus: Map<string, unknown[]> = new Map()): Driver {
  return defineDriver({
    kind: "event",
    id: "event",
    async execute(ast) {
      const key = String(ast.arguments.key ?? ast.target);
      if (ast.action === "EMIT") {
        const list = bus.get(key) ?? [];
        list.push(ast.arguments.data);
        bus.set(key, list);
        return ok({ emitted: true });
      }
      return ok({ data: bus.get(key) ?? [] });
    },
  });
}
