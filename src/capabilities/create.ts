import { compileAst } from "../ast.js";
import { auditAllow, type AuditRecord } from "../audit.js";
import type { Driver } from "../drivers/define.js";
import { PolicyDenied } from "../errors.js";
import { evaluateIntent } from "../evaluate.js";
import type { CommandAst, CoreKind, PolicyDocument, StrongIntent } from "../kinds.js";
import { assertStrongIntent } from "../schema.js";

export type Capability = {
  execute: (command: unknown) => Promise<unknown>;
};

export function commandToIntent(kind: CoreKind, command: unknown): StrongIntent {
  if (!command || typeof command !== "object" || Array.isArray(command)) {
    throw new PolicyDenied("capability execute requires a command object");
  }
  const rec = command as Record<string, unknown>;
  const action = rec.action;
  if (typeof action !== "string" || !action) {
    throw new PolicyDenied("capability command requires action");
  }
  const { action: _a, channel: _c, ...rest } = rec;
  return { channel: kind, action, ...rest } as StrongIntent;
}

export function createCapability(opts: {
  kind: CoreKind;
  driver: Driver;
  policy: PolicyDocument;
  timeoutMs?: number;
  onAllow?: (rec: AuditRecord, ast: CommandAst, data: unknown) => void;
}): Capability {
  const timeoutMs = opts.timeoutMs ?? opts.policy.timeoutMs ?? 5000;
  return {
    async execute(command: unknown) {
      const intent = commandToIntent(opts.kind, command);
      const checked = assertStrongIntent(intent);
      evaluateIntent(opts.policy, checked);
      const ast = compileAst(checked, opts.policy.policyId, timeoutMs);
      if (ast.module === "logger") {
        const slice = opts.policy.kinds.logger;
        const redact = (slice?.redactKeys as string[] | undefined) ?? [];
        const data = { ...((ast.arguments.data as object) ?? {}) } as Record<string, unknown>;
        for (const key of redact) delete data[key];
        ast.arguments.data = data;
      }
      const executed = await opts.driver.execute(ast);
      const rec = auditAllow(ast);
      opts.onAllow?.(rec, ast, executed.data);
      return executed.data;
    },
  };
}
