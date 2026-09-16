import { describe, expect, it } from "vitest";
import {
  authDriver,
  createAnyTool,
  cryptoDriver,
  defineDriver,
  eventDriver,
  loggerDriver,
  memoryFs,
  messageDriver,
  osDriver,
  secretDriver,
  shellDriver,
  wasmDriver,
  type CommandAst,
} from "../src/index.ts";

const basePolicy = {
  spec: "anytool-policy" as const,
  specVersion: "1" as const,
  policyId: "kinds",
  issuedAt: "2026-09-16T12:00:00Z",
  environment: "sandbox" as const,
  timeoutMs: 5000,
  kinds: {
    fs: { allowedRoots: ["/workspace"], maxFileSizeBytes: 10000, blockedExtensions: [], readOnlyPaths: [] },
    os: { allowMetrics: true, allowConstraints: true },
    event: { allowedKeys: ["tick"] },
    auth: { allowWhoami: true, allowedAssertRoles: ["user"] },
    crypto: { allowedAlgorithms: ["sha256"], allowRandom: true },
    secret: { allowedNames: ["STRIPE_KEY"], allowedPurposes: ["charge"] },
    logger: { allowedLevels: ["info"], maxPayloadBytes: 1000, redactKeys: ["token"] },
    email: { allowedRecipients: ["*@example.com"], allowedTemplateIds: ["welcome"] },
    sms: { allowedRecipients: ["+1555"], allowedTemplateIds: ["otp"] },
    shell: { allowedBinaries: ["echo"], allowedCwds: ["/workspace"] },
    wasm: { allowedModules: ["sum"] },
  },
};

describe("builtin kinds", () => {
  it("runs os, event, auth, crypto, secret, logger, email, sms, shell, wasm", async () => {
    const emails: unknown[] = [];
    const at = createAnyTool({
      policy: basePolicy,
      drivers: [
        memoryFs("/workspace"),
        osDriver(basePolicy),
        eventDriver(),
        authDriver(),
        cryptoDriver(),
        secretDriver({ STRIPE_KEY: "never-returned" }),
        loggerDriver(),
        messageDriver("email", emails),
        messageDriver("sms"),
        shellDriver(async (argv) => ({ argv })),
        wasmDriver({ sum: (a, b) => Number(a) + Number(b) }),
      ],
    });

    const osOut = await at.run({
      code: `return os.execute({ action: "metrics" });`,
    });
    expect(osOut.ast?.action).toBe("METRICS");

    await at.run({
      code: `return events.execute({ action: "emit", key: "tick", data: 1 });`,
    });

    await at.run({
      code: `return auth.execute({ action: "whoami" });`,
    });

    const hash = await at.run({
      code: `return crypto.execute({ action: "hash", algorithm: "sha256", data: "a" });`,
    });
    expect(String(hash.data)).toHaveLength(64);

    const secret = await at.run({
      code: `return secrets.execute({ action: "use", name: "STRIPE_KEY", purpose: "charge" });`,
    });
    expect(secret.data).toMatchObject({ ref: "secret:STRIPE_KEY" });
    expect(JSON.stringify(secret.data)).not.toContain("never-returned");

    await at.run({
      code: `return logger.execute({ action: "info", event: "ok", data: { token: "leak" } });`,
    });
    expect((at.auditLog.at(-1) as { allowed: boolean }).allowed).toBe(true);

    const mail = await at.run({
      code: `return email.execute({ action: "send", to: "a@example.com", templateId: "welcome", vars: {} });`,
    });
    expect(mail.data).toMatchObject({ to: "a@example.com" });

    await at.run({
      code: `return sms.execute({ action: "send", to: "+1555", templateId: "otp", vars: {} });`,
    });

    await at.run({
      code: `return shell.execute({ action: "run", argv: ["echo", "hi"], cwd: "/workspace" });`,
    });

    const wasm = await at.run({
      code: `return wasm.execute({ action: "invoke", moduleId: "sum", export: "main", args: [1, 2] });`,
    });
    expect(wasm.data).toBe(3);
  });

  it("compliance: handmade AST cannot be passed as execute command", async () => {
    const at = createAnyTool({
      policy: basePolicy,
      drivers: [memoryFs("/workspace")],
    });
    await expect(
      at.run({
        code: `return files.execute({
          protocol: "anytool-v1",
          module: "fs",
          action: "WRITE",
          target: "/etc/passwd",
          arguments: {},
        });`,
      }),
    ).rejects.toThrow();
  });

  it("defineDriver requires a core kind", () => {
    const d = defineDriver({
      kind: "fs",
      id: "community-fs",
      async execute(_ast: CommandAst) {
        return { ok: true, data: 1 };
      },
    });
    expect(d.kind).toBe("fs");
    expect(d.id).toBe("community-fs");
  });
});
