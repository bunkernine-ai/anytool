import { createHash } from "node:crypto";
import type { CommandAst } from "./kinds";

export type AuditRecord = {
  at: string;
  allowed: boolean;
  policyId: string;
  policyVersion: "1";
  module?: string;
  action?: string;
  argumentsSha256?: string;
  reason?: string;
};

export function hashArgs(args: Record<string, unknown>): string {
  const canonical = JSON.stringify(args, Object.keys(args).sort());
  return createHash("sha256").update(canonical).digest("hex");
}

export function auditAllow(ast: CommandAst): AuditRecord {
  return {
    at: new Date().toISOString(),
    allowed: true,
    policyId: ast.policyId,
    policyVersion: "1",
    module: ast.module,
    action: ast.action,
    argumentsSha256: hashArgs(ast.arguments),
  };
}

export function auditDeny(policyId: string, reason: string): AuditRecord {
  return {
    at: new Date().toISOString(),
    allowed: false,
    policyId,
    policyVersion: "1",
    reason,
  };
}
