import { sdkNameFor } from "./capabilities/names.js";
import type { Driver } from "./drivers/define.js";
import type { CoreKind, PolicyDocument } from "./kinds.js";

export function injectFragment(policy: PolicyDocument, drivers: Driver[]): string {
  const names = drivers.map((d) => sdkNameFor(d.kind)).join(", ");
  const lines: string[] = [
    "AnyTool is bound. Pass generated code and optional input. You MUST NOT write SQL, shell strings, Stripe payloads, or Node builtins.",
    `policyId: ${policy.policyId}`,
    `environment: ${policy.environment}`,
    `Injected capability SDKs: ${names || "(none)"}.`,
    "The host context owns the backend (disk, Postgres, Stripe, Twilio). Agent code only calls <sdk>.execute(command).",
    "Each execute is policy-checked, then handed to the bound driver. Multiple execute calls in one function are allowed.",
    "Unknown actions are denied. Unbound SDKs are not in the VM.",
    "",
  ];
  for (const d of drivers) {
    const slice = policy.kinds[d.kind];
    if (!slice) continue;
    const snapshot = redact(slice);
    const sdk = sdkNameFor(d.kind);
    lines.push(`## ${sdk} (kind ${d.kind}, driver ${d.id})`);
    lines.push("policy snapshot:");
    lines.push(JSON.stringify(snapshot, null, 2));
    lines.push("command shape:");
    lines.push(exampleFor(d.kind));
    lines.push("");
  }
  return lines.join("\n");
}

function redact(slice: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...slice };
  for (const key of Object.keys(out)) {
    if (/secret|key|token|password/i.test(key)) delete out[key];
  }
  return out;
}

function exampleFor(kind: CoreKind): string {
  const sdk = sdkNameFor(kind);
  const examples: Record<CoreKind, string> = {
    fs: `await ${sdk}.execute({ action: "write", path: "/workspace/out.json", body: {} })`,
    net: `await ${sdk}.execute({ action: "request", host: "api.example.com", path: "/", method: "GET" })`,
    db: `await ${sdk}.execute({ action: "find", table: "customers", where: { country: "BD" }, limit: 100 })`,
    payment: `await ${sdk}.execute({ action: "charge", amountCents: 100, currency: "usd", purpose: "invoice", invoiceId: "inv_1" })`,
    os: `await ${sdk}.execute({ action: "metrics" })`,
    shell: `await ${sdk}.execute({ action: "run", argv: ["echo", "hi"], cwd: "/workspace" })`,
    wasm: `await ${sdk}.execute({ action: "invoke", moduleId: "sum", export: "main", args: [1, 2] })`,
    event: `await ${sdk}.execute({ action: "emit", key: "tick", data: 1 })`,
    auth: `await ${sdk}.execute({ action: "whoami" })`,
    crypto: `await ${sdk}.execute({ action: "hash", algorithm: "sha256", data: "a" })`,
    secret: `await ${sdk}.execute({ action: "use", name: "API_KEY", purpose: "charge" })`,
    logger: `await ${sdk}.execute({ action: "info", event: "ok" })`,
    email: `await ${sdk}.execute({ action: "send", to: "a@example.com", templateId: "welcome", vars: {} })`,
    sms: `await ${sdk}.execute({ action: "send", to: "+1555", templateId: "otp", vars: {} })`,
  };
  return examples[kind];
}

export const intentJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["code"],
  properties: {
    code: { type: "string" },
    input: {},
  },
} as const;
