/* eslint-disable */
/** GENERATED from rfc/schemas — do not edit by hand. RFC-0001/0002/0003 are normative. */

export interface AnyToolCommandAst {
  protocol: "anytool-v1";
  module:
    | "fs"
    | "net"
    | "db"
    | "payment"
    | "os"
    | "shell"
    | "wasm"
    | "event"
    | "auth"
    | "crypto"
    | "secret"
    | "logger"
    | "email"
    | "sms";
  action: string;
  target: string;
  arguments: {};
  constraints?: {
    timeoutMs?: number;
  };
  policyId: string;
  policyVersion: "1";
}
