import { defineDriver, ok, type Driver } from "./define.js";

export function shellDriver(run?: (argv: string[], cwd?: string) => Promise<unknown>): Driver {
  return defineDriver({
    kind: "shell",
    id: "shell",
    async execute(ast) {
      const argv = ast.arguments.argv as string[];
      if (!run) return ok({ argv, skipped: true });
      return ok(await run(argv, ast.arguments.cwd as string | undefined));
    },
  });
}
