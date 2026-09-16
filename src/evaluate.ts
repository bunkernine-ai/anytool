import path from "node:path";
import { PolicyDenied } from "./errors";
import type { CoreKind, PolicyDocument, StrongIntent } from "./kinds";

function listed(allow: unknown): string[] {
  return Array.isArray(allow) ? allow.map(String) : [];
}

export function isPathInsideRoot(targetPath: string, allowedRoots: string[]): boolean {
  const resolvedTarget = path.resolve(targetPath);
  for (const root of allowedRoots) {
    const resolvedRoot = path.resolve(root);
    const relative = path.relative(resolvedRoot, resolvedTarget);
    if (relative === "") return true;
    if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) return true;
  }
  return false;
}

function hostAllowed(host: string, patterns: string[]): boolean {
  const h = host.toLowerCase();
  for (const p of patterns) {
    const pat = p.toLowerCase();
    if (pat.startsWith("*.") && h.endsWith(pat.slice(1)) && h.split(".").length === pat.split(".").length) {
      return true;
    }
    if (h === pat) return true;
  }
  return false;
}

function recipientAllowed(to: string, patterns: string[]): boolean {
  const t = to.toLowerCase();
  for (const p of patterns) {
    const pat = p.toLowerCase();
    if (pat.startsWith("*@") && t.endsWith(pat.slice(1))) return true;
    if (t === pat) return true;
  }
  return false;
}

function whereNonEmpty(where: unknown): boolean {
  return Boolean(where && typeof where === "object" && Object.keys(where as object).length > 0);
}

function slice(policy: PolicyDocument, kind: CoreKind): Record<string, unknown> {
  const s = policy.kinds[kind];
  if (!s) throw new PolicyDenied(`kind ${kind} is not in RFC-0001 policy`, { kind });
  return s;
}

/** RFC-0001 evaluation. Ambiguous → deny. Shared by all bindings; drivers MUST NOT reimplement. */
export function evaluateIntent(policy: PolicyDocument, intent: StrongIntent): void {
  const k = intent.channel;
  const s = slice(policy, k);
  const action = intent.action;

  if (k === "fs") {
    const roots = listed(s.allowedRoots);
    if (roots.length === 0) throw new PolicyDenied("fs allowedRoots is empty");
    const p = String(intent.path ?? "");
    if (!isPathInsideRoot(p, roots)) throw new PolicyDenied("fs path outside allowedRoots", { path: p });
    const blocked = listed(s.blockedExtensions);
    const lower = p.toLowerCase();
    if (blocked.some((ext) => lower.endsWith(ext.toLowerCase()))) {
      throw new PolicyDenied("fs blocked extension", { path: p });
    }
    if (action === "write" || action === "remove") {
      const ro = listed(s.readOnlyPaths);
      if (ro.some((r) => isPathInsideRoot(p, [r]))) throw new PolicyDenied("fs path is read-only", { path: p });
    }
    if (action === "write") {
      const max = Number(s.maxFileSizeBytes);
      const body = intent.body;
      const size = typeof body === "string" ? Buffer.byteLength(body) : Buffer.byteLength(JSON.stringify(body ?? ""));
      if (size > max) throw new PolicyDenied("fs write exceeds maxFileSizeBytes");
    }
    return;
  }

  if (k === "net") {
    const hosts = listed(s.allowedHosts);
    if (hosts.length === 0) throw new PolicyDenied("net allowedHosts is empty");
    const host = String(intent.host ?? "");
    if (!hostAllowed(host, hosts)) throw new PolicyDenied("net host not allowed", { host });
    const port = intent.port === undefined ? (intent.method === "GET" ? 443 : 443) : Number(intent.port);
    const blocked = (s.blockedPorts as number[] | undefined) ?? [];
    if (blocked.includes(port)) throw new PolicyDenied("net port blocked", { port });
    const body = intent.body;
    if (body !== undefined) {
      const size = Buffer.byteLength(JSON.stringify(body));
      if (size > Number(s.maxPayloadSizeBytes)) throw new PolicyDenied("net payload too large");
    }
    return;
  }

  if (k === "db") {
    const tables = listed(s.allowedTables);
    const actions = listed(s.allowedActions);
    if (tables.length === 0) throw new PolicyDenied("db allowedTables is empty");
    if (actions.length === 0) throw new PolicyDenied("db allowedActions is empty");
    const table = String(intent.table ?? "");
    if (!tables.includes(table)) throw new PolicyDenied("db table not allowed", { table });
    if (!actions.includes(action)) throw new PolicyDenied("db action not allowed", { action });
    const requireWhere = s.requireWhere !== false;
    if (requireWhere && (action === "update" || action === "remove") && !whereNonEmpty(intent.where)) {
      throw new PolicyDenied("db mutation requires where");
    }
    const limit = intent.limit === undefined ? 1 : Number(intent.limit);
    if (action !== "find" && limit > Number(s.mutationLimitRows)) {
      throw new PolicyDenied("db mutationLimitRows exceeded");
    }
    return;
  }

  if (k === "payment") {
    const max = Number(s.maxAmountCents);
    if (!Number.isFinite(max)) throw new PolicyDenied("payment maxAmountCents missing");
    const amount = Number(intent.amountCents);
    if (!Number.isFinite(amount) || amount > max) throw new PolicyDenied("payment amount exceeds cap", { amount, max });
    const currencies = listed(s.allowedCurrencies);
    const purposes = listed(s.allowedPurposes);
    if (currencies.length === 0) throw new PolicyDenied("payment allowedCurrencies is empty");
    if (purposes.length === 0) throw new PolicyDenied("payment allowedPurposes is empty");
    const cur = String(intent.currency).toLowerCase();
    if (!currencies.map((c) => c.toLowerCase()).includes(cur)) {
      throw new PolicyDenied("payment currency not allowed");
    }
    if (!purposes.includes(String(intent.purpose))) throw new PolicyDenied("payment purpose not allowed");
    if (!s.merchantId) throw new PolicyDenied("payment merchantId missing");
    return;
  }

  if (k === "os") {
    if (action === "metrics" && s.allowMetrics !== true) throw new PolicyDenied("os metrics denied");
    if (action === "constraints" && s.allowConstraints !== true) throw new PolicyDenied("os constraints denied");
    return;
  }

  if (k === "shell") {
    const bins = listed(s.allowedBinaries);
    if (bins.length === 0) throw new PolicyDenied("shell allowedBinaries is empty");
    const argv = intent.argv as string[] | undefined;
    if (!argv?.[0] || !bins.includes(argv[0])) throw new PolicyDenied("shell binary not allowed");
    if (typeof argv[0] === "string" && /[;&|`$<>]/.test(argv.join(" "))) {
      throw new PolicyDenied("shell metacharacters denied");
    }
    const cwds = listed(s.allowedCwds);
    if (intent.cwd) {
      if (cwds.length === 0 || !isPathInsideRoot(String(intent.cwd), cwds)) {
        throw new PolicyDenied("shell cwd not allowed");
      }
    }
    return;
  }

  if (k === "wasm") {
    const mods = listed(s.allowedModules);
    if (mods.length === 0) throw new PolicyDenied("wasm allowedModules is empty");
    if (!mods.includes(String(intent.moduleId))) throw new PolicyDenied("wasm module not allowed");
    return;
  }

  if (k === "event") {
    const keys = listed(s.allowedKeys);
    if (keys.length === 0) throw new PolicyDenied("event allowedKeys is empty");
    if (!keys.includes(String(intent.key))) throw new PolicyDenied("event key not allowed");
    return;
  }

  if (k === "auth") {
    if (action === "whoami" && s.allowWhoami !== true) throw new PolicyDenied("auth whoami denied");
    if (action === "assert") {
      const roles = listed(s.allowedAssertRoles);
      if (roles.length === 0 || !roles.includes(String(intent.role))) throw new PolicyDenied("auth assert denied");
    }
    return;
  }

  if (k === "crypto") {
    if (action === "random") {
      if (s.allowRandom !== true) throw new PolicyDenied("crypto random denied");
      return;
    }
    const algs = listed(s.allowedAlgorithms);
    if (algs.length === 0 || !algs.includes(String(intent.algorithm))) {
      throw new PolicyDenied("crypto algorithm not allowed");
    }
    return;
  }

  if (k === "secret") {
    const names = listed(s.allowedNames);
    const purposes = listed(s.allowedPurposes);
    if (names.length === 0 || !names.includes(String(intent.name))) throw new PolicyDenied("secret name not allowed");
    if (purposes.length === 0 || !purposes.includes(String(intent.purpose))) {
      throw new PolicyDenied("secret purpose not allowed");
    }
    return;
  }

  if (k === "logger") {
    const levels = listed(s.allowedLevels);
    if (levels.length === 0 || !levels.includes(action)) throw new PolicyDenied("logger level not allowed");
    const data = intent.data ?? {};
    const size = Buffer.byteLength(JSON.stringify(data));
    if (size > Number(s.maxPayloadBytes)) throw new PolicyDenied("logger payload too large");
    return;
  }

  if (k === "email" || k === "sms") {
    const recips = listed(s.allowedRecipients);
    const templates = listed(s.allowedTemplateIds);
    if (recips.length === 0) throw new PolicyDenied(`${k} allowedRecipients is empty`);
    if (templates.length === 0) throw new PolicyDenied(`${k} allowedTemplateIds is empty`);
    if (!recipientAllowed(String(intent.to), recips)) throw new PolicyDenied(`${k} recipient not allowed`);
    if (!templates.includes(String(intent.templateId))) throw new PolicyDenied(`${k} template not allowed`);
    return;
  }

  throw new PolicyDenied("unknown channel");
}

export function intentDoesNotEscalate(declared: StrongIntent, actual: StrongIntent): void {
  if (actual.channel !== declared.channel || actual.action !== declared.action) {
    throw new PolicyDenied("code escalated channel or action", { declared, actual });
  }
  if (declared.channel === "payment") {
    if (Number(actual.amountCents) > Number(declared.amountCents)) {
      throw new PolicyDenied("code escalated payment amount");
    }
    if (actual.currency !== declared.currency || actual.purpose !== declared.purpose) {
      throw new PolicyDenied("code changed payment currency or purpose");
    }
    if (declared.invoiceId && actual.invoiceId !== declared.invoiceId) {
      throw new PolicyDenied("code changed invoiceId");
    }
  }
  if (declared.channel === "fs" && String(actual.path) !== String(declared.path)) {
    throw new PolicyDenied("code changed fs path");
  }
  if (declared.channel === "db") {
    if (actual.table !== declared.table) throw new PolicyDenied("code changed db table");
  }
  if (declared.channel === "shell") {
    const a = (actual.argv as string[]) ?? [];
    const d = (declared.argv as string[]) ?? [];
    if (a[0] !== d[0]) throw new PolicyDenied("code changed shell binary");
  }
  if (declared.channel === "net" && actual.host !== declared.host) {
    throw new PolicyDenied("code changed net host");
  }
}
