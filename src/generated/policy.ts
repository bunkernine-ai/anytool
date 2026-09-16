/* eslint-disable */
/** GENERATED from rfc/schemas — do not edit by hand. RFC-0001/0002/0003 are normative. */

export interface AnyToolPolicyDocument {
  spec: "anytool-policy";
  specVersion: "1";
  policyId: string;
  issuedAt: string;
  environment: "sandbox" | "staging" | "production";
  timeoutMs?: number;
  maxMemoryMb?: number;
  kinds: {
    fs?: Fs;
    net?: Net;
    db?: Db;
    payment?: Payment;
    os?: Os;
    shell?: Shell;
    wasm?: Wasm;
    event?: Event;
    auth?: Auth;
    crypto?: Crypto;
    secret?: Secret;
    logger?: Logger;
    email?: Message;
    sms?: Message;
  };
}
export interface Fs {
  allowedRoots: string[];
  blockedExtensions?: string[];
  readOnlyPaths?: string[];
  maxFileSizeBytes: number;
}
export interface Net {
  allowedHosts: string[];
  blockedPorts?: number[];
  maxPayloadSizeBytes: number;
}
export interface Db {
  allowedTables: string[];
  allowedActions: ("find" | "insert" | "update" | "remove")[];
  mutationLimitRows: number;
  requireWhere?: boolean;
}
export interface Payment {
  maxAmountCents: number;
  allowedCurrencies: string[];
  allowedPurposes: string[];
  merchantId: string;
}
export interface Os {
  allowMetrics?: boolean;
  allowConstraints?: boolean;
}
export interface Shell {
  allowedBinaries: string[];
  allowedCwds?: string[];
  timeoutMs?: number;
}
export interface Wasm {
  allowedModules: string[];
  maxFuel?: number;
  maxMemoryPages?: number;
}
export interface Event {
  allowedKeys: string[];
}
export interface Auth {
  allowWhoami?: boolean;
  allowedAssertRoles?: string[];
}
export interface Crypto {
  allowedAlgorithms: string[];
  allowRandom?: boolean;
}
export interface Secret {
  allowedNames: string[];
  allowedPurposes: string[];
}
export interface Logger {
  allowedLevels: ("debug" | "info" | "warn" | "error")[];
  maxPayloadBytes: number;
  redactKeys?: string[];
}
export interface Message {
  allowedRecipients: string[];
  allowedTemplateIds: string[];
  maxPerMinute?: number;
}
