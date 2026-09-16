import type { CommandAst } from "../kinds.js";
import { defineDriver, ok, type Driver } from "./define.js";

export function memoryNet(handler?: (ast: CommandAst) => unknown): Driver {
  return defineDriver({
    kind: "net",
    id: "memory-net",
    async execute(ast) {
      if (handler) return ok(handler(ast));
      return ok({ statusCode: 200, data: { mocked: true, host: ast.arguments.host } });
    },
  });
}
