import { intentJsonSchema } from "../inject.js";
import type { RunInput, RunOutput } from "../engine.js";

export type AiSdkToolShape = {
  description: string;
  inputSchema: unknown;
  execute: (args: RunInput) => Promise<RunOutput>;
};

export function asAiSdkTool(opts: {
  instructions: () => string;
  run: (input: RunInput) => Promise<RunOutput>;
}): AiSdkToolShape {
  return {
    description: opts.instructions(),
    inputSchema: intentJsonSchema,
    execute: (args) => opts.run(args),
  };
}
