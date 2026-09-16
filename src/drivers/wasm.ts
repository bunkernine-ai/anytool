import { PolicyDenied } from "../errors.js";
import { defineDriver, ok, type Driver } from "./define.js";

export function wasmDriver(modules: Record<string, (...args: unknown[]) => unknown>): Driver {
  return defineDriver({
    kind: "wasm",
    id: "wasm",
    async execute(ast) {
      const id = String(ast.arguments.moduleId);
      const fn = modules[id];
      if (!fn) throw new PolicyDenied("wasm module not registered");
      return ok(fn(...((ast.arguments.args as unknown[]) ?? [])));
    },
  });
}
