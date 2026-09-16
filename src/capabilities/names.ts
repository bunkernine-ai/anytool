import type { CoreKind } from "../kinds.js";

export const KIND_TO_SDK: Record<CoreKind, string> = {
  fs: "files",
  net: "http",
  db: "db",
  payment: "payment",
  os: "os",
  shell: "shell",
  wasm: "wasm",
  event: "events",
  auth: "auth",
  crypto: "crypto",
  secret: "secrets",
  logger: "logger",
  email: "email",
  sms: "sms",
};

export function sdkNameFor(kind: CoreKind): string {
  return KIND_TO_SDK[kind];
}
