export const CORE_KINDS = [
  "fs",
  "net",
  "db",
  "payment",
  "os",
  "shell",
  "wasm",
  "event",
  "auth",
  "crypto",
  "secret",
  "logger",
  "email",
  "sms",
] as const;

export type CoreKind = (typeof CORE_KINDS)[number];

export type StrongIntent = {
  channel: CoreKind;
  action: string;
  [key: string]: unknown;
};

export type CommandAst = {
  protocol: "anytool-v1";
  module: CoreKind;
  action: string;
  target: string;
  arguments: Record<string, unknown>;
  constraints?: { timeoutMs?: number };
  policyId: string;
  policyVersion: "1";
};

export type PolicyDocument = {
  spec: "anytool-policy";
  specVersion: "1";
  policyId: string;
  issuedAt: string;
  environment: "sandbox" | "staging" | "production";
  timeoutMs?: number;
  maxMemoryMb?: number;
  kinds: Partial<Record<CoreKind, Record<string, unknown>>>;
};

export function isCoreKind(value: string): value is CoreKind {
  return (CORE_KINDS as readonly string[]).includes(value);
}
