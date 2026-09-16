import * as acorn from "acorn";
import vm from "node:vm";
import type { Capability } from "./capabilities/create.js";
import { PolicyDenied } from "./errors.js";

const BANNED = new Set([
  "eval",
  "Function",
  "require",
  "process",
  "global",
  "globalThis",
  "Buffer",
  "Deno",
  "Bun",
  "XMLHttpRequest",
  "WebAssembly",
  "fetch",
  "Atomics",
  "SharedArrayBuffer",
  "child_process",
  "worker_threads",
  "importScripts",
  "module",
  "exports",
  "__dirname",
  "__filename",
]);

const SQL_RE = /\b(drop|alter|truncate|union\s+select|insert\s+into|delete\s+from)\b/i;

function walk(node: { type: string; [k: string]: unknown }, visit: (n: { type: string; [k: string]: unknown }) => void): void {
  visit(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && typeof (item as { type?: unknown }).type === "string") {
          walk(item as { type: string; [k: string]: unknown }, visit);
        }
      }
    } else if (value && typeof value === "object" && typeof (value as { type?: unknown }).type === "string") {
      walk(value as { type: string; [k: string]: unknown }, visit);
    }
  }
}

export function staticGuard(code: string): void {
  if (code.includes("import(") || /^\s*import\s/m.test(code)) {
    throw new PolicyDenied("static guard: import is not allowed");
  }
  let ast: acorn.Node;
  try {
    ast = acorn.parse(wrapUserCode(code), {
      ecmaVersion: "latest",
      sourceType: "script",
      allowAwaitOutsideFunction: true,
    });
  } catch {
    throw new PolicyDenied("static guard: code is not parseable JavaScript");
  }
  walk(ast as unknown as { type: string; [k: string]: unknown }, (n) => {
    if (n.type === "Identifier" && BANNED.has(String(n.name))) {
      throw new PolicyDenied(`static guard: banned identifier ${String(n.name)}`);
    }
    if (n.type === "MemberExpression") {
      const obj = n.object as { type?: string; name?: string };
      if (obj?.type === "Identifier" && obj.name && BANNED.has(obj.name)) {
        throw new PolicyDenied(`static guard: banned member ${obj.name}`);
      }
    }
    if (n.type === "Literal" && typeof n.value === "string" && SQL_RE.test(n.value)) {
      throw new PolicyDenied("static guard: SQL-like string is not an intent");
    }
    if (n.type === "CallExpression") {
      const callee = n.callee as { type?: string; name?: string };
      if (callee?.type === "Identifier" && callee.name === "eval") {
        throw new PolicyDenied("static guard: eval");
      }
    }
  });
}

function wrapUserCode(code: string): string {
  const trimmed = code.trim();
  if (trimmed.startsWith("async function") || trimmed.startsWith("function") || trimmed.startsWith("(")) {
    return `async function __fn(input) {
  const __user = (${trimmed});
  return await __user(input);
}`;
  }
  return `async function __fn(input) {\n${code}\n}`;
}

export async function runIsolated(opts: {
  code: string;
  input: unknown;
  timeoutMs: number;
  capabilities: Record<string, Capability>;
}): Promise<unknown> {
  staticGuard(opts.code);
  const sandbox: Record<string, unknown> = {
    input: opts.input,
    console: { log() {}, warn() {}, error() {}, info() {} },
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    Date,
    Error,
    Promise,
    Uint8Array,
  };
  for (const [name, cap] of Object.entries(opts.capabilities)) {
    sandbox[name] = Object.freeze({ execute: (command: unknown) => cap.execute(command) });
  }
  vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  const wrapped = `"use strict";
(async () => {
  ${wrapUserCode(opts.code)}
  return await __fn(input);
})()`;
  const script = new vm.Script(wrapped, { filename: "anytool-isolate.js" });
  const result = script.runInContext(sandbox, { timeout: opts.timeoutMs });
  return await result;
}
