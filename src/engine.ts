import { asAiSdkTool as toAiSdkTool } from "./adapters/ai-sdk.js";
import { asLangChainTool as toLangChainTool } from "./adapters/langchain.js";
import { createCapability, sdkNameFor, type Capability } from "./capabilities/index.js";
import { auditDeny, type AuditRecord } from "./audit.js";
import type { Driver } from "./drivers/define.js";
import { BootError, PolicyDenied } from "./errors.js";
import { injectFragment } from "./inject.js";
import { runIsolated } from "./isolate.js";
import type { CommandAst, CoreKind, PolicyDocument } from "./kinds.js";
import { isCoreKind } from "./kinds.js";
import { resolvePolicy } from "./resolve-policy.js";

export type RunInput = {
  code: string;
  input?: unknown;
};

export type RunOutput = {
  ok: true;
  data: unknown;
  ast: CommandAst | null;
  audit: AuditRecord;
};

export type CreateAnyToolOptions = {
  /** RFC-0001 document. If omitted, fs/db use the built-in sandbox policy. */
  policy?: unknown;
  drivers: Driver[] | Partial<Record<CoreKind, Driver>>;
  allowUnsignedPolicy?: boolean;
  policyJws?: string;
};

function normalizeDrivers(raw: CreateAnyToolOptions["drivers"]): Map<CoreKind, Driver> {
  const list = Array.isArray(raw) ? raw : Object.values(raw).filter((d): d is Driver => Boolean(d));
  const map = new Map<CoreKind, Driver>();
  for (const d of list) {
    if (!isCoreKind(d.kind)) throw new BootError(`driver kind ${d.kind} is not a core kind`);
    map.set(d.kind, d);
  }
  return map;
}

export function createAnyTool(opts: CreateAnyToolOptions) {
  const drivers = normalizeDrivers(opts.drivers);
  const policy: PolicyDocument = resolvePolicy(opts.policy, drivers.keys());
  if (policy.environment === "production" && !opts.allowUnsignedPolicy && !opts.policyJws) {
    throw new BootError("RFC-0001: unsigned policy MUST be rejected in production");
  }
  for (const kind of drivers.keys()) {
    if (!policy.kinds[kind]) {
      throw new BootError(`RFC-0001: bound driver ${kind} has no kind slice`);
    }
  }
  const timeoutMs = policy.timeoutMs ?? 5000;
  const auditLog: AuditRecord[] = [];

  async function run(input: RunInput): Promise<RunOutput> {
    if (typeof input?.code !== "string") {
      const rec = auditDeny(policy.policyId, "code is required");
      auditLog.push(rec);
      throw new PolicyDenied("code is required");
    }

    let lastAst: CommandAst | null = null;
    let lastAudit: AuditRecord | null = null;
    const capabilities: Record<string, Capability> = {};
    for (const [kind, driver] of drivers) {
      capabilities[sdkNameFor(kind)] = createCapability({
        kind,
        driver,
        policy,
        timeoutMs,
        onAllow(rec, ast) {
          lastAst = ast;
          lastAudit = rec;
          auditLog.push(rec);
        },
      });
    }

    try {
      const data = await runIsolated({
        code: input.code,
        input: input.input,
        timeoutMs,
        capabilities,
      });
      const audit =
        lastAudit ??
        ({
          at: new Date().toISOString(),
          allowed: true,
          policyId: policy.policyId,
          policyVersion: "1" as const,
        } satisfies AuditRecord);
      return { ok: true, data, ast: lastAst, audit };
    } catch (err) {
      const reason = err instanceof PolicyDenied ? err.reason : String(err);
      const rec = auditDeny(policy.policyId, reason);
      auditLog.push(rec);
      if (err instanceof PolicyDenied) throw err;
      throw new PolicyDenied(reason);
    }
  }

  function instructions(): string {
    return injectFragment(policy, [...drivers.values()]);
  }

  function asAiSdkTool() {
    return toAiSdkTool({ instructions, run });
  }

  function asLangChainTool() {
    return toLangChainTool({ instructions, run });
  }

  return {
    run,
    instructions,
    asAiSdkTool,
    asLangChainTool,
    auditLog,
    policy,
  };
}
