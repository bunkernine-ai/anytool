import { intentJsonSchema } from "../inject.js";
import type { RunInput, RunOutput } from "../engine.js";

export type LangChainToolShape = {
  name: string;
  description: string;
  schema: unknown;
  func: (args: RunInput) => Promise<RunOutput>;
};

export function asLangChainTool(opts: {
  instructions: () => string;
  run: (input: RunInput) => Promise<RunOutput>;
}): LangChainToolShape {
  return {
    name: "anytool",
    description: opts.instructions(),
    schema: intentJsonSchema,
    func: (args) => opts.run(args),
  };
}
