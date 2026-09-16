import type { CommandAst, StrongIntent } from "./kinds";

function targetOf(intent: StrongIntent): string {
  const ch = intent.channel;
  if (ch === "fs" || ch === "net") return String(intent.path ?? "");
  if (ch === "db") return String(intent.table ?? "");
  if (ch === "payment")
    return String(intent.invoiceId ?? intent.refundId ?? "");
  if (ch === "wasm") return String(intent.moduleId ?? "");
  if (ch === "event") return String(intent.key ?? "");
  if (ch === "secret") return String(intent.name ?? "");
  if (ch === "email" || ch === "sms") return String(intent.to ?? "");
  if (ch === "shell")
    return String((intent.argv as string[] | undefined)?.[0] ?? "");
  if (ch === "auth") return String(intent.role ?? "whoami");
  if (ch === "logger") return String(intent.event ?? "");
  if (ch === "crypto") return String(intent.algorithm ?? "random");
  return intent.channel;
}

export function compileAst(
  intent: StrongIntent,
  policyId: string,
  timeoutMs: number,
): CommandAst {
  const { channel, action, ...rest } = intent;
  return {
    protocol: "anytool-v1",
    module: channel,
    action: action.toUpperCase(),
    target: targetOf(intent),
    arguments: rest,
    constraints: { timeoutMs },
    policyId,
    policyVersion: "1",
  };
}
